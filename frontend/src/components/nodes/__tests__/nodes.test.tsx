/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---- Mocks ----
// Mock @xyflow/react — only need Handle stub
vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Mock zustand store
const mockSelectNode = vi.fn();
vi.mock('../../../store/useStore', () => ({
  useStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { selectNode: mockSelectNode };
    return selector ? selector(state as never) : state;
  },
}));

// Import after mocks
import FunctionNode from '../FunctionNode';
import DecisionNode from '../DecisionNode';
import LoopNode from '../LoopNode';
import TerminalNode from '../TerminalNode';
import CallNode from '../CallNode';
import TryCatchNode from '../TryCatchNode';

// Helper — mimics the NodeProps subset each component uses
const baseProps = {
  xPos: 0,
  yPos: 0,
  zIndex: 0,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  selected: false,
  dragging: false,
  draggable: true,
  selectable: true,
  deletable: true,
  type: '',
};

describe('FunctionNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders the function name', () => {
    render(
      <FunctionNode
        {...baseProps}
        id="n1"
        data={{ label: 'compute', name: 'compute', source_start: 5, source_end: 10 }}
      />
    );
    expect(screen.getByText('compute')).toBeTruthy();
  });

  it('shows line range', () => {
    render(
      <FunctionNode
        {...baseProps}
        id="n1"
        data={{ label: 'foo', source_start: 3, source_end: 7 }}
      />
    );
    expect(screen.getByText(/L3/)).toBeTruthy();
  });

  it('calls selectNode on click', () => {
    render(
      <FunctionNode
        {...baseProps}
        id="fn-42"
        data={{ label: 'bar', ir_node_id: 'ir-fn-42', source_start: 1, source_end: 2 }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /function node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-fn-42', 'flowchart');
  });

  it('applies selected border class when selected=true', () => {
    const { container } = render(
      <FunctionNode
        {...baseProps}
        id="n1"
        selected
        data={{ label: 'sel', source_start: 1, source_end: 1 }}
      />
    );
    expect(container.firstChild).toHaveClass('border-blue-400/80');
  });
});

describe('DecisionNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders the label', () => {
    render(
      <DecisionNode
        {...baseProps}
        id="d1"
        data={{ label: 'x > 0?' }}
      />
    );
    expect(screen.getByText('x > 0?')).toBeTruthy();
  });

  it('calls selectNode on click', () => {
    render(
      <DecisionNode
        {...baseProps}
        id="d-10"
        data={{ label: 'y < 5?', ir_node_id: 'ir-d-10' }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /decision node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-d-10', 'flowchart');
  });
});

describe('LoopNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders loop label', () => {
    render(
      <LoopNode
        {...baseProps}
        id="l1"
        data={{ label: 'for i in range(10)', source_start: 8, source_end: 12 }}
      />
    );
    expect(screen.getByText(/for i in range/)).toBeTruthy();
  });

  it('calls selectNode on click', () => {
    render(
      <LoopNode
        {...baseProps}
        id="loop-5"
        data={{ label: 'while True', ir_node_id: 'ir-loop-5', source_start: 5, source_end: 9 }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /loop node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-loop-5', 'flowchart');
  });
});

describe('TerminalNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders start terminal', () => {
    render(
      <TerminalNode
        {...baseProps}
        id="t1"
        data={{ label: 'Start', terminal_type: 'start' }}
      />
    );
    expect(screen.getByText('Start')).toBeTruthy();
  });

  it('renders end terminal', () => {
    render(
      <TerminalNode
        {...baseProps}
        id="t2"
        data={{ label: 'End', terminal_type: 'end' }}
      />
    );
    expect(screen.getByText('End')).toBeTruthy();
  });

  it('calls selectNode on click', () => {
    render(
      <TerminalNode
        {...baseProps}
        id="term-1"
        data={{ label: 'Start', ir_node_id: 'ir-term-1', terminal_type: 'start' }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /terminal node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-term-1', 'flowchart');
  });
});

describe('CallNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders callee name', () => {
    render(
      <CallNode
        {...baseProps}
        id="c1"
        data={{ label: 'process(x)', callee: 'process', source_start: 14 }}
      />
    );
    expect(screen.getAllByText(/process/).length).toBeGreaterThan(0);
  });

  it('calls selectNode on click', () => {
    render(
      <CallNode
        {...baseProps}
        id="call-7"
        data={{ label: 'print()', ir_node_id: 'ir-call-7', callee: 'print', source_start: 10 }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /call node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-call-7', 'flowchart');
  });
});

describe('TryCatchNode', () => {
  beforeEach(() => mockSelectNode.mockClear());

  it('renders try block label', () => {
    render(
      <TryCatchNode
        {...baseProps}
        id="tc1"
        data={{ label: 'try block', exception_type: 'ValueError' }}
      />
    );
    expect(screen.getByText(/try block/i)).toBeTruthy();
  });

  it('shows exception type', () => {
    render(
      <TryCatchNode
        {...baseProps}
        id="tc2"
        data={{ label: 'try', exception_type: 'TypeError' }}
      />
    );
    expect(screen.getByText(/TypeError/)).toBeTruthy();
  });

  it('calls selectNode on click', () => {
    render(
      <TryCatchNode
        {...baseProps}
        id="tc-3"
        data={{ label: 'try', ir_node_id: 'ir-tc-3', exception_type: 'IOError' }}
      />
    );
    fireEvent.click(screen.getByRole('generic', { name: /try.catch node/i }));
    expect(mockSelectNode).toHaveBeenCalledWith('ir-tc-3', 'flowchart');
  });
});
