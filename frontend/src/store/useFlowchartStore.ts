import { create } from 'zustand';

interface FlowchartState {
  code: string;
  language: string;
  nodes: any[];
  edges: any[];
  ir: any;
  isLoading: boolean;
  error: string | null;
  
  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setData: (data: { nodes: any[], edges: any[], ir: any }) => void;
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
