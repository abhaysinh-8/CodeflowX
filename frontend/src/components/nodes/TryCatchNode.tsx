import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { AlertTriangle } from 'lucide-react';

export interface TryCatchNodeData extends Record<string, unknown> {
  label: string;
  exception_type?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
}

const TryCatchNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as TryCatchNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  return (
    <div
      onClick={() => setSelectedNodeId(id)}
      title={`Try/Catch: ${nodeData.label} — Lines ${nodeData.source_start ?? '?'}–${nodeData.source_end ?? '?'}`}
      aria-label={`Try-catch node: ${nodeData.label}`}
      className={`
        min-w-[150px] rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-background' : ''}
        ${selected ? 'border-orange-400/80 shadow-orange-500/30 shadow-xl' : 'border-orange-500/40'}
        bg-[#1a0f00]/90
      `}
      style={{
        borderStyle: 'dashed',
      }}
    >
      {/* Orange header */}
      <div className="bg-orange-700/50 px-3 py-1.5 flex items-center gap-2 rounded-t-[10px]">
        <AlertTriangle className="w-3 h-3 text-orange-300" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-orange-200/70">try / catch</span>
      </div>
      <div className="px-3 py-2">
        <span className="text-xs font-semibold text-orange-100/80 block truncate">{nodeData.label}</span>
        {nodeData.exception_type && (
          <span className="text-[10px] font-mono text-orange-300/60 block">catches: {nodeData.exception_type}</span>
        )}
        <span className="text-[10px] text-white/20 font-mono">L{nodeData.source_start ?? '?'}–{nodeData.source_end ?? '?'}</span>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-orange-400/60 !w-2 !h-2" />
      {/* Normal exit */}
      <Handle id="exit" type="source" position={Position.Bottom} className="!bg-orange-400/60 !w-2 !h-2" />
      {/* Fault / exception path */}
      <Handle id="fault" type="source" position={Position.Right} className="!bg-red-500/80 !w-2 !h-2" />
    </div>
  );
};

export default memo(TryCatchNode);

