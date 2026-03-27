import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';
import type { BreakpointHit, ExecutionCreateResponse } from '../types/execution';

const API_BASE = 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

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

export function useExecutionAPI() {
  const {
    code,
    language,
    irNodes,
    executionBreakpoints,
    executionJobId,
    executionSpeed,
    setExecutionData,
    setLoadingExecution,
    setExecutionErrorMessage,
    setCurrentExecutionStep,
    setExecutionPlaying,
    setExecutionPaused,
    setExecutionSpeed,
    setBreakpointHits,
  } = useStore();

  const tokenRef = useRef<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isSocketConnected, setSocketConnected] = useState(false);

  const sendSocketCommand = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSocketConnected(false);
    setExecutionPlaying(false);
  }, [setExecutionPlaying]);

  const refreshBreakpointHits = useCallback(
    async (jobIdOverride?: string) => {
      const jobId = jobIdOverride ?? executionJobId;
      if (!jobId) return;

      if (!tokenRef.current) {
        tokenRef.current = await fetchToken();
      }
      try {
        const res = await fetch(`${API_BASE}/api/v1/execution/${jobId}/breakpoints`, {
          headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        });
        const data = await res.json().catch(() => ({}));
        const hits = Array.isArray(data?.hits) ? (data.hits as BreakpointHit[]) : [];
        setBreakpointHits(hits);
      } catch {
        setBreakpointHits([]);
      }
    },
    [executionJobId, setBreakpointHits]
  );

  const connectExecutionSocket = useCallback(
    (jobId: string, stepsPerSecond: number) => {
      disconnect();
      const ws = new WebSocket(`${WS_BASE}/execution/${jobId}?rate=${stepsPerSecond}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setSocketConnected(true);
      };

      ws.onmessage = (event) => {
        let message: Record<string, unknown> = {};
        try {
          message = JSON.parse(event.data) as Record<string, unknown>;
        } catch {
          return;
        }

        const eventType = typeof message.event === 'string' ? message.event : '';
        if (eventType === 'STEP') {
          const stepIndex = Number(message.step_index ?? 0);
          if (stepIndex > 0) {
            setCurrentExecutionStep(stepIndex - 1);
          }
          return;
        }

        if (eventType === 'PAUSED') {
          const stepIndex = Number(message.step_index ?? 0);
          if (stepIndex > 0) {
            setCurrentExecutionStep(stepIndex - 1);
          }
          setExecutionPlaying(false);
          setExecutionPaused(true);
          refreshBreakpointHits(jobId);
          return;
        }

        if (eventType === 'COMPLETED') {
          setExecutionPlaying(false);
          setExecutionPaused(false);
          refreshBreakpointHits(jobId);
        }
      };

      ws.onclose = () => {
        setSocketConnected(false);
        setExecutionPlaying(false);
      };

      ws.onerror = () => {
        setSocketConnected(false);
      };
    },
    [
      disconnect,
      refreshBreakpointHits,
      setCurrentExecutionStep,
      setExecutionPaused,
      setExecutionPlaying,
    ]
  );

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
    return () => disconnect();
  }, [disconnect]);

  const runExecution = useCallback(async () => {
    if (!code.trim()) {
      toast.info('Please enter some code before running execution.');
      return;
    }
    const ir = irNodes[0];
    if (!ir) {
      toast.error('Generate the flowchart first. Execution uses the IR from analysis.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setLoadingExecution(true);
    setExecutionErrorMessage(null);
    setExecutionPaused(false);
    setExecutionPlaying(false);

    try {
      const res = await fetch(`${API_BASE}/api/v1/execution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          ir,
          code,
          language,
          breakpoint_node_ids: executionBreakpoints,
        }),
      });

      const data: ExecutionCreateResponse = await res.json().catch(() => ({ status: 'error', error: 'Invalid response' }));
      if (!res.ok || data.status === 'error' || !data.job_id) {
        const message = data.error ?? `Execution API failed (${res.status})`;
        setExecutionErrorMessage(message);
        toast.error(message);
        return;
      }

      const steps = data.steps ?? [];
      setExecutionData({
        jobId: data.job_id,
        steps,
        breakpointNodeIds: data.breakpoint_node_ids ?? executionBreakpoints,
      });
      setCurrentExecutionStep(0);
      connectExecutionSocket(data.job_id, executionSpeed);
      toast.success('Execution simulation prepared.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run execution simulation.';
      setExecutionErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingExecution(false);
    }
  }, [
    code,
    connectExecutionSocket,
    executionBreakpoints,
    executionSpeed,
    irNodes,
    language,
    setCurrentExecutionStep,
    setExecutionData,
    setExecutionErrorMessage,
    setExecutionPaused,
    setExecutionPlaying,
    setLoadingExecution,
  ]);

  const play = useCallback(() => {
    setExecutionPlaying(true);
    setExecutionPaused(false);
    sendSocketCommand({ event: 'RESUME' });
  }, [sendSocketCommand, setExecutionPaused, setExecutionPlaying]);

  const pause = useCallback(() => {
    setExecutionPlaying(false);
    setExecutionPaused(true);
    sendSocketCommand({ event: 'PAUSE' });
  }, [sendSocketCommand, setExecutionPaused, setExecutionPlaying]);

  const jumpToStep = useCallback(
    (stepIndex: number) => {
      setCurrentExecutionStep(stepIndex);
      sendSocketCommand({ event: 'JUMP', step_index: stepIndex });
    },
    [sendSocketCommand, setCurrentExecutionStep]
  );

  const playToNextBreakpoint = useCallback(() => {
    setExecutionPlaying(true);
    setExecutionPaused(false);
    sendSocketCommand({ event: 'PLAY_TO_NEXT_BREAKPOINT' });
  }, [sendSocketCommand, setExecutionPaused, setExecutionPlaying]);

  const updateSpeed = useCallback(
    (speed: number) => {
      setExecutionSpeed(speed);
      sendSocketCommand({ event: 'SET_RATE', steps_per_second: speed });
    },
    [sendSocketCommand, setExecutionSpeed]
  );

  return {
    runExecution,
    play,
    pause,
    jumpToStep,
    playToNextBreakpoint,
    updateSpeed,
    refreshBreakpointHits,
    disconnect,
    isSocketConnected,
  };
}
