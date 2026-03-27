import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

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

  // Execution state (Phase 2 placeholder)
  executionState: Record<string, unknown>;
  setExecutionState: (state: Record<string, unknown>) => void;

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
