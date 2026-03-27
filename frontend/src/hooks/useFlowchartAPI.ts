import { useCallback, useState } from 'react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';
import type { Node, Edge } from '@xyflow/react';

const API_BASE = 'http://localhost:8000';

interface FlowchartResponse {
  nodes: Node[];
  edges: Edge[];
  ir_nodes?: unknown[];
  error?: string;
  line?: number;
  column?: number;
}

export function useFlowchartAPI() {
  const { code, language, setFlowchartData, setLoadingFlowchart, setFlowchartError, setIrNodes } = useStore();
  const [isLoading, setIsLoading] = useState(false);

  const analyze = useCallback(async () => {
    if (!code.trim()) {
      toast.info('Please enter some code to analyze.');
      return;
    }

    setIsLoading(true);
    setLoadingFlowchart(true);
    setFlowchartError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/flowchart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language }),
      });

      // Fallback to mock endpoint while backend is being built by Yash
      const data: FlowchartResponse = res.ok
        ? await res.json()
        : await fetch(`${API_BASE}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          }).then(r => r.json());

      if (data.error) {
        const errMsg = data.line
          ? `Syntax error at line ${data.line}, column ${data.column}: ${data.error}`
          : data.error;
        setFlowchartError(errMsg);
        toast.error(errMsg);
        return;
      }

      // Normalize: ensure nodes have ids
      const nodes: Node[] = (data.nodes ?? []).map((n, i) => ({
        ...n,
        id: (n as Node).id ?? String(i + 1),
      }));
      const edges: Edge[] = (data.edges ?? []).map((e, i) => ({
        ...e,
        id: (e as Edge).id ?? `e${i}`,
      }));

      setFlowchartData({ nodes, edges });
      if (data.ir_nodes) setIrNodes(data.ir_nodes as never[]);
      toast.success('Flowchart generated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error. Is the backend running?';
      setFlowchartError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setLoadingFlowchart(false);
    }
  }, [code, language, setFlowchartData, setFlowchartError, setIrNodes, setLoadingFlowchart]);

  return { analyze, isLoading };
}
