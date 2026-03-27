import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { coverageBadge, coverageBorderClass, coveragePatternStyle, normalizeCoverageStatus } from './coverageStyles';

export interface DecisionNodeData extends Record<string, unknown> {
  label: string;
  ir_node_id?: string;
  condition?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
  has_breakpoint?: boolean;
  coverage_status?: string;
  coverage_overlay?: boolean;
  cross_selected?: boolean;
  cross_pulse?: boolean;
}

const DecisionNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as DecisionNodeData;
  const selectNode = useStore((s) => s.selectNode);
  const coverageStatus = normalizeCoverageStatus(nodeData.coverage_status);
  const coverageEnabled = Boolean(nodeData.coverage_overlay);
  const coverageLabel = coverageBadge(coverageStatus, coverageEnabled);
  const patternStyle = coveragePatternStyle(coverageStatus, coverageEnabled);

  const handleClick = () => {
    const irNodeId = typeof nodeData.ir_node_id === 'string' && nodeData.ir_node_id ? nodeData.ir_node_id : id;
    selectNode(irNodeId, 'flowchart');
  };

  return (
    <div
      onClick={handleClick}
      title={`Condition: ${nodeData.condition || nodeData.label} — Line ${nodeData.source_start ?? '?'}`}
      aria-label={`Decision node: ${nodeData.label}`}
      className={`
        relative flex items-center justify-center transition-all duration-200 cursor-pointer
        ${nodeData.is_active ? 'drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]' : ''}
        ${coverageBorderClass(coverageStatus, coverageEnabled)}
        ${nodeData.cross_pulse ? 'codeflowx-selection-pulse' : ''}
      `}
      style={{ width: 120, height: 80 }}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)] z-20" />
      )}
      {/* Diamond shape */}
      <div
        className={`
          absolute inset-0 border-2 transition-all
          ${selected || nodeData.cross_selected ? 'border-yellow-400 bg-yellow-500/20' : 'border-yellow-500/50 bg-yellow-500/10'}
        `}
        style={{ transform: 'rotate(45deg)', borderRadius: 6 }}
      />
      {/* Label (not rotated) */}
      <span className="relative z-10 text-[11px] font-bold text-yellow-200 text-center px-2 leading-tight max-w-[100px] truncate">
        {nodeData.label}
      </span>
      {patternStyle && (
        <span className="absolute inset-0 pointer-events-none opacity-40 rounded-md" style={patternStyle} />
      )}
      {coverageLabel && (
        <span className="absolute left-1 top-1 text-[8px] font-bold px-1 py-0.5 rounded bg-black/45 text-cyan-100/90 border border-white/15 z-20">
          {coverageLabel}
        </span>
      )}

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

