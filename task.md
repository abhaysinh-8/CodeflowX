# CodeFlowX+ — Abhaysinh's Task Checklist

## Phase 1 — Flowchart Engine

### Branch Decision
- [ ] Decide: work on `main` or create `feature/phase1-abhaysinh` branch

### Frontend Environment Setup
- [ ] Verify Vite + React 18 + TypeScript strict setup is complete ✓ (already scaffolded)
- [ ] Confirm Tailwind CSS dark/light mode working ✓ (already scaffolded)
- [ ] Confirm React Flow (`@xyflow/react`) installed ✓ (in package.json)
- [ ] Confirm Monaco Editor (`monaco-editor`) installed ✓ (in package.json)
- [ ] Set up ESLint + Prettier config (check existing eslint.config.js)
- [ ] Set up Vitest for frontend tests
- [ ] Set up GitHub Actions CI: lint + vitest

### Monaco Editor Component
- [ ] Replace mock CodeEditor with real `monaco-editor` component (use `@monaco-editor/react`)
- [ ] Wire Monaco value to Zustand code state
- [ ] Add syntax highlighting per language
- [ ] Auto-detect language from file extension on upload
- [ ] Upload code file button (reads & sets editor content)

### Language Selector UI
- [ ] Build language dropdown selector (Python / JS / TS / Java)
- [ ] Show language badge in editor toolbar
- [ ] Paste detection: auto-set language from clipboard
- [ ] Keyboard shortcut to switch language (Ctrl+Shift+L)
- [ ] Language-specific editor theme (Python=blue, JS=yellow gutter)
- [ ] Show 'Language not fully supported' banner for partial grammars

### Custom React Flow Node Components (6 shapes)
- [ ] `FunctionNode` — blue header bar + body label
- [ ] `DecisionNode` — yellow diamond with true/false edge labels
- [ ] `LoopNode` — green body + back-edge arrow
- [ ] `TerminalNode` — rounded start/end circle
- [ ] `CallNode` — purple subprocess box
- [ ] `TryCatchNode` — orange fault-edge dashes

### Flowchart Canvas
- [ ] Implement zoom / pan / fit-to-screen controls
- [ ] Minimap component (bottom-right)
- [ ] Node tooltip on hover (name + line range)
- [ ] Call `/api/v1/flowchart` on submit, handle loading & errors
- [ ] Loading skeleton animation while awaiting API
- [ ] Display structured error with line highlight on syntax error

### IR Debug Panel
- [ ] Build collapsible IR tree explorer side panel (dev mode toggle)
- [ ] Click IR node → highlight in editor
- [ ] Node count + edge count summary badges in toolbar

### API Integration
- [ ] Loading progress bar with percentage
- [ ] Toast notifications for success / error
- [ ] API error boundary component wrapping canvas
- [ ] Retry button on network failure

### Zustand Store Setup (Abhaysinh's layer)
- [ ] Set up Zustand store: `selectedNodeId`, `executionState`, `coverageData`, `codeState`
- [ ] All feature UI components subscribe to global store

### Backend — JS/TS Grammar Stub (Abhaysinh's backend task)
- [ ] Write grammar loader for TypeScript ES2020+
- [ ] Stub Java 11+ grammar loader
- [ ] Document grammar-addition guide for contributors

### Tests (Vitest — Frontend)
- [ ] Test: each custom node shape component renders correctly
- [ ] Snapshot tests for flowchart layout
- [ ] Test keyboard controls on canvas
- [ ] Test language selector component

### Documentation
- [ ] Frontend README: dev server + build instructions
- [ ] CONTRIBUTING.md frontend guide
