import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { RefreshCw } from 'lucide-react';

export interface LoopNodeData extends Record<string, unknown> {
  label: string;
  loop_count?: number;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
  has_breakpoint?: boolean;
}

const LoopNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as LoopNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      title={`Loop: ${nodeData.label} — Lines ${nodeData.source_start ?? '?'}–${nodeData.source_end ?? '?'}`}
      aria-label={`Loop node: ${nodeData.label}`}
      className={`
        relative min-w-[140px] rounded-xl border transition-all duration-200 cursor-pointer shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-green-400 ring-offset-1 ring-offset-background' : ''}
        ${selected ? 'border-green-400/80 shadow-green-500/30 shadow-xl' : 'border-green-500/30'}
        bg-[#0a1f12]/90
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]" />
      )}
      {/* Green header */}
      <div className="bg-green-700/70 px-3 py-1.5 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-green-200" />
          <span className="text-[9px] font-bold uppercase tracking-widest text-green-100/70">loop</span>
        </div>
        {nodeData.loop_count !== undefined && (
          <span className="text-[10px] font-mono bg-green-500/30 text-green-200 px-1.5 py-0.5 rounded-full">
            ×{nodeData.loop_count}
          </span>
        )}
      </div>
      <div className="px-3 py-2">
        <span className="text-xs font-semibold text-green-100/80 truncate">{nodeData.label}</span>
        <div className="text-[10px] text-white/30 font-mono mt-0.5">
          L{nodeData.source_start ?? '?'}–{nodeData.source_end ?? '?'}
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-green-400/60 !w-2 !h-2" />
      {/* Normal exit */}
      <Handle id="exit" type="source" position={Position.Bottom} className="!bg-green-400/60 !w-2 !h-2" />
      {/* Loop-back edge — left side */}
      <Handle id="loop" type="source" position={Position.Left} className="!bg-green-500/80 !w-2 !h-2" />
    </div>
  );
};

export default memo(LoopNode);

