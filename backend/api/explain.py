from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from typing import Any, Deque, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect

from backend.api.auth import get_current_user
from backend.modules.ai_explainer.schemas import (
    CoverageExplainRequest,
    EdgeExplainRequest,
    ExplainJobResponse,
    FailureExplainRequest,
    NodeExplainRequest,
)
from backend.modules.ai_explainer.service import AIExplainerService


router = APIRouter()
EXPLAIN_SERVICE = AIExplainerService()


class PerUserMinuteLimiter:
    def __init__(self, *, limit: int, window_seconds: int = 60) -> None:
        self.limit = max(1, int(limit))
        self.window_seconds = max(1, int(window_seconds))
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, user_id: str) -> None:
        now = time.monotonic()
        async with self._lock:
            bucket = self._events[user_id]
            cutoff = now - float(self.window_seconds)
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Rate limit exceeded: {self.limit} requests per minute.",
                )
            bucket.append(now)


RATE_LIMITER = PerUserMinuteLimiter(limit=5, window_seconds=60)


def _user_id(user: Dict[str, Any], request: Request) -> str:
    sub = str(user.get("sub", "")).strip() if isinstance(user, dict) else ""
    if sub:
        return sub
    client = request.client.host if request.client else "anonymous"
    return client or "anonymous"


async def _submit_job(
    *,
    request: Request,
    user: Dict[str, Any],
    explain_type: str,
    target_id: str,
    payload: Dict[str, Any],
) -> ExplainJobResponse:
    user_id = _user_id(user, request)
    await RATE_LIMITER.check(user_id)

    job_id, cache_hit = await EXPLAIN_SERVICE.submit_job(
        explain_type=explain_type,
        target_id=target_id,
        payload=payload,
        user_id=user_id,
    )
    return ExplainJobResponse(job_id=job_id, cache_hit=cache_hit)


@router.post("/api/v1/explain/node", response_model=ExplainJobResponse)
async def explain_node(
    request: Request,
    body: NodeExplainRequest,
    user: dict = Depends(get_current_user),
) -> ExplainJobResponse:
    payload = body.model_dump()
    target_id = str(body.ir_node_id).strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="ir_node_id is required.")
    return await _submit_job(
        request=request,
        user=user,
        explain_type="node",
        target_id=target_id,
        payload=payload,
    )


@router.post("/api/v1/explain/edge", response_model=ExplainJobResponse)
async def explain_edge(
    request: Request,
    body: EdgeExplainRequest,
    user: dict = Depends(get_current_user),
) -> ExplainJobResponse:
    payload = body.model_dump()
    target_id = str(body.edge_id).strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="edge_id is required.")
    return await _submit_job(
        request=request,
        user=user,
        explain_type="edge",
        target_id=target_id,
        payload=payload,
    )


@router.post("/api/v1/explain/coverage", response_model=ExplainJobResponse)
async def explain_coverage(
    request: Request,
    body: CoverageExplainRequest,
    user: dict = Depends(get_current_user),
) -> ExplainJobResponse:
    payload = body.model_dump()
    target_id = str(body.coverage_id).strip()
    if not target_id:
        raise HTTPException(status_code=400, detail="coverage_id is required.")
    return await _submit_job(
        request=request,
        user=user,
        explain_type="coverage",
        target_id=target_id,
        payload=payload,
    )


@router.post("/api/v1/explain/failure", response_model=ExplainJobResponse)
async def explain_failure(
    request: Request,
    body: FailureExplainRequest,
    user: dict = Depends(get_current_user),
) -> ExplainJobResponse:
    return await enqueue_failure_explanation(request=request, body=body, user=user)


async def enqueue_failure_explanation(
    *,
    request: Request,
    body: FailureExplainRequest,
    user: Dict[str, Any],
) -> ExplainJobResponse:
    payload = body.model_dump()
    target_id = (
        str(body.ir_node_id or "").strip()
        or str(body.failed_function_id or "").strip()
        or (str(body.failed_function_ids[0]).strip() if body.failed_function_ids else "")
        or "failure"
    )
    return await _submit_job(
        request=request,
        user=user,
        explain_type="failure",
        target_id=target_id,
        payload=payload,
    )


@router.websocket("/explain/{job_id}")
async def explain_stream(job_id: str, websocket: WebSocket) -> None:
    await websocket.accept()
    snapshot = await EXPLAIN_SERVICE.job_store.get_job(job_id)
    if not snapshot:
        await websocket.send_json({"type": "error", "error": "Unknown explain job"})
        await websocket.close(code=4404)
        return

    try:
        async for event in EXPLAIN_SERVICE.job_store.stream_events(job_id):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.send_json({"type": "error", "error": "Explain stream failed"})
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass

