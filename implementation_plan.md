# CodeFlowX+ — Abhaysinh Phase 1 Implementation Plan

This plan covers Abhaysinh's deliverables for **Phase 1 — Flowchart Engine**.
The goal is to build out the full frontend UI, integrate real Monaco Editor and React Flow canvas with custom node shapes, wire up the Zustand store, and stub the JS/TS backend grammar loader.

---

## User Review Required

> [!IMPORTANT]
> **Branch strategy decision needed.** The project is on `main` with 4 commits, all from initial setup.  
> Since Yash will also be making commits (backend side), working on a **feature branch** is strongly recommended:
> ```
> git checkout -b feature/phase1-abhaysinh
> ```
> Merge to `main` via PR when Phase 1 frontend is complete.  
> **Please confirm this before we start.** (Alternatively, if you and Yash will coordinate directly, working on `main` is fine for now.)

---

## Proposed Changes

### Frontend — Zustand Store

#### [MODIFY] [App.tsx](file:///d:/githubdesk/codeflowx/frontend/src/App.tsx)
- Replace the click-intercept hack with `react-router-dom` routing (or keep simple for now and add proper routing later)
- Install `zustand` and `@monaco-editor/react` packages

#### [NEW] `frontend/src/store/useStore.ts`
- Zustand global store with slices:
  - `code: string` — current editor content
  - `language: string` — selected language (python/js/ts/java)
  - `selectedNodeId: string | null` — cross-view sync
  - `executionState: object` — for Phase 2
  - `coverageData: object` — for Phase 4

---

### Frontend — Monaco Editor Component

#### [NEW] `frontend/src/components/editor/CodeEditorPanel.tsx`
- Real `@monaco-editor/react` editor replacing the fake mock in Dashboard
- Props: `value`, `onChange`, `language`, `onFileUpload`
- File upload button using `<input type="file">` reads [.py](file:///d:/githubdesk/codeflowx/backend/main.py), [.ts](file:///d:/githubdesk/codeflowx/frontend/vite.config.ts), [.js](file:///d:/githubdesk/codeflowx/frontend/eslint.config.js), `.java` files
- Auto-detect language from file extension → dispatches to Zustand store
- Language badge shown in toolbar

#### [NEW] `frontend/src/components/editor/LanguageSelector.tsx`
- Dropdown: `Python 3.x` | `JavaScript` | `TypeScript` | `Java 11+`
- Keyboard shortcut `Ctrl+Shift+L` to cycle language
- Shows "Language partially supported" banner for Java (stub state)

---

### Frontend — Custom React Flow Node Components (6 shapes)

#### [NEW] `frontend/src/components/nodes/FunctionNode.tsx`
- Blue header bar with function name, body label

#### [NEW] `frontend/src/components/nodes/DecisionNode.tsx`
- Yellow diamond shape via CSS `transform: rotate(45deg)` trick
- True/False edge label badges

#### [NEW] `frontend/src/components/nodes/LoopNode.tsx`
- Green body with loop counter badge and back-edge arrow

#### [NEW] `frontend/src/components/nodes/TerminalNode.tsx`
- Rounded pill (start = green, end = red)

#### [NEW] `frontend/src/components/nodes/CallNode.tsx`
- Purple subprocess box with double-border style

#### [NEW] `frontend/src/components/nodes/TryCatchNode.tsx`
- Orange outer box, dashed fault-edge style

#### [NEW] `frontend/src/components/nodes/index.ts`
- Exports `nodeTypes` map for React Flow

---

### Frontend — Flowchart Canvas

#### [MODIFY] [frontend/src/pages/Dashboard.tsx](file:///d:/githubdesk/codeflowx/frontend/src/pages/Dashboard.tsx)
- Replace [FlowchartTab](file:///d:/githubdesk/codeflowx/frontend/src/pages/Dashboard.tsx#31-47) placeholder with real `<FlowchartCanvas />` component
- Replace [CodeEditor](file:///d:/githubdesk/codeflowx/frontend/src/pages/Dashboard.tsx#6-30) mock with real `<CodeEditorPanel />`
- Wire "Run Analysis" button to `POST /api/v1/flowchart`
- Handle loading state (skeleton animation) and error state (error banner)

#### [NEW] `frontend/src/components/canvas/FlowchartCanvas.tsx`
- Full `@xyflow/react` `<ReactFlow>` canvas
- Uses all 6 custom node types via `nodeTypes` map
- Zoom/Pan/Fit-to-screen controls (using React Flow's built-in `<Controls />`)
- Minimap (bottom-right using `<MiniMap />`)
- Node tooltip on hover (name + source line range via `title` or custom tooltip)

#### [NEW] `frontend/src/components/canvas/IRDebugPanel.tsx`
- Collapsible side panel (dev mode only, gated by `import.meta.env.DEV`)
- Renders IR tree as a collapsible tree view
- Clicking a node highlights the corresponding lines in Monaco Editor

---

### Frontend — API Integration & UX

#### [NEW] `frontend/src/components/ui/Toast.tsx`
- Lightweight toast notification system (success / error / info)
- No external dependency — pure React + framer-motion animations

#### [NEW] `frontend/src/hooks/useFlowchartAPI.ts`
- `POST /api/v1/flowchart` call with `{ code, language }` payload
- Returns `{ nodes, edges }` or structured error
- Manages `isLoading`, `error`, `data` states

---

### Backend — JS/TS Grammar Stub (Abhaysinh's backend task)

#### [MODIFY] [backend/main.py](file:///d:/githubdesk/codeflowx/backend/main.py) → refactor to use proper router structure
This is the only backend file Abhaysinh touches in Phase 1:

#### [NEW] `backend/parsers/grammar_loader.py`
- Stub `load_grammar(language: str)` function
- Handles `typescript`, `javascript` with a comment noting `tree-sitter-typescript` is the target grammar
- Stub for Java 11+ grammar
- Documents the interface for contributor grammar additions

---

## Verification Plan

### Install new packages
```bash
cd frontend
npm install zustand @monaco-editor/react react-router-dom
```

### Run Dev Server
```bash
cd frontend
npm run dev
```

### Visual Manual Verification (Browser)
1. Open `http://localhost:5173`
2. Navigate to Dashboard (click "Get Started")
3. **Monaco Editor**: Type code in the editor — syntax highlighting should appear
4. **Language Selector**: Change language in dropdown — Monaco should re-highlight accordingly
5. **File Upload**: Upload a [.py](file:///d:/githubdesk/codeflowx/backend/main.py) file — editor content should update and language auto-set to Python
6. **Run Analysis**: Click "Run Analysis" — canvas should show placeholder flowchart nodes from mock backend
7. **Node Shapes**: Confirm all 6 custom node shapes render on canvas (use mock data initially)
8. **Zoom/Pan/Minimap**: Interact with canvas — zoom in/out, pan, minimap should update
9. **Node Hover Tooltip**: Hover over a node — should show name + source line range

### Lint Check
```bash
cd frontend
npm run lint
```

### Vitest Tests (to be written as part of this phase)
```bash
cd frontend
npx vitest run
```
Tests to write:
- Each node shape component renders without crashing
- `LanguageSelector` shows correct options
- `useFlowchartAPI` hook calls correct endpoint with correct payload (mocked fetch)
