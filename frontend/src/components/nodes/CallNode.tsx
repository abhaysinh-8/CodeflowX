import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { coverageBadge, coverageBorderClass, coveragePatternStyle, normalizeCoverageStatus } from './coverageStyles';

export interface CallNodeData extends Record<string, unknown> {
  label: string;
  ir_node_id?: string;
  callee?: string;
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

const CallNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as CallNodeData;
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

  return (
    <div
      onClick={() => {
        void id;
        const irNodeId = typeof nodeData.ir_node_id === 'string' ? nodeData.ir_node_id.trim() : '';
        if (irNodeId) {
          selectNode(irNodeId, 'flowchart');
        }
      }}
      title={`Calls: ${nodeData.callee || nodeData.label} — Line ${nodeData.source_start ?? '?'}`}
      aria-label={`Function call node: ${nodeData.label}`}
      className={`
        relative min-w-[140px] cursor-pointer transition-all duration-200 shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-background' : ''}
        ${coverageBorderClass(coverageStatus, coverageEnabled)}
        ${failureClass}
        ${nodeData.cross_pulse ? 'codeflowx-selection-pulse' : ''}
      `}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)] z-20" />
      )}
      {/* Outer double-border subprocess box */}
      <div
        className={`
          rounded-lg border-2 p-0.5
          ${selected || nodeData.cross_selected ? 'border-purple-400' : 'border-purple-500/50'}
        `}
      >
        <div
          className={`
            rounded-md border px-3 py-2.5 bg-[#130d1f]/90
            ${selected || nodeData.cross_selected ? 'border-purple-400/60' : 'border-purple-500/30'}
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
      {patternStyle && (
        <span className="absolute inset-0 pointer-events-none opacity-40 rounded-lg" style={patternStyle} />
      )}
      {coverageLabel && (
        <span className="absolute left-2 top-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/45 text-cyan-100/90 border border-white/15 z-20">
          {coverageLabel}
        </span>
      )}

      <Handle type="target" position={Position.Top} className="!bg-purple-400/60 !w-2 !h-2" />
      <Handle type="source" position={Position.Bottom} className="!bg-purple-400/60 !w-2 !h-2" />
    </div>
  );
};

export default memo(CallNode);

