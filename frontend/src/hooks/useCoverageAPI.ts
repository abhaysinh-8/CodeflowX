import { useCallback, useEffect, useRef } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';

const API_BASE = 'http://localhost:8000';

interface CoverageNodeMapRecord {
  coverage_status: 'fully_covered' | 'partially_covered' | 'uncovered' | 'dead';
  hits: number;
  hit_lines: number;
  total_lines: number;
  branch_covered: number;
  branch_total: number;
  dead: boolean;
}

interface CoverageSummary {
  total_nodes: number;
  covered: number;
  partial: number;
  uncovered: number;
  dead: number;
  coverage_percent: number;
}

interface CoverageResponse {
  status?: 'success' | 'error';
  format?: string;
  flowchart?: {
    nodes: Node[];
    edges: Edge[];
  };
  node_coverage_map?: Record<string, CoverageNodeMapRecord>;
  coverage_node_coverage_map?: Record<string, CoverageNodeMapRecord>;
  summary?: CoverageSummary;
  report_json?: Record<string, unknown>;
  detail?: string;
  error?: string;
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/login`, { method: 'POST' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token as string;
  } catch {
    return null;
  }
}

export function useCoverageAPI() {
  const {
    flowchartData,
    setFlowchartData,
    coverageData,
    setCoverageData,
    setLoadingCoverage,
    setCoverageError,
    setCoverageOverlayEnabled,
    setCoverageFilter,
  } = useStore();

  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
  }, []);

  const importCoverage = useCallback(async (file: File) => {
    if (!flowchartData) {
      toast.info('Generate a flowchart first. Coverage is applied on flowchart nodes.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setLoadingCoverage(true);
    setCoverageError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('flowchart_json', JSON.stringify({
        nodes: flowchartData.nodes,
        edges: flowchartData.edges,
      }));

      const res = await fetch(`${API_BASE}/api/v1/coverage`, {
        method: 'POST',
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        body: form,
      });

      const data: CoverageResponse = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') {
        const msg = data.detail || data.error || `Coverage API failed (${res.status})`;
        setCoverageError(msg);
        toast.error(msg);
        return;
      }

      const nextNodes = data.flowchart?.nodes ?? flowchartData.nodes;
      const nextEdges = data.flowchart?.edges ?? flowchartData.edges;
      setFlowchartData({ nodes: nextNodes, edges: nextEdges });

      setCoverageData({
        format: data.format ?? 'Unknown',
        node_coverage_map: data.node_coverage_map ?? {},
        coverage_node_coverage_map: data.coverage_node_coverage_map ?? data.node_coverage_map ?? {},
        summary: data.summary ?? {
          total_nodes: 0,
          covered: 0,
          partial: 0,
          uncovered: 0,
          dead: 0,
          coverage_percent: 0,
        },
        report_json: data.report_json ?? {},
        file_name: file.name,
        file_size: file.size,
      });
      setCoverageOverlayEnabled(true);
      setCoverageFilter('all');
      toast.success('Coverage report imported and heatmap applied.');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to import coverage report.';
      setCoverageError(msg);
      toast.error(msg);
    } finally {
      setLoadingCoverage(false);
    }
  }, [
    flowchartData,
    setCoverageData,
    setCoverageError,
    setCoverageFilter,
    setCoverageOverlayEnabled,
    setFlowchartData,
    setLoadingCoverage,
  ]);

  const exportCoverageReport = useCallback(() => {
    if (!coverageData?.report_json) {
      toast.info('No coverage report available to export.');
      return;
    }
    const blob = new Blob([JSON.stringify(coverageData.report_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'codeflowx-coverage-report.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [coverageData?.report_json]);

  return {
    importCoverage,
    exportCoverageReport,
  };
}
