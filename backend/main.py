from fastapi import FastAPI, HTTPException, Security, Depends
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import sys
import os

# Ensure the backend directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.parsers.grammar_loader import GrammarLoader
from backend.parsers.language_registry import LanguageRegistry
from backend.ir.transformer import ASTTransformer
from backend.modules.flowchart import FlowchartModule
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

@app.get("/")
def read_root():
    return {"status": "CodeFlowX+ Backend Active", "version": "1.2.0"}

@app.post("/api/v1/login")
async def login():
    """Simple login to get a token for testing."""
    token = create_access_token(data={"sub": "demo_user"})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/api/v1/flowchart")
@limiter.limit("10/minute")
async def generate_flowchart(request: CodeParseRequest, user: dict = Depends(get_current_user)):
    """
    Parses code and generates a visual flowchart.
    """
    try:
        # 1. Parse into raw AST
        tree = GrammarLoader.parse(request.code, request.language)
        if not tree:
             # Basic syntax error detection
             return {
                 "error": f"Failed to parse {request.language} code. Please check syntax.",
                 "line": 0,
                 "column": 0
             }
        
        # 2. Transform into IR
        transformer = ASTTransformer(request.language, request.code)
        ir_tree = transformer.transform(tree.root_node)
        
        # 3. Generate Flowchart
        flowchart_gen = FlowchartModule()
        result = flowchart_gen.generate(ir_tree)
        
        return {
            "status": "success",
            "language": request.language,
            "ir": ir_tree,
            "nodes": result["nodes"],
            "edges": result["edges"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analyze/{job_id}")
async def poll_analysis(job_id: str, user: dict = Depends(get_current_user)):
    """Mock polling endpoint."""
    return {"status": "completed", "job_id": job_id}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.2.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
