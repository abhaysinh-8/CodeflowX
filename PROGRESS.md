# CodeFlowX+ — Project Progress & Handoff

> Last updated: 2026-03-27 — Abhaysinh
> Branch: `feature/phase1-abhaysinh`

---

## 👥 Team Split

| Person | Role |
|--------|------|
| **Abhaysinh** 🟢 | ALL frontend UI components, JS/TS grammar backend, `dependency.py`, `coverage.py`, Celery/Redis, security frontend |
| **Yash** 🔵 | Python/Java parsers, AST→IR transformer, `flowchart.py`, `execution.py`, FastAPI endpoints, Docker, PostgreSQL |

See [`docs/CodeFlowX_FullSplit.md`](docs/CodeFlowX_FullSplit.md) for the complete task split per feature per person.

---

## 🌿 Branches

```
main                         ← stable base (4 initial commits)
feature/phase1-abhaysinh     ← Abhaysinh's Phase 1 frontend work (current)
```

**Yash should branch off `main` as:** `feature/phase1-yash`  
Both branches merge to `main` via PR when Phase 1 is complete.

---

## ✅ Phase 1 — Completed (Abhaysinh)

### Frontend
- [x] Zustand global store (`src/store/useStore.ts`) — `code`, `language`, `selectedNodeId`, `flowchartData`, `executionState`, `coverageData`
- [x] React Flow canvas with zoom/pan/minimap + Background dots (`src/components/canvas/FlowchartCanvas.tsx`)
- [x] **6 custom node shapes** in `src/components/nodes/`:
  - `FunctionNode` — blue header bar
  - `DecisionNode` — yellow diamond, true/false handles
  - `LoopNode` — green body with loop counter badge
  - `TerminalNode` — rounded pill (green=Start, red=End)
  - `CallNode` — purple double-border subprocess box
  - `TryCatchNode` — orange dashed-border with fault-edge handle
- [x] Real Monaco Editor (`src/components/editor/CodeEditorPanel.tsx`) — syntax highlighting, file upload, auto-detect language
- [x] Language selector dropdown with `Ctrl+Shift+L` shortcut (`src/components/editor/LanguageSelector.tsx`)
- [x] Toast notification system — success/error/info (`src/components/ui/Toast.tsx`)
- [x] IR Debug Panel — dev-only collapsible tree (`src/components/canvas/IRDebugPanel.tsx`)
- [x] `useFlowchartAPI` hook — `POST /api/v1/flowchart` with graceful fallback to mock backend
- [x] Full Dashboard rebuild with sidebar nav, editor+canvas split, Flowchart/Execution/Dependency tabs
- [x] `react-router-dom` routing — `/` landing, `/dashboard`
- [x] "Get Started" button → `/dashboard`

### Backend (Abhaysinh's tasks)
- [x] `backend/parsers/grammar_loader.py` — TypeScript/JS grammar loader (tree-sitter-typescript), Java 11+ stub, contributor guide in docstrings
- [x] `backend/parsers/__init__.py`

---

## 🔵 Phase 1 — Pending (Yash's tasks)

> These are **Yash's** backend deliverables needed to make the frontend fully functional.

- [ ] `POST /api/v1/flowchart` — real Tree-sitter Python/JS → `{ nodes[], edges[] }` response
- [ ] `GET /api/v1/analyze/{job_id}` — async job polling
- [ ] IR Node schema (`IRNode` dataclass) and `ASTTransformer` visitor
- [ ] `backend/modules/flowchart.py` — IR → flowchart node/edge JSON
- [ ] `backend/ir/` — IR schema + transformer
- [ ] `backend/parsers/` — Python grammar loader (Yash), LanguageRegistry
- [ ] Docker Compose — `api`, `postgres`, `redis` services
- [ ] GitHub Actions CI — `ruff` + `pytest`

---

## 🐛 Known Bugs & Unresolved Issues

### 1. Landing Page Spline 3D Animation — 403 Forbidden (Non-blocking)
- **File:** `frontend/src/components/hero/Hero.tsx`
- **Error:** `GET https://prod.spline.design/7f2b650b-.../scene.splinecode 403 (Forbidden)` + `Error: Data read, but end of buffer not reached`
- **Status:** ⚠️ **Non-blocking** — already wrapped in `<ErrorBoundary>`, shows a loading placeholder instead. The rest of the landing page renders fine.
- **Fix when needed:** Replace the Spline URL with a valid one, or swap for a local asset / CSS animation.

### 2. Flowchart Canvas Shows Demo Data Until Backend is Ready
- **File:** `frontend/src/components/canvas/FlowchartCanvas.tsx`
- **Description:** When no real analysis has been run, `DEMO_NODES` / `DEMO_EDGES` (hardcoded sample) are shown. This is intentional.
- **Status:** ✅ By design — clears automatically once Yash's `POST /api/v1/flowchart` returns real data.

### 3. React Flow Node State Not Re-initializing on New Flowchart Data
- **File:** `FlowchartCanvas.tsx` — uses `useNodesState(displayNodes)` initialized once
- **Description:** `useNodesState` only uses its initial argument once; changing `flowchartData` in Zustand won't automatically re-render new nodes from the API.
- **Status:** 🔴 **Bug to fix before API integration** — needs a `useEffect` to call `setNodes(flowchartData.nodes)` and `setEdges(flowchartData.edges)` when `flowchartData` changes.
- **Fix:**
  ```tsx
  const { flowchartData } = useStore();
  const [nodes, setNodes, onNodesChange] = useNodesState(DEMO_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEMO_EDGES);

  useEffect(() => {
    if (flowchartData) {
      setNodes(flowchartData.nodes);
      setEdges(flowchartData.edges);
    }
  }, [flowchartData, setNodes, setEdges]);
  ```

### 4. `useFlowchartAPI` — Wrong Import Paths (Already Fixed)
- Both `../../store/useStore` and `../components/ui/Toast` paths fixed in `src/hooks/useFlowchartAPI.ts`. No action needed.

### 5. Paste Language Auto-Detection Not Implemented
- **File:** `CodeEditorPanel.tsx`
- **Description:** The plan included detecting language from clipboard paste content. Not yet implemented.
- **Status:** 🟡 Low priority — skip for Phase 1, add in Phase 5 polish.

### 6. Vitest & GitHub Actions CI Not Set Up
- **Status:** 🟡 Pending — tests and CI need to be added (both Abhaysinh and Yash).

---

## 🏗️ How to Run Locally

### Frontend
```bash
cd frontend
npm install
npm run dev          # → http://localhost:5173
# OR with cache clear:
npm run dev -- --force
```

### Backend (basic mock server)
```bash
cd backend
pip install fastapi uvicorn pydantic
uvicorn main:app --reload --port 8000
# → http://localhost:8000
```

### Full stack (once Yash sets up Docker)
```bash
docker compose up --build
```

---

## 📁 Key Files Reference

```
frontend/src/
├── store/useStore.ts              ← Zustand global store
├── components/
│   ├── nodes/                     ← 6 custom React Flow node shapes
│   │   ├── FunctionNode.tsx
│   │   ├── DecisionNode.tsx
│   │   ├── LoopNode.tsx
│   │   ├── TerminalNode.tsx
│   │   ├── CallNode.tsx
│   │   ├── TryCatchNode.tsx
│   │   └── index.ts               ← nodeTypes map
│   ├── editor/
│   │   ├── CodeEditorPanel.tsx    ← Monaco Editor
│   │   └── LanguageSelector.tsx   ← Language dropdown
│   ├── canvas/
│   │   ├── FlowchartCanvas.tsx    ← React Flow canvas
│   │   └── IRDebugPanel.tsx       ← Dev IR tree explorer
│   └── ui/Toast.tsx               ← Toast notification system
├── hooks/useFlowchartAPI.ts       ← API integration hook
└── pages/Dashboard.tsx            ← Main app workspace

backend/
├── main.py                        ← FastAPI app (mock endpoints — Yash extends this)
└── parsers/
    ├── grammar_loader.py          ← JS/TS + Java grammar loaders (Abhaysinh)
    └── __init__.py
```

---

## 📋 Phase 2 Preview (Execution Visualizer)

When Phase 1 is merged, Abhaysinh starts Phase 2 frontend:
- Variable Watch Panel (name/value/type table, amber flash on change)
- Step counter + progress bar
- Keyboard nav: `→` next, `←` prev, `Space` play/pause
- Auto-play speed slider (0.5x–10x)
- Reverse step button
- Breakpoint UI (click node → red dot badge)
- Call Stack Panel
- `useExecutionStream()` WebSocket hook

Yash starts Phase 2 backend:
- `ExecutionStep` schema
- IR interpreter (traverse IR tree, emit steps)
- Variable scope stack
- WebSocket `ws/execution/{job_id}`
