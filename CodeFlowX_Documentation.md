**CodeFlowX+**

*Full Feature Documentation*

Advanced Code Understanding Platform

*Visualize · Simulate · Analyze · Understand*

  ----------------------------------- -----------------------------------
  Version                             1.0 (Concept Draft)

  Status                              Concept / Pre-Development

  License                             MIT (Open Source)

  Date                                2026
  ----------------------------------- -----------------------------------

*Confidential --- For Technical Review & Collaboration*

**Table of Contents**

**1. Executive Summary**

CodeFlowX+ is an open-source, advanced code understanding platform
designed to help developers, students, and engineers deeply comprehend
code behavior --- not just read it. By combining four powerful
subsystems --- Code-to-Flowchart Conversion, Execution Simulation,
Dependency Mapping, and Coverage Heatmapping --- CodeFlowX+ transforms
raw source code into rich, interactive visual insights.

Unlike standalone code viewers or basic linters, CodeFlowX+ creates a
unified, cross-linked workspace where every visual representation is
connected to every other. Clicking a function in the Dependency Graph
opens its Flowchart. Running the Execution Visualizer highlights active
nodes in the Dependency Graph simultaneously. Coverage overlays appear
directly on top of Flowcharts. This integrated approach enables users to
understand not just what code does, but how, why, and where it might
fail.

  -----------------------------------------------------------------------
  **🎯 Mission Statement**

  To make code universally understandable --- through visualization,
  simulation, and analysis ---

  empowering developers and learners to build, debug, and reason about
  software with confidence.
  -----------------------------------------------------------------------

**2. Problem Statement**

Modern software development faces a persistent challenge: code is
written for machines to execute, but humans must understand it. This
creates a fundamental comprehension gap that leads to:

-   Slow onboarding --- New developers spend weeks or months navigating
    unfamiliar codebases.

-   Debugging inefficiency --- Engineers trace execution paths manually,
    wasting hours on root cause analysis.

-   Poor code review quality --- Reviewers miss logic errors hidden in
    complex conditional branches.

-   Knowledge silos --- Tribal knowledge lives in people\'s heads, not
    in the code itself.

-   Testing blindspots --- Uncovered code paths cause production
    failures that could have been caught earlier.

Existing tools address these problems in isolation: linters check style,
debuggers show runtime state, documentation generators produce static
text. No single platform currently unifies visual flowcharting, live
execution simulation, dependency mapping, and coverage analysis into one
coherent, interactive experience.

CodeFlowX+ fills this gap.

**3. Core Features**

**3.1 Code-to-Flowchart Conversion**

The Flowchart Engine parses source code into an Abstract Syntax Tree
(AST) using Tree-sitter, then converts the AST into an Intermediate
Representation (IR) that drives flowchart generation. The output is a
structured, semantically meaningful diagram --- not a generic
box-and-arrow sketch.

**How It Works**

1.  Source code is submitted via the editor or GitHub import.

2.  Tree-sitter parses the code into a language-aware AST.

3.  The AST Transformer converts the tree into CodeFlowX+ IR nodes.

4.  The Flowchart Renderer maps IR nodes to visual blocks --- start/end
    terminators, process boxes, decision diamonds, loop back-edges, and
    function call connectors.

5.  The result is rendered in the frontend using a React Flow canvas
    with drag-and-zoom support.

**Supported Node Types**

  ------------------------ ----------------------------------------------
  **Component**            **Details**

  **Function Definition**  Generates a named function block with
                           entry/exit connectors

  **If / Else / Elif**     Generates a decision diamond with true/false
                           branches

  **For / While Loop**     Generates loop body with back-edge arrow and
                           loop condition diamond

  **Return Statement**     Connects to the function exit terminal

  **Function Call**        Generates a rounded-corner subprocess block
                           with a link to the callee\'s flowchart

  **Try / Catch /          Generates error-handling branches with fault
  Finally**                edges

  **Class Method**         Supported as an encapsulated function with
                           class context label
  ------------------------ ----------------------------------------------

**Supported Languages (Phase 1)**

-   Python 3.x

-   JavaScript / TypeScript (ES2020+)

-   Java 11+

-   C / C++ (planned Phase 2)

-   Go, Rust (future roadmap)

**3.2 Execution Visualizer**

The Execution Visualizer simulates code execution step-by-step,
displaying the live state of variables, the currently active node in the
flowchart, the decision path taken at each branch, and the call stack
depth --- all without actually running the code in a real environment.

**Key Capabilities**

-   Step Forward / Backward: Navigate execution one statement at a time.

-   Variable Watch Panel: Displays all in-scope variables and their
    current values at each step.

-   Active Node Highlighting: The currently executing flowchart node is
    highlighted in real-time.

-   Branch Path Tracing: Decision paths (true/false) are highlighted on
    the flowchart as execution proceeds.

-   Call Stack Visualization: Shows the depth and order of function
    calls as a stack panel.

-   Loop Iteration Counter: Displays how many times each loop has been
    iterated.

**Execution Modes**

  --------------------- -------------------------------------------------
  **Component**         **Details**

  **Step Mode**         Manual step-by-step execution with
                        user-controlled navigation

  **Auto-Play Mode**    Automatic execution at adjustable speed (0.5x to
                        10x)

  **Breakpoint Mode**   Set breakpoints on specific nodes; execution
                        pauses automatically

  **Reverse Mode**      Step backwards through execution history
  --------------------- -------------------------------------------------

**3.3 Dependency Graph**

The Dependency Graph builds a multi-level visualization of how
functions, modules, classes, and external services relate to each other.
It enables navigation across large codebases by providing a high-level
structural map that links directly to code-level flowcharts.

**Graph Node Types**

-   Function Node: Represents an individual function or method.

-   Module Node: Groups all functions within a file or module.

-   Class Node: Represents a class with all its methods collapsed
    inside.

-   External Service Node: Represents external API calls, database
    queries, or system calls.

-   Entrypoint Node: Marks the main() function or application entry
    point.

**Graph Edge Types**

  ------------------ ----------------------------------------------------
  **Component**      **Details**

  **Calls**          A function directly invokes another function

  **Imports**        A module imports another module or package

  **Inherits**       A class extends or inherits from another class

  **Depends On**     A module depends on an external service or library

  **Triggers**       An event handler is triggered by another component
  ------------------ ----------------------------------------------------

**Navigation Features**

-   Click any node to open its corresponding Flowchart in a side panel.

-   Hover a node to preview its function signature and docstring.

-   Filter by node type (functions only, modules only, external
    services).

-   Search nodes by name with fuzzy matching.

-   Zoom / Pan across large graphs with minimap navigation.

**3.4 Coverage Heatmap**

The Coverage Heatmap overlays test coverage data directly onto the
Flowchart view, making it immediately visible which code paths have been
tested and which are blind spots. Coverage data can be imported from
standard coverage tools (pytest-cov, Istanbul, JaCoCo) or generated from
the Execution Visualizer\'s simulation runs.

**Heatmap Layers**

  ------------------------ ----------------------------------------------
  **Component**            **Details**

  **Fully Covered          All branches through this node have been
  (Green)**                executed in tests

  **Partially Covered      The node is reached, but not all branches
  (Amber)**                leaving it are tested

  **Uncovered (Red)**      This node is never reached in any test run

  **Dead Code (Gray)**     Statically unreachable code --- unreachable
                           regardless of input
  ------------------------ ----------------------------------------------

**Coverage Import Formats**

-   coverage.xml (Python / pytest-cov)

-   lcov.info (JavaScript / Istanbul / C++ / lcov)

-   jacoco.xml (Java / Maven)

-   CodeFlowX+ native JSON format (exported from Execution Visualizer)

**4. Integration Features**

One of CodeFlowX+\'s defining characteristics is that all four
subsystems are deeply interconnected. Changes in one view propagate to
all others in real-time, creating a fully unified analysis workspace.

**4.1 Cross-View Linking**

  ------------------------ ----------------------------------------------
  **Component**            **Details**

  **Dependency Graph →     Click a function node in the Dependency Graph
  Flowchart**              to instantly open its Flowchart in the side
                           panel.

  **Execution Visualizer → As execution progresses, the currently
  Dependency Graph**       executing function node is highlighted in the
                           Dependency Graph.

  **Coverage Heatmap →     Coverage overlays render directly on Flowchart
  Flowchart**              nodes; clicking a red (uncovered) node jumps
                           to the source code line.

  **Flowchart → Source     Click any Flowchart node to highlight the
  Code**                   corresponding source code lines in the editor.
  ------------------------ ----------------------------------------------

**4.2 Failure Simulation**

Failure Simulation allows developers to mark a function as \'broken\' or
\'unavailable\' and observe the cascading impact across the Dependency
Graph. Affected nodes turn red. Flowcharts show which branches are now
unreachable or will produce exceptions. This is valuable for:

-   Understanding the blast radius of a failing microservice.

-   Preparing for chaos engineering experiments.

-   Teaching students about fault propagation in distributed systems.

**4.3 AI-Powered Explanations**

Each Flowchart node, Dependency Graph edge, and Coverage region can be
right-clicked to request an AI-generated explanation. The AI module
draws on the code context, the IR structure, and the execution state to
produce natural language explanations such as:

  -----------------------------------------------------------------------
  **💡 Example AI Explanation**

  Node: validate_user_token() --- \"This function checks the JWT token in
  the Authorization header.

  It first decodes the token using the HS256 algorithm, then verifies the
  expiry timestamp.

  If the token is expired, it raises a TokenExpiredError, which is caught
  in the caller\'s

  try/except block and returns a 401 Unauthorized response to the
  client.\"
  -----------------------------------------------------------------------

**4.4 GitHub Repository Analysis**

Users can connect a GitHub repository and trigger full-repository
analysis. CodeFlowX+ clones the repository, runs Tree-sitter parsing
across all supported language files, builds a global Dependency Graph
for the entire project, generates Flowcharts for every function, and
loads any existing coverage reports. This makes CodeFlowX+ viable for
production-scale codebases with thousands of files.

**5. System Architecture**

**5.1 Architectural Overview**

CodeFlowX+ follows a three-tier architecture: a React-based frontend, a
FastAPI Python backend, and a set of specialized processing modules. The
backend exposes a RESTful API consumed by the frontend. All processing
is stateless per request; session state is managed client-side with
optional server-side caching via Redis.

  -----------------------------------------------------------------------
  **🏗️ Architecture Layers**

  Layer 1 (Frontend): React + TypeScript + React Flow + Monaco Editor

  Layer 2 (API): FastAPI (Python) --- REST endpoints + WebSocket for
  real-time updates

  Layer 3 (Processing): Tree-sitter Parser → IR Transformer → Four Module
  Processors

  Layer 4 (Storage): PostgreSQL (metadata) + Redis (cache) +
  S3-compatible (repo storage)
  -----------------------------------------------------------------------

**5.2 Frontend Architecture**

  ---------------------- ------------------------------------------------
  **Component**          **Details**

  **React 18 +           Main UI framework with strict typing
  TypeScript**           

  **React Flow**         Interactive canvas for Flowchart and Dependency
                         Graph rendering

  **Monaco Editor**      VS Code-quality code editor with syntax
                         highlighting

  **Zustand**            Lightweight global state management for
                         cross-view synchronization

  **TanStack Query**     Server state management, caching, and background
                         refetching

  **Tailwind CSS**       Utility-first styling with dark/light mode
                         support

  **Vite**               Build tooling and dev server with HMR
  ---------------------- ------------------------------------------------

**5.3 Backend Architecture**

  ---------------------- ------------------------------------------------
  **Component**          **Details**

  **FastAPI (Python      High-performance async REST API framework
  3.11+)**               

  **Tree-sitter**        Language-agnostic AST parser supporting 40+
                         languages

  **Pydantic v2**        Schema validation for all API request/response
                         models

  **SQLAlchemy 2.0**     Async ORM for database access

  **Celery + Redis**     Background task queue for large repository
                         analysis jobs

  **WebSockets**         Real-time execution step streaming to the
                         frontend

  **PyGithub /           GitHub API integration and local git operations
  GitPython**            

  **Docker**             Containerized deployment of all backend services
  ---------------------- ------------------------------------------------

**5.4 Processing Pipeline**

The core processing pipeline is triggered whenever code is submitted for
analysis. It runs in parallel across the four processing modules after
the shared AST and IR are computed:

6.  Code Input --- User submits code via editor or GitHub URL.

7.  Language Detection --- Automatic language detection by file
    extension and content heuristics.

8.  AST Parsing --- Tree-sitter parses the code into a language-specific
    AST.

9.  IR Transformation --- The AST Transformer normalizes the AST into
    the language-agnostic CodeFlowX+ IR (Intermediate Representation).

10. Parallel Processing --- Four modules process the IR simultaneously:

    -   Flowchart Module: Converts IR into flowchart node/edge JSON.

    -   Execution Module: Builds the execution step sequence with
        variable state snapshots.

    -   Dependency Module: Extracts function call relationships and
        module imports.

    -   Coverage Module: Merges coverage data with IR node identifiers.

11. Unified UI Assembly --- The frontend receives all four outputs and
    links them via shared IR node IDs.

**6. API Design**

The CodeFlowX+ backend exposes a RESTful API. All endpoints are
versioned under /api/v1/. Requests and responses use JSON.
Authentication uses JWT Bearer tokens.

**6.1 Core Analysis Endpoints**

  ------------ ------------------------------------- ---------------------- --------------------
  **Method**   **Endpoint**                          **Description**        **Response**

  **POST**     /api/v1/analyze                       Submit code for full   { job_id, status,
                                                     analysis (AST,         results }
                                                     flowchart, execution,  
                                                     dependency, coverage)  

  **GET**      /api/v1/analyze/{job_id}              Poll status of an      { status, progress,
                                                     async analysis job     results }

  **POST**     /api/v1/flowchart                     Generate flowchart for { nodes\[\],
                                                     a single function      edges\[\] }

  **POST**     /api/v1/execution                     Run step-by-step       { steps\[\],
                                                     execution simulation   variables\[\] }

  **GET**      /api/v1/execution/{job_id}/step/{n}   Get state at execution { variables,
                                                     step N                 active_node,
                                                                            call_stack }

  **POST**     /api/v1/dependency                    Build dependency graph { nodes\[\],
                                                     for submitted code     edges\[\],
                                                                            clusters\[\] }

  **POST**     /api/v1/coverage                      Upload and merge       { node_coverage_map
                                                     coverage data          }
  ------------ ------------------------------------- ---------------------- --------------------

**6.2 GitHub Integration Endpoints**

  ------------ -------------------------------------- ---------------------- --------------------
  **Method**   **Endpoint**                           **Description**        **Response**

  **POST**     /api/v1/github/connect                 Connect a GitHub       { repo_id, status }
                                                      repository for         
                                                      analysis               

  **GET**      /api/v1/github/{repo_id}/status        Check repository       { progress,
                                                      analysis progress      files_parsed }

  **GET**      /api/v1/github/{repo_id}/graph         Fetch full repo        { nodes\[\],
                                                      dependency graph       edges\[\] }

  **GET**      /api/v1/github/{repo_id}/file/{path}   Get flowchart for a    { flowchart,
                                                      specific file          functions\[\] }
  ------------ -------------------------------------- ---------------------- --------------------

**6.3 AI Explanation Endpoints**

  ------------ -------------------------- ---------------------- ---------------------
  **Method**   **Endpoint**               **Description**        **Response**

  **POST**     /api/v1/explain/node       Get AI explanation for { explanation,
                                          a flowchart node       confidence }

  **POST**     /api/v1/explain/edge       Get AI explanation for { explanation }
                                          a dependency edge      

  **POST**     /api/v1/explain/coverage   Get AI explanation for { explanation,
                                          an uncovered path      suggestion }

  **POST**     /api/v1/simulate/failure   Simulate function      { affected_nodes\[\],
                                          failure and get impact blast_radius }
                                          analysis               
  ------------ -------------------------- ---------------------- ---------------------

**6.4 WebSocket Endpoints**

  ------------------------------------- -------------------------------------------
  **Component**                         **Details**

  **ws://host/ws/execution/{job_id}**   Real-time execution step streaming ---
                                        server pushes each step state as the
                                        simulation runs.

  **ws://host/ws/analysis/{job_id}**    Real-time progress updates for large
                                        repository analysis jobs.
  ------------------------------------- -------------------------------------------

**7. Core Data Models**

All CodeFlowX+ data is modeled around the IR (Intermediate
Representation) node as the shared identifier across all four
subsystems. Every flowchart node, dependency node, execution step, and
coverage record references the same IR node ID.

**7.1 IR Node Schema**

  ------------------ ----------------------------------------------------
  **Component**      **Details**

  **id**             Unique node identifier (UUID)

  **type**           Node type: function_def \| if_stmt \| for_loop \|
                     while_loop \| return \| call \| try_except \|
                     assignment

  **language**       Source language: python \| javascript \| java \| cpp

  **name**           Human-readable label (function name, variable name,
                     condition text)

  **source_start**   Starting line number in source file

  **source_end**     Ending line number in source file

  **children**       List of child IR node IDs

  **metadata**       Language-specific extra data (e.g. async flag,
                     decorator list, access modifier)
  ------------------ ----------------------------------------------------

**7.2 Flowchart Node Schema**

  --------------------- ----------------------------------------------------
  **Component**         **Details**

  **ir_node_id**        Reference to the source IR node

  **shape**             Visual shape: rectangle \| diamond \| rounded \|
                        circle \| parallelogram

  **label**             Display text shown on the node

  **position**          { x, y } canvas coordinates

  **style**             Visual styling overrides (color, border)

  **coverage_status**   covered \| partial \| uncovered \| dead_code

  **is_active**         Boolean --- true when this node is the current
                        execution step
  --------------------- ----------------------------------------------------

**8. Implementation Roadmap**

CodeFlowX+ is planned across five development phases, each building on
the previous. Each phase produces a usable, demonstrable product
milestone.

  ----------- ------------------- ---------------------------- --------------
  **Phase**   **Name**            **Deliverables**             **Duration**

  **Phase 1** Flowchart Engine    Tree-sitter integration, IR  6--8 weeks
                                  transformer, React Flow      
                                  canvas, Python + JS support, 
                                  code editor                  

  **Phase 2** Execution           Step-by-step simulation      6--8 weeks
              Visualizer          engine, variable watch       
                                  panel, WebSocket streaming,  
                                  breakpoints                  

  **Phase 3** Dependency Graph    Call graph extraction,       5--7 weeks
                                  module/class grouping,       
                                  cross-function navigation,   
                                  graph filters                

  **Phase 4** Coverage Heatmap    Coverage XML/lcov import, IR 4--6 weeks
                                  node mapping, heatmap        
                                  overlay on flowcharts, dead  
                                  code detection               

  **Phase 5** Integration &       Cross-view linking, GitHub   6--10 weeks
              Optimization        analysis, AI explanations,   
                                  failure simulation,          
                                  performance tuning           
  ----------- ------------------- ---------------------------- --------------

**8.1 Phase 1 --- Flowchart Engine (Detailed)**

-   Set up React + TypeScript + Vite frontend scaffold.

-   Integrate Monaco Editor for code input.

-   Set up FastAPI backend with Tree-sitter Python bindings.

-   Implement Tree-sitter grammar loading for Python and JavaScript.

-   Build IR Node data model and AST-to-IR transformer.

-   Build Flowchart Module: IR-to-flowchart-node/edge conversion.

-   Integrate React Flow for canvas rendering.

-   Implement node shapes (rectangle, diamond, rounded, terminal).

-   Add zoom, pan, and minimap controls.

-   Write unit tests for AST transformer and flowchart module.

**9. Use Cases**

**9.1 Software Education**

Computer science students and bootcamp learners can submit any code
snippet and instantly see a visual flowchart of the algorithm\'s logic.
Stepping through execution shows exactly how variables change at each
step, making abstract concepts like recursion, sorting algorithms, or
tree traversal tangible and intuitive.

**9.2 Debugging & Root Cause Analysis**

Engineers can submit a buggy function, run the Execution Visualizer with
specific input values, and watch exactly which branch was taken and why.
Coverage Heatmaps reveal paths that tests never exercise --- paths that
may harbor lurking bugs.

**9.3 Code Review**

Reviewers can generate a Flowchart of the PR\'s changed functions to
visually verify that the logic matches the intended behavior, without
having to mentally simulate execution from reading the code text alone.

**9.4 Onboarding & Knowledge Transfer**

New team members can import a GitHub repository and immediately explore
the Dependency Graph to understand the high-level architecture, then
drill into individual functions via their Flowcharts to understand
implementation details --- without needing a senior engineer to walk
them through it.

**9.5 Interview Preparation**

Candidates preparing for technical interviews can visualize classic data
structure and algorithm problems --- linked list reversal, binary
search, dynamic programming --- and step through their solutions to
verify correctness before presenting them.

**9.6 System Design Understanding**

Architects can use the Dependency Graph\'s external service nodes to map
the full call chain from a frontend API request through backend
services, database queries, and external API calls --- producing an
auto-generated system interaction diagram.

**10. Open Source Contribution Guide**

CodeFlowX+ is built as an open-source project under the MIT License.
Contributions from developers, students, and the broader engineering
community are actively encouraged and welcomed.

**10.1 Repository Structure**

  ---------------------- ----------------------------------------------------
  **Component**          **Details**

  **/frontend**          React + TypeScript application (Vite, React Flow,
                         Monaco Editor, Zustand)

  **/backend**           FastAPI application (parsers, IR transformer,
                         processing modules, API routes)

  **/backend/parsers**   Language-specific Tree-sitter grammar loaders and
                         AST normalizers

  **/backend/modules**   flowchart.py, execution.py, dependency.py,
                         coverage.py --- one file per subsystem

  **/backend/ir**        IR Node schema, transformer logic, and IR utility
                         functions

  **/tests**             Unit and integration tests (pytest for backend,
                         Vitest for frontend)

  **/docs**              This documentation and supplementary technical specs

  **/docker**            Docker Compose setup for local development
                         environment

  **/.github**           GitHub Actions CI/CD pipelines, issue templates, and
                         PR templates
  ---------------------- ----------------------------------------------------

**10.2 How to Contribute**

12. Fork the repository on GitHub.

13. Clone your fork: git clone
    https://github.com/YOUR_USERNAME/codeflowx-plus.git

14. Create a feature branch: git checkout -b feature/your-feature-name

15. Set up the local environment using Docker Compose: docker compose up
    \--build

16. Make your changes. Ensure tests pass: pytest (backend) or npm run
    test (frontend).

17. Run the linter: ruff check . (backend) or npm run lint (frontend).

18. Commit with a conventional commit message: feat: add Go language
    support

19. Open a Pull Request against the main branch with a description of
    your changes.

**10.3 Contribution Areas**

-   Language Support: Add Tree-sitter grammars and IR transformers for
    new languages (Go, Rust, C++, Ruby, PHP).

-   Frontend Components: Improve the React Flow canvas, add new node
    styles, or enhance the Monaco Editor integration.

-   Execution Engine: Improve simulation accuracy, add support for more
    statement types, or implement reverse debugging.

-   Coverage Importers: Add support for new coverage report formats
    (cobertura, Clover, etc.).

-   AI Explanations: Improve prompting strategies for more accurate and
    contextual explanations.

-   Documentation: Write tutorials, how-to guides, language support
    docs, and API references.

-   Tests: Increase test coverage with unit, integration, and end-to-end
    tests.

**10.4 Code Standards**

  ------------------- ----------------------------------------------------
  **Component**       **Details**

  **Python Style**    PEP 8 compliance enforced by ruff. Type hints
                      required on all public functions.

  **TypeScript        ESLint + Prettier. Strict TypeScript mode enabled.
  Style**             No implicit any.

  **Commit Messages** Conventional Commits format: feat:, fix:, docs:,
                      test:, refactor:, chore:

  **PR Size**         Keep PRs focused. Large features should be broken
                      into multiple smaller PRs.

  **Test Coverage**   New backend code must maintain 80%+ test coverage.
                      No PRs accepted below threshold.

  **Documentation**   All public API endpoints and exported functions must
                      include docstrings/JSDoc comments.
  ------------------- ----------------------------------------------------

**11. Non-Functional Requirements**

**11.1 Performance Targets**

  --------------------------- -------------------------------------------
  **Component**               **Details**

  **Flowchart Generation (\<  \< 800ms end-to-end (API + render)
  500 LOC)**                  

  **Flowchart Generation      \< 3s with background processing indicator
  (500--5000 LOC)**           

  **Execution Step            \< 50ms per step transition in the UI
  Navigation**                

  **Dependency Graph (\< 100  \< 1.5s to render and layout
  nodes)**                    

  **GitHub Repo Analysis (\<  \< 30s with real-time progress updates
  50 files)**                 

  **Coverage Overlay          \< 200ms to apply a coverage XML to an
  Application**               existing flowchart
  --------------------------- -------------------------------------------

**11.2 Scalability Design**

-   Stateless backend API --- all analysis state is returned to the
    client or stored in Redis for async jobs.

-   Celery task queue absorbs large repository analysis workloads
    without blocking the API.

-   Frontend graph virtualization (react-flow-renderer windowing)
    ensures large graphs (500+ nodes) remain performant.

-   Horizontal scaling of the FastAPI backend via Docker Swarm or
    Kubernetes.

**11.3 Security**

-   Code submission sandboxing --- Tree-sitter is a pure parser; no
    submitted code is ever executed on the server in Phase 1--3.

-   Execution Visualizer (Phase 2) runs in a strictly sandboxed Python
    subprocess with CPU/memory limits, no network access, and no
    filesystem write access.

-   GitHub integration uses OAuth2 with read-only repository scope by
    default.

-   All API endpoints are authenticated via JWT. Token refresh is
    supported.

-   Input code is size-limited (default: 500KB per submission) to
    prevent DoS.

**11.4 Accessibility**

-   All interactive UI elements are keyboard-navigable.

-   Flowchart nodes include ARIA labels for screen reader compatibility.

-   Color-blind safe palette for Coverage Heatmap (uses pattern overlays
    in addition to color).

-   Dark and light mode support with system preference detection.

**12. Future Roadmap**

The following features are planned beyond the initial five
implementation phases, subject to community feedback and contribution:

  ---------------------- ------------------------------------------------
  **Component**          **Details**

  **Multi-file Execution Step through execution that spans multiple
  Simulation**           files, following function calls across module
                         boundaries.

  **Live Collaboration** Real-time multi-user editing and annotation of
                         flowcharts and dependency graphs (similar to
                         Figma collaboration).

  **VS Code Extension**  Integrate CodeFlowX+ directly into the VS Code
                         IDE as a side panel, triggered on function hover
                         or right-click.

  **CI/CD Integration**  GitHub Action to auto-generate and publish
                         flowchart documentation on every PR merge.

  **Diff Flowcharts**    Show structural differences between two versions
                         of a function as a side-by-side or overlay
                         flowchart.

  **Performance          Import profiling data (cProfile, py-spy) and
  Profiling Overlay**    overlay execution time per node on the
                         flowchart.

  **Natural Language     Search a codebase using natural language
  Code Search**          queries; results highlighted in the Dependency
                         Graph.

  **Mobile App**         Read-only mobile viewer for exploring flowcharts
                         and dependency graphs on iOS and Android.
  ---------------------- ------------------------------------------------

**13. Glossary**

  ---------------------- ------------------------------------------------
  **Component**          **Details**

  **AST (Abstract Syntax A tree representation of the structure of source
  Tree)**                code, produced by a language parser.

  **IR (Intermediate     CodeFlowX+\'s language-agnostic internal data
  Representation)**      model that all four processing modules consume.

  **Tree-sitter**        An open-source, incremental parsing library that
                         supports 40+ programming languages.

  **Flowchart**          A visual diagram of code logic using standard
                         notation: process boxes, decision diamonds, and
                         connectors.

  **Execution            The CodeFlowX+ subsystem that simulates code
  Visualizer**           execution step-by-step without running code on a
                         real machine.

  **Dependency Graph**   A visual map of function call relationships,
                         module imports, and service dependencies.

  **Coverage Heatmap**   A visual overlay showing which code paths are
                         covered, partially covered, or missed by tests.

  **Failure Simulation** A CodeFlowX+ feature that marks functions as
                         failed and shows cascading impact across the
                         Dependency Graph.

  **React Flow**         An open-source React library for rendering
                         interactive node-based graphs and flowcharts.

  **FastAPI**            A modern, high-performance Python web framework
                         for building REST APIs with automatic OpenAPI
                         documentation.

  **Celery**             A distributed task queue for Python used to
                         process long-running analysis jobs
                         asynchronously.

  **Blast Radius**       The set of functions and modules affected when a
                         specific function fails or becomes unavailable.
  ---------------------- ------------------------------------------------

**14. Conclusion**

CodeFlowX+ represents a significant step forward in making software
universally understandable. By unifying four complementary analysis
capabilities --- Flowchart generation, Execution Simulation, Dependency
Mapping, and Coverage Analysis --- into a single, deeply integrated
platform, CodeFlowX+ addresses the core comprehension challenges faced
by developers and learners across the entire software engineering
lifecycle.

The platform\'s open-source nature means it can grow through community
contributions, adding language support, new visualization modes, and
integration features far beyond what any single team could build alone.
Its phased implementation roadmap ensures that each milestone delivers
standalone value, building incrementally toward a world-class code
understanding tool.

Whether used for debugging a production issue, onboarding to a new
codebase, preparing for a technical interview, or teaching algorithms to
a class of students --- CodeFlowX+ provides the visual clarity that code
alone cannot offer.

  -----------------------------------------------------------------------
  **🚀 Ready to Build**

  CodeFlowX+ is open for contributions. Visit the GitHub repository to
  get started.

  Join the discussion, pick up a good-first-issue, and help make code
  universally understandable.
  -----------------------------------------------------------------------

*--- End of Document ---*

**CodeFlowX+**

Full Work Split --- Backend & Frontend tasks split between Yash and
Abhaysinh

**Every task is divided between both team members across BOTH backend
and frontend**

+-----------------------------------+-----------------------------------+
| **🔵 Yash**                       | **🟢 Abhaysinh**                  |
|                                   |                                   |
| -   Backend: FastAPI endpoints,   | -   Backend: Tree-sitter JS/TS    |
|     Tree-sitter/IR (Features 3.1  |     grammar, dependency.py,       |
|     & 3.2), Storage & Docker      |     coverage.py, Celery/Redis,    |
|                                   |     security                      |
| -   Frontend: API integration     |                                   |
|     hooks, Zustand state,         | -   Frontend: ALL React UI        |
|     TanStack Query wiring         |     components, canvas rendering, |
|                                   |     panels, accessibility, dark   |
| -   Phases 1--5: backend          |     mode                          |
|     environment, core parser,     |                                   |
|     step engine, call graph       | -   Phases 1--5: frontend         |
|     extraction, security          |     environment, all custom node  |
|                                   |     shapes, variable watch,       |
| -   Shared: backend tests         |     heatmap UI                    |
|     (pytest), backend docs,       |                                   |
|     backend PR reviews            | -   Shared: frontend tests        |
|                                   |     (Vitest), frontend docs,      |
|                                   |     frontend PR reviews           |
+-----------------------------------+-----------------------------------+

**Section 1 --- Feature-by-Feature Work Split**

*Each sub-feature broken into backend tasks (split between Yash &
Abhaysinh) AND frontend tasks (also split between Yash & Abhaysinh).*

**🔷 3.1 Code-to-Flowchart Conversion**

+--------+--------------+--------------+--------------+--------------+
| **Task | **🔵 Yash    | **🟢         | **🔵 Yash    | **🟢         |
| Area** | ---          | Abhaysinh    | ---          | Abhaysinh    |
|        | Backend**    | ---          | Frontend**   | ---          |
|        |              | Backend**    |              | Frontend**   |
+========+==============+==============+==============+==============+
| **     | -   Install  | -   Install  | -   Wire     | -   Build    |
| Parser |              |              |     language |     language |
| &      |  tree-sitter |  tree-sitter |              |     dropdown |
| G      |     Python   |     JS/TS    |    selection |     selector |
| rammar |     bindings |     grammar  |     to API   |              |
| S      |              |     support  |     payload  |    component |
| etup** | -   Build    |              |              |              |
|        |     Langu    | -   Write    | -   Handle   | -   Show     |
|        | ageRegistry: |     grammar  |     parse    |     language |
|        |              |     loader   |     errors:  |     badge in |
|        |    extension |     for      |     display  |     editor   |
|        |     →        |              |     line/col |     toolbar  |
|        |     grammar  |   TypeScript |     in       |              |
|        |     map      |     ES2020+  |     editor   | -   Paste    |
|        |              |              |              |              |
|        | -   Write    | -   Stub     | -            |   detection: |
|        |     G        |     Java 11+ |  Auto-detect |     auto-set |
|        | rammarLoader |     grammar  |     language |     language |
|        | .parse(code, |     loader   |     from     |     from     |
|        |     lang) →  |              |     file     |              |
|        |     raw AST  | -   Document |              |    clipboard |
|        |              |     gram     |    extension |              |
|        | -   Unit     | mar-addition |     on       | -   Upload   |
|        |     tests:   |     guide    |     upload   |     code     |
|        |     valid    |     for      |              |     file     |
|        |     Python & |              |              |     button   |
|        |     JS AST   | contributors |              |     (reads & |
|        |     produced |              |              |     sets     |
|        |              |              |              |     editor   |
|        |              |              |              |     content) |
+--------+--------------+--------------+--------------+--------------+
| **IR   | -   Define   | -   Write IR | -   IR Debug | -   Build IR |
| Node   |     IRNode   |              |     Panel    |     tree     |
| Schema |              |  transformer |     (dev     |     explorer |
| &      |   dataclass: |     for      |     mode):   |     side     |
| T      |              |     JS/TS    |              |     panel    |
| ransfo |    id(UUID), |     nodes    |  collapsible |     (        |
| rmer** |              |              |     IR tree  | collapsible) |
|        |  type(enum), | -   Handle   |     view     |              |
|        |              |     JS arrow |              | -   Click IR |
|        |    language, |              | -   Show     |     node →   |
|        |     name,    |   functions, |              |              |
|        |     s        |              | source_start |    highlight |
|        | ource_start, | async/await, |     /        |     c        |
|        |              |     d        |   source_end |     orresponding |
|        |  source_end, | estructuring |     range on |     source   |
|        |     c        |              |     node     |     lines in |
|        | hildren\[\], | -   Write IR |     hover    |     editor   |
|        |              |     utility  |              |              |
|        |   metadata{} |              |              | -   Node     |
|        |              |   functions: |              |     count +  |
|        | -            |              |              |     edge     |
|        |    Implement |  find_by_id, |              |     count    |
|        |     AS       |     get_     |              |     summary  |
|        | TTransformer | descendants, |              |     badges   |
|        |     visitor  |     g        |              |     in       |
|        |              | et_ancestors |              |     toolbar  |
|        |   dispatcher |              |              |              |
|        |              | -   Unit     |              |              |
|        | -   Map:     |     tests    |              |              |
|        |     f        |     for      |              |              |
|        | unction_def, |     JS/TS IR |              |              |
|        |     i        |     tr       |              |              |
|        | if/elif/else, | ansformation |              |              |
|        |              |              |              |              |
|        |   for/while, |              |              |              |
|        |     return,  |              |              |              |
|        |     call,    |              |              |              |
|        |     try/ca   |              |              |              |
|        | tch/finally, |              |              |              |
|        |     class,   |              |              |              |
|        |              |              |              |              |
|        |   assignment |              |              |              |
|        |              |              |              |              |
|        | -   Assign   |              |              |              |
|        |     stable   |              |              |              |
|        |     UUIDs to |              |              |              |
|        |     every IR |              |              |              |
|        |     node     |              |              |              |
+--------+--------------+--------------+--------------+--------------+
| **Flo  | -            | -            | -   Call     | -            |
| wchart |    Flowchart |  Topological |     /api/    |    Implement |
| Mo     | Module.gener |     sort     | v1/flowchart |     custom   |
| dule** | ate(ir_root) |     layout   |     on       |     React    |
|        |     → {      |              |     submit,  |     Flow     |
|        |              |    algorithm |     handle   |     node     |
|        |   nodes\[\], |     for node |     loading  |   components |
|        |              |     position |     & errors |     per      |
|        |    edges\[\] |     hints    |              |     shape    |
|        |     }        |              | -   Render   |              |
|        |              | -   Handle   |     React    | -   F        |
|        | -   Map IR   |     cyclic   |     Flow     | unctionNode: |
|        |     types to |     IR       |     canvas   |     blue     |
|        |     shape    |     graphs   |     with     |     header   |
|        |     enum:    |     (loops)  |     backend  |     bar +    |
|        |              |     without  |              |     body     |
|        |   rectangle/ |     infinite |    node/edge |     label    |
|        | diamond/roun |     loops    |     data     |              |
|        | ded/circle/p |              |              | -   D        |
|        | arallelogram | -   Add      | -   Add zoom | ecisionNode: |
|        |              |              |              |     yellow   |
|        | -   Generate |  source_star |    controls, |     diamond  |
|        |     edges:   | t/source_end |     pan,     |     with     |
|        |              |     to every |     f        |              |
|        |  sequential, |     F        | it-to-screen |   true/false |
|        |              | lowchartNode |     button   |     edge     |
|        |   true/false |     response |              |     labels   |
|        |     branch,  |              |              |              |
|        |              | -            |              | -            |
|        |   loop-back, |  Integration |              |    LoopNode: |
|        |     fault    |     test:    |              |     green    |
|        |              |     Python   |              |     body +   |
|        | -   POST     |     snippet  |              |              |
|        |     /api/    |     → assert |              |    back-edge |
|        | v1/flowchart |     expected |              |     arrow    |
|        |              |              |              |              |
|        |   endpoint + |    node/edge |              | -   T        |
|        |     Pydantic |     JSON     |              | erminalNode: |
|        |     schemas  |              |              |     rounded  |
|        |              |              |              |    start/end |
|        | -   Return   |              |              |     circle   |
|        |     syntax   |              |              |              |
|        |     errors   |              |              | -            |
|        |     as {     |              |              |    CallNode: |
|        |     error,   |              |              |     purple   |
|        |     line,    |              |              |              |
|        |     column } |              |              |   subprocess |
|        |     JSON     |              |              |     box      |
|        |              |              |              |              |
|        |              |              |              | -   T        |
|        |              |              |              | ryCatchNode: |
|        |              |              |              |     orange   |
|        |              |              |              |              |
|        |              |              |              |   fault-edge |
|        |              |              |              |     dashes   |
|        |              |              |              |              |
|        |              |              |              | -   Minimap  |
|        |              |              |              |     panel    |
|        |              |              |              |     (        |
|        |              |              |              | bottom-right |
|        |              |              |              |     corner)  |
+--------+--------------+--------------+--------------+--------------+
| **La   | -   Python   | -            | -   Language | -   Keyboard |
| nguage |     3.x:     |   JavaScript |     selector |     shortcut |
| S      |     full     | /TypeScript: |     dropdown |     to       |
| upport |     grammar  |     classes, |     ---      |     switch   |
| L      |     ---      |     modules, |     Python / |     language |
| ayer** |              |              |     JS / TS  |     (C       |
|        |  decorators, | async/await, |     / Java   | trl+Shift+L) |
|        |     com      |     optional |              |              |
|        | prehensions, |     chaining | -   Show     | -   Langu    |
|        |              |              |              | age-specific |
|        |  generators, | -   Stub Go, |  unsupported |     editor   |
|        |     walrus   |     Rust     |     language |     theme    |
|        |     operator |     grammar  |     warning  |     (        |
|        |              |     loaders  |     toast    | Python=blue, |
|        | -   Java     |              |              |              |
|        |     11+:     |    (roadmap) |              |    JS=yellow |
|        |     class,   |              |              |     gutter)  |
|        |              | -   Document |              |              |
|        |   interface, |     how to   |              | -   Show     |
|        |     try-wi   |     add a    |              |              |
|        | th-resources |     new      |              |   \'Language |
|        |              |     language |              |     not      |
|        | -   Design   |     to the   |              |     fully    |
|        |              |     registry |              |  supported\' |
|        |    pluggable |              |              |     banner   |
|        |     grammar  |              |              |     for      |
|        |     plugin   |              |              |     partial  |
|        |    interface |              |              |     grammars |
|        |     for      |              |              |              |
|        |              |              |              |              |
|        | contributors |              |              |              |
+--------+--------------+--------------+--------------+--------------+
| **API  | -   POST     | -   POST     | -   Show     | -   Loading  |
| &      |     /api/    |     /ap      |     loading  |     progress |
| Error  | v1/flowchart | i/v1/analyze |     skeleton |     bar with |
| Hand   |     --- main |     --- full |              |              |
| ling** |     endpoint |     pipeline |    animation |   percentage |
|        |              |     trigger  |     while    |              |
|        | -   GET      |              |     awaiting | -   Toast    |
|        |              | -   Pydantic |     API      |     n        |
|        | /api/v1/anal |     v2       |              | otifications |
|        | yze/{job_id} |     request  | -   Display  |     for      |
|        |     ---      |              |              |     success  |
|        |     async    | validation + |   structured |     / error  |
|        |     job      |     error    |     error    |              |
|        |     polling  |     messages |     with     | -   API      |
|        |              |              |     line     |     error    |
|        | -   JWT auth | -   Global   |              |     boundary |
|        |              |     FastAPI  |    highlight |              |
|        |   middleware |              |     on       |    component |
|        |     on all   |    exception |     syntax   |     wrapping |
|        |              |     handler  |     error    |     canvas   |
|        |    endpoints |     →        |              |              |
|        |              |              | -   Retry    |              |
|        | -   Rate     |   structured |     button   |              |
|        |     limit:   |     JSON     |     on       |              |
|        |     10       |     errors   |     network  |              |
|        |     req/min  |              |     failure  |              |
|        |     per user | -   Async    |              |              |
|        |              |     endpoint |              |              |
|        |              |     with     |              |              |
|        |              |     asyncio  |              |              |
|        |              |     (n       |              |              |
|        |              | on-blocking) |              |              |
+--------+--------------+--------------+--------------+--------------+
| **Tes  | -   pytest:  | -   pytest:  | -   Vitest:  | -   Vitest:  |
| ting** |     AS       |     JS/TS IR |     canvas   |     each     |
|        | TTransformer |              |     renders  |     custom   |
|        |     --- all  |  transformer |     with     |     node     |
|        |     8 node   |     edge     |     mock     |     shape    |
|        |     types    |     cases    |              |              |
|        |              |              |    node/edge |    component |
|        | -   pytest:  | -            |     data     |              |
|        |     Flo      |  Integration |              | -   Snapshot |
|        | wchartModule |     test:    | -   Test     |     tests    |
|        |     --- node |     POST     |     loading  |     for      |
|        |     count,   |     /api/    |     and      |              |
|        |     edge     | v1/flowchart |     error    |    flowchart |
|        |     count    |     → assert |     states   |     layout   |
|        |              |              |              |              |
|        | -   80%+     |    flowchart |              | -   Test     |
|        |     backend  |     JSON     |              |     keyboard |
|        |     coverage |              |              |     controls |
|        |     gate in  | -   py       |              |     on       |
|        |     GitHub   | test-asyncio |              |     canvas   |
|        |     Actions  |     for      |              |              |
|        |     CI       |     async    |              |              |
|        |              |     endpoint |              |              |
|        |              |     tests    |              |              |
+--------+--------------+--------------+--------------+--------------+

**⚡ 3.2 Execution Visualizer**

+--------+--------------+--------------+--------------+--------------+
| **Task | **🔵 Yash    | **🟢         | **🔵 Yash    | **🟢         |
| Area** | ---          | Abhaysinh    | ---          | Abhaysinh    |
|        | Backend**    | ---          | Frontend**   | ---          |
|        |              | Backend**    |              | Frontend**   |
+========+==============+==============+==============+==============+
| **Step | -   Design   | -   Handle   | -   Step     | -   Keyboard |
| Engine |     E        |     loop     |     counter: |     handler: |
| Core** | xecutionStep |              |     \'Step N |     → next,  |
|        |     schema:  |   iteration: |     of M\'   |     ← prev,  |
|        |     step_id, |              |              |     Space    |
|        |     act      |    increment | -   Linear   |     toggle   |
|        | ive_node_id, | s\[node_id\] |     progress |    auto-play |
|        |     p        |   loop_count |     bar      |              |
|        | rev_node_id, | s\[node_id\] |     across   | -            |
|        |              |     per      |     total    |    Auto-Play |
|        | variables{}, |              |     steps    |     speed    |
|        |     cal      |    iteration |              |     slider:  |
|        | l_stack\[\], |              | -   Step     |     0.5x --  |
|        |     b        | -   Handle   |     jump:    |     10x      |
|        | ranch_taken, |              |     click    |              |
|        |     l        |   try/except |     progress | -   Pause /  |
|        | oop_counts{} |              |     bar to   |     Resume   |
|        |              |   branching: |     jump to  |     button   |
|        | -            |     emit     |     any step |     during   |
|        |    Implement |     ex       |              |              |
|        |     IR       | ception-path |              |    auto-play |
|        |              |     steps    |              |              |
|        |  interpreter |              |              | -   Reverse  |
|        |     ---      | -   Handle   |              |     step     |
|        |     traverse |     nested   |              |     button   |
|        |     IR tree, |     function |              |              |
|        |     emit one |     calls    |              |              |
|        |     step per |     across   |              |              |
|        |              |     files    |              |              |
|        |    statement |              |              |              |
|        |     node     | -   Generate |              |              |
|        |              |     full     |              |              |
|        | -   Track    |     step     |              |              |
|        |     variable |     array    |              |              |
|        |     scope    |     upfront  |              |              |
|        |     stack:   |     before   |              |              |
|        |     push on  |              |              |              |
|        |     function |    streaming |              |              |
|        |     call,    |              |              |              |
|        |     pop on   |              |              |              |
|        |     return   |              |              |              |
+--------+--------------+--------------+--------------+--------------+
| **Va   | -   Include  | -   Detect   | -   Variable | -   Type     |
| riable |     full     |     variable |     Watch    |     badge    |
| Watch  |              |              |     Panel:   |     per      |
| P      |  variables{} |    mutations |              |              |
| anel** |     snapshot |     between  |   two-column |    variable: |
|        |     at every |     steps    |     table    |              |
|        |     step     |              |     (Name \| |    int=blue, |
|        |     (not     | -   Include  |     Value)   |              |
|        |     delta)   |     complex  |              |   str=green, |
|        | -   Include  |     nested   | -   Show     |              |
|        |     type     |     values   |     scope    | list=yellow, |
|        |     string:  |     (list of |     badge:   |              |
|        |     int,     |     dicts,   |     LOCAL /  | dict=purple, |
|        |     str,     |     etc.)    |     GLOBAL   |              |
|        |     list,    |              |              |  bool=orange |
|        |     dict,    | -   Emit     | -   Pin a    |              |
|        |     bool,    |     var      |     variable | -   Amber    |
|        |     NoneType | iable_added, |     to top   |     flash    |
|        |              |     varia    |     of watch |              |
|        | -   Include  | ble_changed, |     panel    |    animation |
|        |              |     vari     |              |     on       |
|        |   prev_value | able_removed |              |     changed  |
|        |     for      |     per step |              |              |
|        |     delta    |              |              |    variables |
|        |              |              |              |              |
|        |    detection |              |              | -   Exp      |
|        |              |              |              | and/collapse |
|        |              |              |              |     lists    |
|        |              |              |              |     and      |
|        |              |              |              |     dicts    |
|        |              |              |              |     with     |
|        |              |              |              |     tree     |
|        |              |              |              |     toggle   |
|        |              |              |              |              |
|        |              |              |              | -            |
|        |              |              |              |  \'Changed\' |
|        |              |              |              |     diff     |
|        |              |              |              |              |
|        |              |              |              |    indicator |
|        |              |              |              |     showing  |
|        |              |              |              |     old →    |
|        |              |              |              |     new      |
|        |              |              |              |     value    |
+--------+--------------+--------------+--------------+--------------+
| **     | -   Include  | -   Compute  | -            | -   Animate  |
| Active |     ac       |     edg      |    Highlight |     edge     |
| Node & | tive_node_id | e_traversed: |     active   |              |
| Branch |     and      |     {        |              |   traversal: |
| Hi     |              |     from_id, |    flowchart |              |
| ghligh | prev_node_id |     to_id,   |     node     |   travelling |
| ting** |     in each  |     label }  |     with     |     dot      |
|        |     step     |     per step |     pulsing  |     along    |
|        |              |              |     blue     |     active   |
|        | -   Include  | -   Include  |     ring     |     edge     |
|        |     b        |              |              |              |
|        | ranch_taken: |    animation | -   Scroll   | -   True     |
|        |     true /   |     hint     |     canvas   |     branch   |
|        |     false /  |              |     to keep  |     edge =   |
|        |     loop /   |  (entry/exit |     active   |     green    |
|        |              |              |     node in  |     flash,   |
|        |    exception |   direction) |     viewport |     False    |
|        |              |     in step  |              |     branch = |
|        |              |     payload  | -   Fade out |     red      |
|        |              |              |     previous |     flash    |
|        |              |              |     node on  |              |
|        |              |              |     step     | -            |
|        |              |              |     advance  |    Loop-back |
|        |              |              |              |     edge =   |
|        |              |              |              |     orange   |
|        |              |              |              |     flash    |
|        |              |              |              |              |
|        |              |              |              | -            |
|        |              |              |              |    Exception |
|        |              |              |              |     edge =   |
|        |              |              |              |     red      |
|        |              |              |              |     dashes   |
|        |              |              |              |     flash    |
+--------+--------------+--------------+--------------+--------------+
| **B    | -   Accept   | -   Log      | -   Click    | -            |
| reakpo |              |              |     node to  |  Conditional |
| ints** |  breakpoint_ |   breakpoint |     set      |              |
|        | node_ids\[\] |     hit      |              |   breakpoint |
|        |     in POST  |     events   |   breakpoint |     UI:      |
|        |     /api/    |     with     |     --- red  |              |
|        | v1/execution |     node     |     dot      |  right-click |
|        |              |     metadata |     badge on |     → \'Add  |
|        | -   Pause    |              |     node     |              |
|        |     step     | -   Expose   |              |  conditional |
|        |     emission |     GET      | -            |              |
|        |     at       |     /a       |   Breakpoint | breakpoint\' |
|        |              | pi/v1/execut |     list     |              |
|        |   breakpoint | ion/{job_id} |     panel    | -            |
|        |     nodes,   | /breakpoints |     with     |  Play-to-nex |
|        |     emit     |     for      |     node     | t-breakpoint |
|        |     PAUSED   |              |     names    |     button   |
|        |     signal   |   breakpoint |     and      |              |
|        |              |     list     |   \'Remove\' | -   Keyboard |
|        | -   Resume   |              |     button   |              |
|        |     on       |              |              |    shortcut: |
|        |     client   |              |              |     F9 to    |
|        |     message  |              |              |     toggle   |
|        |     via      |              |              |              |
|        |              |              |              |   breakpoint |
|        |    WebSocket |              |              |     on       |
|        |              |              |              |     selected |
|        | -   Support  |              |              |     node     |
|        |              |              |              |              |
|        |   step_limit |              |              |              |
|        |     param to |              |              |              |
|        |     cap      |              |              |              |
|        |              |              |              |              |
|        |   simulation |              |              |              |
|        |     length   |              |              |              |
+--------+--------------+--------------+--------------+--------------+
| **Call | -   cal      | -   Celery   | -   Call     | -   Stack    |
| Stack  | l_stack\[\]: |     task for |     Stack    |     depth    |
| &      |     {        |     long     |     Panel:   |     badge in |
| WebSo  |     fu       |              |     vertical |     panel    |
| cket** | nction_name, |    execution |     frame    |     header   |
|        |     file,    |              |     list,    |              |
|        |              |  simulations |     newest   | -   Collapse |
|        | source_line, |              |     on top   |     call     |
|        |              | -            |              |     stack    |
|        |   ir_node_id |   Persistent | -   Click    |     panel to |
|        |     } per    |     step     |     frame →  |     icon     |
|        |     step     |     storage  |     jump to  |     when     |
|        |              |     in Redis |     that     |     empty    |
|        | -            |     (TTL 1h) |              |              |
|        |    WebSocket |              |  function\'s | -   Loop     |
|        |              | -            |              |              |
|        |   ws/executi |    WebSocket |    flowchart |    Iteration |
|        | on/{job_id}: |     he       |              |     Counter  |
|        |     push     | artbeat/ping |              |     badge on |
|        |     each     |     to       |              |     loop     |
|        |     step as  |     detect   |              |     nodes in |
|        |     JSON     |     stale    |              |     canvas   |
|        |              |              |              |              |
|        | -   Handle   |  connections |              |              |
|        |     client   |              |              |              |
|        |              |              |              |              |
|        |   disconnect |              |              |              |
|        |              |              |              |              |
|        |   gracefully |              |              |              |
|        |              |              |              |              |
|        | -            |              |              |              |
|        |   Rate-limit |              |              |              |
|        |     to match |              |              |              |
|        |     client   |              |              |              |
|        |     speed    |              |              |              |
+--------+--------------+--------------+--------------+--------------+
