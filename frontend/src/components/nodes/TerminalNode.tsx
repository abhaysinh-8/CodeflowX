import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { coverageBadge, coverageBorderClass, normalizeCoverageStatus } from './coverageStyles';

export interface TerminalNodeData extends Record<string, unknown> {
  label: string;
  terminal_type?: 'start' | 'end';
  is_active?: boolean;
  has_breakpoint?: boolean;
  coverage_status?: string;
  coverage_overlay?: boolean;
}

const TerminalNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as TerminalNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const isStart = nodeData.terminal_type !== 'end';
  const coverageStatus = normalizeCoverageStatus(nodeData.coverage_status);
  const coverageEnabled = Boolean(nodeData.coverage_overlay);
  const coverageLabel = coverageBadge(coverageStatus, coverageEnabled);

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      aria-label={`${isStart ? 'Start' : 'End'} terminal node`}
      title={nodeData.label}
      className={`
        relative px-6 py-2.5 rounded-full border-2 font-bold text-sm cursor-pointer
        transition-all duration-200 shadow-lg min-w-[100px] text-center
        ${nodeData.is_active ? (isStart ? 'ring-2 ring-emerald-400 ring-offset-1' : 'ring-2 ring-rose-400 ring-offset-1') : ''}
        ${coverageBorderClass(coverageStatus, coverageEnabled)}
        ${selected
          ? (isStart ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100' : 'border-rose-400 bg-rose-500/20 text-rose-100')
          : (isStart ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300' : 'border-rose-500/60 bg-rose-500/10 text-rose-300')
        }
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]" />
      )}
      {coverageLabel && (
        <span className="absolute left-1.5 top-1 text-[8px] font-bold px-1 py-0.5 rounded bg-black/45 text-cyan-100/90 border border-white/15">
          {coverageLabel}
        </span>
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

