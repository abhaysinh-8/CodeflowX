/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---- Mocks ----
// Mock @xyflow/react wholesale — we only test loading/error/demo overlay states
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="reactflow">{children}</div>,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Panel: ({ children }: { children?: React.ReactNode }) => <div data-testid="panel">{children}</div>,
  useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
}));
vi.mock('../../nodes', () => ({ nodeTypes: {} }));
vi.mock('../../../hooks/useFlowchartAPI', () => ({
  useFlowchartAPI: () => ({ analyze: vi.fn(), isLoading: false }),
}));

const mockSetFlowchartError = vi.fn();
let mockState = {
  flowchartData: null as null | { nodes: unknown[]; edges: unknown[] },
  isLoadingFlowchart: false,
  flowchartProgress: 0,
  flowchartError: null as string | null,
  selectedNodeId: null as string | null,
  selectionPulseNodeId: null as string | null,
  selectionPulseToken: 0,
  selectNode: vi.fn(),
  coverageData: null as null | { node_coverage_map?: Record<string, unknown>; coverage_node_coverage_map?: Record<string, unknown> },
  coverageOverlayEnabled: false,
  coverageFilter: 'all',
};

vi.mock('../../../store/useStore', () => {
  const getState = () => ({ setFlowchartError: mockSetFlowchartError });
  const useStore = (selector?: (s: unknown) => unknown) => {
    const state = { ...mockState, setFlowchartError: mockSetFlowchartError };
    return selector ? selector(state) : state;
  };
  useStore.getState = getState;
  return { useStore };
});

import FlowchartCanvas from '../FlowchartCanvas';

describe('FlowchartCanvas', () => {
  beforeEach(() => {
    mockState = {
      flowchartData: null,
      isLoadingFlowchart: false,
      flowchartProgress: 0,
      flowchartError: null,
      selectedNodeId: null,
      selectionPulseNodeId: null,
      selectionPulseToken: 0,
      selectNode: vi.fn(),
      coverageData: null,
      coverageOverlayEnabled: false,
      coverageFilter: 'all',
    };
    mockSetFlowchartError.mockClear();
  });

  it('shows loading spinner when isLoadingFlowchart=true', () => {
    mockState.isLoadingFlowchart = true;
    render(<FlowchartCanvas />);
    expect(screen.getByText(/generating flowchart/i)).toBeTruthy();
  });

  it('shows error panel when flowchartError is set', () => {
    mockState.flowchartError = 'SyntaxError at line 5';
    render(<FlowchartCanvas />);
    expect(screen.getByText(/analysis error/i)).toBeTruthy();
    expect(screen.getByText(/SyntaxError at line 5/i)).toBeTruthy();
  });

  it('dismiss button clears the error', () => {
    mockState.flowchartError = 'Some error';
    render(<FlowchartCanvas />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockSetFlowchartError).toHaveBeenCalledWith(null);
  });

  it('shows demo overlay when no flowchartData', () => {
    render(<FlowchartCanvas />);
    expect(screen.getByText(/demo/i)).toBeTruthy();
  });

  it('renders ReactFlow when not loading and no error', () => {
    render(<FlowchartCanvas />);
    expect(screen.getByTestId('reactflow')).toBeTruthy();
  });

  it('shows node/edge count panel', () => {
    render(<FlowchartCanvas />);
    expect(screen.getByTestId('panel')).toBeTruthy();
    expect(screen.getByText(/nodes/)).toBeTruthy();
  });
});
