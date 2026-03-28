from __future__ import annotations

import json
import os
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

try:
    import redis  # type: ignore[import]
except Exception:  # pragma: no cover
    redis = None  # type: ignore[assignment]


@dataclass
class RepositoryRecord:
    repo_id: str
    user_id: str
    repo_url: str
    owner: str
    name: str
    clone_url: str
    local_path: str = ""
    status: str = "queued"
    total_files: int = 0
    files_parsed: int = 0
    current_file: str = ""
    error: Optional[str] = None
    celery_task_id: Optional[str] = None
    created_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    updated_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "repo_id": self.repo_id,
            "user_id": self.user_id,
            "repo_url": self.repo_url,
            "owner": self.owner,
            "name": self.name,
            "clone_url": self.clone_url,
            "local_path": self.local_path,
            "status": self.status,
            "total_files": self.total_files,
            "files_parsed": self.files_parsed,
            "current_file": self.current_file,
            "error": self.error,
            "celery_task_id": self.celery_task_id,
            "created_at_ms": self.created_at_ms,
            "updated_at_ms": self.updated_at_ms,
        }


class GitHubStore:
    """
    Redis-aware persistence with in-memory fallback for GitHub analysis state.
    """

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._repos: Dict[str, RepositoryRecord] = {}
        self._oauth_state_by_token: Dict[str, Dict[str, Any]] = {}
        self._encrypted_tokens: Dict[str, str] = {}
        self._analysis_payloads: Dict[str, Dict[str, Any]] = {}
        self._cancel_flags: Dict[str, bool] = {}

        self._redis = None
        redis_url = os.getenv("CODEFLOWX_REDIS_URL") or os.getenv("REDIS_URL")
        if redis_url and redis is not None:
            try:
                self._redis = redis.Redis.from_url(redis_url, decode_responses=True)
                self._redis.ping()
            except Exception:
                self._redis = None

    def _repo_key(self, repo_id: str) -> str:
        return f"codeflowx:github:repo:{repo_id}"

    def _progress_key(self, repo_id: str) -> str:
        return f"codeflowx:github:progress:{repo_id}"

    def _token_key(self, user_id: str) -> str:
        return f"codeflowx:github:token:{user_id}"

    def _oauth_state_key(self, state: str) -> str:
        return f"codeflowx:github:oauth_state:{state}"

    def _analysis_key(self, repo_id: str) -> str:
        return f"codeflowx:github:analysis:{repo_id}"

    def _cancel_key(self, repo_id: str) -> str:
        return f"codeflowx:github:cancel:{repo_id}"

    def create_oauth_state(self, user_id: str, ttl_seconds: int = 600) -> str:
        token = str(uuid.uuid4())
        expires_at = time.time() + float(ttl_seconds)
        payload = {"user_id": user_id, "expires_at": expires_at}

        with self._lock:
            self._oauth_state_by_token[token] = payload

        if self._redis is not None:
            try:
                self._redis.setex(self._oauth_state_key(token), ttl_seconds, json.dumps(payload))
            except Exception:
                pass

        return token

    def pop_oauth_state(self, state: str) -> Optional[str]:
        state = str(state or "").strip()
        if not state:
            return None

        payload: Optional[Dict[str, Any]] = None

        with self._lock:
            payload = self._oauth_state_by_token.pop(state, None)

        if payload is None and self._redis is not None:
            try:
                raw = self._redis.get(self._oauth_state_key(state))
                self._redis.delete(self._oauth_state_key(state))
                if raw:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        payload = parsed
            except Exception:
                payload = payload or None

        if not payload:
            return None

        if float(payload.get("expires_at", 0)) <= time.time():
            return None

        user_id = str(payload.get("user_id", "")).strip()
        return user_id or None

    def set_encrypted_token(self, user_id: str, encrypted_token: str) -> None:
        with self._lock:
            self._encrypted_tokens[user_id] = encrypted_token

        if self._redis is not None:
            try:
                self._redis.set(self._token_key(user_id), encrypted_token)
            except Exception:
                pass

    def get_encrypted_token(self, user_id: str) -> Optional[str]:
        with self._lock:
            token = self._encrypted_tokens.get(user_id)
        if token:
            return token

        if self._redis is not None:
            try:
                token = self._redis.get(self._token_key(user_id))
                if token:
                    with self._lock:
                        self._encrypted_tokens[user_id] = token
                    return token
            except Exception:
                return None
        return None

    def create_repo(
        self,
        *,
        user_id: str,
        repo_url: str,
        owner: str,
        name: str,
        clone_url: str,
    ) -> RepositoryRecord:
        repo_id = str(uuid.uuid4())
        record = RepositoryRecord(
            repo_id=repo_id,
            user_id=user_id,
            repo_url=repo_url,
            owner=owner,
            name=name,
            clone_url=clone_url,
        )

        with self._lock:
            self._repos[repo_id] = record

        self._persist_repo(record)
        self.set_progress(
            repo_id,
            {
                "status": "queued",
                "total_files": 0,
                "files_parsed": 0,
                "current_file": "",
                "error": None,
                "updated_at_ms": int(time.time() * 1000),
            },
        )
        return record

    def _persist_repo(self, record: RepositoryRecord) -> None:
        if self._redis is None:
            return
        try:
            self._redis.set(self._repo_key(record.repo_id), json.dumps(record.to_dict()))
        except Exception:
            pass

    def get_repo(self, repo_id: str) -> Optional[RepositoryRecord]:
        with self._lock:
            record = self._repos.get(repo_id)
        if record:
            return record

        if self._redis is not None:
            try:
                raw = self._redis.get(self._repo_key(repo_id))
                if raw:
                    payload = json.loads(raw)
                    if isinstance(payload, dict):
                        hydrated = RepositoryRecord(
                            repo_id=str(payload.get("repo_id", repo_id)),
                            user_id=str(payload.get("user_id", "")),
                            repo_url=str(payload.get("repo_url", "")),
                            owner=str(payload.get("owner", "")),
                            name=str(payload.get("name", "")),
                            clone_url=str(payload.get("clone_url", "")),
                            local_path=str(payload.get("local_path", "")),
                            status=str(payload.get("status", "queued")),
                            total_files=int(payload.get("total_files", 0) or 0),
                            files_parsed=int(payload.get("files_parsed", 0) or 0),
                            current_file=str(payload.get("current_file", "")),
                            error=payload.get("error"),
                            celery_task_id=payload.get("celery_task_id"),
                            created_at_ms=int(payload.get("created_at_ms", int(time.time() * 1000))),
                            updated_at_ms=int(payload.get("updated_at_ms", int(time.time() * 1000))),
                        )
                        with self._lock:
                            self._repos[repo_id] = hydrated
                        return hydrated
            except Exception:
                return None

        return None

    def verify_repo_owner(self, repo_id: str, user_id: str) -> bool:
        record = self.get_repo(repo_id)
        if not record:
            return False
        return record.user_id == user_id

    def update_repo(self, repo_id: str, **updates: Any) -> Optional[RepositoryRecord]:
        with self._lock:
            record = self._repos.get(repo_id)
            if not record:
                record = self.get_repo(repo_id)
            if not record:
                return None

            for key, value in updates.items():
                if hasattr(record, key):
                    setattr(record, key, value)
            record.updated_at_ms = int(time.time() * 1000)
            self._repos[repo_id] = record

        self._persist_repo(record)
        return record

    def set_progress(self, repo_id: str, payload: Dict[str, Any]) -> None:
        payload = {
            "status": str(payload.get("status", "queued")),
            "total_files": int(payload.get("total_files", 0) or 0),
            "files_parsed": int(payload.get("files_parsed", 0) or 0),
            "current_file": str(payload.get("current_file", "")),
            "error": payload.get("error"),
            "updated_at_ms": int(payload.get("updated_at_ms", int(time.time() * 1000))),
        }

        if self._redis is not None:
            try:
                self._redis.set(self._progress_key(repo_id), json.dumps(payload))
            except Exception:
                pass

        self.update_repo(
            repo_id,
            status=payload["status"],
            total_files=payload["total_files"],
            files_parsed=payload["files_parsed"],
            current_file=payload["current_file"],
            error=payload.get("error"),
        )

    def get_progress(self, repo_id: str) -> Dict[str, Any]:
        if self._redis is not None:
            try:
                raw = self._redis.get(self._progress_key(repo_id))
                if raw:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        return parsed
            except Exception:
                pass

        record = self.get_repo(repo_id)
        if not record:
            return {
                "status": "unknown",
                "total_files": 0,
                "files_parsed": 0,
                "current_file": "",
                "error": "Repository not found",
                "updated_at_ms": int(time.time() * 1000),
            }
        return {
            "status": record.status,
            "total_files": record.total_files,
            "files_parsed": record.files_parsed,
            "current_file": record.current_file,
            "error": record.error,
            "updated_at_ms": record.updated_at_ms,
        }

    def set_analysis_payload(self, repo_id: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            self._analysis_payloads[repo_id] = payload

        if self._redis is not None:
            try:
                self._redis.set(self._analysis_key(repo_id), json.dumps(payload))
            except Exception:
                pass

    def get_analysis_payload(self, repo_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            payload = self._analysis_payloads.get(repo_id)
        if payload is not None:
            return payload

        if self._redis is not None:
            try:
                raw = self._redis.get(self._analysis_key(repo_id))
                if raw:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        with self._lock:
                            self._analysis_payloads[repo_id] = parsed
                        return parsed
            except Exception:
                return None
        return None

    def mark_cancel_requested(self, repo_id: str) -> None:
        with self._lock:
            self._cancel_flags[repo_id] = True
        if self._redis is not None:
            try:
                self._redis.set(self._cancel_key(repo_id), "1")
            except Exception:
                pass

    def clear_cancel_requested(self, repo_id: str) -> None:
        with self._lock:
            self._cancel_flags.pop(repo_id, None)
        if self._redis is not None:
            try:
                self._redis.delete(self._cancel_key(repo_id))
            except Exception:
                pass

    def is_cancel_requested(self, repo_id: str) -> bool:
        with self._lock:
            if self._cancel_flags.get(repo_id):
                return True

        if self._redis is not None:
            try:
                raw = self._redis.get(self._cancel_key(repo_id))
                return str(raw or "") == "1"
            except Exception:
                return False
        return False


GITHUB_STORE = GitHubStore()


def get_github_store() -> GitHubStore:
    return GITHUB_STORE
