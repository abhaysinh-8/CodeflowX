import { useCallback, useEffect, useRef } from 'react';
import { toast } from '../components/ui/Toast';
import { useStore } from '../store/useStore';
import { useExplanationStore, type ExplanationType } from '../store/explanationStore';

const API_BASE = 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

interface ExplainCreateResponse {
  status?: string;
  job_id?: string;
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

function endpointFor(type: ExplanationType): string {
  if (type === 'node') return '/api/v1/explain/node';
  if (type === 'edge') return '/api/v1/explain/edge';
  if (type === 'coverage') return '/api/v1/explain/coverage';
  return '/api/v1/simulate/failure';
}

function buildExplainPayload(
  type: ExplanationType,
  targetId: string,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const state = useStore.getState();

  const dependencyPayload = state.dependencyData
    ? {
        graph_id: state.dependencyData.graphId,
        nodes: state.dependencyData.nodes,
        edges: state.dependencyData.edges,
        clusters: state.dependencyData.clusters,
      }
    : {};

  const payload: Record<string, unknown> = {
    job_id: state.analysisJobId,
    source_code: state.code,
    language: state.language,
    ir: state.irNodes[0] ?? null,
    flow_nodes: state.flowchartData?.nodes ?? [],
    flow_edges: state.flowchartData?.edges ?? [],
    execution_steps: state.executionSteps ?? [],
    execution_step_index: state.currentExecutionStep,
    execution_state: state.executionSteps[state.currentExecutionStep] ?? state.executionState ?? {},
    coverage: state.coverageData ?? {},
    dependency: dependencyPayload,
    ...extra,
  };

  if (type === 'node') {
    payload.ir_node_id = targetId;
  } else if (type === 'edge') {
    payload.edge_id = targetId;
  } else if (type === 'coverage') {
    payload.coverage_id = targetId;
    if (!payload.ir_node_id && state.selectedNodeId) {
      payload.ir_node_id = state.selectedNodeId;
    }
  } else {
    payload.mode = 'explain';
    payload.ir_node_id = targetId;
    payload.failed_function_ids = [targetId];
  }

  return payload;
}

export function useExplainAPI() {
  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const requestExplanation = useCallback(async (
    type: ExplanationType,
    targetId: string,
    extraPayload: Record<string, unknown> = {},
  ) => {
    const normalizedTarget = targetId.trim();
    if (!normalizedTarget) {
      toast.info('Select a valid target before requesting explanation.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    const payload = buildExplainPayload(type, normalizedTarget, extraPayload);
    useExplanationStore.getState().startRequest({
      type,
      targetId: normalizedTarget,
      payload,
    });

    disconnect();
    try {
      const res = await fetch(`${API_BASE}${endpointFor(type)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data: ExplainCreateResponse = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        const message = data.detail || data.error || `Explain request failed (${res.status})`;
        useExplanationStore.getState().failRequest(message);
        toast.error(message);
        return;
      }

      const ws = new WebSocket(`${WS_BASE}/explain/${data.job_id}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        let message: Record<string, unknown> = {};
        try {
          message = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }

        const kind = String(message.type ?? '');
        if (kind === 'chunk') {
          useExplanationStore.getState().appendChunk(String(message.text ?? ''));
          return;
        }
        if (kind === 'final') {
          useExplanationStore.getState().finishRequest({
            type,
            targetId: normalizedTarget,
            explanation: String(message.explanation ?? ''),
            confidence: Number(message.confidence ?? 0),
            relevant_lines: Array.isArray(message.relevant_lines)
              ? (message.relevant_lines as number[])
              : [],
          });
          return;
        }
        if (kind === 'error') {
          const err = String(message.error ?? 'Explanation stream failed.');
          useExplanationStore.getState().failRequest(err);
          toast.error(err);
        }
      };

      ws.onerror = () => {
        const err = 'WebSocket error while streaming explanation.';
        useExplanationStore.getState().failRequest(err);
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to request explanation.';
      useExplanationStore.getState().failRequest(message);
      toast.error(message);
    }
  }, [disconnect]);

  const explainMore = useCallback(async () => {
    const state = useExplanationStore.getState();
    if (!state.lastRequest || !state.currentExplanation) {
      toast.info('Run an explanation first, then use Explain more.');
      return;
    }
    await requestExplanation(
      state.lastRequest.type,
      state.lastRequest.targetId,
      {
        ...state.lastRequest.payload,
        previous_explanation: state.currentExplanation.explanation,
        follow_up: true,
      }
    );
  }, [requestExplanation]);

  return {
    requestExplanation,
    explainMore,
    disconnect,
  };
}

