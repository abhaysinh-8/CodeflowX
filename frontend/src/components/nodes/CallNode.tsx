import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';

export interface CallNodeData extends Record<string, unknown> {
  label: string;
  callee?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
  has_breakpoint?: boolean;
}

const CallNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as CallNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      title={`Calls: ${nodeData.callee || nodeData.label} — Line ${nodeData.source_start ?? '?'}`}
      aria-label={`Function call node: ${nodeData.label}`}
      className={`
        relative min-w-[140px] cursor-pointer transition-all duration-200 shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-background' : ''}
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)] z-20" />
      )}
      {/* Outer double-border subprocess box */}
      <div
        className={`
          rounded-lg border-2 p-0.5
          ${selected ? 'border-purple-400' : 'border-purple-500/50'}
        `}
      >
        <div
          className={`
            rounded-md border px-3 py-2.5 bg-[#130d1f]/90
            ${selected ? 'border-purple-400/60' : 'border-purple-500/30'}
          `}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-purple-300/60">call</span>
          </div>
          <span className="text-xs font-bold text-purple-100 truncate block">{nodeData.label}</span>
          {nodeData.callee && nodeData.callee !== nodeData.label && (
            <span className="text-[10px] text-purple-300/50 font-mono block truncate">→ {nodeData.callee}</span>
          )}
          <span className="text-[10px] text-white/20 font-mono">L{nodeData.source_start ?? '?'}</span>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-purple-400/60 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400/60 !w-2 !h-2" />
    </div>
  );
};

export default memo(CallNode);

