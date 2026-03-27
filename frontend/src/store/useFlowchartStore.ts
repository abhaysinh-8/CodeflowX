import { create } from 'zustand';
import type { Node, Edge } from 'reactflow';

interface IRNodeData {
  id?: string;
  type?: string;
  name?: string;
  source_start?: number;
  source_end?: number;
  children?: IRNodeData[];
}

interface FlowchartState {
  code: string;
  language: string;
  nodes: Node[];
  edges: Edge[];
  ir: IRNodeData | null;
  isLoading: boolean;
  error: string | null;

  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setData: (data: { nodes: Node[], edges: Edge[], ir: IRNodeData | null }) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useFlowchartStore = create<FlowchartState>((set) => ({
  code: '',
  language: 'python',
  nodes: [],
  edges: [],
  ir: null,
  isLoading: false,
  error: null,

  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setData: (data) => set({ ...data, isLoading: false, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
