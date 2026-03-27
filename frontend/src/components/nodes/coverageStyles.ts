import type { CSSProperties } from 'react';

export type NodeCoverageStatus = 'fully_covered' | 'partially_covered' | 'uncovered' | 'dead' | '';

export function normalizeCoverageStatus(value: unknown): NodeCoverageStatus {
  const status = String(value ?? '').trim();
  if (status === 'fully_covered') return status;
  if (status === 'partially_covered') return status;
  if (status === 'uncovered') return status;
  if (status === 'dead') return status;
  return '';
}

export function coverageBorderClass(status: NodeCoverageStatus, enabled: boolean): string {
  if (!enabled || !status) return '';
  if (status === 'fully_covered') return 'ring-1 ring-emerald-400/80';
  if (status === 'partially_covered') return 'ring-1 ring-amber-400/80';
  if (status === 'uncovered') return 'ring-1 ring-rose-400/80';
  return 'ring-1 ring-slate-400/70';
}

export function coverageBadge(status: NodeCoverageStatus, enabled: boolean): string {
  if (!enabled || !status) return '';
  if (status === 'fully_covered') return 'COVERED';
  if (status === 'partially_covered') return 'PARTIAL';
  if (status === 'uncovered') return 'UNCOVERED';
  return 'DEAD';
}

export function coveragePatternStyle(status: NodeCoverageStatus, enabled: boolean): CSSProperties | undefined {
  if (!enabled) return undefined;
  if (status === 'partially_covered') {
    return {
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
      backgroundSize: '7px 7px',
    };
  }
  if (status === 'uncovered') {
    return {
      backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.16) 4px, transparent 4px, transparent 8px)',
    };
  }
  return undefined;
}

