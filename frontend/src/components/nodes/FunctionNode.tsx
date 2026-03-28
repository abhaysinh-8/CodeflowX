import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { coverageBadge, coverageBorderClass, coveragePatternStyle, normalizeCoverageStatus } from './coverageStyles';

export interface FunctionNodeData extends Record<string, unknown> {
  label: string;
  name?: string;
  ir_node_id?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
  has_breakpoint?: boolean;
  coverage_status?: string;
  coverage_overlay?: boolean;
  cross_selected?: boolean;
  cross_pulse?: boolean;
  failure_severity?: string;
  failure_unreachable?: boolean;
}

const FunctionNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as FunctionNodeData;
  const selectNode = useStore((s) => s.selectNode);
  const coverageStatus = normalizeCoverageStatus(nodeData.coverage_status);
  const coverageEnabled = Boolean(nodeData.coverage_overlay);
  const coverageLabel = coverageBadge(coverageStatus, coverageEnabled);
  const patternStyle = coveragePatternStyle(coverageStatus, coverageEnabled);
  const failureSeverity = typeof nodeData.failure_severity === 'string' ? nodeData.failure_severity : '';
  const failureClass = failureSeverity === 'failed'
    ? 'border-rose-400/90 shadow-rose-500/40'
    : failureSeverity === 'directly_affected'
      ? 'border-orange-400/80 shadow-orange-500/35'
      : failureSeverity === 'transitively_affected'
        ? 'border-amber-300/80 shadow-amber-500/25'
        : nodeData.failure_unreachable
          ? 'border-rose-300/70'
          : '';

  const handleClick = () => {
    void id;
    const irNodeId = typeof nodeData.ir_node_id === 'string' ? nodeData.ir_node_id.trim() : '';
    if (irNodeId) {
      selectNode(irNodeId, 'flowchart');
    }
  };

  return (
    <div
      onClick={handleClick}
      title={`${nodeData.name || nodeData.label} — Lines ${nodeData.source_start ?? '?'}–${nodeData.source_end ?? '?'}`}
      aria-label={`Function node: ${nodeData.name || nodeData.label}`}
      className={`
        relative min-w-[140px] rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-background' : ''}
        ${coverageBorderClass(coverageStatus, coverageEnabled)}
        ${failureClass}
        ${selected || nodeData.cross_selected ? 'border-blue-400/80 shadow-blue-500/30 shadow-xl' : 'border-blue-500/30'}
        ${nodeData.cross_pulse ? 'codeflowx-selection-pulse' : ''}
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)]" />
      )}
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
      {patternStyle && (
        <span className="absolute inset-0 pointer-events-none opacity-40" style={patternStyle} />
      )}
      {coverageLabel && (
        <span className="absolute left-2 top-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/45 text-cyan-100/90 border border-white/15">
          {coverageLabel}
        </span>
      )}

      <Handle type="target" position={Position.Top} className="!bg-blue-400/60 !border-blue-500/50 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-blue-400/60 !border-blue-500/50 !w-2 !h-2" />
    </div>
  );
};

export default memo(FunctionNode);

