import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type { BreakpointHit, ExecutionStep } from '../types/execution';

export type Language = 'python' | 'javascript' | 'typescript' | 'java';

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

interface AppState {
  // Editor
  code: string;
  language: Language;
  setCode: (code: string) => void;
  setLanguage: (lang: Language) => void;

  // Cross-view sync
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Flowchart
  flowchartData: FlowchartData | null;
  isLoadingFlowchart: boolean;
  flowchartError: string | null;
  setFlowchartData: (data: FlowchartData | null) => void;
  setLoadingFlowchart: (loading: boolean) => void;
  setFlowchartError: (err: string | null) => void;

  // IR Debug
  irNodes: IRNode[];
  setIrNodes: (nodes: IRNode[]) => void;

  // Syntax error highlight
  syntaxErrorLine: number | null;
  setSyntaxErrorLine: (line: number | null) => void;

  // Execution state (legacy placeholder + phase 2 runtime state)
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

  // Coverage (Phase 4 placeholder)
  coverageData: Record<string, unknown>;
  setCoverageData: (data: Record<string, unknown>) => void;

  // Dependency graph (Phase 3)
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

  // Cross-view sync
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  // Flowchart
  flowchartData: null,
  isLoadingFlowchart: false,
  flowchartError: null,
  setFlowchartData: (flowchartData) => set({ flowchartData }),
  setLoadingFlowchart: (isLoadingFlowchart) => set({ isLoadingFlowchart }),
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

  // Coverage
  coverageData: {},
  setCoverageData: (coverageData) => set({ coverageData }),

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
