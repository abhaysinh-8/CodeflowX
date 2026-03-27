# CodeFlowX+

CodeFlowX+ converts source code into an IR tree and interactive visualizations.

- `backend/` FastAPI service (parse -> IR -> flowchart + dependency graph)
- `frontend/` React + Vite app (editor + flowchart/dependency views)

## Feature Status

- `3.1 Code-to-Flowchart`: implemented and tested
- `3.3 Dependency Graph`: implemented and tested
- `3.2 Execution Visualizer`: in progress
- `3.4 Coverage Heatmap`: not implemented yet

Important planning note:

- `3.4` can be developed before `3.2` for XML/LCOV/JaCoCo import + IR mapping + heatmap overlay.
- The only `3.4` item that depends on `3.2` is importing native execution-export JSON.

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm 10+

## Backend Setup

From repo root:

```powershell
python -m pip install fastapi uvicorn pydantic pyjwt slowapi python-multipart httpx tree-sitter tree-sitter-python tree-sitter-javascript tree-sitter-typescript tree-sitter-java pytest
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend URLs:

- API root: `http://localhost:8000/`
- Health: `http://localhost:8000/health`
- OpenAPI docs: `http://localhost:8000/docs`

## Frontend Setup

In a second terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend URLs:

- App: `http://localhost:5173/`
- Dashboard: `http://localhost:5173/dashboard`

## Backend-Frontend Integration Check

1. Open `http://localhost:5173/dashboard`
2. Paste code in the editor
3. Select language
4. Keep `flowchart` tab active and click `Analyze` (tests feature `3.1`)
5. Switch to `dependency` tab and click `Analyze` (tests feature `3.3`)
6. Confirm graph renders and clicking dependency nodes can jump to flowchart

Notes:

- Frontend uses backend at `http://localhost:8000`.
- App fetches JWT from `POST /api/v1/login` before protected endpoints.

## Test Commands

From repo root:

```powershell
$env:PYTHONPATH = (Get-Location).Path
python -m pytest -q backend/tests

cd frontend
npm run lint
npm test -- --run
npm run build
```

## Main API Endpoints

- `POST /api/v1/login`
- `GET /api/v1/languages`
- `POST /api/v1/flowchart`
- `POST /api/v1/analyze`
- `GET /api/v1/analyze/{job_id}`
- `POST /api/v1/dependency`
- `GET /api/v1/dependency/search?q=...&graph_id=...`
- `GET /api/v1/dependency/subgraph/{node_id}?graph_id=...&hops=...`
- `GET /health`
