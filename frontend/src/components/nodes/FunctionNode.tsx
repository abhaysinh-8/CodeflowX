import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';

export interface FunctionNodeData extends Record<string, unknown> {
  label: string;
  name?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
}

const FunctionNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as FunctionNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  const handleClick = () => setSelectedNodeId(id);

  return (
    <div
      onClick={handleClick}
      title={`${nodeData.name || nodeData.label} — Lines ${nodeData.source_start ?? '?'}–${nodeData.source_end ?? '?'}`}
      aria-label={`Function node: ${nodeData.name || nodeData.label}`}
      className={`
        min-w-[140px] rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background' : ''}
        ${selected ? 'border-blue-400/80 shadow-blue-500/30 shadow-xl' : 'border-blue-500/30'}
      `}
    >
      {/* Blue header bar */}
      <div className="bg-blue-600/80 px-3 py-1.5 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest text-blue-100/70">fn</span>
        <span className="text-xs font-bold text-white truncate">{nodeData.name || nodeData.label}</span>
      </div>
      {/* Body */}
      <div className="bg-[#0f1829]/90 backdrop-blur-sm px-3 py-2">
        <span className="text-[10px] text-white/50 font-mono">
          L{nodeData.source_start ?? '?'}–{nodeData.source_end ?? '?'}
        </span>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-blue-400/60 !border-blue-500/50 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400/60 !border-blue-500/50 !w-2 !h-2" />
    </div>
  );
};

export default memo(FunctionNode);

