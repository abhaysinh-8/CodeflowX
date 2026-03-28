from __future__ import annotations

import asyncio
import copy
import json
import os
import time
from dataclasses import dataclass, field
from typing import Any, AsyncGenerator, Dict, List, Optional


class ExplanationCache:
    """
    Redis-backed explain result cache with in-memory fallback.
    """

    def __init__(self, ttl_seconds: int = 3600):
        self.ttl_seconds = max(60, int(ttl_seconds))
        self._memory: Dict[str, tuple[float, Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()

        self._redis = None
        redis_url = os.getenv("CODEFLOWX_REDIS_URL") or os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis.asyncio as redis_async  # type: ignore[import]

                self._redis = redis_async.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        if self._redis is not None:
            try:
                raw = await self._redis.get(key)
                if raw:
                    payload = json.loads(raw)
                    if isinstance(payload, dict):
                        return payload
            except Exception:
                self._redis = None

        async with self._lock:
            self._cleanup_memory_locked()
            entry = self._memory.get(key)
            if not entry:
                return None
            return copy.deepcopy(entry[1])

    async def set(
        self,
        key: str,
        payload: Dict[str, Any],
        ttl_seconds: Optional[int] = None,
    ) -> None:
        ttl = max(60, int(ttl_seconds or self.ttl_seconds))
        if self._redis is not None:
            try:
                await self._redis.setex(key, ttl, json.dumps(payload))
            except Exception:
                self._redis = None

        async with self._lock:
            self._memory[key] = (time.time() + float(ttl), copy.deepcopy(payload))
            self._cleanup_memory_locked()

    def _cleanup_memory_locked(self) -> None:
        now = time.time()
        stale_keys = [key for key, (expires_at, _) in self._memory.items() if expires_at <= now]
        for key in stale_keys:
            self._memory.pop(key, None)


@dataclass
class _ExplanationJob:
    job_id: str
    user_id: str
    explain_type: str
    target_id: str
    status: str = "queued"
    created_at_ms: int = field(default_factory=lambda: int(time.time() * 1000))
    cache_hit: bool = False
    events: List[Dict[str, Any]] = field(default_factory=list)
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)


class ExplanationJobStore:
    """
    In-memory explain job state + stream event store.
    """

    TERMINAL_STATES = {"completed", "error"}

    def __init__(self, ttl_seconds: int = 3600):
        self.ttl_seconds = max(60, int(ttl_seconds))
        self._jobs: Dict[str, _ExplanationJob] = {}
        self._lock = asyncio.Lock()

    async def create_job(
        self,
        *,
        job_id: str,
        user_id: str,
        explain_type: str,
        target_id: str,
    ) -> None:
        async with self._lock:
            self._cleanup_locked()
            self._jobs[job_id] = _ExplanationJob(
                job_id=job_id,
                user_id=user_id,
                explain_type=explain_type,
                target_id=target_id,
            )

    async def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            self._cleanup_locked()
            job = self._jobs.get(job_id)
            if not job:
                return None
            return {
                "job_id": job.job_id,
                "user_id": job.user_id,
                "explain_type": job.explain_type,
                "target_id": job.target_id,
                "status": job.status,
                "created_at_ms": job.created_at_ms,
                "cache_hit": job.cache_hit,
                "events_count": len(job.events),
            }

    async def mark_running(self, job_id: str) -> None:
        await self._set_status(job_id, "running")

    async def mark_completed(self, job_id: str, *, cache_hit: bool = False) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
        if not job:
            return
        async with job.condition:
            job.status = "completed"
            job.cache_hit = bool(cache_hit)
            job.condition.notify_all()

    async def mark_error(self, job_id: str, message: str) -> None:
        await self.append_event(job_id, {"type": "error", "error": str(message)})
        await self._set_status(job_id, "error")

    async def append_event(self, job_id: str, event: Dict[str, Any]) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
        if not job:
            return
        async with job.condition:
            job.events.append(copy.deepcopy(event))
            job.condition.notify_all()

    async def stream_events(
        self,
        job_id: str,
        *,
        from_index: int = 0,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        cursor = max(0, int(from_index))

        while True:
            async with self._lock:
                job = self._jobs.get(job_id)
            if not job:
                return

            pending: List[Dict[str, Any]] = []
            status = job.status

            async with job.condition:
                if cursor >= len(job.events) and status not in self.TERMINAL_STATES:
                    try:
                        await asyncio.wait_for(job.condition.wait(), timeout=15.0)
                    except asyncio.TimeoutError:
                        # Keep websocket alive even when model is quiet.
                        pass
                pending = [copy.deepcopy(event) for event in job.events[cursor:]]
                status = job.status

            for event in pending:
                cursor += 1
                yield event

            if status in self.TERMINAL_STATES:
                async with self._lock:
                    latest = self._jobs.get(job_id)
                    latest_events = len(latest.events) if latest else 0
                    latest_status = latest.status if latest else "error"
                if cursor >= latest_events and latest_status in self.TERMINAL_STATES:
                    return

    async def _set_status(self, job_id: str, status: str) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
        if not job:
            return
        async with job.condition:
            job.status = status
            job.condition.notify_all()

    def _cleanup_locked(self) -> None:
        now_ms = int(time.time() * 1000)
        stale_ids: List[str] = []
        for job_id, job in self._jobs.items():
            expires_at_ms = job.created_at_ms + (self.ttl_seconds * 1000)
            if expires_at_ms <= now_ms:
                stale_ids.append(job_id)
        for job_id in stale_ids:
            self._jobs.pop(job_id, None)

