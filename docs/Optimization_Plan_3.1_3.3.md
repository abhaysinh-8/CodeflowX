# CodeFlowX+ Optimization Plan (3.1 + 3.3)

Last updated: 2026-03-27

## Scope

This plan optimizes only:

- `3.1` Code-to-Flowchart
- `3.3` Dependency Graph

It is designed for the current project state (single-file analysis first), without requiring `3.2` or `3.4`.

## Goals And Performance Targets

### 3.1 Targets

- P50 flowchart generation latency: <= 350ms for 300 LOC
- P95 flowchart generation latency: <= 900ms for 500 LOC
- Frontend canvas first render after API success: <= 250ms for <= 250 nodes
- API error rate for valid code: < 1%

### 3.3 Targets

- P50 dependency graph generation latency: <= 500ms for 500 LOC
- P95 dependency graph generation latency: <= 1.4s for 1000 LOC
- Search API latency: <= 120ms for top-10 results
- Subgraph API latency (1-2 hops): <= 180ms
- Frontend graph interaction FPS: >= 45 on medium graphs (300-500 nodes)

## Baseline Measurement (Do First)

- Add request timing logs for:
- `POST /api/v1/flowchart`
- `POST /api/v1/dependency`
- `GET /api/v1/dependency/search`
- `GET /api/v1/dependency/subgraph/{node_id}`
- Capture payload size, node count, edge count, and total processing time.
- Add frontend performance marks:
- API response received time
- graph data normalization time
- canvas render-complete time
- Save baseline report in `docs/perf/baseline_3.1_3.3.md`.

## 3.1 Optimization Backlog

### Backend Pipeline

- Pre-warm grammar loaders on app startup to remove first-request cold start.
- Reuse parser instances where safe instead of re-creating per request.
- Minimize repeated tree traversal in IR transform and flowchart generation.
- Avoid deep copies for IR/flowchart structures unless required.
- Add fast-fail guards:
- reject empty code early
- explicit size limit with clear 413 message
- return typed error for unsupported language

### Flowchart Generation

- Keep node and edge generation single-pass where possible.
- Ensure branch and loop edge creation is O(nodes + edges), not O(n^2).
- Add optional compact response mode for very large graphs:
- omit non-essential metadata unless requested
- preserve `ir_node_id`, `source_start`, `source_end`

### Frontend Flowchart Rendering

- Memoize node components and expensive selectors.
- Keep stable callback references for React Flow handlers.
- Batch state updates when replacing nodes/edges after analysis.
- Avoid unnecessary canvas remounts for same graph version.
- Add graceful fallback:
- if node count exceeds threshold, disable expensive decorations first

### Quality Gates (3.1)

- Add regression tests for large synthetic inputs:
- 100 LOC, 300 LOC, 500 LOC
- Add snapshot and schema tests for stable node/edge payload shape.
- Add performance budget test in CI (non-blocking first, blocking later).

## 3.3 Optimization Backlog

### Backend Graph Extraction

- Build adjacency maps once and reuse for:
- search ranking context
- subgraph traversal
- neighborhood highlighting payloads
- Cache symbol table per request lifecycle (avoid repeated recomputation).
- Improve callee resolution with deterministic priority order:
- local function
- class method
- imported symbol
- external fallback
- Keep external dependency detection table-driven for faster lookups.

### Search And Subgraph APIs

- Normalize searchable text once (lowercase + stripped punctuation).
- Precompute lightweight search tokens per node.
- Return compact result schema for search list views.
- Ensure cursor pagination is stable and deterministic.
- Validate hop limits and node IDs early to avoid heavy traversal on bad requests.

### Frontend Dependency Graph

- Keep layout cost bounded:
- prefer backend-provided positions for initial render
- re-layout only changed subsets
- Defer expensive hover tooltips until node is stable/focused.
- Add level-of-detail rendering:
- simplified labels at low zoom
- full details only on high zoom or selection
- Keep connected-node highlighting incremental, not full graph repaint.

### Quality Gates (3.3)

- Add golden tests for expected node and edge types per language snippet.
- Add API tests for:
- search ranking correctness
- cursor pagination consistency
- subgraph hop correctness
- Add frontend interaction tests for:
- selection, filter, and search-to-zoom behavior

## Shared Optimization Work

### Caching Strategy

- Add bounded in-memory cache for repeated identical requests:
- key: hash(language + module_path + code)
- value: graph/flowchart payload + metadata
- Apply short TTL for local mode and configurable TTL for production.
- Add cache hit/miss metrics to logs.

### API Contract Stability

- Version response schemas and freeze critical fields:
- `id`, `ir_node_id`, `source_start`, `source_end`, `type`, `name`
- Add contract tests to prevent accidental payload drift.

### Observability

- Add structured logs with request ID and timing breakdown:
- parse time
- IR transform time
- graph generation time
- serialization time
- Add lightweight metrics dashboard source in `docs/perf/metrics.md`.

### CI Guardrails

- Keep lint + typecheck + unit tests blocking.
- Add optional perf smoke tests on pull requests.
- Promote perf smoke tests to blocking after 2 stable weeks.

## Rollout Plan

### Phase A (Quick Wins, 2-3 days)

- Baseline measurement and instrumentation
- grammar pre-warm
- stable search normalization
- frontend memoization for heavy node components

### Phase B (Core Performance, 4-6 days)

- adjacency/symbol-table reuse in dependency extraction
- single-pass flowchart optimizations
- deterministic pagination and compact search payload
- large-input regression tests

### Phase C (Hardening, 3-5 days)

- cache with metrics
- contract tests and perf budgets
- documentation of SLOs and runbook

## Definition Of Done

- All target endpoints have timing metrics.
- No correctness regressions in existing tests.
- New performance tests pass agreed budgets.
- README and docs updated with performance expectations.
- Team can reproduce benchmark numbers locally with one command set.

