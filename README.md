# CodeFlowX+

CodeFlowX+ converts source code into an IR tree and interactive visualizations.

- `backend/` FastAPI service (parse -> IR -> flowchart + dependency graph)
- `frontend/` React + Vite app (editor + flowchart/execution/dependency/coverage views)

## Feature Status

- `3.1 Code-to-Flowchart`: implemented and tested
- `3.3 Dependency Graph`: implemented and tested
- `3.2 Execution Visualizer`: implemented and tested
- `3.4 Coverage Heatmap`: implemented and tested
- `4.1 Cross-View Linking`: implemented and tested

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
4. Click `Analyze` once (always uses unified `POST /api/v1/analyze`)
5. Verify all tabs are populated from the same analysis job (`flowchart`, `execution`, `dependency`, `coverage`)
6. Toggle `Sync On/Off` in the header and verify cross-view selection behavior
7. Use `<` / `>` history buttons to navigate cross-view node selection
8. In `dependency`, click a node and verify the right-side lazy flowchart panel opens
9. In `execution`, run/play and verify active function highlights in dependency view
10. In `coverage`, upload XML/LCOV/JaCoCo/Native and verify heatmap + editor/flowchart bidirectional highlight

Notes:

- Frontend uses backend at `http://localhost:8000`.
- App fetches JWT from `POST /api/v1/login` before protected endpoints.
- Dependency lazy flowchart panel uses `GET /api/v1/analyze/{job_id}/flowchart?ir_node_id=...`.

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
- `GET /api/v1/analyze/{job_id}/flowchart?ir_node_id=...`
- `POST /api/v1/execution`
- `GET /api/v1/execution/{job_id}`
- `GET /api/v1/execution/{job_id}/step/{n}`
- `GET /api/v1/execution/{job_id}/breakpoints`
- `WS /execution/{job_id}`
- `WS /ws/execution/{job_id}`
- `POST /api/v1/dependency`
- `GET /api/v1/dependency/search?q=...&graph_id=...`
- `GET /api/v1/dependency/subgraph/{node_id}?graph_id=...&hops=...`
- `POST /api/v1/coverage` (multipart upload: coverage file + flowchart context)
- `GET /health`
