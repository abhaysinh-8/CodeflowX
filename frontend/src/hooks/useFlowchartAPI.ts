import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';
import type { Node, Edge } from '@xyflow/react';
import type { ExecutionStep } from '../types/execution';

const API_BASE = 'http://localhost:8000';

interface IRTreeNode {
  id: string;
  type: string;
  language?: string;
  name?: string;
  source_start?: number;
  source_end?: number;
  children: IRTreeNode[];
  metadata: Record<string, unknown>;
}

interface AnalyzeCoverageRecord {
  coverage_status: 'fully_covered' | 'partially_covered' | 'uncovered' | 'dead';
  hits: number;
  hit_lines: number;
  total_lines: number;
  branch_covered: number;
  branch_total: number;
  dead: boolean;
}

interface AnalyzeResponse {
  status?: 'success' | 'error' | 'completed';
  job_id?: string;
  error?: string;
  line?: number;
  column?: number;
  ir?: IRTreeNode;
  nodes?: Node[];
  edges?: Edge[];
  flowchart?: {
    ir?: IRTreeNode;
    nodes?: Node[];
    edges?: Edge[];
  };
  dependency?: {
    graph_id?: string;
    nodes?: Array<Record<string, unknown>>;
    edges?: Array<Record<string, unknown>>;
    clusters?: Array<Record<string, unknown>>;
  };
  execution?: {
    steps?: ExecutionStep[];
  };
  coverage?: {
    format?: string;
    node_coverage_map?: Record<string, AnalyzeCoverageRecord>;
    coverage_node_coverage_map?: Record<string, AnalyzeCoverageRecord>;
    summary?: {
      total_nodes: number;
      covered: number;
      partial: number;
      uncovered: number;
      dead: number;
      coverage_percent: number;
    };
    report_json?: Record<string, unknown>;
  };
  ir_node_lookup?: Record<string, {
    flowchart_node_id?: string;
    dependency_node_ids?: string[];
    source_start?: number;
    source_end?: number;
    coverage_status?: string;
  }>;
  results?: AnalyzeResponse;
}

const KNOWN_NODE_TYPES = new Set([
  'function_def',
  'if_stmt',
  'for_loop',
  'while_loop',
  'terminal',
  'call',
  'try_except',
  'custom',
]);

function normalizeNodeType(type: unknown): string {
  return typeof type === 'string' && KNOWN_NODE_TYPES.has(type) ? type : 'custom';
}

function edgeStyleByType(type: string): Pick<Edge, 'animated' | 'style'> {
  if (type === 'imports') {
    return { animated: false, style: { strokeDasharray: '6 4', stroke: '#60a5fa' } };
  }
  if (type === 'inherits') {
    return { animated: false, style: { strokeDasharray: '2 6', stroke: '#f59e0b' } };
  }
  if (type === 'depends_on') {
    return { animated: false, style: { stroke: '#f97316', strokeWidth: 2.2 } };
  }
  if (type === 'triggers') {
    return { animated: true, style: { stroke: '#a855f7' } };
  }
  return { animated: false, style: { stroke: '#94a3b8' } };
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

export function useFlowchartAPI() {
  const {
    code,
    language,
    setFlowchartData,
    setLoadingFlowchart,
    setFlowchartError,
    setIrNodes,
    setSyntaxErrorLine,
    setFlowchartProgress,
    setDependencyData,
    setLoadingDependency,
    setDependencyError,
    setExecutionData,
    setLoadingExecution,
    setExecutionErrorMessage,
    setCoverageData,
    setLoadingCoverage,
    setCoverageError,
    setCoverageOverlayEnabled,
    setCoverageFilter,
    setAnalysisContext,
    clearSelectionHistory,
    clearDependencyExecutionTrail,
  } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    fetchToken().then((t) => { tokenRef.current = t; });
  }, []);

  const analyze = useCallback(async () => {
    if (!code.trim()) {
      toast.info('Please enter some code to analyze.');
      return;
    }
    setSyntaxErrorLine(null);

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setIsLoading(true);
    setLoadingFlowchart(true);
    setLoadingDependency(true);
    setLoadingExecution(true);
    setLoadingCoverage(true);
    setFlowchartProgress(8);
    setFlowchartError(null);
    setDependencyError(null);
    setExecutionErrorMessage(null);
    setCoverageError(null);
    clearDependencyExecutionTrail();

    const progressTimer = window.setInterval(() => {
      const current = useStore.getState().flowchartProgress;
      if (current < 92) {
        setFlowchartProgress(current + Math.max(1, Math.round((92 - current) / 6)));
      }
    }, 120);

    try {
      const res = await fetch(`${API_BASE}/api/v1/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify({ code, language }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        const msg = detail?.detail ?? `Server error ${res.status}`;
        setFlowchartData(null);
        setDependencyData(null);
        setIrNodes([]);
        setFlowchartError(msg);
        toast.error(msg);
        return;
      }

      const raw: AnalyzeResponse = await res.json();
      const data = raw.results ?? raw;

      if (data.status === 'error' || data.error) {
        const errMsg = data.line
          ? `Syntax error at line ${data.line}, col ${data.column}: ${data.error}`
          : (data.error ?? 'Analysis failed');
        setFlowchartData(null);
        setDependencyData(null);
        setIrNodes([]);
        setFlowchartError(errMsg);
        if (data.line) setSyntaxErrorLine(data.line);
        toast.error(errMsg);
        return;
      }

      if (language === 'java') {
        toast.info('Java support is partial — complex constructs may not be fully represented.');
      }

      const flowchartPayload = data.flowchart ?? { nodes: data.nodes ?? [], edges: data.edges ?? [], ir: data.ir };
      const nodes: Node[] = (flowchartPayload.nodes ?? []).map((n, i) => ({
        ...n,
        id: (n as Node).id ?? String(i + 1),
        type: normalizeNodeType((n as Node).type),
      }));
      const edges: Edge[] = (flowchartPayload.edges ?? []).map((e, i) => ({
        ...e,
        id: (e as Edge).id ?? `e${i}`,
      }));
      setFlowchartData({ nodes, edges });
      setIrNodes(flowchartPayload.ir ? [flowchartPayload.ir] : []);

      const dep = data.dependency;
      if (dep) {
        const depNodes: Node[] = (dep.nodes ?? []).map((node) => {
          const record = node as Record<string, unknown>;
          return {
            id: String(record.id ?? ''),
            type: 'dependency',
            position: {
              x: Number(record.x ?? 0),
              y: Number(record.y ?? 0),
            },
            data: {
              ...record,
              label: String(record.name ?? record.label ?? ''),
            },
          };
        });
        const depEdges: Edge[] = (dep.edges ?? []).map((edge) => {
          const record = edge as Record<string, unknown>;
          const edgeType = String(record.type ?? '');
          return {
            id: String(record.id ?? ''),
            source: String(record.source ?? ''),
            target: String(record.target ?? ''),
            label: String(record.label ?? ''),
            ...edgeStyleByType(edgeType),
            data: { edge_type: edgeType, label: String(record.label ?? '') },
          };
        });
        setDependencyData({
          graphId: String(dep.graph_id ?? ''),
          nodes: depNodes,
          edges: depEdges,
          clusters: (dep.clusters ?? []) as Array<{
            id: string;
            type: string;
            name: string;
            module: string;
            node_ids: string[];
            x: number;
            y: number;
            width: number;
            height: number;
          }>,
        });
      } else {
        setDependencyData(null);
      }

      const executionSteps = data.execution?.steps ?? [];
      setExecutionData({ jobId: '', steps: executionSteps, breakpointNodeIds: [] });

      const coverage = data.coverage;
      if (coverage) {
        setCoverageData({
          format: coverage.format ?? 'Native',
          node_coverage_map: coverage.node_coverage_map ?? {},
          coverage_node_coverage_map: coverage.coverage_node_coverage_map ?? {},
          summary: coverage.summary ?? {
            total_nodes: 0,
            covered: 0,
            partial: 0,
            uncovered: 0,
            dead: 0,
            coverage_percent: 0,
          },
          report_json: coverage.report_json ?? {},
        });
      } else {
        setCoverageData(null);
      }
      setCoverageOverlayEnabled(false);
      setCoverageFilter('all');

      const normalizedLookup = Object.fromEntries(
        Object.entries(data.ir_node_lookup ?? {}).map(([irId, entry]) => [
          irId,
          {
            ...entry,
            dependency_node_ids: Array.isArray(entry?.dependency_node_ids) ? entry.dependency_node_ids : [],
          },
        ])
      );
      setAnalysisContext({
        jobId: data.job_id ?? null,
        irNodeLookup: normalizedLookup,
      });
      clearSelectionHistory();

      setFlowchartProgress(100);
      toast.success('Unified analysis completed successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error. Is the backend running?';
      setFlowchartData(null);
      setDependencyData(null);
      setIrNodes([]);
      setFlowchartError(msg);
      toast.error(msg);
    } finally {
      window.clearInterval(progressTimer);
      setIsLoading(false);
      setLoadingFlowchart(false);
      setLoadingDependency(false);
      setLoadingExecution(false);
      setLoadingCoverage(false);
      window.setTimeout(() => setFlowchartProgress(0), 260);
    }
  }, [
    clearDependencyExecutionTrail,
    clearSelectionHistory,
    code,
    language,
    setAnalysisContext,
    setCoverageData,
    setCoverageError,
    setCoverageFilter,
    setCoverageOverlayEnabled,
    setDependencyData,
    setDependencyError,
    setExecutionData,
    setExecutionErrorMessage,
    setFlowchartData,
    setFlowchartError,
    setFlowchartProgress,
    setIrNodes,
    setLoadingCoverage,
    setLoadingDependency,
    setLoadingExecution,
    setLoadingFlowchart,
    setSyntaxErrorLine,
  ]);

  return { analyze, isLoading };
}
