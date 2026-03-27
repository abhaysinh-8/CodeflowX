import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useDependencyAPI } from '../../hooks/useDependencyAPI';

type FilterType = 'all' | 'function' | 'module' | 'class' | 'external' | 'entrypoint' | 'method';

const TYPE_META: Record<string, { symbol: string; color: string }> = {
  function: { symbol: 'ƒ', color: '#3b82f6' },
  method: { symbol: 'm', color: '#2563eb' },
  module: { symbol: '📦', color: '#0ea5e9' },
  class: { symbol: 'C', color: '#f59e0b' },
  external: { symbol: '⚡', color: '#f97316' },
  entrypoint: { symbol: '▶', color: '#22c55e' },
};

function DependencyNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const nodeType = String(data.type ?? 'function');
  const meta = TYPE_META[nodeType] ?? TYPE_META.function;
  const label = String(data.name ?? data.label ?? '');
  const signature = String(data.signature ?? '');
  const docstring = String(data.docstring ?? '');

  return (
    <div
      className={`min-w-[180px] max-w-[260px] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md ${
        selected ? 'border-blue-400 bg-blue-500/10' : 'border-white/10 bg-slate-900/90'
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
  return (
    <div
      className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] backdrop-blur-sm pointer-events-none"
      style={{
        width: Number(data.width ?? 320),
        height: Number(data.height ?? 180),
      }}
    >
      <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/40 font-bold">
        {String(data.label ?? '')}
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
    setSelectedNodeId,
  } = useStore();
  const { searchDependency, isSearching } = useDependencyAPI();

  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [showClusters, setShowClusters] = useState(true);
  const [collapseClassMembers, setCollapseClassMembers] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [instance, setInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchDependency(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDependency]);

  const relationSet = useMemo(() => {
    if (!activeNodeId || !dependencyData) return new Set<string>();
    const related = new Set<string>([activeNodeId]);
    for (const edge of dependencyData.edges) {
      if (edge.source === activeNodeId) related.add(edge.target);
      if (edge.target === activeNodeId) related.add(edge.source);
    }
    return related;
  }, [activeNodeId, dependencyData]);

  const filteredBaseNodes = useMemo(() => {
    if (!dependencyData) return [];
    return dependencyData.nodes.filter((node) => {
      const nodeType = String((node.data as Record<string, unknown>)?.type ?? '');
      if (collapseClassMembers && nodeType === 'method') return false;
      if (filter === 'all') return true;
      return nodeType === filter;
    });
  }, [collapseClassMembers, dependencyData, filter]);

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
        selectable: false,
        connectable: false,
        zIndex: -10,
        data: {
          label: `${cluster.type}: ${cluster.name}`,
          width: cluster.width,
          height: cluster.height,
        },
      }));
  }, [dependencyData, showClusters, visibleNodeIds]);

  const graphNodes = useMemo<Node[]>(() => {
    return [
      ...clusterNodes,
      ...filteredBaseNodes.map((node) => ({
        ...node,
        data: {
          ...(node.data as Record<string, unknown>),
          isDimmed: activeNodeId ? !relationSet.has(node.id) : false,
        },
      })),
    ];
  }, [clusterNodes, filteredBaseNodes, activeNodeId, relationSet]);

  const graphEdges = useMemo<Edge[]>(() => {
    if (!dependencyData) return [];
    return dependencyData.edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        const dim = activeNodeId
          ? !(edge.source === activeNodeId || edge.target === activeNodeId)
          : false;
        const baseStyle = (edge.style ?? {}) as Record<string, unknown>;
        return {
          ...edge,
          style: {
            ...baseStyle,
            opacity: dim ? 0.18 : 1,
          },
        };
      });
  }, [dependencyData, visibleNodeIds, activeNodeId]);

  const selectNode = useCallback(
    (nodeId: string) => {
      setActiveNodeId(nodeId);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        if (trimmed[trimmed.length - 1] === nodeId) return trimmed;
        const next = [...trimmed, nodeId];
        setHistoryIndex(next.length - 1);
        return next;
      });
    },
    [historyIndex]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_evt, node) => {
      if (node.type === 'cluster') return;
      selectNode(node.id);
      const irNodeId = (node.data as Record<string, unknown>)?.ir_node_id;
      if (typeof irNodeId === 'string' && irNodeId) {
        setSelectedNodeId(irNodeId);
      }
    },
    [selectNode, setSelectedNodeId]
  );

  const jumpToNode = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      const node = filteredBaseNodes.find((n) => n.id === nodeId) || dependencyData?.nodes.find((n) => n.id === nodeId);
      if (node && instance) {
        instance.setCenter(node.position.x, node.position.y, { zoom: 1.2, duration: 400 });
      }
    },
    [dependencyData?.nodes, filteredBaseNodes, instance, selectNode]
  );

  const activeNode = useMemo(() => {
    if (!activeNodeId || !dependencyData) return null;
    return dependencyData.nodes.find((node) => node.id === activeNodeId) ?? null;
  }, [activeNodeId, dependencyData]);

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setActiveNodeId(history[nextIndex] ?? null);
  }, [history, historyIndex]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setActiveNodeId(history[nextIndex] ?? null);
  }, [history, historyIndex]);

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
        Run analysis in Dependency tab to build graph
      </div>
    );
  }

  const openFlowchart = () => {
    if (!activeNode) return;
    const irNodeId = (activeNode.data as Record<string, unknown>)?.ir_node_id;
    if (typeof irNodeId === 'string' && irNodeId && onOpenFlowchartNode) {
      onOpenFlowchartNode(irNodeId);
    }
  };

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
            return TYPE_META[t]?.color ?? '#94a3b8';
          }}
          maskColor="rgba(0,0,0,0.45)"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
        <Panel position="top-right" className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-white/60 disabled:opacity-40"
            title="Back"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-white/60 disabled:opacity-40"
            title="Forward"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-mono text-white/40 bg-black/40 border border-white/10 px-2 py-1 rounded-lg">
            {filteredBaseNodes.length} nodes · {graphEdges.length} edges
          </span>
        </Panel>
        <Panel position="bottom-left" className="pointer-events-none">
          <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/60 leading-5">
            <div>ƒ Function / m Method / 📦 Module / C Class / ⚡ External / ▶ Entrypoint</div>
            <div>Calls: solid | Imports: dashed | Inherits: dotted | Depends On: orange | Triggers: animated</div>
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
            disabled={!onOpenFlowchartNode || !String((activeNode.data as Record<string, unknown>)?.ir_node_id ?? '')}
            className="mt-4 w-full px-3 py-2 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-40"
          >
            Open In Flowchart
          </button>
          <div className="mt-6 text-[10px] text-white/35">
            Legend: Calls=solid, Imports=dashed, Inherits=dotted, Depends On=orange, Triggers=animated.
          </div>
        </div>
      )}
    </div>
  );
}
