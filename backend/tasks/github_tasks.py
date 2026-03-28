from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple

from backend.github.store import get_github_store
from backend.services.github_service import get_github_service

try:
    from celery import Celery
except Exception:  # pragma: no cover
    Celery = None  # type: ignore[assignment]


CELERY_APP = None
if Celery is not None:
    broker = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL")
    backend = os.getenv("CELERY_RESULT_BACKEND") or broker
    if broker and backend:
        CELERY_APP = Celery("codeflowx_github", broker=broker, backend=backend)


GITHUB_ANALYZE_TASK_NAME = "codeflowx.github.analyze_repository"


def _run_analysis(repo_id: str) -> Dict[str, Any]:
    service = get_github_service()
    store = get_github_store()
    try:
        return service.analyze_repository(repo_id)
    except Exception as exc:
        progress = store.get_progress(repo_id)
        store.set_progress(
            repo_id,
            {
                "status": "failed",
                "total_files": progress.get("total_files", 0),
                "files_parsed": progress.get("files_parsed", 0),
                "current_file": progress.get("current_file", ""),
                "error": str(exc),
            },
        )
        raise


if CELERY_APP is not None:

    @CELERY_APP.task(name=GITHUB_ANALYZE_TASK_NAME, bind=True)
    def analyze_repository(self, repo_id: str) -> Dict[str, Any]:  # type: ignore[override]
        return _run_analysis(repo_id)

else:

    def analyze_repository(repo_id: str) -> Dict[str, Any]:
        return _run_analysis(repo_id)


def enqueue_repository_analysis(repo_id: str) -> Tuple[str, Optional[str]]:
    use_celery = (
        CELERY_APP is not None
        and os.getenv("CODEFLOWX_GITHUB_USE_CELERY", "1").strip().lower() in {"1", "true", "yes", "on"}
    )

    if use_celery and CELERY_APP is not None:
        result = CELERY_APP.send_task(GITHUB_ANALYZE_TASK_NAME, args=[repo_id])
        if result and result.id:
            get_github_store().update_repo(repo_id, celery_task_id=str(result.id))
        return "celery", str(result.id) if result else None

    return "local", None


def cancel_repository_analysis(repo_id: str) -> Dict[str, Any]:
    store = get_github_store()
    store.mark_cancel_requested(repo_id)

    revoked_task_id: Optional[str] = None
    record = store.get_repo(repo_id)
    if CELERY_APP is not None and record and record.celery_task_id:
        try:
            CELERY_APP.control.revoke(record.celery_task_id, terminate=False)
            revoked_task_id = record.celery_task_id
        except Exception:
            revoked_task_id = None

    return {
        "repo_id": repo_id,
        "status": "cancel_requested",
        "revoked_task_id": revoked_task_id,
    }
