import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';
import type { Node, Edge } from '@xyflow/react';

const API_BASE = 'http://localhost:8000';

interface FlowchartResponse {
  status?: 'success' | 'error';
  nodes?: Node[];
  edges?: Edge[];
  ir?: IRTreeNode;
  error?: string;
  line?: number;
  column?: number;
}

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

/** Auto-login once and cache the JWT for the session lifetime. */
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
  const { code, language, setFlowchartData, setLoadingFlowchart, setFlowchartError, setIrNodes, setSyntaxErrorLine } = useStore();
  const [isLoading, setIsLoading] = useState(false);
  const tokenRef = useRef<string | null>(null);

  // Obtain JWT on mount
  useEffect(() => {
    fetchToken().then((t) => { tokenRef.current = t; });
  }, []);

  const analyze = useCallback(async () => {
    if (!code.trim()) {
      toast.info('Please enter some code to analyze.');
      return;
    }
    setSyntaxErrorLine(null);

    // Ensure we have a token
    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setIsLoading(true);
    setLoadingFlowchart(true);
    setFlowchartError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/flowchart`, {
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
        setIrNodes([]);
        setFlowchartError(msg);
        toast.error(msg);
        return;
      }

      const data: FlowchartResponse = await res.json();

      if (data.status === 'error' || data.error) {
        const errMsg = data.line
          ? `Syntax error at line ${data.line}, col ${data.column}: ${data.error}`
          : (data.error ?? 'Analysis failed');
        setFlowchartData(null);
        setIrNodes([]);
        setFlowchartError(errMsg);
        if (data.line) setSyntaxErrorLine(data.line);
        toast.error(errMsg);
        return;
      }

      if (language === 'java') {
        toast.info('Java support is partial — complex constructs may not be fully represented.');
      }

      // Normalise node/edge ids
      const nodes: Node[] = (data.nodes ?? []).map((n, i) => ({
        ...n,
        id: (n as Node).id ?? String(i + 1),
        type: normalizeNodeType((n as Node).type),
      }));
      const edges: Edge[] = (data.edges ?? []).map((e, i) => ({
        ...e,
        id: (e as Edge).id ?? `e${i}`,
      }));

      setFlowchartData({ nodes, edges });
      setIrNodes(data.ir ? [data.ir] : []);
      toast.success('Flowchart generated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error. Is the backend running?';
      setFlowchartData(null);
      setIrNodes([]);
      setFlowchartError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setLoadingFlowchart(false);
    }
  }, [code, language, setFlowchartData, setFlowchartError, setIrNodes, setLoadingFlowchart, setSyntaxErrorLine]);

  return { analyze, isLoading };
}
