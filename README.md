# CodeFlowX+

CodeFlowX+ parses source code into an IR tree and powers four synchronized views:

- flowchart generation
- execution simulation (with breakpoints + websocket streaming)
- dependency graph generation
- coverage heatmap overlay

## Current Scope

- `3.1 Code-to-Flowchart`: implemented and tested
- `3.2 Execution Visualizer`: implemented and tested
- `3.3 Dependency Graph`: implemented and tested
- `3.4 Coverage Heatmap`: implemented and tested
- `4.1 Cross-View Linking`: implemented and tested

## Repository Structure (Current)

The tree below reflects the source layout in this repository.

```text
.
|-- .github/
|   `-- workflows/
|       `-- ci.yml
|-- backend/
|   |-- api/
|   |   `-- auth.py
|   |-- ir/
|   |   |-- ir_node.py
|   |   |-- transformer.py
|   |   `-- utils.py
|   |-- modules/
|   |   |-- coverage.py
|   |   |-- dependency.py
|   |   |-- execution.py
|   |   `-- flowchart.py
|   |-- parsers/
|   |   |-- grammar_loader.py
|   |   |-- language_registry.py
|   |   `-- __init__.py
|   |-- tests/
|   |   |-- conftest.py
|   |   |-- test_analyze_api.py
|   |   |-- test_coverage_api.py
|   |   |-- test_dependency.py
|   |   |-- test_dependency_api.py
|   |   |-- test_execution.py
|   |   |-- test_flowchart.py
|   |   |-- test_flowchart_api.py
|   |   |-- test_ir.py
|   |   `-- test_parser.py
|   `-- main.py
|-- docs/
|   |-- CodeFlowX_Documentation.md
|   |-- CodeFlowX_FullSplit.md
|   `-- Optimization_Plan_3.1_3.3.md
|-- frontend/
|   |-- public/
|   |   |-- favicon.svg
|   |   `-- icons.svg
|   |-- src/
|   |   |-- components/
|   |   |   |-- canvas/
|   |   |   |-- coverage/
|   |   |   |-- demo/
|   |   |   |-- dependency/
|   |   |   |-- editor/
|   |   |   |-- execution/
|   |   |   |-- features/
|   |   |   |-- hero/
|   |   |   |-- layout/
|   |   |   |-- nodes/
|   |   |   `-- ui/
|   |   |-- hooks/
|   |   |   |-- useCoverageAPI.ts
|   |   |   |-- useDependencyAPI.ts
|   |   |   |-- useExecutionAPI.ts
|   |   |   `-- useFlowchartAPI.ts
|   |   |-- modules/flowchart/
|   |   |-- pages/
|   |   |   |-- Dashboard.tsx
|   |   |   `-- Landing.tsx
|   |   |-- store/
|   |   |   |-- useFlowchartStore.ts
|   |   |   |-- useStore.test.ts
|   |   |   `-- useStore.ts
|   |   |-- types/
|   |   |   `-- execution.ts
|   |   |-- App.tsx
|   |   `-- main.tsx
|   |-- package.json
|   `-- vite.config.ts
|-- LICENSE
`-- README.md
```

Note: local dev folders such as `frontend/node_modules`, `frontend/dist`, `.pytest_cache`, `.vite`, and `__pycache__` are generated artifacts and not part of source design.

## Supported Languages

- `python` (full)
- `javascript` (full)
- `typescript` (full)
- `java` (partial)

## Run Locally

### Prerequisites

- Python `3.11+` (CI uses 3.12)
- Node.js `20+`
- npm `10+`

### Backend

From repo root:

```powershell
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn slowapi PyJWT cryptography python-multipart httpx pytest tree-sitter tree-sitter-python tree-sitter-javascript tree-sitter-typescript tree-sitter-java
$env:PYTHONPATH = (Get-Location).Path
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend URLs:

- API root: `http://localhost:8000/`
- Health: `http://localhost:8000/health`
- OpenAPI docs: `http://localhost:8000/docs`

### Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend URLs:

- App: `http://localhost:5173/`
- Dashboard: `http://localhost:5173/dashboard`

## API Reference (Current)

Base URL: `http://localhost:8000`

### Authentication

1. Get token via `POST /api/v1/login`
2. Send `Authorization: Bearer <token>` on protected HTTP endpoints
3. WebSocket execution routes currently do not require JWT

### Public HTTP Endpoints

- `GET /` -> backend status + version
- `GET /health` -> health + version
- `POST /api/v1/login` -> demo JWT token
- `GET /api/v1/languages` -> supported language list with support tier

### Protected HTTP Endpoints

#### Flowchart + Unified Analyze

- `POST /api/v1/flowchart` (rate limit: `10/min`)
  - body: `{ "code": "...", "language": "python|javascript|typescript|java" }`
- `POST /api/v1/analyze` (rate limit: `10/min`)
  - body: same as flowchart
  - returns: `flowchart`, `dependency`, `execution`, `coverage`, `ir_node_lookup`, `job_id`
- `GET /api/v1/analyze/{job_id}`
  - returns cached unified payload
- `GET /api/v1/analyze/{job_id}/flowchart?ir_node_id=<id>`
  - lazy flowchart fetch for dependency side-panel linking

#### Execution

- `POST /api/v1/execution` (rate limit: `20/min`)
  - body:
    - `ir` (required)
    - `breakpoint_node_ids` (optional)
    - `conditional_breakpoints` (optional map)
    - `step_limit` (optional)
    - `code`, `language`, `file` (optional metadata inputs)
- `GET /api/v1/execution/{job_id}`
- `GET /api/v1/execution/{job_id}/step/{n}` (`n` is 1-based)
- `GET /api/v1/execution/{job_id}/breakpoints`

#### Coverage

- `POST /api/v1/coverage` (rate limit: `20/min`, multipart)
  - required file field: `file`
  - plus one context mode:
    - `flowchart_json` (nodes + edges), or
    - `job_id` (from `/api/v1/analyze`), or
    - `code` + `language`
  - accepted coverage formats:
    - Cobertura XML (`coverage.xml`)
    - LCOV (`.info`)
    - JaCoCo XML (`jacoco.xml`)
    - CodeFlowX native JSON

#### Dependency

- `POST /api/v1/dependency` (rate limit: `10/min`)
  - body: `{ "code": "...", "language": "...", "module_path": "main.py" }`
- `GET /api/v1/dependency/search?q=<query>&graph_id=<id>&cursor=<optional>&limit=<1-50>`
- `GET /api/v1/dependency/subgraph/{node_id}?graph_id=<id>&hops=<1-4>`

### WebSocket Endpoints (Execution Stream)

- `WS /execution/{job_id}?start=0&rate=3`
- `WS /ws/execution/{job_id}?start=0&rate=3` (compat route)

Client command messages:

- `{"event":"RESUME"}`
- `{"event":"PAUSE"}`
- `{"event":"SET_RATE","steps_per_second":5}`
- `{"event":"JUMP","step_index":10}`
- `{"event":"PLAY_TO_NEXT_BREAKPOINT"}`

Server events include:

- `READY`
- `STEP`
- `PAUSED` (breakpoint)
- `PING`
- `COMPLETED`
- `ERROR`

## Frontend Integration Notes

- Dashboard `Analyze` button uses `POST /api/v1/analyze` as the unified source for flowchart, dependency, execution, and baseline coverage context.
- Dependency side panel lazy-loads flowchart context via `GET /api/v1/analyze/{job_id}/flowchart`.
- Execution view opens websocket stream (`/ws/execution/{job_id}`) and drives step playback, breakpoints, and speed control.
- Coverage workspace uploads report files to `POST /api/v1/coverage` and overlays coverage status onto flowchart nodes.

## Optional Infra/Env Settings

- `CODEFLOWX_REDIS_URL` or `REDIS_URL` for analyze/execution cache backing
- `CODEFLOWX_ANALYZE_CACHE_TTL_SECONDS` (default `1800`)
- `CODEFLOWX_EXECUTION_USE_CELERY=1` to offload execution step generation
- `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`, `CODEFLOWX_EXECUTION_TASK_TIMEOUT`

## Test Commands

From repo root:

```powershell
$env:PYTHONPATH = (Get-Location).Path
python -m pytest -q backend/tests

cd frontend
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
```
