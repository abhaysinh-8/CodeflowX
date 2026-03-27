# CodeFlowX+ — Full Work Split

> Backend & Frontend tasks split between **Yash** and **Abhaysinh**
>
> **Every task is divided between both team members across BOTH backend and frontend.**

---

## Team Overview

| | 🔵 Yash | 🟢 Abhaysinh |
|---|---|---|
| **Backend** | FastAPI endpoints, Tree-sitter/IR (Features 3.1 & 3.2), Storage & Docker | Tree-sitter JS/TS grammar, dependency.py, coverage.py, Celery/Redis, security |
| **Frontend** | API integration hooks, Zustand state, TanStack Query wiring | ALL React UI components, canvas rendering, panels, accessibility, dark mode |
| **Phases 1–5** | Backend environment, core parser, step engine, call graph extraction, security | Frontend environment, all custom node shapes, variable watch, heatmap UI |
| **Shared** | Backend tests (pytest), backend docs, backend PR reviews | Frontend tests (Vitest), frontend docs, frontend PR reviews |

---

## Section 1 — Feature-by-Feature Work Split

*Each sub-feature broken into backend tasks (split between Yash & Abhaysinh) AND frontend tasks (also split between Yash & Abhaysinh).*

---

### 🔷 3.1 Code-to-Flowchart Conversion

#### Parser & Grammar Setup

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Install tree-sitter Python bindings | Install tree-sitter JS/TS grammar support | Wire language selection to API payload | Build language dropdown selector component |
| | Build `LanguageRegistry`: extension → grammar map | Write grammar loader for TypeScript ES2020+ | Handle parse errors: display line/col in editor | Show language badge in editor toolbar |
| | Write `GrammarLoader.parse(code, lang)` → raw AST | Stub Java 11+ grammar loader | Auto-detect language from file extension on upload | Paste detection: auto-set language from clipboard |
| | Unit tests: valid Python & JS AST produced | Document grammar-addition guide for contributors | | Upload code file button (reads & sets editor content) |

#### IR Node Schema & Transformer

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Define `IRNode` dataclass: `id(UUID)`, `type(enum)`, `language`, `name`, `source_start`, `source_end`, `children[]`, `metadata{}` | Write IR transformer for JS/TS AST nodes | IR Debug Panel (dev mode): collapsible IR tree view | Build IR tree explorer side panel (collapsible) |
| | Implement `ASTTransformer` visitor dispatcher | Handle JS arrow functions, async/await, destructuring | Show `source_start` / `source_end` range on node hover | Click IR node → highlight corresponding source lines in editor |
| | Map: `function_def`, `if/elif/else`, `for/while`, `return`, `call`, `try/catch/finally`, `class`, `assignment` | Write IR utility functions: `find_by_id`, `get_descendants`, `get_ancestors` | | Node count + edge count summary badges in toolbar |
| | Assign stable UUIDs to every IR node | Unit tests for JS/TS IR transformation | | |

#### Flowchart Module

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `FlowchartModule.generate(ir_root)` → `{ nodes[], edges[] }` | Topological sort layout algorithm for node position hints | Call `/api/v1/flowchart` on submit, handle loading & errors | Implement custom React Flow node components per shape |
| | Map IR types to shape enum: `rectangle / diamond / rounded / circle / parallelogram` | Handle cyclic IR graphs (loops) without infinite loops | Render React Flow canvas with backend node/edge data | `FunctionNode`: blue header bar + body label |
| | Generate edges: sequential, true/false branch, loop-back, fault | Add `source_start` / `source_end` to every `FlowchartNode` response | Add zoom controls, pan, fit-to-screen button | `DecisionNode`: yellow diamond with true/false edge labels |
| | `POST /api/v1/flowchart` endpoint + Pydantic schemas | Integration test: Python snippet → assert expected node/edge JSON | | `LoopNode`: green body + back-edge arrow |
| | Return syntax errors as `{ error, line, column }` JSON | | | `TerminalNode`: rounded start/end circle |
| | | | | `CallNode`: purple subprocess box |
| | | | | `TryCatchNode`: orange fault-edge dashes |
| | | | | Minimap panel (bottom-right corner) |

#### Language Support Layer

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Python 3.x: full grammar — decorators, comprehensions, generators, walrus operator | JavaScript/TypeScript: classes, modules, async/await, optional chaining | Language selector dropdown — Python / JS / TS / Java | Keyboard shortcut to switch language (Ctrl+Shift+L) |
| | Java 11+: class, interface, try-with-resources | Stub Go, Rust grammar loaders (roadmap) | Show unsupported language warning toast | Language-specific editor theme (Python=blue, JS=yellow gutter) |
| | Design pluggable grammar plugin interface for contributors | Document how to add a new language to the registry | | Show 'Language not fully supported' banner for partial grammars |

#### API & Error Handling

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `POST /api/v1/flowchart` — main endpoint | `POST /api/v1/analyze` — full pipeline trigger | Show loading skeleton animation while awaiting API | Loading progress bar with percentage |
| | `GET /api/v1/analyze/{job_id}` — async job polling | Pydantic v2 request validation + error messages | Display structured error with line highlight on syntax error | Toast notifications for success / error |
| | JWT auth middleware on all endpoints | Global FastAPI exception handler → structured JSON errors | Retry button on network failure | API error boundary component wrapping canvas |
| | Rate limit: 10 req/min per user | Async endpoint with asyncio (non-blocking) | | |

#### Testing

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | pytest: `ASTTransformer` — all 8 node types | pytest: JS/TS IR transformer edge cases | Vitest: canvas renders with mock node/edge data | Vitest: each custom node shape component |
| | pytest: `FlowchartModule` — node count, edge count | Integration test: `POST /api/v1/flowchart` → assert flowchart JSON | Test loading and error states | Snapshot tests for flowchart layout |
| | 80%+ backend coverage gate in GitHub Actions CI | pytest-asyncio for async endpoint tests | | Test keyboard controls on canvas |

---

### ⚡ 3.2 Execution Visualizer

#### Step Engine Core

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Design `ExecutionStep` schema: `step_id`, `active_node_id`, `prev_node_id`, `variables{}`, `call_stack[]`, `branch_taken`, `loop_counts{}` | Handle loop iteration: increment `loop_counts[node_id]` per iteration | Step counter: 'Step N of M' | Keyboard handler: → next, ← prev, Space toggle auto-play |
| | Implement IR interpreter — traverse IR tree, emit one step per statement node | Handle try/except branching: emit exception-path steps | Linear progress bar across total steps | Auto-Play speed slider: 0.5x – 10x |
| | Track variable scope stack: push on function call, pop on return | Handle nested function calls across files | Step jump: click progress bar to jump to any step | Pause / Resume button during auto-play |
| | | Generate full step array upfront before streaming | | Reverse step button |

#### Variable Watch Panel

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Include full `variables{}` snapshot at every step (not delta) | Detect variable mutations between steps | Variable Watch Panel: two-column table (Name \| Value) | Type badge per variable: `int`=blue, `str`=green, `list`=yellow, `dict`=purple, `bool`=orange |
| | Include type string: `int`, `str`, `list`, `dict`, `bool`, `NoneType` | Include complex nested values (list of dicts, etc.) | Show scope badge: LOCAL / GLOBAL | Amber flash animation on changed variables |
| | Include scope: `local` / `global` | Emit `variable_added`, `variable_changed`, `variable_removed` flags per step | Pin a variable to top of watch panel | Expand/collapse lists and dicts with tree toggle |
| | Include `prev_value` for delta detection | | | 'Changed' diff indicator showing old → new value |

#### Active Node & Branch Highlighting

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Include `active_node_id` and `prev_node_id` in each step | Compute `edge_traversed`: `{ from_id, to_id, label }` per step | Highlight active flowchart node with pulsing blue ring | Animate edge traversal: travelling dot along active edge |
| | Include `branch_taken`: `true` / `false` / `loop` / `exception` | Include animation hint (entry/exit direction) in step payload | Scroll canvas to keep active node in viewport | True branch edge = green flash, False branch = red flash |
| | | | Fade out previous node on step advance | Loop-back edge = orange flash |
| | | | | Exception edge = red dashes flash |

#### Breakpoints

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Accept `breakpoint_node_ids[]` in `POST /api/v1/execution` | Log breakpoint hit events with node metadata | Click node to set breakpoint — red dot badge on node | Conditional breakpoint UI: right-click → 'Add conditional breakpoint' |
| | Pause step emission at breakpoint nodes, emit PAUSED signal | Expose `GET /api/v1/execution/{job_id}/breakpoints` for active breakpoint list | Breakpoint list panel with node names and 'Remove' button | Play-to-next-breakpoint button |
| | Resume on client message via WebSocket | | | Keyboard shortcut: F9 to toggle breakpoint on selected node |
| | Support `step_limit` param to cap simulation length | | | |

#### Call Stack & WebSocket

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `call_stack[]`: `{ function_name, file, source_line, ir_node_id }` per step | Celery task for long execution simulations | Call Stack Panel: vertical frame list, newest on top | Stack depth badge in panel header |
| | `ws/execution/{job_id}`: push each step as JSON | Persistent step storage in Redis (TTL 1h) | Click frame → jump to that function's flowchart | Collapse call stack panel to icon when empty |
| | Handle client disconnect gracefully | WebSocket heartbeat/ping to detect stale connections | | Loop Iteration Counter badge on loop nodes in canvas |
| | Rate-limit to match client speed | | | |

---

### 🕸️ 3.3 Dependency Graph

#### Call Graph Extraction

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Traverse all `function_def` IR nodes | Extract import statements → Imports edges: `module → imported_module` | Wire dependency graph API response to React Flow | Draw cluster boundary boxes around Module/Class groups |
| | Create Calls edge: `caller → callee` for each call IR node | Detect class inheritance → Inherits edges: `child → parent` | Render initial graph layout using backend-provided x, y positions | Expand/collapse cluster to show/hide member nodes |
| | Resolve callee by name via symbol table of all `function_defs` | Detect event handler decorators → Triggers edges | | Cluster label with file path or class name |
| | Detect external calls: `requests.get`, `psycopg2`, `os` → `ExternalServiceNode` + Depends On edge | Handle method calls on class instances (best-effort resolution) | | |

#### Node Types & Grouping

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Group `FunctionNodes` by file → `ModuleNode` clusters | Group `MethodNodes` by class → `ClassNode` sub-clusters | Render node icons per type: ƒ function, 📦 module, C class, ⚡ external, ▶ entrypoint | Node legend panel showing all node types and edge types |
| | Mark `main()` / `__main__` / app entry → `EntrypointNode` | Include external service metadata: service name, call type (HTTP/DB/FS/OS) | Edge type styling: Calls=solid, Imports=dashed, Inherits=dotted, Depends On=bold orange, Triggers=animated purple | Dim unrelated nodes/edges when a node is selected |
| | `POST /api/v1/dependency` — return `{ nodes[], edges[], clusters[] }` | Compute cluster bounding boxes for layout | | Highlight all connected neighbours on node select |
| | Pydantic schema: `DependencyNode(id, type, name, signature, docstring, module, x, y)` | Integration test: known snippet → assert expected node/edge types | | |

#### Navigation & Search

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `GET /api/v1/dependency/search?q=` — fuzzy match across node names | Pagination for large graphs (> 500 nodes): cursor-based API | Click node → open its Flowchart in right side panel (slide-in) | Search bar with debounced API call (300ms) |
| | Return top-10 ranked matches with node type + module path | Sub-graph fetch: `GET /api/v1/dependency/subgraph/{node_id}` returns N-hop neighbourhood | Hover node → tooltip showing function signature + docstring | Filter toolbar: All / Functions / Modules / Classes / External / Entrypoints |
| | Include `function_signature` and `docstring` on every node | | Breadcrumb trail of navigation history with back button | Zoom-to-node button when search result selected |
| | | | | Minimap navigation panel (bottom-right) |

---

### 🌡️ 3.4 Coverage Heatmap

#### Coverage Importers

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Parse `coverage.xml` (pytest-cov / Cobertura): extract `<line number=N hits=M>` | Parse CodeFlowX+ native JSON from Execution Visualizer export | Drag-and-drop coverage file upload zone | Error display if format unrecognized with format examples |
| | Parse `lcov.info` (Istanbul / gcov): extract `DA:line,hits` records | `POST /api/v1/coverage` — accept multipart file upload + job_id | Show detected format badge: pytest-cov / Istanbul / JaCoCo / Native | 'Download sample coverage file' link for each format |
| | Parse `jacoco.xml` (Java/Maven): extract `<line nr=N ci=M>` | Validate file format; return 400 with format hint on failure | Upload progress bar | Show file name and size after successful upload |
| | | Integration test: import sample `coverage.xml` → assert `node_coverage_map` | | |

#### IR Node Mapping & Status

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Map coverage line ranges to IR node IDs using `source_start` / `source_end` overlap | Dead Code: static reachability analysis — nodes with no path from entry IR node | Toggle coverage overlay on/off with toolbar button | Apply color fill to each `FlowchartNode`: Green / Amber / Red / Gray |
| | **Fully Covered**: all lines hit AND all outgoing branches exercised | Store `coverage_status` on each `FlowchartNode` | Coverage toggle keyboard shortcut (C key) | Color-blind safe mode: add pattern overlays (hatching for uncovered, dots for partial) |
| | **Partially Covered**: lines hit but not all branches | Return updated flowchart JSON with `coverage_status` per node | | Animate coverage fade-in on data load |
| | **Uncovered**: no lines hit in any test run | | | |

#### Coverage Summary & Export

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Aggregate: total nodes, covered, partial, uncovered, dead counts | Performance: < 200ms to apply coverage XML to existing flowchart | Coverage Summary Bar: X% covered / Y% partial / Z% uncovered / W% dead | Click uncovered (red) node → jump to source line in Monaco editor |
| | Return summary object in coverage API response | Cache merged coverage result in Redis (TTL 30min) | Click segment to filter canvas to only that category | Click partial (amber) node → tooltip showing which branches are untested |
| | Export coverage report as CodeFlowX+ native JSON | | | Dead Code count badge in coverage summary |
| | | | | Export coverage report button (download JSON) |

---

## Section 2 — Integration Features Work Split

*Cross-view linking, Failure Simulation, AI Explanations, GitHub Integration — all tasks split backend + frontend between both.*

---

### 🔗 4.1 Cross-View Linking

#### Shared IR Node ID

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Ensure all four module outputs use same stable IR node UUID | Include `ir_node_id` in `FlowchartNode`, `DependencyNode`, `ExecutionStep`, `CoverageRecord` | Store `ir_node_id` map in Zustand `selectedNodeId` global store | Animate highlight ring (500ms pulse) on newly selected node across all views |
| | Unified analysis response: all four outputs keyed by `ir_node_id` | Design cross-module IR node lookup table | All four view components subscribe to `selectedNodeId` | Navigation history stack: back/forward buttons across views |
| | `POST /api/v1/analyze` runs all four modules via `asyncio.gather()` | Unit test: same `ir_node_id` appears in flowchart + dependency + coverage outputs | | 'Sync views' toggle button to enable/disable cross-view linking |

#### Dep Graph → Flowchart Link

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Include `flowchart_job_id` in each `DependencyNode` API response | Fetch flowchart for a node on demand (lazy — only when clicked) | Click `DependencyGraph` node → fetch & open its Flowchart in right side panel | Panel has back-button to return to previous flowchart |
| | | Cache fetched flowcharts in Redis so repeated clicks are instant | Panel slide-in animation from right | Breadcrumb: `Module > Class > Function` path shown in panel header |
| | | | | Panel resize handle (drag to widen/narrow) |

#### Execution → Dep Graph Link

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Include `currently_executing_function_id` in each `ExecutionStep` payload | Map executing function to its `DependencyGraph` node in response | Highlight active function's `DependencyGraph` node in blue during execution | Dim all other nodes to 30% opacity during execution |
| | | | | Restore full opacity on pause/end |
| | | | | Execution path trail: visited nodes shown in lighter blue |

#### Coverage → Flowchart Link

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `coverage_node_coverage_map` keyed by `ir_node_id` for fast lookup | Ensure coverage overlay re-applies when flowchart is re-fetched | Coverage colors render directly on `Flowchart` nodes in React Flow | Click red node → Monaco editor scrolls to and highlights those lines |
| | | | Toggle coverage overlay without re-fetching from API | Click amber node → tooltip: which specific branches are untested |
| | | | | Bidirectional: click line in Monaco → highlights Flowchart node |

---

### 💥 4.2 Failure Simulation

#### Failure Simulation API

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `POST /api/v1/simulate/failure` — accept `{ failed_function_id }` | Compute which Flowchart branches become unreachable when function raises | 'Mark as Failed' right-click menu item on any `DependencyGraph` node | Red fill on failed node, orange on directly affected, yellow on transitively affected |
| | Traverse `DependencyGraph` to find all directly + transitively affected nodes | Include severity per node: `directly_affected` / `transitively_affected` | Show blast radius count in toast: 'N functions affected' | Animated pulse on affected nodes |
| | Return `{ affected_nodes[], blast_radius, unreachable_branches[] }` | Support marking multiple functions as failed simultaneously | | Reset failure simulation button |
| | | | | Export failure impact report as JSON |

---

### 🤖 4.3 AI-Powered Explanations

#### AI Setup & Prompt Engineering

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Configure AI model API (OpenAI / Anthropic) | Prompt templates with few-shot examples for each explanation type | Right-click context menu on any Flowchart node, Dep edge, or Coverage region | Explanation popup panel with typing animation (streamed response) |
| | Design context injection for node explanations: IR metadata + code + execution state | Include confidence score (0.0–1.0) and `relevant_lines[]` in response | 'Explain this' menu item triggers request | Confidence badge: High / Medium / Low |
| | `POST /api/v1/explain/node`, `/explain/edge`, `/explain/coverage`, `/simulate/failure` | Rate-limit AI endpoints (5 req/min per user) | | Relevant source lines highlighted in Monaco |
| | Stream AI response via WebSocket for typing effect | Cache repeated explanations by `ir_node_id` in Redis | | Copy to clipboard button, 'Explain more' follow-up |
| | | | | Previous Explanations drawer (session history) |

---

### 🐙 4.4 GitHub Repository Analysis

#### GitHub OAuth2 & Cloning

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Implement OAuth2 flow: redirect → callback → token exchange | GitPython: clone repo to S3-compatible temp storage | GitHub Connect button with OAuth popup flow | Real-time progress bar with file count and currently-parsing filename |
| | Encrypt access token at rest | Auto-detect all supported language files in repo | Repo URL input with validation | Estimated time remaining display |
| | `POST /api/v1/github/connect` — accept repo URL, return `repo_id` | Celery task: batch Tree-sitter parsing (20 files per chunk) | Connection success/failure state display | Cancel analysis button |
| | Read-only repo scope by default | Emit progress via WebSocket: `files_parsed / total_files` | | File tree browser showing repo structure after analysis |

#### Repo Navigation UI

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `GET /api/v1/github/{repo_id}/graph` — full repo dependency graph (paginated) | Load existing coverage reports found in repo (`coverage.xml`, `lcov.info`) | Click file in tree → load its flowchart in main canvas | Fuzzy search across all function names in repo |
| | `GET /api/v1/github/{repo_id}/file/{path}` — flowchart for specific file | Support pagination for large repos (> 1000 nodes cursor-based) | Filter repo dependency graph by directory/module | Breadcrumb path showing current file location |
| | `GET /api/v1/github/{repo_id}/status` — analysis progress | Index all function names for fuzzy search across repo | | Repo overview stats: N files, M functions, P classes |

---

## Section 3 — Phase-by-Phase Work Split

*All 5 phases — each task area split: Yash's backend tasks | Abhaysinh's backend tasks | Yash's frontend tasks | Abhaysinh's frontend tasks.*

---

### Phase 1 — Flowchart Engine *(6–8 Weeks)*

#### Environment Setup

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Create `/backend` with FastAPI + Pydantic v2 + SQLAlchemy 2.0 | Set up Tree-sitter Python bindings (tree-sitter 0.20.x) | Wire Monaco editor value to Zustand code state | Create `/frontend` with Vite + React 18 + TypeScript strict |
| | Configure Docker Compose: api, postgres, redis services | Configure `tree_sitter_languages` package | Set up TanStack Query client | Install Tailwind CSS, React Flow, Monaco Editor, Zustand |
| | Set up ruff linter + pre-commit hooks | Write `LanguageRegistry` scaffold | | Set up ESLint + Prettier + Vitest |
| | GitHub Actions CI: ruff + pytest | Stub grammar loaders for Python & JS | | GitHub Actions CI: lint + vitest |

#### Core AST & IR

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `ASTTransformer.visit()` dispatcher pattern | JS/TS IR transformation | IR Debug Panel: collapsible tree (dev mode toggle) | Monaco Editor component with syntax highlighting |
| | Handle: `function_def`, `if/elif/else`, `for/while`, `return`, `call`, `try/catch`, `class`, `assignment` | IR utility functions: `find_by_id`, `get_descendants` | Click IR node → highlight in editor | Language selector dropdown (Python / JS / TS) |
| | Assign UUIDs, link parent-child | Unit tests for JS/TS IR | | Upload code file button |
| | Unit tests for Python IR transformation | `IRNode` Pydantic schema for API responses | | Auto-detect language from file extension |

#### Flowchart Generation

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `FlowchartModule`: IR → `{ nodes[], edges[] }` | Topological sort for layout position hints | Call API on submit, handle loading & errors | Implement all custom React Flow node components (all 6 shapes) |
| | Node shape mapping: `rectangle / diamond / rounded / circle / parallelogram` | Edge generation: `true/false/loop-back/fault` | Loading skeleton animation | Zoom / pan / fit-to-screen controls |
| | `POST /api/v1/flowchart` endpoint | Integration test: Python → flowchart JSON | Error banner with line highlight | Minimap component (bottom-right) |
| | Syntax error structured response | Async endpoint with asyncio | | Node tooltip on hover (name + line range) |

---

### Phase 2 — Execution Visualizer *(6–8 Weeks)*

#### Step Engine & Schema

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `ExecutionStep` schema: `step_id`, `active_node_id`, `prev_node_id`, `variables{}`, `call_stack[]`, `branch_taken`, `loop_counts{}` | Loop iteration counting | Step counter + progress bar | Auto-Play speed slider 0.5x–10x |
| | IR interpreter: traverse IR, emit one step per statement | try/except exception path steps | Keyboard: → next, ← prev, Space play/pause | Reverse step button |
| | Variable scope stack: push/pop on call/return | Handle nested function calls | | Step jump via progress bar click |
| | | Generate full step array upfront | | |

#### Variable Watch

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Full variable snapshot per step: value, type, scope, `prev_value` | `variable_added` / `variable_changed` / `variable_removed` flags | Variable Watch Panel: Name \| Value table | Type badge with colour coding |
| | Type detection: `int/str/list/dict/bool/NoneType` | Complex nested values (lists of dicts) | Scope badge LOCAL / GLOBAL | Amber flash on changed variables |
| | | | Pin variable to top | Expand/collapse nested values |
| | | | | Old → new diff indicator |

#### Breakpoints & WebSocket

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Accept `breakpoint_node_ids[]` in execution request | Resume on client message via WebSocket | Click node → red dot breakpoint badge | Call Stack Panel: frames newest-on-top |
| | Pause step emission, emit PAUSED signal | Redis persistence for step sequence (TTL 1h) | Breakpoints list panel with Remove button | Click frame → jump to function flowchart |
| | `ws/execution/{job_id}`: push steps | WebSocket heartbeat for stale connection detection | Play-to-next-breakpoint button | Stack depth badge in panel header |
| | | | | Loop Iteration Counter badge on loop nodes |

---

### Phase 3 — Dependency Graph *(5–7 Weeks)*

#### Graph Extraction

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Traverse IR → Calls, Imports, Inherits, Depends On, Triggers edges | Module/Class grouping and cluster bounding boxes | Render React Flow graph with backend positions | Node icons per type (ƒ / 📦 / C / ⚡ / ▶) |
| | External call detection (HTTP/DB/OS) | Hierarchical layout algorithm (position hints) | Filter toolbar: All / Functions / Modules / Classes / External / Entrypoints | Edge type styling (solid / dashed / dotted / bold / animated) |
| | Symbol table for callee resolution | `GET /api/v1/dependency/search?q=` fuzzy search | Click node → open Flowchart side panel | Click node → signature + docstring tooltip |
| | `POST /api/v1/dependency` endpoint | Integration test: known snippet → expected node/edge types | | Hover node → signature + docstring tooltip |

#### Search & Navigation

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | `GET /api/v1/dependency/search?q=` — fuzzy match, return top-10 | Sub-graph endpoint: N-hop neighbourhood fetch | Fuzzy search bar (debounced 300ms) | Minimap navigation panel |
| | Include signature + docstring on each node | Pagination for > 500 node graphs | Zoom-to-node on search result select | Dim unrelated nodes/edges on selection |
| | | | | Highlight connected neighbours |
| | | | | Breadcrumb navigation history |

---

### Phase 4 — Coverage Heatmap *(4–6 Weeks)*

#### Importers & Mapping

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Parse `coverage.xml` (pytest-cov) | Parse CodeFlowX+ native JSON | Drag-and-drop upload zone | Error display for unrecognized formats |
| | Parse `lcov.info` (Istanbul) | Map line ranges → IR node IDs via `source_start/source_end` | Detected format badge display | 'Download sample' links for each format |
| | Parse `jacoco.xml` (JaCoCo) | Dead code static reachability analysis | Upload progress bar | Coverage toggle button (C key shortcut) |
| | `POST /api/v1/coverage` endpoint | Integration test: sample files → assert `node_coverage_map` | | |

#### Heatmap Overlay

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Merge coverage into `FlowchartNode` JSON by `ir_node_id` | < 200ms performance target for applying coverage to flowchart | Apply green/amber/red/gray fills to canvas nodes | Color-blind patterns (hatching/dots) on top of colors |
| | Return updated nodes with `coverage_status` | Export coverage as native JSON | Toggle overlay without re-fetching API | Coverage Summary Bar with segment click-to-filter |
| | Cache merged result in Redis (TTL 30min) | Aggregate summary: covered/partial/uncovered/dead counts | | Click red node → jump to source line in editor |
| | | | | Click amber node → tooltip: which branches are untested |

---

### Phase 5 — Integration & Optimization *(6–10 Weeks)*

#### Cross-View Linking

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Unified `/api/v1/analyze` bundles all four outputs with consistent `ir_node_id` | Ensure `ir_node_id` consistency across all module outputs | Zustand `selectedNodeId`: all views subscribe and react | Navigation history stack: back/forward across views |
| | `ws/analysis/{job_id}`: real-time progress | Redis caching for repeated analyze requests | Animated highlight ring (500ms pulse) on selection | 'Sync views' toggle button |
| | `asyncio.gather()` parallelism for all four modules | Unit test: same `ir_node_id` in all four outputs | | Animated edge traversal during execution across all panels |

#### Performance Tuning

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Redis caching for flowchart requests (key = hash of code + language) | Celery chunking for large repos (20 files/batch) | TanStack Query background refetch for stale data | React Flow virtualization: render only visible nodes |
| | Pre-warm Tree-sitter grammar cache on startup | Target: < 800ms flowchart < 500 LOC, < 30s for 50-file repo | Lazy load side panels on first open | Memoize custom node components (`React.memo`) |
| | Database indices on `ir_node_id` and `job_id` columns | asyncpg connection pooling for PostgreSQL | | Code-split bundles per feature (dynamic import) |
| | | | | Debounce all search inputs (300ms) |

#### Security & Accessibility

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Execution sandbox: seccomp, CPU 2s, RAM 128MB, no network, no FS write | GitHub OAuth2 read-only scope, encrypted token storage | Send JWT in Authorization header (never cookies) | ARIA labels on all canvas nodes |
| | JWT auth + token refresh on all endpoints | SQL injection prevention via SQLAlchemy ORM | Clear JWT from memory on logout | All panels keyboard-navigable (Tab/Enter) |
| | Input size limit 500KB (HTTP 413 on exceed) | Audit log: all analysis requests with `user_id` | Show 'Code never executed on server' badge Phase 1–3 | Color-blind patterns on Coverage Heatmap |
| | Rate limiting on `/api/v1/analyze` | API security headers (CORS, X-Content-Type-Options) | | Dark/light mode with system preference detection |
| | | | | `prefers-reduced-motion`: disable animations if set |
| | | | | Screen reader announcements for execution step changes |

---

## Section 4 — Architecture Layer Responsibilities

*Who owns each tech layer — backend AND frontend responsibilities split for both.*

### Layer 1 — Frontend Stack

| | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|
| | TanStack Query hooks: `useFlowchart()`, `useDependencyGraph()`, `useCoverage()` | React 18 + TypeScript strict mode application |
| | JWT header injection in API client | Vite build + HMR dev server |
| | `useExecutionStream()` WebSocket hook | Tailwind CSS: dark/light mode, responsive layout |
| | Error boundary components wrapping canvas views | Zustand global store: `selectedNodeId`, `executionState`, `coverageData` |
| | | All feature UI components (canvas, panels, toolbars) |

### Layer 2 — API / FastAPI

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | All `/api/v1/*` REST endpoint handlers | Pydantic v2 schemas for all request/response models | API integration wiring in frontend components | TanStack Query setup: caching, background refetch, optimistic updates |
| | JWT Bearer token auth middleware | OpenAPI docstrings on every endpoint | | API error boundary components |
| | WebSocket handlers: `/ws/execution`, `/ws/analysis` | Async endpoints with asyncio (non-blocking) | | Toast notification system for success/error/loading states |
| | Global FastAPI exception handler | API versioning under `/api/v1/` | | |

### Layer 3 — Processing

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend |
|---|---|---|
| | `/backend/ir/` — `IRNode` schema, `ASTTransformer`, IR utils | `/backend/modules/dependency.py` |
| | `/backend/modules/flowchart.py` | `/backend/modules/coverage.py` |
| | `/backend/modules/execution.py` | Language plugin interface for contributor grammars |
| | `/backend/parsers/` — Tree-sitter grammar loaders | Pluggable coverage importer registry |

### Layer 4 — Storage

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend |
|---|---|---|
| | PostgreSQL schema: `jobs`, `ir_nodes`, `flowchart_nodes`, `users` | Redis caching setup (TTL config per cache type) |
| | SQLAlchemy 2.0 async ORM models + queries | Celery task queue + worker setup |
| | Docker Compose: `postgres`, `redis`, `api`, `celery_worker` services | S3-compatible storage for repo clones and coverage files |

### Layer 5 — DevOps / CI

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Dockerfile for FastAPI backend | Dockerfile for Celery worker | TanStack Query cache invalidation on deploy | Dockerfile for frontend (Nginx static serve) |
| | GitHub Actions: ruff lint + pytest + Docker build | `.env.example` with all required env vars | | GitHub Actions: ESLint + Vitest + Vite build |
| | `/.github/PULL_REQUEST_TEMPLATE.md` backend sections | `CONTRIBUTING.md` backend guide | | `/.github/ISSUE_TEMPLATE/` — bug & feature request templates |
| | | `CHANGELOG.md` maintenance | | `CONTRIBUTING.md` frontend guide |
| | | | | Storybook component docs (Phase 5) |

---

## Section 5 — Shared Responsibilities

*Testing, standards, documentation, and code review — all split per person per layer.*

### Testing

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | pytest: `ASTTransformer` all node types | pytest: `DependencyExtractor`, `CoverageImporter` | Vitest: API hook tests with mocked fetch | Vitest: all custom node shape components |
| | pytest: `FlowchartModule` node/edge counts | Integration tests for all `/api/v1/*` endpoints | Vitest: Zustand store mutation tests | Vitest: UI panel components (Variable Watch, Call Stack) |
| | 80%+ backend coverage gate in CI | Mock external services (GitHub API, AI API) with pytest-mock | Snapshot tests for canvas with mock data | E2E test: paste code → submit → flowchart renders (Playwright Phase 5) |
| | pytest-asyncio for async endpoint tests | Fixtures: sample Python/JS code snippets for each node type | | Test keyboard navigation and accessibility |

### Code Standards

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | PEP 8 via ruff on every commit (pre-commit hook) | Same PEP 8 + ruff standards | ESLint + Prettier on every commit | TypeScript strict mode: no implicit `any` |
| | Type hints on all public functions | Type hints + docstrings on all processing modules | Explicit return types on all exported components | Conventional Commits (same format) |
| | Docstrings on all API endpoints and module classes | Keep PRs focused (< 400 lines changed) | JSDoc on all exported components and hooks | Storybook entries for major components (Phase 5) |
| | Conventional Commits: `feat:/fix:/docs:/test:/refactor:/chore:` | Review backend PRs from each other | | Review frontend PRs from each other |

### Documentation

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Backend README: setup, Docker Compose, env vars | `CONTRIBUTING.md` backend guide | `/docs/` state management guide | Frontend README: dev server + build instructions |
| | OpenAPI docstrings → auto-generates Swagger UI | `CHANGELOG.md` per release | JSDoc on all API integration hooks | `/docs/` component library overview |
| | `/docs/` IR schema spec and API reference | Architecture diagram in `/docs/` | | `CONTRIBUTING.md` frontend guide |

### Code Review

| | 🔵 Yash — Backend | 🟢 Abhaysinh — Backend | 🔵 Yash — Frontend | 🟢 Abhaysinh — Frontend |
|---|---|---|---|---|
| | Review Abhaysinh's backend PRs (`dependency.py`, `coverage.py`) | Review Yash's backend PRs (`flowchart.py`, `execution.py`, parsers) | Review Abhaysinh's frontend PRs touching API integration hooks | Review Yash's frontend PRs touching Zustand state |
| | Approve API contract changes that affect frontend | Review IR schema changes for cross-module consistency | Flag missing fields or broken API contracts in frontend code | Review cross-view linking implementation |
| | Flag breaking API response shape changes early | Respond to open-source contributor PRs on parsers | | Respond to open-source contributor PRs on React components |

---

*— End of Document —*