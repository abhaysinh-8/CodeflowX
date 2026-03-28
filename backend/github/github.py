from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, RedirectResponse

from backend.api.auth import get_current_user, verify_token
from backend.github.schemas import GitHubCancelResponse, GitHubConnectRequest, GitHubConnectResponse, GitHubStatusResponse
from backend.github.store import get_github_store
from backend.services.github_service import get_github_service
from backend.tasks.github_tasks import (
    analyze_repository,
    cancel_repository_analysis,
    enqueue_repository_analysis,
)

router = APIRouter()


def _user_id_from_claims(user: Dict[str, Any]) -> str:
    identifier = str(user.get("sub", "")).strip()
    if not identifier:
        raise HTTPException(status_code=401, detail="Invalid authenticated user")
    return identifier


def _normalize_path(path: str) -> str:
    return str(path or "").replace("\\", "/").strip("/")


def _status_with_progress(progress: Dict[str, Any]) -> Dict[str, Any]:
    files_parsed = int(progress.get("files_parsed", 0) or 0)
    total_files = int(progress.get("total_files", 0) or 0)
    status = str(progress.get("status", "queued"))

    if total_files > 0:
        pct = max(0.0, min(100.0, round((files_parsed / total_files) * 100.0, 2)))
    elif status == "completed":
        pct = 100.0
    else:
        pct = 0.0

    return {
        "status": status,
        "progress": pct,
        "files_parsed": files_parsed,
        "total_files": total_files,
        "current_file": str(progress.get("current_file", "")),
        "error": progress.get("error"),
        "updated_at_ms": int(progress.get("updated_at_ms", int(time.time() * 1000))),
    }


@router.get("/api/v1/github/auth")
async def github_auth(http_request: Request, access_token: Optional[str] = Query(None)):
    service = get_github_service()
    bearer = str(http_request.headers.get("authorization", "")).strip()
    token = access_token
    if not token and bearer.lower().startswith("bearer "):
        token = bearer[7:].strip()

    if not token:
        raise HTTPException(status_code=401, detail="Authentication token is required.")

    try:
        user = verify_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid auth token: {exc}")
    user_id = _user_id_from_claims(user)

    state = service.create_oauth_state(user_id)
    authorization_url = service.build_authorization_url(state)
    return RedirectResponse(url=authorization_url, status_code=307)


@router.get("/api/v1/github/callback")
async def github_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
):
    service = get_github_service()
    store = get_github_store()

    if error:
        payload = {"status": "error", "message": str(error)}
        html = (
            "<html><body><script>"
            f"window.opener && window.opener.postMessage({json.dumps(payload)}, '*');"
            "window.close();"
            "</script>GitHub OAuth failed. You can close this window.</body></html>"
        )
        return HTMLResponse(content=html)

    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth callback parameters.")

    user_id = store.pop_oauth_state(state)
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    try:
        token = await service.exchange_code_for_token(code)
    except Exception as exc:
        payload = {"status": "error", "message": str(exc)}
        html = (
            "<html><body><script>"
            f"window.opener && window.opener.postMessage({json.dumps(payload)}, '*');"
            "window.close();"
            "</script>GitHub OAuth failed. You can close this window.</body></html>"
        )
        return HTMLResponse(content=html, status_code=400)

    service.store_user_token(user_id, token)

    payload = {"status": "success", "message": "GitHub connected", "user_id": user_id}
    html = (
        "<html><body><script>"
        f"window.opener && window.opener.postMessage({json.dumps(payload)}, '*');"
        "window.close();"
        "</script>GitHub connected. You can close this window.</body></html>"
    )
    return HTMLResponse(content=html)


@router.post("/api/v1/github/connect", response_model=GitHubConnectResponse)
async def github_connect(request: GitHubConnectRequest, user: Dict[str, Any] = Depends(get_current_user)):
    service = get_github_service()
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    try:
        record = service.create_repository_record(user_id=user_id, repo_url=request.repo_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    repo_id = str(record.get("repo_id", "")).strip()
    if not repo_id:
        raise HTTPException(status_code=500, detail="Failed to create repository record.")

    access_token = service.get_user_token(user_id)

    try:
        clone_path = await service.clone_repository(repo_id=repo_id, clone_url=record["clone_url"], token=access_token)
    except TimeoutError as exc:
        store.set_progress(
            repo_id,
            {
                "status": "failed",
                "total_files": 0,
                "files_parsed": 0,
                "current_file": "",
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=504, detail=str(exc))
    except Exception as exc:
        store.set_progress(
            repo_id,
            {
                "status": "failed",
                "total_files": 0,
                "files_parsed": 0,
                "current_file": "",
                "error": str(exc),
            },
        )
        raise HTTPException(status_code=400, detail=f"Failed to clone repository: {exc}")

    detected_files = service.detect_supported_files(clone_path)
    store.update_repo(repo_id, local_path=clone_path, status="cloned", total_files=len(detected_files), files_parsed=0)
    store.set_progress(
        repo_id,
        {
            "status": "queued",
            "total_files": len(detected_files),
            "files_parsed": 0,
            "current_file": "",
            "error": None,
        },
    )

    mode, task_id = enqueue_repository_analysis(repo_id)
    if mode == "local":
        asyncio.create_task(asyncio.to_thread(analyze_repository, repo_id))
    elif task_id:
        store.update_repo(repo_id, celery_task_id=task_id)

    return GitHubConnectResponse(repo_id=repo_id)


@router.get("/api/v1/github/{repo_id}/status", response_model=GitHubStatusResponse)
async def github_status(repo_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    if not store.verify_repo_owner(repo_id, user_id):
        raise HTTPException(status_code=404, detail="Repository not found.")

    progress = store.get_progress(repo_id)
    payload = _status_with_progress(progress)
    return GitHubStatusResponse(
        status=payload["status"],
        progress=payload["progress"],
        files_parsed=payload["files_parsed"],
        total_files=payload["total_files"],
        current_file=payload["current_file"],
    )


@router.get("/api/v1/github/{repo_id}/graph")
async def github_dependency_graph(
    repo_id: str,
    cursor: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    module: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(get_current_user),
):
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    if not store.verify_repo_owner(repo_id, user_id):
        raise HTTPException(status_code=404, detail="Repository not found.")

    payload = store.get_analysis_payload(repo_id)
    if not payload:
        progress = _status_with_progress(store.get_progress(repo_id))
        if progress["status"] in {"processing", "queued", "cloned"}:
            return {
                "status": progress["status"],
                "repo_id": repo_id,
                "cursor": cursor,
                "next_cursor": None,
                "limit": limit,
                "total_nodes": 0,
                "nodes": [],
                "edges": [],
                "module_relationships": [],
                "file_tree": [],
                "stats": {},
            }
        raise HTTPException(status_code=404, detail="Repository analysis payload not available.")

    graph = payload.get("graph", {}) if isinstance(payload.get("graph"), dict) else {}
    nodes = graph.get("nodes", []) if isinstance(graph.get("nodes"), list) else []
    edges = graph.get("edges", []) if isinstance(graph.get("edges"), list) else []

    module_filter = str(module or "").strip().lower()
    if module_filter:
        nodes = [
            node
            for node in nodes
            if module_filter in str(node.get("module", "")).lower()
            or module_filter in str(node.get("file_path", "")).lower()
        ]

    start = 0
    if cursor:
        try:
            start = max(0, int(cursor))
        except ValueError:
            start = 0

    page_nodes = nodes[start:start + limit]
    page_ids = {str(node.get("id", "")).strip() for node in page_nodes if str(node.get("id", "")).strip()}
    page_edges = [
        edge
        for edge in edges
        if str(edge.get("source", "")).strip() in page_ids and str(edge.get("target", "")).strip() in page_ids
    ]

    next_cursor = str(start + limit) if (start + limit) < len(nodes) else None

    return {
        "status": "success",
        "repo_id": repo_id,
        "cursor": cursor,
        "next_cursor": next_cursor,
        "limit": limit,
        "total_nodes": len(nodes),
        "nodes": page_nodes,
        "edges": page_edges,
        "module_relationships": graph.get("module_relationships", []),
        "file_tree": payload.get("file_tree", []),
        "stats": payload.get("stats", {}),
    }


@router.get("/api/v1/github/{repo_id}/file/{file_path:path}")
async def github_file_flowchart(repo_id: str, file_path: str, user: Dict[str, Any] = Depends(get_current_user)):
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    if not store.verify_repo_owner(repo_id, user_id):
        raise HTTPException(status_code=404, detail="Repository not found.")

    payload = store.get_analysis_payload(repo_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Repository analysis payload not available.")

    files = payload.get("files", {}) if isinstance(payload.get("files"), dict) else {}
    normalized = _normalize_path(file_path)
    record = files.get(normalized)
    if not record:
        raise HTTPException(status_code=404, detail="Requested file was not parsed.")

    flowchart = record.get("flowchart", {}) if isinstance(record.get("flowchart"), dict) else {}
    return {
        "status": "success",
        "repo_id": repo_id,
        "path": normalized,
        "language": record.get("language", ""),
        "flowchart": {
            "nodes": flowchart.get("nodes", []),
            "edges": flowchart.get("edges", []),
        },
        "coverage": record.get("coverage", {}),
    }


@router.get("/api/v1/github/{repo_id}/search")
async def github_search(
    repo_id: str,
    q: str = Query(..., min_length=1),
    cursor: Optional[str] = Query(None),
    limit: int = Query(25, ge=1, le=100),
    user: Dict[str, Any] = Depends(get_current_user),
):
    service = get_github_service()
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    if not store.verify_repo_owner(repo_id, user_id):
        raise HTTPException(status_code=404, detail="Repository not found.")

    payload = store.get_analysis_payload(repo_id)
    if not payload:
        raise HTTPException(status_code=404, detail="Repository analysis payload not available.")

    search_index = payload.get("search_index", []) if isinstance(payload.get("search_index"), list) else []
    result = service.search_functions(search_index=search_index, query=q, cursor=cursor, limit=limit)

    return {
        "status": "success",
        "repo_id": repo_id,
        "query": q,
        "cursor": result.get("cursor"),
        "next_cursor": result.get("next_cursor"),
        "total": result.get("total", 0),
        "results": result.get("results", []),
    }


@router.post("/api/v1/github/{repo_id}/cancel", response_model=GitHubCancelResponse)
async def github_cancel(repo_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    store = get_github_store()
    user_id = _user_id_from_claims(user)

    if not store.verify_repo_owner(repo_id, user_id):
        raise HTTPException(status_code=404, detail="Repository not found.")

    cancel_repository_analysis(repo_id)
    progress = store.get_progress(repo_id)
    store.set_progress(
        repo_id,
        {
            "status": "cancel_requested",
            "total_files": progress.get("total_files", 0),
            "files_parsed": progress.get("files_parsed", 0),
            "current_file": progress.get("current_file", ""),
            "error": None,
        },
    )
    return GitHubCancelResponse(status="cancel_requested", repo_id=repo_id)


@router.websocket("/ws/github/{repo_id}")
async def github_progress_stream(repo_id: str, websocket: WebSocket):
    store = get_github_store()
    await websocket.accept()

    last_payload: Optional[Dict[str, Any]] = None

    try:
        while True:
            progress = _status_with_progress(store.get_progress(repo_id))
            outgoing = {
                "status": progress["status"],
                "files_parsed": progress["files_parsed"],
                "total_files": progress["total_files"],
                "current_file": progress["current_file"],
                "progress": progress["progress"],
                "error": progress.get("error"),
            }
            if outgoing != last_payload:
                await websocket.send_json(outgoing)
                last_payload = outgoing

            if outgoing["status"] in {"completed", "failed", "cancelled"}:
                break

            await asyncio.sleep(0.8)
    except WebSocketDisconnect:
        return
    except Exception:
        try:
            await websocket.send_json({"status": "error", "message": "Progress stream failed"})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
