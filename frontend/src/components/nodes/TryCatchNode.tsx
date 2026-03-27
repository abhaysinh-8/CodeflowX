import { memo } from 'react';
import { Handle, Position,  } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react';
import { useStore } from '../../store/useStore';
import { AlertTriangle } from 'lucide-react';
import { coverageBadge, coverageBorderClass, coveragePatternStyle, normalizeCoverageStatus } from './coverageStyles';

export interface TryCatchNodeData extends Record<string, unknown> {
  label: string;
  ir_node_id?: string;
  exception_type?: string;
  source_start?: number;
  source_end?: number;
  is_active?: boolean;
  has_breakpoint?: boolean;
  coverage_status?: string;
  coverage_overlay?: boolean;
  cross_selected?: boolean;
  cross_pulse?: boolean;
}

const TryCatchNode = ({ id, data, selected }: NodeProps) => {
  const nodeData = data as TryCatchNodeData;
  const selectNode = useStore((s) => s.selectNode);
  const coverageStatus = normalizeCoverageStatus(nodeData.coverage_status);
  const coverageEnabled = Boolean(nodeData.coverage_overlay);
  const coverageLabel = coverageBadge(coverageStatus, coverageEnabled);
  const patternStyle = coveragePatternStyle(coverageStatus, coverageEnabled);

  return (
    <div
      onClick={() => {
        const irNodeId = typeof nodeData.ir_node_id === 'string' && nodeData.ir_node_id ? nodeData.ir_node_id : id;
        selectNode(irNodeId, 'flowchart');
      }}
      title={`Try/Catch: ${nodeData.label} — Lines ${nodeData.source_start ?? '?'}–${nodeData.source_end ?? '?'}`}
      aria-label={`Try-catch node: ${nodeData.label}`}
      className={`
        relative min-w-[150px] rounded-xl border-2 transition-all duration-200 cursor-pointer shadow-lg
        ${nodeData.is_active ? 'ring-2 ring-orange-400 ring-offset-1 ring-offset-background' : ''}
        ${selected || nodeData.cross_selected ? 'border-orange-400/80 shadow-orange-500/30 shadow-xl' : 'border-orange-500/40'}
        ${coverageBorderClass(coverageStatus, coverageEnabled)}
        ${nodeData.cross_pulse ? 'codeflowx-selection-pulse' : ''}
        bg-[#1a0f00]/90
      `}
      style={{
        borderStyle: 'dashed',
      }}
    >
      {nodeData.has_breakpoint && (
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border border-rose-200 shadow-[0_0_0_2px_rgba(15,23,42,0.9)] z-20" />
      )}
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
      {patternStyle && (
        <span className="absolute inset-0 pointer-events-none opacity-40 rounded-xl" style={patternStyle} />
      )}
      {coverageLabel && (
        <span className="absolute left-2 top-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/45 text-cyan-100/90 border border-white/15 z-20">
          {coverageLabel}
        </span>
      )}

      <Handle type="target" position={Position.Top} className="!bg-orange-400/60 !w-2 !h-2" />
      {/* Normal exit */}
      <Handle id="exit" type="source" position={Position.Bottom} className="!bg-orange-400/60 !w-2 !h-2" />
      {/* Fault / exception path */}
      <Handle id="fault" type="source" position={Position.Right} className="!bg-red-500/80 !w-2 !h-2" />
    </div>
  );
};

export default memo(TryCatchNode);

