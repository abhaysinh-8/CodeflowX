from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import time

app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CodeRequest(BaseModel):
    code: str

@app.get("/")
def read_root():
    return {"status": "CodeFlowX+ Backend Active", "version": "1.0.0"}

@app.post("/analyze")
async def analyze_code(request: CodeRequest):
    # Mock analysis delay
    time.sleep(0.5)
    return {
        "nodes": [
            {"id": "1", "type": "input", "data": {"label": "Start"}, "position": {"x": 250, "y": 5}},
            {"id": "2", "data": {"label": "Process data"}, "position": {"x": 250, "y": 100}},
            {"id": "3", "type": "output", "data": {"label": "Success"}, "position": {"x": 250, "y": 200}},
        ],
        "edges": [
            {"id": "e1-2", "source": "1", "target": "2", "animated": True},
            {"id": "e2-3", "source": "2", "target": "3", "animated": True},
        ]
    }

@app.get("/execution")
async def get_execution():
    return {
        "steps": [
            {"id": 1, "status": "resolved", "message": "Initialized environment"},
            {"id": 2, "status": "resolved", "message": "Fetched remote dependencies"},
            {"id": 3, "status": "active", "message": "Analyzing control flow blocks"},
            {"id": 4, "status": "pending", "message": "Generating visual graph mapping"},
        ]
    }

@app.get("/dependency")
async def get_dependency():
    return {
        "graph": {
            "main": ["ui", "hooks", "lib"],
            "ui": ["components", "styles"],
            "hooks": ["lib"],
            "lib": []
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
