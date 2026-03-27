from fastapi import FastAPI, HTTPException, Security, Depends, Request, Query, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio
import uuid as _uuid
import hashlib
import time

import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.parsers.grammar_loader import GrammarLoader, is_language_supported, get_support_level
from backend.ir.transformer import ASTTransformer
from backend.modules.flowchart import FlowchartModule
from backend.modules.dependency import DependencyModule, rank_dependency_nodes, build_subgraph
from backend.modules.execution import ExecutionInterpreter, ExecutionJobStore, ir_from_dict, stream_job_steps, celery_enabled
from backend.api.auth import get_current_user, create_access_token

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="CodeFlowX+ API v1")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeParseRequest(BaseModel):
    code: str
    language: str


class DependencyRequest(CodeParseRequest):
    module_path: Optional[str] = "main"


class ExecutionRequest(BaseModel):
    ir: Dict[str, Any]
    breakpoint_node_ids: List[str] = []
    step_limit: Optional[int] = None
    code: str = ""
    language: Optional[str] = None
    file: str = "main"


DEPENDENCY_GRAPH_CACHE: Dict[str, Dict[str, Any]] = {}
EXECUTION_JOB_STORE = ExecutionJobStore()

# ---------------------------------------------------------------------------
# Helper — run flowchart pipeline (shared by sync + async endpoints)
# ---------------------------------------------------------------------------
def _run_flowchart_pipeline(code: str, language: str) -> Dict[str, Any]:
    """Parse code → IR → flowchart. Returns a result dict or an error dict."""
    # 1. Parse into raw AST
    tree = GrammarLoader.parse(code, language)
    if not tree:
        return {
            "status": "error",
            "error": f"Failed to parse {language} code. Please check syntax.",
            "line": 0,
            "column": 0,
        }

    # 2. Detect syntax errors via tree-sitter ERROR nodes
    def _find_error(node) -> Optional[Dict]:
        if node.type == "ERROR":
            return {"line": node.start_point[0] + 1, "column": node.start_point[1] + 1}
        for child in node.children:
            result = _find_error(child)
            if result:
                return result
        return None

    syntax_error = _find_error(tree.root_node)
    if syntax_error:
        return {
            "status": "error",
            "error": f"Syntax error at line {syntax_error['line']}, column {syntax_error['column']}",
            "line": syntax_error["line"],
            "column": syntax_error["column"],
        }

    # 3. Transform into IR
    transformer = ASTTransformer(language, code)
    ir_tree = transformer.transform(tree.root_node)

    # 4. Generate Flowchart
    flowchart_gen = FlowchartModule()
    result = flowchart_gen.generate(ir_tree)

    def _ir_to_dict(node) -> Dict:
        return {
            "id": node.id,
            "type": node.type.value,
            "language": node.language,
            "name": node.name,
            "source_start": node.source_start,
            "source_end": node.source_end,
            "children": [_ir_to_dict(c) for c in node.children],
            "metadata": node.metadata,
        }

    return {
        "status": "success",
        "language": language,
        "support_level": get_support_level(language),
        "ir": _ir_to_dict(ir_tree),
        "nodes": result["nodes"],
        "edges": result["edges"],
    }


def _run_dependency_pipeline(code: str, language: str, module_path: str = "main") -> Dict[str, Any]:
    """Parse code -> IR -> dependency graph."""
    tree = GrammarLoader.parse(code, language)
    if not tree:
        return {
            "status": "error",
            "error": f"Failed to parse {language} code. Please check syntax.",
            "line": 0,
            "column": 0,
        }

    def _find_error(node) -> Optional[Dict[str, int]]:
        if node.type == "ERROR":
            return {"line": node.start_point[0] + 1, "column": node.start_point[1] + 1}
        for child in node.children:
            result = _find_error(child)
            if result:
                return result
        return None

    syntax_error = _find_error(tree.root_node)
    if syntax_error:
        return {
            "status": "error",
            "error": f"Syntax error at line {syntax_error['line']}, column {syntax_error['column']}",
            "line": syntax_error["line"],
            "column": syntax_error["column"],
        }

    transformer = ASTTransformer(language, code)
    ir_tree = transformer.transform(tree.root_node)

    dependency_gen = DependencyModule(source_code=code, language=language, module_path=module_path)
    result = dependency_gen.generate(ir_tree)

    graph_id = hashlib.md5(f"{language}:{module_path}:{code}".encode("utf8")).hexdigest()[:16]
    DEPENDENCY_GRAPH_CACHE[graph_id] = {
        "nodes": result["nodes"],
        "edges": result["edges"],
        "clusters": result["clusters"],
    }

    return {
        "status": "success",
        "language": language,
        "support_level": get_support_level(language),
        "graph_id": graph_id,
        "nodes": result["nodes"],
        "edges": result["edges"],
        "clusters": result["clusters"],
    }


def _run_execution_pipeline(
    ir_data: Dict[str, Any],
    code: str = "",
    file: str = "main",
    step_limit: int | None = None,
) -> List[Dict[str, Any]]:
    ir_root = ir_from_dict(ir_data)
    interpreter = ExecutionInterpreter(
        ir_root=ir_root,
        source_code=code,
        file=file,
        step_limit=step_limit,
    )
    return [step.model_dump() for step in interpreter.generate_steps()]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {"status": "CodeFlowX+ Backend Active", "version": "1.2.0"}

@app.post("/api/v1/login")
async def login():
    """Simple demo login to obtain a JWT token."""
    token = create_access_token(data={"sub": "demo_user"})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/v1/languages")
async def get_languages():
    """Return supported languages with their support level."""
    return {
        "languages": [
            {"id": "python",     "label": "Python 3.x",    "support": "full"},
            {"id": "javascript", "label": "JavaScript",     "support": "full"},
            {"id": "typescript", "label": "TypeScript",     "support": "full"},
            {"id": "java",       "label": "Java 11+",       "support": "partial"},
        ]
    }

@app.post("/api/v1/flowchart")
@limiter.limit("10/minute")
async def generate_flowchart(request: Request, body: CodeParseRequest, user: dict = Depends(get_current_user)):
    """
    Parses code and generates a visual flowchart synchronously.
    Returns structured error with line/column on syntax failure.
    """
    if not is_language_supported(body.language):
        return {
            "status": "error",
            "error": f"Language '{body.language}' is not supported. Supported: python, javascript, typescript, java.",
        }

    try:
        result = _run_flowchart_pipeline(body.code, body.language)
        if result.get("status") == "error":
            return result
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/analyze")
@limiter.limit("10/minute")
async def analyze_full(request: Request, body: CodeParseRequest, user: dict = Depends(get_current_user)):
    """
    Full async analysis pipeline trigger.
    Returns a job_id for polling (currently runs synchronously and returns immediately).
    """
    if not is_language_supported(body.language):
        return {
            "status": "error",
            "error": f"Language '{body.language}' is not supported.",
        }

    job_id = str(_uuid.uuid4())
    try:
        # Run in thread pool to stay non-blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, _run_flowchart_pipeline, body.code, body.language)
        result["job_id"] = job_id
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analyze/{job_id}")
async def poll_analysis(job_id: str, user: dict = Depends(get_current_user)):
    """Polling endpoint for async analysis jobs (stub — jobs run synchronously for now)."""
    return {"status": "completed", "job_id": job_id}


@app.post("/api/v1/execution")
@limiter.limit("20/minute")
async def run_execution_simulation(
    request: Request,
    body: ExecutionRequest,
    user: dict = Depends(get_current_user),
):
    """
    Build a full execution step list from IR without running user code.
    """
    if not body.ir:
        return {
            "status": "error",
            "error": "Request must include an `ir` object generated by /api/v1/flowchart.",
        }

    job_id = str(_uuid.uuid4())
    try:
        loop = asyncio.get_event_loop()
        steps = await loop.run_in_executor(
            None,
            _run_execution_pipeline,
            body.ir,
            body.code,
            body.file,
            body.step_limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    payload: Dict[str, Any] = {
        "job_id": job_id,
        "status": "ready",
        "created_at": int(time.time() * 1000),
        "breakpoint_node_ids": sorted(set(body.breakpoint_node_ids or [])),
        "breakpoint_hits": [],
        "steps": steps,
    }
    await EXECUTION_JOB_STORE.save_job(job_id, payload)

    return {
        "status": "success",
        "job_id": job_id,
        "total_steps": len(steps),
        "execution_worker": "celery" if celery_enabled() else "local",
        "breakpoint_node_ids": payload["breakpoint_node_ids"],
        "steps": steps,
    }


@app.get("/api/v1/execution/{job_id}")
async def get_execution_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await EXECUTION_JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Execution job not found")

    return {
        "status": "success",
        "job_id": job_id,
        "execution_status": job.get("status", "ready"),
        "total_steps": len(job.get("steps", [])),
        "breakpoint_node_ids": job.get("breakpoint_node_ids", []),
        "breakpoint_hits": job.get("breakpoint_hits", []),
    }


@app.get("/api/v1/execution/{job_id}/step/{n}")
async def get_execution_step(job_id: str, n: int, user: dict = Depends(get_current_user)):
    job = await EXECUTION_JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Execution job not found")

    steps = job.get("steps", [])
    if n < 1 or n > len(steps):
        raise HTTPException(status_code=404, detail=f"Step index out of range (1..{len(steps)})")

    step = steps[n - 1]
    return {
        "status": "success",
        "job_id": job_id,
        "step_index": n,
        "total_steps": len(steps),
        "step": step,
        "variables": step.get("variables", {}),
        "active_node": step.get("active_node_id"),
        "call_stack": step.get("call_stack", []),
    }


@app.get("/api/v1/execution/{job_id}/breakpoints")
async def get_execution_breakpoints(job_id: str, user: dict = Depends(get_current_user)):
    job = await EXECUTION_JOB_STORE.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Execution job not found")

    return {
        "status": "success",
        "job_id": job_id,
        "breakpoint_node_ids": job.get("breakpoint_node_ids", []),
        "hits": job.get("breakpoint_hits", []),
    }


@app.websocket("/execution/{job_id}")
async def execution_stream(job_id: str, websocket: WebSocket):
    await websocket.accept()
    job = await EXECUTION_JOB_STORE.get_job(job_id)
    if not job:
        await websocket.send_json({"event": "ERROR", "error": "Unknown execution job"})
        await websocket.close(code=4404)
        return

    start_qp = websocket.query_params.get("start")
    rate_qp = websocket.query_params.get("rate")
    try:
        start_index = int(start_qp) if start_qp is not None else 0
    except ValueError:
        start_index = 0
    try:
        stream_rate = float(rate_qp) if rate_qp is not None else 3.0
    except ValueError:
        stream_rate = 3.0

    await EXECUTION_JOB_STORE.patch_job(job_id, {"status": "streaming"})
    try:
        await stream_job_steps(
            websocket=websocket,
            job=job,
            store=EXECUTION_JOB_STORE,
            start_index=start_index,
            steps_per_second=stream_rate,
        )
    except WebSocketDisconnect:
        await EXECUTION_JOB_STORE.patch_job(job_id, {"status": "disconnected"})
    except Exception:
        await EXECUTION_JOB_STORE.patch_job(job_id, {"status": "error"})
        try:
            await websocket.send_json({"event": "ERROR", "error": "Execution stream failed"})
        except Exception:
            pass
        try:
            await websocket.close(code=1011)
        except Exception:
            pass


@app.post("/api/v1/dependency")
@limiter.limit("10/minute")
async def generate_dependency_graph(request: Request, body: DependencyRequest, user: dict = Depends(get_current_user)):
    """
    Build dependency graph data from source code.
    Returns nodes/edges/clusters for React Flow rendering.
    """
    if not is_language_supported(body.language):
        return {
            "status": "error",
            "error": f"Language '{body.language}' is not supported.",
        }

    try:
        return _run_dependency_pipeline(body.code, body.language, body.module_path or "main")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/v1/dependency/search")
async def search_dependency_nodes(
    q: str = Query(..., min_length=1),
    graph_id: str = Query(..., min_length=1),
    cursor: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=50),
    user: dict = Depends(get_current_user),
):
    """Fuzzy search over dependency nodes in a previously generated graph."""
    cached = DEPENDENCY_GRAPH_CACHE.get(graph_id)
    if not cached:
        return {
            "status": "error",
            "error": "Unknown graph_id. Generate dependency graph first.",
            "results": [],
        }

    start = 0
    if cursor:
        try:
            start = max(0, int(cursor))
        except ValueError:
            start = 0

    ranked_full = rank_dependency_nodes(
        cached["nodes"],
        q,
        limit=max(len(cached["nodes"]), start + limit),
    )
    page = ranked_full[start:start + limit]
    next_cursor = str(start + limit) if (start + limit) < len(ranked_full) else None

    compact = [
        {
            "id": node["id"],
            "name": node["name"],
            "type": node["type"],
            "module": node.get("module", ""),
            "signature": node.get("signature", ""),
            "docstring": node.get("docstring", ""),
        }
        for node in page
    ]
    return {
        "status": "success",
        "graph_id": graph_id,
        "query": q,
        "cursor": cursor,
        "next_cursor": next_cursor,
        "total": len(ranked_full),
        "results": compact,
    }


@app.get("/api/v1/dependency/subgraph/{node_id}")
async def get_dependency_subgraph(
    node_id: str,
    graph_id: str = Query(..., min_length=1),
    hops: int = Query(1, ge=1, le=4),
    user: dict = Depends(get_current_user),
):
    """Return an N-hop dependency neighborhood for a node."""
    cached = DEPENDENCY_GRAPH_CACHE.get(graph_id)
    if not cached:
        return {
            "status": "error",
            "error": "Unknown graph_id. Generate dependency graph first.",
            "nodes": [],
            "edges": [],
        }

    subgraph = build_subgraph(cached["nodes"], cached["edges"], node_id=node_id, hops=hops)
    return {
        "status": "success",
        "graph_id": graph_id,
        "node_id": node_id,
        "hops": hops,
        "nodes": subgraph["nodes"],
        "edges": subgraph["edges"],
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.2.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
