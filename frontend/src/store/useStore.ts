import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { BreakpointHit, ExecutionStep } from '../types/execution';

export type Language = 'python' | 'javascript' | 'typescript' | 'java';
export type CoverageStatus = 'fully_covered' | 'partially_covered' | 'uncovered' | 'dead';
export type CoverageFilter = 'all' | 'covered' | 'partial' | 'uncovered' | 'dead';
export type SelectionSource = 'flowchart' | 'dependency' | 'execution' | 'coverage' | 'editor' | 'history' | 'system';

interface FlowchartData {
  nodes: Node[];
  edges: Edge[];
}

interface DependencyCluster {
  id: string;
  type: string;
  name: string;
  module: string;
  node_ids: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DependencyData {
  graphId: string;
  nodes: Node[];
  edges: Edge[];
  clusters: DependencyCluster[];
}

interface DependencySearchResult {
  id: string;
  name: string;
  type: string;
  module: string;
  signature?: string;
  docstring?: string;
}

interface IRNode {
  id: string;
  type: string;
  language?: string;
  name?: string;
  source_start?: number;
  source_end?: number;
  children: IRNode[];
  metadata: Record<string, unknown>;
}

interface CoverageNodeRecord {
  coverage_status: CoverageStatus;
  hits: number;
  hit_lines: number;
  total_lines: number;
  branch_covered: number;
  branch_total: number;
  dead: boolean;
}

interface CoverageSummary {
  total_nodes: number;
  covered: number;
  partial: number;
  uncovered: number;
  dead: number;
  coverage_percent: number;
}

interface CoverageData {
  format: string;
  node_coverage_map: Record<string, CoverageNodeRecord>;
  coverage_node_coverage_map: Record<string, CoverageNodeRecord>;
  summary: CoverageSummary;
  report_json: Record<string, unknown>;
  file_name?: string;
  file_size?: number;
}

interface IRNodeLookupEntry {
  flowchart_node_id?: string;
  dependency_node_ids: string[];
  source_start?: number;
  source_end?: number;
  coverage_status?: string;
}

interface SelectNodeOptions {
  force?: boolean;
  recordHistory?: boolean;
}

interface AppState {
  // Editor
  code: string;
  language: Language;
  setCode: (code: string) => void;
  setLanguage: (lang: Language) => void;

  // Unified analysis context
  analysisJobId: string | null;
  irNodeLookup: Record<string, IRNodeLookupEntry>;
  setAnalysisContext: (payload: { jobId: string | null; irNodeLookup?: Record<string, IRNodeLookupEntry> }) => void;

  // Cross-view sync
  syncViewsEnabled: boolean;
  selectedNodeId: string | null;
  selectionPulseNodeId: string | null;
  selectionPulseToken: number;
  selectionPulseAt: number;
  selectionHistory: string[];
  selectionHistoryIndex: number;
  setSyncViewsEnabled: (enabled: boolean) => void;
  setSelectedNodeId: (id: string | null) => void;
  selectNode: (id: string | null, source?: SelectionSource, options?: SelectNodeOptions) => void;
  goSelectionBack: () => void;
  goSelectionForward: () => void;
  clearSelectionHistory: () => void;

  // Flowchart
  flowchartData: FlowchartData | null;
  isLoadingFlowchart: boolean;
  flowchartProgress: number;
  flowchartError: string | null;
  setFlowchartData: (data: FlowchartData | null) => void;
  setLoadingFlowchart: (loading: boolean) => void;
  setFlowchartProgress: (progress: number) => void;
  setFlowchartError: (err: string | null) => void;

  // IR Debug
  irNodes: IRNode[];
  setIrNodes: (nodes: IRNode[]) => void;

  // Syntax error highlight
  syntaxErrorLine: number | null;
  setSyntaxErrorLine: (line: number | null) => void;

  // Execution state
  executionState: Record<string, unknown>;
  setExecutionState: (state: Record<string, unknown>) => void;
  executionJobId: string | null;
  executionSteps: ExecutionStep[];
  currentExecutionStep: number;
  executionBreakpoints: string[];
  breakpointHits: BreakpointHit[];
  isLoadingExecution: boolean;
  executionError: string | null;
  isExecutionPlaying: boolean;
  isExecutionPaused: boolean;
  executionSpeed: number;
  pinnedVariables: string[];
  setExecutionData: (payload: { jobId: string; steps: ExecutionStep[]; breakpointNodeIds?: string[] }) => void;
  clearExecution: () => void;
  setLoadingExecution: (loading: boolean) => void;
  setExecutionErrorMessage: (error: string | null) => void;
  setCurrentExecutionStep: (stepIndex: number) => void;
  nextExecutionStep: () => void;
  prevExecutionStep: () => void;
  setExecutionPlaying: (isPlaying: boolean) => void;
  setExecutionPaused: (isPaused: boolean) => void;
  setExecutionSpeed: (speed: number) => void;
  setExecutionBreakpoints: (breakpoints: string[]) => void;
  toggleExecutionBreakpoint: (nodeId: string) => void;
  setBreakpointHits: (hits: BreakpointHit[]) => void;
  togglePinnedVariable: (name: string) => void;

  // Dependency execution highlighting
  dependencyExecutionActiveNodeId: string | null;
  dependencyExecutionTrail: string[];
  setDependencyExecutionActiveNodeId: (nodeId: string | null) => void;
  clearDependencyExecutionTrail: () => void;

  // Coverage
  coverageData: CoverageData | null;
  isLoadingCoverage: boolean;
  coverageError: string | null;
  coverageOverlayEnabled: boolean;
  coverageFilter: CoverageFilter;
  setCoverageData: (data: CoverageData | null) => void;
  setLoadingCoverage: (loading: boolean) => void;
  setCoverageError: (error: string | null) => void;
  setCoverageOverlayEnabled: (enabled: boolean) => void;
  setCoverageFilter: (filter: CoverageFilter) => void;
  clearCoverage: () => void;

  // Dependency graph
  dependencyData: DependencyData | null;
  dependencySearchResults: DependencySearchResult[];
  isLoadingDependency: boolean;
  dependencyError: string | null;
  setDependencyData: (data: DependencyData | null) => void;
  setDependencySearchResults: (results: DependencySearchResult[]) => void;
  setLoadingDependency: (loading: boolean) => void;
  setDependencyError: (error: string | null) => void;
}

export const useStore = create<AppState>((set) => ({
  // Editor
  code: '',
  language: 'python',
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),

  // Unified analysis context
  analysisJobId: null,
  irNodeLookup: {},
  setAnalysisContext: ({ jobId, irNodeLookup }) => set({
    analysisJobId: jobId,
    irNodeLookup: irNodeLookup ?? {},
  }),

  // Cross-view sync
  syncViewsEnabled: true,
  selectedNodeId: null,
  selectionPulseNodeId: null,
  selectionPulseToken: 0,
  selectionPulseAt: 0,
  selectionHistory: [],
  selectionHistoryIndex: -1,
  setSyncViewsEnabled: (syncViewsEnabled) => set({ syncViewsEnabled }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
  selectNode: (id, source = 'system', options = {}) => set((state) => {
    void source;
    if (!id) return {};
    if (!state.syncViewsEnabled && !options.force) return {};

    const updates: Partial<AppState> = {
      selectedNodeId: id,
      selectionPulseNodeId: id,
      selectionPulseToken: state.selectionPulseToken + 1,
      selectionPulseAt: Date.now(),
    };

    if (options.recordHistory !== false) {
      const trimmed = state.selectionHistory.slice(0, state.selectionHistoryIndex + 1);
      if (trimmed[trimmed.length - 1] !== id) {
        trimmed.push(id);
      }
      updates.selectionHistory = trimmed;
      updates.selectionHistoryIndex = trimmed.length - 1;
    }

    return updates;
  }),
  goSelectionBack: () => set((state) => {
    if (state.selectionHistoryIndex <= 0) return {};
    const nextIndex = state.selectionHistoryIndex - 1;
    const selectedNodeId = state.selectionHistory[nextIndex] ?? null;
    return {
      selectionHistoryIndex: nextIndex,
      selectedNodeId,
      selectionPulseNodeId: selectedNodeId,
      selectionPulseToken: state.selectionPulseToken + 1,
      selectionPulseAt: Date.now(),
    };
  }),
  goSelectionForward: () => set((state) => {
    if (state.selectionHistoryIndex >= state.selectionHistory.length - 1) return {};
    const nextIndex = state.selectionHistoryIndex + 1;
    const selectedNodeId = state.selectionHistory[nextIndex] ?? null;
    return {
      selectionHistoryIndex: nextIndex,
      selectedNodeId,
      selectionPulseNodeId: selectedNodeId,
      selectionPulseToken: state.selectionPulseToken + 1,
      selectionPulseAt: Date.now(),
    };
  }),
  clearSelectionHistory: () => set({
    selectionHistory: [],
    selectionHistoryIndex: -1,
    selectedNodeId: null,
    selectionPulseNodeId: null,
  }),

  // Flowchart
  flowchartData: null,
  isLoadingFlowchart: false,
  flowchartProgress: 0,
  flowchartError: null,
  setFlowchartData: (flowchartData) => set({ flowchartData }),
  setLoadingFlowchart: (isLoadingFlowchart) => set({ isLoadingFlowchart }),
  setFlowchartProgress: (flowchartProgress) => set({ flowchartProgress: Math.max(0, Math.min(100, flowchartProgress)) }),
  setFlowchartError: (flowchartError) => set({ flowchartError }),

  // IR Debug
  irNodes: [],
  setIrNodes: (irNodes) => set({ irNodes }),

  // Syntax error highlight
  syntaxErrorLine: null,
  setSyntaxErrorLine: (syntaxErrorLine) => set({ syntaxErrorLine }),

  // Execution state
  executionState: {},
  setExecutionState: (executionState) => set({ executionState }),
  executionJobId: null,
  executionSteps: [],
  currentExecutionStep: 0,
  executionBreakpoints: [],
  breakpointHits: [],
  isLoadingExecution: false,
  executionError: null,
  isExecutionPlaying: false,
  isExecutionPaused: false,
  executionSpeed: 1,
  pinnedVariables: [],
  setExecutionData: ({ jobId, steps, breakpointNodeIds = [] }) => set({
    executionJobId: jobId,
    executionSteps: steps,
    currentExecutionStep: steps.length ? 0 : 0,
    executionBreakpoints: [...breakpointNodeIds],
    breakpointHits: [],
    isLoadingExecution: false,
    executionError: null,
    isExecutionPaused: false,
    isExecutionPlaying: false,
    pinnedVariables: [],
    dependencyExecutionActiveNodeId: null,
    dependencyExecutionTrail: [],
  }),
  clearExecution: () => set({
    executionJobId: null,
    executionSteps: [],
    currentExecutionStep: 0,
    breakpointHits: [],
    isLoadingExecution: false,
    executionError: null,
    isExecutionPlaying: false,
    isExecutionPaused: false,
    pinnedVariables: [],
    dependencyExecutionActiveNodeId: null,
    dependencyExecutionTrail: [],
  }),
  setLoadingExecution: (isLoadingExecution) => set({ isLoadingExecution }),
  setExecutionErrorMessage: (executionError) => set({ executionError, isLoadingExecution: false }),
  setCurrentExecutionStep: (stepIndex) => set((state) => ({
    currentExecutionStep: Math.max(0, Math.min(stepIndex, Math.max(0, state.executionSteps.length - 1))),
  })),
  nextExecutionStep: () => set((state) => ({
    currentExecutionStep: Math.min(state.currentExecutionStep + 1, Math.max(0, state.executionSteps.length - 1)),
  })),
  prevExecutionStep: () => set((state) => ({
    currentExecutionStep: Math.max(state.currentExecutionStep - 1, 0),
  })),
  setExecutionPlaying: (isExecutionPlaying) => set({ isExecutionPlaying }),
  setExecutionPaused: (isExecutionPaused) => set({ isExecutionPaused }),
  setExecutionSpeed: (executionSpeed) => set({ executionSpeed: Math.max(0.5, Math.min(executionSpeed, 10)) }),
  setExecutionBreakpoints: (executionBreakpoints) => set({ executionBreakpoints: [...executionBreakpoints] }),
  toggleExecutionBreakpoint: (nodeId) => set((state) => {
    const hasNode = state.executionBreakpoints.includes(nodeId);
    return {
      executionBreakpoints: hasNode
        ? state.executionBreakpoints.filter((id) => id !== nodeId)
        : [...state.executionBreakpoints, nodeId],
    };
  }),
  setBreakpointHits: (breakpointHits) => set({ breakpointHits }),
  togglePinnedVariable: (name) => set((state) => {
    const has = state.pinnedVariables.includes(name);
    return {
      pinnedVariables: has
        ? state.pinnedVariables.filter((item) => item !== name)
        : [...state.pinnedVariables, name],
    };
  }),

  // Dependency execution highlighting
  dependencyExecutionActiveNodeId: null,
  dependencyExecutionTrail: [],
  setDependencyExecutionActiveNodeId: (nodeId) => set((state) => {
    if (!nodeId) {
      return { dependencyExecutionActiveNodeId: null };
    }
    const prev = state.dependencyExecutionTrail;
    const nextTrail = prev[prev.length - 1] === nodeId ? prev : [...prev, nodeId];
    return {
      dependencyExecutionActiveNodeId: nodeId,
      dependencyExecutionTrail: nextTrail,
    };
  }),
  clearDependencyExecutionTrail: () => set({
    dependencyExecutionActiveNodeId: null,
    dependencyExecutionTrail: [],
  }),

  // Coverage
  coverageData: null,
  isLoadingCoverage: false,
  coverageError: null,
  coverageOverlayEnabled: false,
  coverageFilter: 'all',
  setCoverageData: (coverageData) => set({ coverageData }),
  setLoadingCoverage: (isLoadingCoverage) => set({ isLoadingCoverage }),
  setCoverageError: (coverageError) => set({ coverageError }),
  setCoverageOverlayEnabled: (coverageOverlayEnabled) => set({ coverageOverlayEnabled }),
  setCoverageFilter: (coverageFilter) => set({ coverageFilter }),
  clearCoverage: () => set({
    coverageData: null,
    coverageError: null,
    isLoadingCoverage: false,
    coverageOverlayEnabled: false,
    coverageFilter: 'all',
  }),

  // Dependency graph
  dependencyData: null,
  dependencySearchResults: [],
  isLoadingDependency: false,
  dependencyError: null,
  setDependencyData: (dependencyData) => set({ dependencyData }),
  setDependencySearchResults: (dependencySearchResults) => set({ dependencySearchResults }),
  setLoadingDependency: (isLoadingDependency) => set({ isLoadingDependency }),
  setDependencyError: (dependencyError) => set({ dependencyError }),
}));

// Keep store warm for non-hook callers using getState().
void useStore.getState();
