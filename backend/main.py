from fastapi import FastAPI, HTTPException, Security, Depends, Request, Query
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

import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.parsers.grammar_loader import GrammarLoader, is_language_supported, get_support_level
from backend.ir.transformer import ASTTransformer
from backend.modules.flowchart import FlowchartModule
from backend.modules.dependency import DependencyModule, rank_dependency_nodes, build_subgraph
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


DEPENDENCY_GRAPH_CACHE: Dict[str, Dict[str, Any]] = {}

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
