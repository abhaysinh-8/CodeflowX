import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';

const API_BASE = 'http://localhost:8000';

interface FailureAffectedNode {
  dependency_node_id: string;
  ir_node_id?: string | null;
  flowchart_node_id?: string | null;
  name?: string | null;
  node_type?: string | null;
  severity: 'failed' | 'directly_affected' | 'transitively_affected';
}

interface FailureSimulationResponse {
  status?: 'success' | 'error';
  blast_radius?: number;
  failed_function_ids?: string[];
  affected_nodes?: FailureAffectedNode[];
  unreachable_branches?: string[];
  error?: string;
  detail?: string;
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

export function useFailureSimulationAPI() {
  const {
    analysisJobId,
    setFailureSimulationResult,
    setLoadingFailureSimulation,
    setFailureSimulationError,
    resetFailureSimulation,
    failedDependencyNodeIds,
    failureAffectedNodes,
    failureUnreachableFlowchartNodeIds,
    failureBlastRadius,
  } = useStore();
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
  }, []);

  const simulateFailure = useCallback(async (failedFunctionIdentifiers: string[]) => {
    if (!analysisJobId) {
      toast.info('Run unified Analyze first to enable failure simulation.');
      return;
    }
    const identifiers = [...new Set(
      (failedFunctionIdentifiers ?? [])
        .map((id) => id.trim())
        .filter(Boolean)
    )];
    if (!identifiers.length) {
      toast.info('Select at least one dependency function to simulate failure.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setLoadingFailureSimulation(true);
    setFailureSimulationError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/simulate/failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          job_id: analysisJobId,
          failed_function_ids: identifiers,
        }),
      });
      const data: FailureSimulationResponse = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error') {
        const msg = data.detail || data.error || `Failure simulation failed (${res.status})`;
        setFailureSimulationError(msg);
        toast.error(msg);
        return;
      }

      setFailureSimulationResult({
        failedDependencyNodeIds: data.failed_function_ids ?? identifiers,
        affectedNodes: data.affected_nodes ?? [],
        unreachableFlowchartNodeIds: data.unreachable_branches ?? [],
        blastRadius: Number(data.blast_radius ?? 0),
      });
      toast.success(`${Number(data.blast_radius ?? 0)} functions affected.`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failure simulation request failed.';
      setFailureSimulationError(msg);
      toast.error(msg);
    } finally {
      setLoadingFailureSimulation(false);
    }
  }, [
    analysisJobId,
    setFailureSimulationResult,
    setLoadingFailureSimulation,
    setFailureSimulationError,
  ]);

  const exportFailureReport = useCallback(() => {
    if (!failedDependencyNodeIds.length && !failureAffectedNodes.length) {
      toast.info('No failure simulation data to export.');
      return;
    }
    const payload = {
      failed_function_ids: failedDependencyNodeIds,
      blast_radius: failureBlastRadius,
      affected_nodes: failureAffectedNodes,
      unreachable_branches: failureUnreachableFlowchartNodeIds,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'codeflowx-failure-impact-report.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [
    failedDependencyNodeIds,
    failureAffectedNodes,
    failureBlastRadius,
    failureUnreachableFlowchartNodeIds,
  ]);

  return {
    simulateFailure,
    resetFailureSimulation,
    exportFailureReport,
  };
}
