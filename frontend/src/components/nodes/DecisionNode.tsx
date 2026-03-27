import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';

export interface DecisionNodeData extends Record<string, unknown> {
  label: string;
  condition?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
}

const DecisionNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as DecisionNodeData;
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);

  const handleClick = () => setSelectedNodeId(id);

  return (
    <div
      onClick={handleClick}
      title={`Condition: ${nodeData.condition || nodeData.label} — Line ${nodeData.source_start ?? '?'}`}
      aria-label={`Decision node: ${nodeData.label}`}
      className={`
        relative flex items-center justify-center transition-all duration-200 cursor-pointer
        ${nodeData.is_active ? 'drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]' : ''}
      `}
      style={{ width: 120, height: 80 }}
    >
      {/* Diamond shape */}
      <div
        className={`
          absolute inset-0 border-2 transition-all
          ${selected ? 'border-yellow-400 bg-yellow-500/20' : 'border-yellow-500/50 bg-yellow-500/10'}
        `}
        style={{ transform: 'rotate(45deg)', borderRadius: 6 }}
      />
      {/* Label (not rotated) */}
      <span className="relative z-10 text-[11px] font-bold text-yellow-200 text-center px-2 leading-tight max-w-[100px] truncate">
        {nodeData.label}
      </span>

      {/* True / False labels */}
      <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-green-400/80 font-bold">T</span>
      <span className="absolute top-1/2 -right-6 -translate-y-1/2 text-[9px] text-red-400/80 font-bold">F</span>

      <Handle type="target" position={Position.Top} className="!bg-yellow-400/60 !w-2 !h-2" />
      {/* True branch — bottom */}
      <Handle id="true" type="source" position={Position.Bottom} className="!bg-green-400/70 !w-2 !h-2" />
      {/* False branch — right */}
      <Handle id="false" type="source" position={Position.Right} className="!bg-red-400/70 !w-2 !h-2" />
    </div>
  );
};

export default memo(DecisionNode);

