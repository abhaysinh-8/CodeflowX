import { useCallback, useEffect, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useStore } from '../store/useStore';
import { toast } from '../components/ui/Toast';

const API_BASE = 'http://localhost:8000';

interface DependencyNodeResponse {
  id: string;
  type: string;
  name: string;
  signature: string;
  docstring: string;
  module: string;
  x: number;
  y: number;
  ir_node_id?: string | null;
  flowchart_job_id?: string | null;
  metadata?: Record<string, unknown>;
}

interface DependencyEdgeResponse {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
}

interface DependencyClusterResponse {
  id: string;
  type: string;
  name: string;
  module: string;
  node_ids: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DependencyResponse {
  status?: 'success' | 'error';
  graph_id?: string;
  nodes?: DependencyNodeResponse[];
  edges?: DependencyEdgeResponse[];
  clusters?: DependencyClusterResponse[];
  error?: string;
}

interface SearchResponse {
  status?: 'success' | 'error';
  results?: Array<{
    id: string;
    name: string;
    type: string;
    module: string;
    signature?: string;
    docstring?: string;
  }>;
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

export function useDependencyAPI() {
  const {
    code,
    language,
    dependencyData,
    setDependencyData,
    setLoadingDependency,
    setDependencyError,
    setDependencySearchResults,
  } = useStore();
  const tokenRef = useRef<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
  }, []);

  const analyzeDependency = useCallback(async () => {
    if (!code.trim()) {
      toast.info('Please enter some code to analyze.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setLoadingDependency(true);
    setDependencyError(null);

    try {
      const res = await fetch(`${API_BASE}/api/v1/dependency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}),
        },
        body: JSON.stringify({
          code,
          language,
          module_path: `main.${language === 'python' ? 'py' : language === 'java' ? 'java' : language === 'typescript' ? 'ts' : 'js'}`,
        }),
      });

      const data: DependencyResponse = await res.json().catch(() => ({}));
      if (!res.ok || data.status === 'error' || data.error) {
        const msg = data.error || `Dependency API failed (${res.status})`;
        setDependencyData(null);
        setDependencyError(msg);
        setDependencySearchResults([]);
        toast.error(msg);
        return;
      }

      const nodes: Node[] = (data.nodes ?? []).map((node) => ({
        id: node.id,
        type: 'dependency',
        position: { x: node.x, y: node.y },
        data: {
          ...node,
          label: node.name,
        },
      }));

      const edges: Edge[] = (data.edges ?? []).map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        ...edgeStyleByType(edge.type),
        data: { edge_type: edge.type, label: edge.label },
      }));

      setDependencyData({
        graphId: data.graph_id ?? '',
        nodes,
        edges,
        clusters: data.clusters ?? [],
      });
      setDependencySearchResults([]);
      toast.success('Dependency graph generated successfully!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate dependency graph.';
      setDependencyData(null);
      setDependencyError(msg);
      toast.error(msg);
    } finally {
      setLoadingDependency(false);
    }
  }, [
    code,
    language,
    setDependencyData,
    setDependencyError,
    setDependencySearchResults,
    setLoadingDependency,
  ]);

  const searchDependency = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) {
        setDependencySearchResults([]);
        return;
      }
      if (!dependencyData?.graphId) return;

      if (!tokenRef.current) {
        tokenRef.current = await fetchToken();
      }

      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q,
          graph_id: dependencyData.graphId,
        });
        const res = await fetch(`${API_BASE}/api/v1/dependency/search?${params.toString()}`, {
          headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        });
        const data: SearchResponse = await res.json().catch(() => ({}));
        if (!res.ok || data.status === 'error') {
          setDependencySearchResults([]);
          return;
        }
        setDependencySearchResults(data.results ?? []);
      } catch {
        setDependencySearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [dependencyData?.graphId, setDependencySearchResults]
  );

  return {
    analyzeDependency,
    searchDependency,
    isSearching,
  };
}
