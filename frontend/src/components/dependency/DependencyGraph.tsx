import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useDependencyAPI } from '../../hooks/useDependencyAPI';
import { useFailureSimulationAPI } from '../../hooks/useFailureSimulationAPI';
import { nodeTypes as flowchartNodeTypes } from '../nodes';
import { useShallow } from 'zustand/react/shallow';

const API_BASE = 'http://localhost:8000';
type FilterType = 'all' | 'function' | 'module' | 'class' | 'external' | 'entrypoint' | 'method';

const TYPE_META: Record<string, { symbol: string; color: string }> = {
  function: { symbol: 'ƒ', color: '#3b82f6' },
  method: { symbol: 'm', color: '#2563eb' },
  module: { symbol: '📦', color: '#0ea5e9' },
  class: { symbol: 'C', color: '#f59e0b' },
  external: { symbol: '⚡', color: '#f97316' },
  entrypoint: { symbol: '▶', color: '#22c55e' },
};

interface FlowchartPanelPayload {
  nodes: Node[];
  edges: Edge[];
  focus_flowchart_node_id?: string | null;
  focus_ir_node_id?: string | null;
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

function DependencyNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const nodeType = String(data.type ?? 'function');
  const meta = TYPE_META[nodeType] ?? TYPE_META.function;
  const label = String(data.name ?? data.label ?? '');
  const signature = String(data.signature ?? '');
  const docstring = String(data.docstring ?? '');
  const failureSeverity = String(data.failure_severity ?? '');
  const failureClasses = failureSeverity === 'failed'
    ? 'border-rose-400 bg-rose-500/20 shadow-rose-400/30'
    : failureSeverity === 'directly_affected'
      ? 'border-orange-400 bg-orange-500/16'
      : failureSeverity === 'transitively_affected'
        ? 'border-amber-300 bg-amber-500/12'
        : '';

  return (
    <div
      className={`min-w-[180px] max-w-[260px] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md ${
        selected
          ? 'border-blue-400 bg-blue-500/15 shadow-blue-400/20'
          : data.isTrail
            ? 'border-blue-300/60 bg-blue-500/8'
            : failureClasses || 'border-white/10 bg-slate-900/90'
      }`}
      style={{ opacity: data.isDimmed ? 0.3 : 1 }}
      title={[signature, docstring].filter(Boolean).join('\n') || label}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm" style={{ color: meta.color }}>{meta.symbol}</span>
        <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">{nodeType}</span>
      </div>
      <div className="text-sm font-semibold text-white mt-1 truncate">{label}</div>
      <div className="text-[10px] text-white/40 mt-0.5 truncate">{signature || 'No signature'}</div>
    </div>
  );
}

function ClusterNode({ data }: { data: Record<string, unknown> }) {
  const collapsed = Boolean(data.collapsed);
  const memberCount = Number(data.member_count ?? 0);
  return (
    <div
      className={`rounded-2xl border border-dashed backdrop-blur-sm ${collapsed ? 'border-cyan-300/70 bg-cyan-500/10' : 'border-white/20 bg-white/[0.02]'}`}
      style={{
        width: Number(data.width ?? 320),
        height: Number(data.height ?? 180),
      }}
    >
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-bold flex items-center justify-between">
        <span className={collapsed ? 'text-cyan-200/90' : 'text-white/40'}>{String(data.label ?? '')}</span>
        <span className={collapsed ? 'text-cyan-200/70' : 'text-white/30'}>{collapsed ? `collapsed (${memberCount})` : `${memberCount} members`}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  dependency: DependencyNode,
  cluster: ClusterNode,
};

interface DependencyGraphProps {
  onOpenFlowchartNode?: (irNodeId: string) => void;
}

export default function DependencyGraph({ onOpenFlowchartNode }: DependencyGraphProps) {
  const {
    dependencyData,
    dependencySearchResults,
    isLoadingDependency,
    dependencyError,
    analysisJobId,
    selectedNodeId,
    selectNode,
    selectionHistory,
    selectionHistoryIndex,
    goSelectionBack,
    goSelectionForward,
    dependencyExecutionActiveNodeId,
    dependencyExecutionTrail,
    failedDependencyNodeIds,
    failureAffectedByDependencyNode,
    isLoadingFailureSimulation,
    failureBlastRadius,
  } = useStore(useShallow((state) => ({
    dependencyData: state.dependencyData,
    dependencySearchResults: state.dependencySearchResults,
    isLoadingDependency: state.isLoadingDependency,
    dependencyError: state.dependencyError,
    analysisJobId: state.analysisJobId,
    selectedNodeId: state.selectedNodeId,
    selectNode: state.selectNode,
    selectionHistory: state.selectionHistory,
    selectionHistoryIndex: state.selectionHistoryIndex,
    goSelectionBack: state.goSelectionBack,
    goSelectionForward: state.goSelectionForward,
    dependencyExecutionActiveNodeId: state.dependencyExecutionActiveNodeId,
    dependencyExecutionTrail: state.dependencyExecutionTrail,
    failedDependencyNodeIds: state.failedDependencyNodeIds,
    failureAffectedByDependencyNode: state.failureAffectedByDependencyNode,
    isLoadingFailureSimulation: state.isLoadingFailureSimulation,
    failureBlastRadius: state.failureBlastRadius,
  })));
  const { searchDependency, isSearching } = useDependencyAPI();
  const { simulateFailure, resetFailureSimulation, exportFailureReport } = useFailureSimulationAPI();

  const tokenRef = useRef<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showClusters, setShowClusters] = useState(true);
  const [collapseClassMembers, setCollapseClassMembers] = useState(false);
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});
  const [instance, setInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [panelWidth, setPanelWidth] = useState(420);
  const [panelHistory, setPanelHistory] = useState<string[]>([]);
  const [panelHistoryIndex, setPanelHistoryIndex] = useState(-1);
  const [panelPayloadByIr, setPanelPayloadByIr] = useState<Record<string, FlowchartPanelPayload>>({});

  useEffect(() => {
    fetchToken().then((token) => {
      tokenRef.current = token;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchDependency(searchQuery);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, searchDependency]);

  const activeNodeId = useMemo(() => {
    if (!dependencyData) return null;
    if (dependencyExecutionActiveNodeId && dependencyData.nodes.some((node) => node.id === dependencyExecutionActiveNodeId)) {
      return dependencyExecutionActiveNodeId;
    }
    if (!selectedNodeId) return null;
    const match = dependencyData.nodes.find((node) => {
      const irNodeId = (node.data as Record<string, unknown>)?.ir_node_id;
      return typeof irNodeId === 'string' && irNodeId === selectedNodeId;
    });
    return match?.id ?? null;
  }, [dependencyData, dependencyExecutionActiveNodeId, selectedNodeId]);

  const executionTrailSet = useMemo(() => new Set(dependencyExecutionTrail), [dependencyExecutionTrail]);

  const relationSet = useMemo(() => {
    if (!activeNodeId || !dependencyData) return new Set<string>();
    const related = new Set<string>([activeNodeId]);
    for (const edge of dependencyData.edges) {
      if (edge.source === activeNodeId) related.add(edge.target);
      if (edge.target === activeNodeId) related.add(edge.source);
    }
    return related;
  }, [activeNodeId, dependencyData]);

  const clusterMembershipByNode = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!dependencyData) return map;
    for (const cluster of dependencyData.clusters) {
      for (const nodeId of cluster.node_ids) {
        if (!map[nodeId]) map[nodeId] = [];
        map[nodeId].push(cluster.id);
      }
    }
    return map;
  }, [dependencyData]);

  const filteredBaseNodes = useMemo(() => {
    if (!dependencyData) return [];
    return dependencyData.nodes.filter((node) => {
      const nodeType = String((node.data as Record<string, unknown>)?.type ?? '');
      const memberships = clusterMembershipByNode[node.id] ?? [];
      if (memberships.some((clusterId) => collapsedClusters[clusterId])) return false;
      if (collapseClassMembers && nodeType === 'method') return false;
      if (filter === 'all') return true;
      return nodeType === filter;
    });
  }, [clusterMembershipByNode, collapseClassMembers, collapsedClusters, dependencyData, filter]);

  const visibleNodeIds = useMemo(() => new Set(filteredBaseNodes.map((node) => node.id)), [filteredBaseNodes]);

  const clusterNodes = useMemo<Node[]>(() => {
    if (!dependencyData || !showClusters) return [];
    return dependencyData.clusters
      .filter((cluster) => cluster.node_ids.some((id) => visibleNodeIds.has(id)))
      .map((cluster) => ({
        id: `cluster-node-${cluster.id}`,
        type: 'cluster',
        position: { x: cluster.x, y: cluster.y },
        draggable: false,
        selectable: true,
        connectable: false,
        zIndex: -10,
        data: {
          label: `${cluster.type}: ${cluster.name}`,
          width: cluster.width,
          height: cluster.height,
          cluster_id: cluster.id,
          collapsed: Boolean(collapsedClusters[cluster.id]),
          member_count: cluster.node_ids.length,
        },
      }));
  }, [collapsedClusters, dependencyData, showClusters, visibleNodeIds]);

  const graphNodes = useMemo<Node[]>(() => {
    return [
      ...clusterNodes,
      ...filteredBaseNodes.map((node) => ({
        ...node,
        selected: node.id === activeNodeId,
        data: {
          ...(node.data as Record<string, unknown>),
          isDimmed: activeNodeId ? !relationSet.has(node.id) : false,
          isTrail: executionTrailSet.has(node.id) && node.id !== activeNodeId,
          failure_severity: failedDependencyNodeIds.includes(node.id)
            ? 'failed'
            : failureAffectedByDependencyNode[node.id],
        },
      })),
    ];
  }, [
    clusterNodes,
    filteredBaseNodes,
    activeNodeId,
    relationSet,
    executionTrailSet,
    failedDependencyNodeIds,
    failureAffectedByDependencyNode,
  ]);

  const graphEdges = useMemo<Edge[]>(() => {
    if (!dependencyData) return [];
    return dependencyData.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        const dim = activeNodeId
          ? !(edge.source === activeNodeId || edge.target === activeNodeId)
          : false;
        const inTrail = executionTrailSet.has(edge.source) || executionTrailSet.has(edge.target);
        const baseStyle = (edge.style ?? {}) as Record<string, unknown>;
        const baseStroke = typeof baseStyle.stroke === 'string' ? baseStyle.stroke : undefined;
        return {
          ...edge,
          style: {
            ...baseStyle,
            opacity: dim ? 0.18 : 1,
            strokeWidth: inTrail ? 2.4 : Number(baseStyle.strokeWidth ?? 1.6),
            stroke: inTrail ? '#60a5fa' : baseStroke,
          },
        };
      });
  }, [dependencyData, visibleNodeIds, activeNodeId, executionTrailSet]);

  useEffect(() => {
    if (!instance || !activeNodeId) return;
    const node = filteredBaseNodes.find((item) => item.id === activeNodeId) ?? dependencyData?.nodes.find((item) => item.id === activeNodeId);
    if (!node) return;
    instance.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 280 });
  }, [activeNodeId, dependencyData?.nodes, filteredBaseNodes, instance]);

  const jumpToNode = useCallback(
    (nodeId: string) => {
      const node = filteredBaseNodes.find((n) => n.id === nodeId) || dependencyData?.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const irNodeId = (node.data as Record<string, unknown>)?.ir_node_id;
      if (typeof irNodeId === 'string' && irNodeId.trim()) {
        selectNode(irNodeId.trim(), 'dependency');
      }
      if (instance) {
        instance.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 300 });
      }
    },
    [dependencyData?.nodes, filteredBaseNodes, instance, selectNode]
  );

  const activeNode = useMemo(() => {
    if (!activeNodeId || !dependencyData) return null;
    return dependencyData.nodes.find((node) => node.id === activeNodeId) ?? null;
  }, [activeNodeId, dependencyData]);

  const breadcrumbLabels = useMemo(() => {
    if (!dependencyData || selectionHistoryIndex < 0) return [];
    const ids = selectionHistory.slice(0, selectionHistoryIndex + 1);
    return ids.map((irNodeId) => {
      const node = dependencyData.nodes.find((item) => {
        const nodeIrId = (item.data as Record<string, unknown>)?.ir_node_id;
        return typeof nodeIrId === 'string' && nodeIrId === irNodeId;
      });
      return String((node?.data as Record<string, unknown> | undefined)?.name ?? irNodeId);
    });
  }, [dependencyData, selectionHistory, selectionHistoryIndex]);

  const panelCurrentIr = panelHistoryIndex >= 0 ? panelHistory[panelHistoryIndex] : null;
  const panelPayload = panelCurrentIr ? panelPayloadByIr[panelCurrentIr] : undefined;

  const fetchFlowchartForNode = useCallback(async (irNodeId: string, pushHistory = true) => {
    if (!irNodeId) return;

    if (pushHistory) {
      setPanelHistory((prev) => {
        const trimmed = prev.slice(0, panelHistoryIndex + 1);
        if (trimmed[trimmed.length - 1] === irNodeId) return trimmed;
        const next = [...trimmed, irNodeId];
        setPanelHistoryIndex(next.length - 1);
        return next;
      });
    }

    setPanelOpen(true);
    setPanelError(null);

    if (panelPayloadByIr[irNodeId]) return;

    if (!analysisJobId) {
      if (onOpenFlowchartNode) {
        onOpenFlowchartNode(irNodeId);
      }
      setPanelError('No unified analysis job found. Run Analyze first to enable lazy flowchart panel.');
      return;
    }

    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }

    setPanelLoading(true);
    try {
      const params = new URLSearchParams({ ir_node_id: irNodeId });
      const res = await fetch(`${API_BASE}/api/v1/analyze/${analysisJobId}/flowchart?${params.toString()}`, {
        headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.status === 'error') {
        setPanelError(data?.detail || data?.error || `Failed to fetch flowchart (${res.status})`);
        return;
      }
      const payload: FlowchartPanelPayload = {
        nodes: (data?.flowchart?.nodes ?? []) as Node[],
        edges: (data?.flowchart?.edges ?? []) as Edge[],
        focus_flowchart_node_id: data?.focus_flowchart_node_id ?? null,
        focus_ir_node_id: data?.focus_ir_node_id ?? null,
      };
      setPanelPayloadByIr((prev) => ({ ...prev, [irNodeId]: payload }));
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to fetch flowchart.');
    } finally {
      setPanelLoading(false);
    }
  }, [analysisJobId, onOpenFlowchartNode, panelHistoryIndex, panelPayloadByIr]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (node.type === 'cluster') {
        const clusterId = String((node.data as Record<string, unknown>)?.cluster_id ?? '');
        if (clusterId) {
          setCollapsedClusters((prev) => ({
            ...prev,
            [clusterId]: !prev[clusterId],
          }));
        }
        return;
      }
      const irNodeId = (node.data as Record<string, unknown>)?.ir_node_id;
      if (typeof irNodeId === 'string' && irNodeId.trim()) {
        selectNode(irNodeId.trim(), 'dependency');
        void fetchFlowchartForNode(irNodeId.trim(), true);
      }
    },
    [fetchFlowchartForNode, selectNode]
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      if (node.type === 'cluster') return;
      const nodeId = String(node.id ?? '').trim();
      if (!nodeId) return;
      const nextFailed = event.shiftKey
        ? [...new Set([...failedDependencyNodeIds, nodeId])]
        : [nodeId];
      void simulateFailure(nextFailed);
    },
    [failedDependencyNodeIds, simulateFailure]
  );

  const onResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    const onMove = (moveEvt: MouseEvent) => {
      const delta = startX - moveEvt.clientX;
      setPanelWidth(Math.max(320, Math.min(820, startWidth + delta)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const panelBack = useCallback(() => {
    if (panelHistoryIndex <= 0) return;
    const nextIndex = panelHistoryIndex - 1;
    setPanelHistoryIndex(nextIndex);
  }, [panelHistoryIndex]);

  if (isLoadingDependency) {
    return (
      <div className="h-full flex items-center justify-center text-slate-300 text-sm">
        Building dependency graph...
      </div>
    );
  }

  if (dependencyError) {
    return (
      <div className="h-full flex items-center justify-center text-rose-300 text-sm">
        {dependencyError}
      </div>
    );
  }

  if (!dependencyData) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
        Run unified Analyze to build dependency graph.
      </div>
    );
  }

  const openFlowchart = () => {
    if (!activeNode) return;
    const irNodeId = (activeNode.data as Record<string, unknown>)?.ir_node_id;
    if (typeof irNodeId === 'string' && irNodeId.trim()) {
      void fetchFlowchartForNode(irNodeId.trim(), true);
    }
  };

  const panelHeaderPath = activeNode
    ? [
      String((activeNode.data as Record<string, unknown>)?.module ?? ''),
      String(((activeNode.data as Record<string, unknown>)?.metadata as Record<string, unknown> | undefined)?.class_name ?? ''),
      String((activeNode.data as Record<string, unknown>)?.name ?? ''),
    ].filter(Boolean).join(' > ')
    : '';

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-white/5 relative">
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl px-2 py-2">
        <div className="flex items-center gap-2 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
          <Search className="w-3 h-3 text-white/40" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes..."
            className="bg-transparent outline-none text-xs text-white w-44"
          />
          {isSearching && <span className="text-[10px] text-white/40">...</span>}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'function', 'method', 'module', 'class', 'external', 'entrypoint'] as FilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border ${
                filter === type
                  ? 'bg-blue-500/20 border-blue-400/50 text-blue-200'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowClusters((v) => !v)}
          className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border bg-white/5 border-white/10 text-white/60"
          title="Toggle clusters"
        >
          <Filter className="w-3 h-3 inline-block mr-1" />
          {showClusters ? 'Clusters On' : 'Clusters Off'}
        </button>
        <button
          onClick={() => setCollapseClassMembers((v) => !v)}
          className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border bg-white/5 border-white/10 text-white/60"
          title="Collapse or expand class members"
        >
          {collapseClassMembers ? 'Expand Class Members' : 'Collapse Class Members'}
        </button>
        <button
          onClick={resetFailureSimulation}
          className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border bg-white/5 border-white/10 text-white/60"
          title="Reset failure simulation highlights"
        >
          Reset Failure
        </button>
        <button
          onClick={exportFailureReport}
          className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border bg-white/5 border-white/10 text-white/60"
          title="Export failure impact report as JSON"
        >
          Export Failure JSON
        </button>
        {(failedDependencyNodeIds.length > 0 || failureBlastRadius > 0) && (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border border-rose-400/40 bg-rose-500/15 text-rose-100">
            Blast Radius {failureBlastRadius}
          </span>
        )}
        {isLoadingFailureSimulation && (
          <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-md border border-orange-400/40 bg-orange-500/15 text-orange-100">
            Simulating...
          </span>
        )}
      </div>

      {dependencySearchResults.length > 0 && searchQuery.trim() && (
        <div className="absolute top-16 left-2 z-20 w-80 max-h-56 overflow-auto bg-slate-900/95 border border-white/10 rounded-xl">
          {dependencySearchResults.map((item) => (
            <button
              key={item.id}
              className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-b-0"
              onClick={() => jumpToNode(item.id)}
            >
              <div className="text-xs font-semibold text-white">{item.name}</div>
              <div className="text-[10px] text-white/50">{item.type} · {item.module}</div>
            </button>
          ))}
        </div>
      )}

      <ReactFlow
        nodes={graphNodes}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onNodeContextMenu={onNodeContextMenu}
        onInit={setInstance}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        className="bg-[#070b13]"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-white/5 !border-white/10 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10" />
        <MiniMap
          className="!bg-[#080c14] !border-white/10 !rounded-xl overflow-hidden"
          nodeColor={(node) => {
            const data = (node.data as Record<string, unknown>) || {};
            const t = String(data.type ?? node.type ?? '');
            const failureSeverity = String(data.failure_severity ?? '');
            if (failureSeverity === 'failed') return '#fb7185';
            if (failureSeverity === 'directly_affected') return '#fb923c';
            if (failureSeverity === 'transitively_affected') return '#fbbf24';
            if (node.id === activeNodeId) return '#60a5fa';
            if (executionTrailSet.has(node.id)) return '#93c5fd';
            return TYPE_META[t]?.color ?? '#94a3b8';
          }}
          maskColor="rgba(0,0,0,0.45)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
        <Panel position="top-right" className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={goSelectionBack}
            disabled={selectionHistoryIndex <= 0}
            className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-white/60 disabled:opacity-40"
            title="Back"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={goSelectionForward}
            disabled={selectionHistoryIndex >= selectionHistory.length - 1}
            className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-white/60 disabled:opacity-40"
            title="Forward"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-mono text-white/40 bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
            {filteredBaseNodes.length} nodes · {graphEdges.length} edges
          </span>
        </Panel>
        {breadcrumbLabels.length > 0 && (
          <Panel position="top-center" className="pointer-events-none">
            <div className="max-w-[680px] truncate text-[10px] font-mono text-cyan-100/80 bg-black/45 border border-white/10 px-3 py-1.5 rounded-lg">
              {breadcrumbLabels.join(' > ')}
            </div>
          </Panel>
        )}
        <Panel position="bottom-left" className="pointer-events-none">
          <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/60 leading-5">
            <div>ƒ Function / m Method / 📦 Module / C Class / ⚡ External / ▶ Entrypoint</div>
            <div>Calls: solid | Imports: dashed | Inherits: dotted | Depends On: orange | Triggers: animated</div>
            <div>Execution sync: active node blue, visited trail light-blue.</div>
            <div>Failure simulation: failed=red, direct=orange, transitive=yellow. Right-click node to mark failed.</div>
          </div>
        </Panel>
      </ReactFlow>

      {activeNode && (
        <div className="absolute top-0 right-0 h-full w-80 bg-slate-950/95 border-l border-white/10 p-4 z-20">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Node Details</div>
          <div className="mt-2 text-lg font-bold text-white">{String((activeNode.data as Record<string, unknown>)?.name ?? '')}</div>
          <div className="mt-1 text-xs text-white/50">
            {String((activeNode.data as Record<string, unknown>)?.type ?? '')} · {String((activeNode.data as Record<string, unknown>)?.module ?? '')}
          </div>
          <div className="mt-3 text-[11px] text-white/70 font-mono break-words">
            {String((activeNode.data as Record<string, unknown>)?.signature ?? 'No signature')}
          </div>
          <div className="mt-3 text-xs text-white/60">
            {String((activeNode.data as Record<string, unknown>)?.docstring ?? 'No docstring')}
          </div>
          <button
            onClick={openFlowchart}
            disabled={!String((activeNode.data as Record<string, unknown>)?.ir_node_id ?? '')}
            className="mt-4 w-full px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
          >
            Open In Side Flowchart
          </button>
          <button
            onClick={() => void simulateFailure([activeNode.id])}
            className="mt-2 w-full px-3 py-2 rounded-lg bg-rose-600/70 hover:bg-rose-500 text-white text-xs font-semibold"
          >
            Mark As Failed
          </button>
          <div className="mt-6 text-[10px] text-white/35">
            Legend: Calls=solid, Imports=dashed, Inherits=dotted, Depends On=orange, Triggers=animated.
          </div>
        </div>
      )}

      <div
        className={`absolute top-0 right-0 h-full z-30 transition-transform duration-300 ${
          panelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: panelWidth }}
      >
        <div className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-white/10 hover:bg-cyan-400/50" onMouseDown={onResizeStart} />
        <div className="ml-1 h-full bg-[#070d16]/98 border-l border-white/10 flex flex-col">
          <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-cyan-200/70">Linked Flowchart</div>
              <div className="text-[11px] text-white/70 truncate">{panelHeaderPath || 'Module > Class > Function'}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={panelBack}
                disabled={panelHistoryIndex <= 0}
                className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60 disabled:opacity-40"
                title="Previous flowchart in panel"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => setPanelOpen(false)}
                className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60"
                title="Close panel"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {panelLoading && (
              <div className="absolute inset-0 z-10 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center text-sm text-cyan-100 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading flowchart...
              </div>
            )}
            {panelError && (
              <div className="absolute top-2 left-2 right-2 z-10 text-[11px] text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded-lg px-2 py-1.5">
                {panelError}
              </div>
            )}
            {panelPayload ? (
              <ReactFlow
                nodes={panelPayload.nodes}
                edges={panelPayload.edges}
                nodeTypes={flowchartNodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                className="bg-[#060b12]"
                proOptions={{ hideAttribution: true }}
              >
                <Controls className="!bg-white/5 !border-white/10 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10" />
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.04)" />
              </ReactFlow>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                Click a dependency node to fetch its linked flowchart.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
