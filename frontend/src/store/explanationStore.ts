import { create } from 'zustand';

export type ExplanationType = 'node' | 'edge' | 'coverage' | 'failure';

export interface ExplanationEntry {
  id: string;
  type: ExplanationType;
  targetId: string;
  explanation: string;
  confidence: number;
  relevant_lines: number[];
  createdAt: number;
}

export interface ExplanationRequestMeta {
  type: ExplanationType;
  targetId: string;
  payload: Record<string, unknown>;
}

interface ExplanationStoreState {
  currentExplanation: ExplanationEntry | null;
  currentStreamText: string;
  isLoading: boolean;
  error: string | null;
  history: ExplanationEntry[];
  isOpen: boolean;
  lastRequest: ExplanationRequestMeta | null;

  setOpen: (open: boolean) => void;
  startRequest: (meta: ExplanationRequestMeta) => void;
  appendChunk: (text: string) => void;
  finishRequest: (entry: Omit<ExplanationEntry, 'id' | 'createdAt'>) => void;
  failRequest: (error: string) => void;
  reopenFromHistory: (id: string) => void;
  clearCurrentExplanation: () => void;
}

export const useExplanationStore = create<ExplanationStoreState>((set) => ({
  currentExplanation: null,
  currentStreamText: '',
  isLoading: false,
  error: null,
  history: [],
  isOpen: false,
  lastRequest: null,

  setOpen: (isOpen) => set({ isOpen }),

  startRequest: (lastRequest) => set({
    lastRequest,
    isLoading: true,
    error: null,
    currentStreamText: '',
    currentExplanation: null,
    isOpen: true,
  }),

  appendChunk: (text) => set((state) => ({
    currentStreamText: `${state.currentStreamText}${text}`,
  })),

  finishRequest: (entry) => set((state) => {
    const enriched: ExplanationEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    return {
      currentExplanation: enriched,
      currentStreamText: enriched.explanation,
      isLoading: false,
      error: null,
      history: [enriched, ...state.history].slice(0, 30),
      isOpen: true,
    };
  }),

  failRequest: (error) => set({
    isLoading: false,
    error,
  }),

  reopenFromHistory: (id) => set((state) => {
    const match = state.history.find((item) => item.id === id) ?? null;
    if (!match) return {};
    return {
      currentExplanation: match,
      currentStreamText: match.explanation,
      isOpen: true,
      error: null,
      isLoading: false,
    };
  }),

  clearCurrentExplanation: () => set({
    currentExplanation: null,
    currentStreamText: '',
    error: null,
    isLoading: false,
  }),
}));

