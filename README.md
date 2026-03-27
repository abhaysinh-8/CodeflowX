# CodeFlowX+

CodeFlowX+ converts source code into an IR tree and an interactive flowchart.
This repo contains:

- `backend/` FastAPI service (parse -> IR -> flowchart)
- `frontend/` React + Vite app (editor + flowchart canvas)

## Current Scope

Implemented and verified for feature `3.1` (Code-to-Flowchart conversion):

- multi-language parse pipeline (Python, JavaScript, TypeScript, Java partial)
- IR transformation with stable IDs and source ranges
- flowchart node/edge generation with branches and loops
- frontend integration for flowchart rendering and source-line highlighting

## Prerequisites

- Python 3.11+ (3.14 also works)
- Node.js 20+
- npm 10+

## Backend Setup

From repo root:

```powershell
python -m pip install fastapi uvicorn pydantic pyjwt slowapi tree-sitter tree-sitter-python tree-sitter-javascript tree-sitter-typescript tree-sitter-java pytest
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

Frontend URL:

- App: `http://localhost:5173/`
- Dashboard: `http://localhost:5173/dashboard`

## Integration Check (Backend + Frontend)

1. Open `http://localhost:5173/dashboard`
2. Paste code in the editor
3. Select language
4. Click `Analyze`
5. Confirm flowchart renders and node click highlights source lines

Notes:

- Frontend calls backend at `http://localhost:8000` (configured in `frontend/src/hooks/useFlowchartAPI.ts`).
- The app fetches JWT from `POST /api/v1/login` before calling protected analysis endpoints.

## Test Commands

From repo root:

```powershell
python -m pytest -q backend/tests
cd frontend
npm test -- --run
```

## Main API Endpoints

- `POST /api/v1/login`
- `GET /api/v1/languages`
- `POST /api/v1/flowchart`
- `POST /api/v1/analyze`
- `GET /api/v1/analyze/{job_id}`
- `GET /health`
