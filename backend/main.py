from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import time
import sys
import os

# Ensure the backend directory is in the path for imports to work regardless of how it's started
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.parsers.grammar_loader import GrammarLoader
from backend.parsers.language_registry import LanguageRegistry
from backend.ir.transformer import ASTTransformer

app = FastAPI(title="CodeFlowX+ Backend")

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
    return {"status": "CodeFlowX+ Backend Active", "version": "1.1.0"}

@app.post("/parse")
async def parse_code(request: CodeParseRequest):
    """
    Parses code into Tree-sitter AST and language-agnostic IR.
    """
    try:
        # 1. Parse into raw AST
        tree = GrammarLoader.parse(request.code, request.language)
        if not tree:
            raise HTTPException(status_code=400, detail=f"Language '{request.language}' not supported or parsing failed.")
        
        # 2. Transform into IR
        transformer = ASTTransformer(request.language, request.code)
        ir_tree = transformer.transform(tree.root_node)
        
        return {
            "status": "success",
            "language": request.language,
            "ast_root_type": tree.root_node.type,
            "ir": ir_tree
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_code(request: CodeParseRequest):
    # Keep the old endpoint for compatibility but enhance it?
    # For now, just return a success response or reuse the parse logic
    return await parse_code(request)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.1.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
