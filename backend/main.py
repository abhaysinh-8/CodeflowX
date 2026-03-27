from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Request,
    Query,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Form,
)
from pydantic import BaseModel
from typing import Dict, Any, List, Optional, Tuple
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import asyncio
import uuid as _uuid
import hashlib
import time
import json

import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.parsers.grammar_loader import GrammarLoader, is_language_supported, get_support_level
from backend.ir.transformer import ASTTransformer
from backend.modules.flowchart import FlowchartModule
from backend.modules.dependency import DependencyModule, rank_dependency_nodes, build_subgraph
from backend.modules.execution import (
    ExecutionJobStore,
    stream_job_steps,
    run_execution_job,
)
from backend.modules.coverage import (
    ParsedCoverage,
    parse_coverage_payload,
    apply_coverage_to_flowchart,
)
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
    conditional_breakpoints: Dict[str, str] = {}
    step_limit: Optional[int] = None
    code: str = ""
    language: Optional[str] = None
    file: str = "main"


DEPENDENCY_GRAPH_CACHE: Dict[str, Dict[str, Any]] = {}
EXECUTION_JOB_STORE = ExecutionJobStore()
COVERAGE_RESULT_CACHE: Dict[str, Dict[str, Any]] = {}
COVERAGE_CACHE_TTL_SECONDS = 1800


class AnalyzeResultStore:
    """
    Redis-aware analyze payload cache with in-memory fallback.
    """

    def __init__(self) -> None:
        try:
            self.ttl_seconds = max(
                60,
                int(os.getenv("CODEFLOWX_ANALYZE_CACHE_TTL_SECONDS", "1800")),
            )
        except ValueError:
            self.ttl_seconds = 1800
        self._memory: Dict[str, Tuple[float, Dict[str, Any]]] = {}
        self._lock = asyncio.Lock()
        self._redis = None
        redis_url = os.getenv("CODEFLOWX_REDIS_URL") or os.getenv("REDIS_URL")
        if redis_url:
            try:
                import redis.asyncio as redis_async  # type: ignore[import]

                self._redis = redis_async.from_url(redis_url, decode_responses=True)
            except Exception:
                self._redis = None

    def _key(self, job_id: str) -> str:
        return f"codeflowx:analyze:{job_id}"

    async def save_result(self, job_id: str, payload: Dict[str, Any]) -> None:
        if self._redis is not None:
            try:
                await self._redis.setex(self._key(job_id), self.ttl_seconds, json.dumps(payload))
            except Exception:
                self._redis = None

        expires_at = time.time() + float(self.ttl_seconds)
        async with self._lock:
            self._memory[job_id] = (expires_at, payload)
            stale = [key for key, (ttl, _) in self._memory.items() if ttl <= time.time()]
            for key in stale:
                self._memory.pop(key, None)

    async def get_result(self, job_id: str) -> Optional[Dict[str, Any]]:
        if self._redis is not None:
            try:
                raw = await self._redis.get(self._key(job_id))
                if raw:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        return parsed
            except Exception:
                self._redis = None

        async with self._lock:
            payload = self._memory.get(job_id)
            if not payload:
                return None
            expires_at, result = payload
            if expires_at <= time.time():
                self._memory.pop(job_id, None)
                return None
            return result


ANALYZE_RESULT_STORE = AnalyzeResultStore()


def _find_syntax_issue(node) -> Optional[Dict[str, int]]:
    """
    Find first concrete syntax issue in a tree-sitter node tree.

    We treat explicit ERROR nodes and missing nodes as syntax failures.
    """
    stack = [node]
    while stack:
        current = stack.pop(0)
        is_missing = bool(getattr(current, "is_missing", False))
        if current.type == "ERROR" or is_missing:
            return {
                "line": current.start_point[0] + 1,
                "column": current.start_point[1] + 1,
            }
        stack.extend(list(current.children))
    return None


def _cleanup_coverage_cache() -> None:
    now_ms = int(time.time() * 1000)
    stale_keys = [
        key
        for key, payload in COVERAGE_RESULT_CACHE.items()
        if int(payload.get("expires_at", 0)) <= now_ms
    ]
    for key in stale_keys:
        COVERAGE_RESULT_CACHE.pop(key, None)

# ---------------------------------------------------------------------------
# Helpers — shared pipeline pieces for flowchart/dependency/execution/coverage
# ---------------------------------------------------------------------------
def _ir_to_dict(node) -> Dict[str, Any]:
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


def _module_path_for_language(language: str) -> str:
    ext_map = {
        "python": "py",
        "javascript": "js",
        "typescript": "ts",
        "java": "java",
    }
    ext = ext_map.get(language, "txt")
    return f"main.{ext}"


def _parse_and_transform(code: str, language: str) -> Dict[str, Any]:
    """Parse source code and build IR once for downstream modules."""
    tree = GrammarLoader.parse(code, language)
    if not tree:
        return {
            "status": "error",
            "error": f"Failed to parse {language} code. Please check syntax.",
            "line": 0,
            "column": 0,
        }

    syntax_error = _find_syntax_issue(tree.root_node)
    if syntax_error or bool(getattr(tree.root_node, "has_error", False)):
        if not syntax_error:
            syntax_error = {"line": 1, "column": 1}
        return {
            "status": "error",
            "error": f"Syntax error at line {syntax_error['line']}, column {syntax_error['column']}",
            "line": syntax_error["line"],
            "column": syntax_error["column"],
        }

    transformer = ASTTransformer(language, code)
    ir_tree = transformer.transform(tree.root_node)
    return {
        "status": "success",
        "ir_tree": ir_tree,
        "ir": _ir_to_dict(ir_tree),
    }


def _build_flowchart_from_ir(ir_root) -> Dict[str, Any]:
    flowchart_gen = FlowchartModule()
    return flowchart_gen.generate(ir_root)


def _build_dependency_from_ir(
    ir_root,
    code: str,
    language: str,
    module_path: str = "main",
    flowchart_job_id: Optional[str] = None,
) -> Dict[str, Any]:
    dependency_gen = DependencyModule(source_code=code, language=language, module_path=module_path)
    result = dependency_gen.generate(ir_root)
    nodes = []
    for node in result["nodes"]:
        enriched = dict(node)
        enriched["flowchart_job_id"] = flowchart_job_id
        nodes.append(enriched)

    graph_id = hashlib.md5(f"{language}:{module_path}:{code}".encode("utf8")).hexdigest()[:16]
    DEPENDENCY_GRAPH_CACHE[graph_id] = {
        "nodes": nodes,
        "edges": result["edges"],
        "clusters": result["clusters"],
    }

    return {
        "graph_id": graph_id,
        "nodes": nodes,
        "edges": result["edges"],
        "clusters": result["clusters"],
    }


def _map_coverage_by_ir_node_id(
    flow_nodes: List[Dict[str, Any]],
    node_coverage_map: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    coverage_by_ir: Dict[str, Dict[str, Any]] = {}
    for node in flow_nodes:
        node_id = str(node.get("id", "")).strip()
        node_data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
        ir_node_id = str(node_data.get("ir_node_id", "")).strip()
        if not node_id or not ir_node_id:
            continue
        coverage = node_coverage_map.get(node_id)
        if coverage:
            coverage_by_ir[ir_node_id] = dict(coverage)
    return coverage_by_ir


def _build_default_coverage_payload(
    flow_nodes: List[Dict[str, Any]],
    flow_edges: List[Dict[str, Any]],
) -> Dict[str, Any]:
    merged = apply_coverage_to_flowchart(
        nodes=flow_nodes,
        edges=flow_edges,
        parsed=ParsedCoverage(format="native", line_hits={}, node_hits={}, branch_hits={}),
    )
    node_coverage_map = merged["node_coverage_map"]
    coverage_node_coverage_map = _map_coverage_by_ir_node_id(
        flow_nodes=merged["nodes"],
        node_coverage_map=node_coverage_map,
    )
    report_json = dict(merged.get("report_json", {}))
    report_json["coverage_node_coverage_map"] = coverage_node_coverage_map

    return {
        "format": "Native",
        "flowchart": {
            "nodes": merged["nodes"],
            "edges": merged["edges"],
        },
        "node_coverage_map": node_coverage_map,
        "coverage_node_coverage_map": coverage_node_coverage_map,
        "summary": merged["summary"],
        "report_json": report_json,
    }


def _build_ir_node_lookup(
    flow_nodes: List[Dict[str, Any]],
    dependency_nodes: List[Dict[str, Any]],
    coverage_node_coverage_map: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    lookup: Dict[str, Dict[str, Any]] = {}

    for flow_node in flow_nodes:
        node_id = str(flow_node.get("id", "")).strip()
        data = flow_node.get("data", {}) if isinstance(flow_node.get("data"), dict) else {}
        ir_node_id = str(data.get("ir_node_id", "")).strip()
        if not ir_node_id:
            continue
        entry = lookup.setdefault(ir_node_id, {"dependency_node_ids": []})
        entry["flowchart_node_id"] = node_id
        if data.get("source_start") is not None:
            entry["source_start"] = data.get("source_start")
        if data.get("source_end") is not None:
            entry["source_end"] = data.get("source_end")

    for dep_node in dependency_nodes:
        dep_id = str(dep_node.get("id", "")).strip()
        ir_node_id = str(dep_node.get("ir_node_id", "")).strip()
        if not ir_node_id or not dep_id:
            continue
        entry = lookup.setdefault(ir_node_id, {"dependency_node_ids": []})
        dep_ids = entry.setdefault("dependency_node_ids", [])
        if dep_id not in dep_ids:
            dep_ids.append(dep_id)

    for ir_node_id, coverage in coverage_node_coverage_map.items():
        entry = lookup.setdefault(ir_node_id, {"dependency_node_ids": []})
        entry["coverage_status"] = coverage.get("coverage_status")

    return lookup


def _run_flowchart_pipeline(code: str, language: str) -> Dict[str, Any]:
    """Parse code → IR → flowchart. Returns a result dict or an error dict."""
    parsed = _parse_and_transform(code, language)
    if parsed.get("status") == "error":
        return parsed

    result = _build_flowchart_from_ir(parsed["ir_tree"])
    return {
        "status": "success",
        "language": language,
        "support_level": get_support_level(language),
        "ir": parsed["ir"],
        "nodes": result["nodes"],
        "edges": result["edges"],
    }


def _run_dependency_pipeline(code: str, language: str, module_path: str = "main") -> Dict[str, Any]:
    """Parse code -> IR -> dependency graph."""
    parsed = _parse_and_transform(code, language)
    if parsed.get("status") == "error":
        return parsed

    result = _build_dependency_from_ir(parsed["ir_tree"], code, language, module_path)
    return {
        "status": "success",
        "language": language,
        "support_level": get_support_level(language),
        "graph_id": result["graph_id"],
        "nodes": result["nodes"],
        "edges": result["edges"],
        "clusters": result["clusters"],
    }


def _run_execution_pipeline(
    ir_data: Dict[str, Any],
    code: str = "",
    file: str = "main",
    step_limit: int | None = None,
) -> Dict[str, Any]:
    steps, worker = run_execution_job(
        ir_data=ir_data,
        code=code,
        file=file,
        step_limit=step_limit,
    )
    return {
        "steps": steps,
        "worker": worker,
    }


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
    Unified analysis pipeline:
    parse once -> IR once -> run flowchart/dependency/execution in parallel -> attach coverage context.
    """
    if not is_language_supported(body.language):
        return {
            "status": "error",
            "error": f"Language '{body.language}' is not supported.",
        }

    job_id = str(_uuid.uuid4())
    module_path = _module_path_for_language(body.language)
    try:
        loop = asyncio.get_running_loop()
        parsed = await loop.run_in_executor(None, _parse_and_transform, body.code, body.language)
        if parsed.get("status") == "error":
            return parsed

        ir_tree = parsed["ir_tree"]
        ir_payload = parsed["ir"]

        flowchart_task = loop.run_in_executor(None, _build_flowchart_from_ir, ir_tree)
        dependency_task = loop.run_in_executor(
            None,
            _build_dependency_from_ir,
            ir_tree,
            body.code,
            body.language,
            module_path,
            job_id,
        )
        execution_task = loop.run_in_executor(
            None,
            _run_execution_pipeline,
            ir_payload,
            body.code,
            module_path,
            None,
        )

        flowchart_result, dependency_result, execution_result = await asyncio.gather(
            flowchart_task,
            dependency_task,
            execution_task,
        )

        coverage_result = await loop.run_in_executor(
            None,
            _build_default_coverage_payload,
            flowchart_result.get("nodes", []),
            flowchart_result.get("edges", []),
        )

        dependency_nodes = dependency_result.get("nodes", [])

        ir_node_lookup = _build_ir_node_lookup(
            flow_nodes=flowchart_result.get("nodes", []),
            dependency_nodes=dependency_nodes,
            coverage_node_coverage_map=coverage_result.get("coverage_node_coverage_map", {}),
        )

        result_payload = {
            "status": "success",
            "job_id": job_id,
            "language": body.language,
            "support_level": get_support_level(body.language),
            "flowchart": {
                "ir": ir_payload,
                "nodes": flowchart_result.get("nodes", []),
                "edges": flowchart_result.get("edges", []),
            },
            "dependency": {
                "graph_id": dependency_result.get("graph_id", ""),
                "nodes": dependency_nodes,
                "edges": dependency_result.get("edges", []),
                "clusters": dependency_result.get("clusters", []),
            },
            "execution": {
                "total_steps": len(execution_result.get("steps", [])),
                "execution_worker": execution_result.get("worker", "local"),
                "steps": execution_result.get("steps", []),
            },
            "coverage": {
                "format": coverage_result.get("format", "Native"),
                "node_coverage_map": coverage_result.get("node_coverage_map", {}),
                "coverage_node_coverage_map": coverage_result.get("coverage_node_coverage_map", {}),
                "summary": coverage_result.get("summary", {}),
                "report_json": coverage_result.get("report_json", {}),
            },
            "ir_node_lookup": ir_node_lookup,
            # Compatibility fields retained during migration.
            "ir": ir_payload,
            "nodes": flowchart_result.get("nodes", []),
            "edges": flowchart_result.get("edges", []),
        }

        await ANALYZE_RESULT_STORE.save_result(job_id, result_payload)
        return result_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analyze/{job_id}")
async def poll_analysis(job_id: str, user: dict = Depends(get_current_user)):
    """Return cached unified analysis result."""
    cached = await ANALYZE_RESULT_STORE.get_result(job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Analysis job not found or expired")
    return {
        "status": "completed",
        "job_id": job_id,
        "results": cached,
    }


@app.get("/api/v1/analyze/{job_id}/flowchart")
async def get_analyze_flowchart_for_node(
    job_id: str,
    ir_node_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    """
    Lazy node-focused flowchart fetch for dependency-panel linking.
    Returns cached full flowchart and focus metadata.
    """
    cached = await ANALYZE_RESULT_STORE.get_result(job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Analysis job not found or expired")

    flowchart = cached.get("flowchart", {}) if isinstance(cached, dict) else {}
    flow_nodes = flowchart.get("nodes", cached.get("nodes", [])) if isinstance(flowchart, dict) else []
    flow_edges = flowchart.get("edges", cached.get("edges", [])) if isinstance(flowchart, dict) else []
    lookup = cached.get("ir_node_lookup", {}) if isinstance(cached, dict) else {}

    focus_flowchart_node_id: Optional[str] = None
    if ir_node_id:
        entry = lookup.get(ir_node_id, {}) if isinstance(lookup, dict) else {}
        focus_flowchart_node_id = entry.get("flowchart_node_id") if isinstance(entry, dict) else None
        if not focus_flowchart_node_id:
            for node in flow_nodes:
                data = node.get("data", {}) if isinstance(node, dict) else {}
                if str(data.get("ir_node_id", "")).strip() == ir_node_id:
                    focus_flowchart_node_id = str(node.get("id", "")).strip() or None
                    break

    return {
        "status": "success",
        "job_id": job_id,
        "flowchart": {
            "nodes": flow_nodes,
            "edges": flow_edges,
        },
        "focus_ir_node_id": ir_node_id,
        "focus_flowchart_node_id": focus_flowchart_node_id,
        "cache_hit": True,
    }


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
        execution_result = await loop.run_in_executor(
            None,
            _run_execution_pipeline,
            body.ir,
            body.code,
            body.file,
            body.step_limit,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    steps = execution_result.get("steps", [])
    worker = str(execution_result.get("worker", "local"))

    payload: Dict[str, Any] = {
        "job_id": job_id,
        "status": "ready",
        "created_at": int(time.time() * 1000),
        "breakpoint_node_ids": sorted(set(body.breakpoint_node_ids or [])),
        "conditional_breakpoints": {
            str(node_id): str(expr)
            for node_id, expr in (body.conditional_breakpoints or {}).items()
            if str(node_id)
        },
        "breakpoint_hits": [],
        "steps": steps,
    }
    await EXECUTION_JOB_STORE.save_job(job_id, payload)

    return {
        "status": "success",
        "job_id": job_id,
        "total_steps": len(steps),
        "execution_worker": worker,
        "breakpoint_node_ids": payload["breakpoint_node_ids"],
        "conditional_breakpoints": payload["conditional_breakpoints"],
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
        "conditional_breakpoints": job.get("conditional_breakpoints", {}),
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
        "conditional_breakpoints": job.get("conditional_breakpoints", {}),
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


@app.websocket("/ws/execution/{job_id}")
async def execution_stream_compat(job_id: str, websocket: WebSocket):
    """
    Compatibility route matching the FullSplit contract.
    """
    await execution_stream(job_id, websocket)


@app.post("/api/v1/coverage")
@limiter.limit("20/minute")
async def import_coverage_report(
    request: Request,
    file: UploadFile = File(...),
    job_id: Optional[str] = Form(None),
    flowchart_json: Optional[str] = Form(None),
    code: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    """
    Import coverage report and merge coverage status into flowchart nodes.

    Accepted formats:
    - coverage.xml (pytest-cov / Cobertura)
    - lcov.info (Istanbul/gcov style)
    - jacoco.xml
    - CodeFlowX native JSON (line_hits/node_hits/steps)
    """
    _cleanup_coverage_cache()

    if not file:
        raise HTTPException(status_code=400, detail="Coverage file is required")

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Coverage file is empty")

    flow_nodes: List[Dict[str, Any]] = []
    flow_edges: List[Dict[str, Any]] = []

    if flowchart_json:
        try:
            parsed_flow = json.loads(flowchart_json)
            flow_nodes = parsed_flow.get("nodes", []) if isinstance(parsed_flow, dict) else []
            flow_edges = parsed_flow.get("edges", []) if isinstance(parsed_flow, dict) else []
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid flowchart_json payload: {exc}")
    elif job_id:
        cached = await ANALYZE_RESULT_STORE.get_result(job_id)
        if not cached:
            raise HTTPException(status_code=404, detail="Unknown job_id. Run /api/v1/analyze first or send flowchart_json.")
        flowchart_result = cached.get("flowchart", {}) if isinstance(cached, dict) else {}
        if isinstance(flowchart_result, dict):
            flow_nodes = flowchart_result.get("nodes", [])
            flow_edges = flowchart_result.get("edges", [])
        if (not flow_nodes or not flow_edges) and isinstance(cached, dict):
            # Legacy shape compatibility.
            flow_nodes = cached.get("nodes", flow_nodes)
            flow_edges = cached.get("edges", flow_edges)
    elif code and language:
        if not is_language_supported(language):
            raise HTTPException(status_code=400, detail=f"Language '{language}' is not supported.")
        generated = _run_flowchart_pipeline(code, language)
        if generated.get("status") == "error":
            return generated
        flow_nodes = generated.get("nodes", [])
        flow_edges = generated.get("edges", [])
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide one of: flowchart_json, job_id, or (code + language).",
        )

    if not isinstance(flow_nodes, list) or not isinstance(flow_edges, list) or not flow_nodes:
        raise HTTPException(status_code=400, detail="Flowchart context is missing nodes/edges.")

    cache_key = hashlib.sha1(
        f"{job_id or ''}:{file.filename or 'coverage'}:{len(raw_bytes)}:{hashlib.md5(raw_bytes).hexdigest()}".encode("utf8")
    ).hexdigest()
    cached_result = COVERAGE_RESULT_CACHE.get(cache_key)
    if cached_result and int(cached_result.get("expires_at", 0)) > int(time.time() * 1000):
        return cached_result.get("response", {})

    try:
        parsed = parse_coverage_payload(file.filename or "coverage.dat", raw_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"{exc} Example files: coverage.xml, lcov.info, jacoco.xml, codeflowx-native.json",
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse coverage file: {exc}")

    merged = apply_coverage_to_flowchart(
        nodes=flow_nodes,
        edges=flow_edges,
        parsed=parsed,
    )
    coverage_node_coverage_map = _map_coverage_by_ir_node_id(
        flow_nodes=merged["nodes"],
        node_coverage_map=merged["node_coverage_map"],
    )
    report_json = dict(merged["report_json"])
    report_json["coverage_node_coverage_map"] = coverage_node_coverage_map

    format_label_map = {
        "pytest-cov": "pytest-cov",
        "istanbul": "Istanbul",
        "jacoco": "JaCoCo",
        "native": "Native",
    }
    response_payload = {
        "status": "success",
        "format": format_label_map.get(parsed.format, parsed.format),
        "flowchart": {
            "nodes": merged["nodes"],
            "edges": merged["edges"],
        },
        "node_coverage_map": merged["node_coverage_map"],
        "coverage_node_coverage_map": coverage_node_coverage_map,
        "summary": merged["summary"],
        "report_json": report_json,
    }

    COVERAGE_RESULT_CACHE[cache_key] = {
        "expires_at": int(time.time() * 1000) + (COVERAGE_CACHE_TTL_SECONDS * 1000),
        "response": response_payload,
    }
    return response_payload


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
