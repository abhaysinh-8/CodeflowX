import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';

export interface TerminalNodeData extends Record<string, unknown> {
  label: string;
  terminal_type?: 'start' | 'end';
  is_active?: boolean;
  has_breakpoint?: boolean;
}

const TerminalNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as TerminalNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const isStart = nodeData.terminal_type !== 'end';

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      aria-label={`${isStart ? 'Start' : 'End'} terminal node`}
      title={nodeData.label}
      className={`
        relative px-6 py-2.5 rounded-full border-2 font-bold text-sm cursor-pointer
        transition-all duration-200 shadow-lg min-w-[100px] text-center
        ${nodeData.is_active ? (isStart ? 'ring-2 ring-emerald-400 ring-offset-1' : 'ring-2 ring-rose-400 ring-offset-1') : ''}
        ${selected
          ? (isStart ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100' : 'border-rose-400 bg-rose-500/20 text-rose-100')
          : (isStart ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/60 bg-rose-500/10 text-rose-300')
        }
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]" />
      )}
      {nodeData.label}

      {isStart ? (
        <Handle type="source" position={Position.Bottom} className="!bg-emerald-400/70 !w-2 !h-2" />
      ) : (
        <Handle type="target" position={Position.Top} className="!bg-rose-400/70 !w-2 !h-2" />
      )}
    </div>
  );
};

export default memo(TerminalNode);

