import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  type ReactFlowInstance,
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { useStore } from '../../store/useStore';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { useFlowchartAPI } from '../../hooks/useFlowchartAPI';

const DEMO_NODES: Node[] = [
  { id: 't1', type: 'terminal', data: { label: 'Start', terminal_type: 'start' }, position: { x: 200, y: 20 } },
  { id: 'f1', type: 'function_def', data: { label: 'main()', name: 'main', source_start: 1, source_end: 20 }, position: { x: 180, y: 110 } },
  { id: 'd1', type: 'if_stmt', data: { label: 'x > 0?', condition: 'x > 0' }, position: { x: 165, y: 220 } },
  { id: 'l1', type: 'for_loop', data: { label: 'for i in items', loop_count: 3 }, position: { x: 60, y: 340 } },
  { id: 'c1', type: 'call', data: { label: 'process(x)', callee: 'process', source_start: 14 }, position: { x: 310, y: 340 } },
  { id: 'tc', type: 'try_except', data: { label: 'try block', exception_type: 'ValueError' }, position: { x: 180, y: 460 } },
  { id: 't2', type: 'terminal', data: { label: 'End', terminal_type: 'end' }, position: { x: 200, y: 580 } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e-t1-f1', source: 't1', target: 'f1', animated: true, style: { stroke: '#3b82f6' } },
  { id: 'e-f1-d1', source: 'f1', target: 'd1' },
  { id: 'e-d1-l1', source: 'd1', target: 'l1', sourceHandle: 'true', label: 'true', style: { stroke: '#22c55e' } },
  { id: 'e-d1-c1', source: 'd1', target: 'c1', sourceHandle: 'false', label: 'false', style: { stroke: '#ef4444' } },
  { id: 'e-l1-tc', source: 'l1', target: 'tc' },
  { id: 'e-c1-tc', source: 'c1', target: 'tc' },
  { id: 'e-tc-t2', source: 'tc', target: 't2', sourceHandle: 'exit' },
];

function normalizeCoverageStatus(raw: unknown): string {
  const status = String(raw ?? '').trim();
  if (!status) return '';
  return status;
}

function matchesCoverageFilter(node: Node, status: string, filter: string, overlayEnabled: boolean): boolean {
  if (!overlayEnabled || filter === 'all') return true;
  if (node.type === 'terminal') return true;
  if (filter === 'covered') return status === 'fully_covered';
  if (filter === 'partial') return status === 'partially_covered';
  if (filter === 'uncovered') return status === 'uncovered';
  if (filter === 'dead') return status === 'dead';
  return true;
}

export default function FlowchartCanvas() {
  const {
    flowchartData,
    isLoadingFlowchart,
    flowchartProgress,
    flowchartError,
    selectedNodeId,
    selectionPulseNodeId,
    selectionPulseToken,
    selectionPulseAt,
    selectNode,
    coverageData,
    coverageOverlayEnabled,
    coverageFilter,
  } = useStore();
  const { analyze } = useFlowchartAPI();
  const [instance, setInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  const coverageMapByNode = useMemo(
    () => coverageData?.node_coverage_map ?? {},
    [coverageData?.node_coverage_map]
  );
  const coverageMapByIr = useMemo(
    () => coverageData?.coverage_node_coverage_map ?? {},
    [coverageData?.coverage_node_coverage_map]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockMs(Date.now());
    }, 120);
    return () => window.clearInterval(timer);
  }, []);

  const displayNodes = useMemo(() => {
    const baseNodes = flowchartData?.nodes ?? DEMO_NODES;
    const withCoverage = baseNodes.map((node) => {
      const nodeData = { ...((node.data as Record<string, unknown>) ?? {}) };
      const irNodeId = String(nodeData.ir_node_id ?? '').trim();
      const mapRecord = (irNodeId ? coverageMapByIr[irNodeId] : undefined) ?? coverageMapByNode[node.id];
      const status = normalizeCoverageStatus(nodeData.coverage_status ?? mapRecord?.coverage_status);
      if (coverageOverlayEnabled && status) {
        nodeData.coverage_status = status;
        nodeData.coverage_overlay = true;
        nodeData.coverage_hit_lines = mapRecord?.hit_lines ?? nodeData.coverage_hit_lines;
        nodeData.coverage_total_lines = mapRecord?.total_lines ?? nodeData.coverage_total_lines;
        nodeData.coverage_branch_covered = mapRecord?.branch_covered ?? nodeData.coverage_branch_covered;
        nodeData.coverage_branch_total = mapRecord?.branch_total ?? nodeData.coverage_branch_total;
      } else {
        nodeData.coverage_overlay = false;
      }
      nodeData.cross_selected = Boolean(selectedNodeId && irNodeId && irNodeId === selectedNodeId);
      nodeData.cross_pulse = Boolean(
        selectionPulseNodeId
          && irNodeId
          && irNodeId === selectionPulseNodeId
          && clockMs - selectionPulseAt <= 500
          && selectionPulseToken > 0
      );
      return {
        ...node,
        data: nodeData,
      };
    });
    return withCoverage.filter((node) => {
      const status = normalizeCoverageStatus((node.data as Record<string, unknown>)?.coverage_status);
      return matchesCoverageFilter(node, status, coverageFilter, coverageOverlayEnabled);
    });
  }, [
    coverageFilter,
    coverageMapByIr,
    coverageMapByNode,
    coverageOverlayEnabled,
    flowchartData?.nodes,
    selectedNodeId,
    selectionPulseAt,
    selectionPulseNodeId,
    selectionPulseToken,
    clockMs,
  ]);

  const visibleNodeIds = useMemo(() => new Set(displayNodes.map((node) => node.id)), [displayNodes]);

  const displayEdges = useMemo(() => {
    const baseEdges = flowchartData?.edges ?? DEMO_EDGES;
    return baseEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  }, [flowchartData?.edges, visibleNodeIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(displayNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(displayEdges);

  useEffect(() => {
    setNodes(displayNodes);
    setEdges(displayEdges);
  }, [displayNodes, displayEdges, setNodes, setEdges]);

  useEffect(() => {
    if (!instance || !selectedNodeId) return;
    const target = displayNodes.find((node) => {
      const data = (node.data as Record<string, unknown>) ?? {};
      return String(data.ir_node_id ?? '') === selectedNodeId;
    });
    if (!target) return;
    instance.setCenter(target.position.x, target.position.y, { zoom: 1.15, duration: 260 });
  }, [displayNodes, instance, selectedNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    const irNodeId = (node.data as Record<string, unknown> | undefined)?.ir_node_id;
    selectNode(typeof irNodeId === 'string' && irNodeId ? irNodeId : node.id, 'flowchart');
  }, [selectNode]);

  const nodesWithTooltip = nodes.map((n) => ({
    ...n,
    title: [
      n.data?.label,
      n.data?.source_start != null
        ? `Lines ${n.data.source_start}–${n.data.source_end ?? n.data.source_start}`
        : null,
      n.data?.coverage_overlay && n.data?.coverage_status
        ? `Coverage: ${String(n.data.coverage_status)}`
        : null,
      n.data?.coverage_overlay &&
      n.data?.coverage_status === 'partially_covered' &&
      Number(n.data?.coverage_branch_total ?? 0) > Number(n.data?.coverage_branch_covered ?? 0)
        ? `Untested branches: ${Number(n.data?.coverage_branch_total ?? 0) - Number(n.data?.coverage_branch_covered ?? 0)}`
        : null,
    ].filter(Boolean).join(' · '),
  }));

  if (isLoadingFlowchart) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 glass border-white/5 rounded-2xl">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-white/40 text-sm font-mono animate-pulse">Generating flowchart...</p>
        <div className="w-56 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
            style={{ width: `${Math.max(2, flowchartProgress)}%` }}
          />
        </div>
        <p className="text-[11px] text-white/50 font-mono">{Math.round(flowchartProgress)}%</p>
      </div>
    );
  }

  if (flowchartError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 glass border-rose-500/20 rounded-2xl p-8">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
        <p className="text-rose-300 text-sm font-semibold text-center">Analysis Error</p>
        <p className="text-rose-400/70 text-xs font-mono text-center max-w-sm">{flowchartError}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => useStore.getState().setFlowchartError(null)}
            className="text-xs px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={analyze}
            className="inline-flex items-center gap-1 text-xs px-4 py-2 rounded-lg bg-blue-500/15 border border-blue-400/40 text-blue-200 hover:bg-blue-500/25 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-white/5 relative">
      {!flowchartData && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-[10px] text-white/20 font-mono uppercase tracking-widest pointer-events-none select-none">
          Demo — run analysis to visualize your code
        </div>
      )}
      <ReactFlow
        nodes={nodesWithTooltip}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onInit={setInstance}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-[#080c14]"
      >
        <Controls className="!bg-white/5 !border-white/10 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10" />
        <MiniMap
          className="!bg-[#080c14] !border-white/10 !rounded-xl overflow-hidden"
          nodeColor={(node) => {
            const coverageStatus = String((node.data as Record<string, unknown> | undefined)?.coverage_status ?? '');
            if (coverageOverlayEnabled && coverageStatus) {
              if (coverageStatus === 'fully_covered') return '#22c55e';
              if (coverageStatus === 'partially_covered') return '#f59e0b';
              if (coverageStatus === 'uncovered') return '#ef4444';
              if (coverageStatus === 'dead') return '#94a3b8';
            }
            const colorMap: Record<string, string> = {
              function_def: '#3b82f6',
              if_stmt: '#eab308',
              for_loop: '#22c55e',
              while_loop: '#22c55e',
              terminal: '#10b981',
              call: '#a855f7',
              try_except: '#f97316',
            };
            return colorMap[node.type ?? ''] ?? '#ffffff30';
          }}
          maskColor="rgba(0,0,0,0.4)"
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.04)"
        />
        <Panel position="top-right" className="flex items-center gap-2 pointer-events-none select-none">
          <span className="text-[10px] font-mono text-white/30 bg-black/40 backdrop-blur px-2 py-1 rounded-lg border border-white/5">
            {nodes.length} nodes · {edges.length} edges
          </span>
          {coverageOverlayEnabled && (
            <span className="text-[10px] font-mono text-cyan-100/70 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/30">
              coverage overlay
            </span>
          )}
        </Panel>
      </ReactFlow>
    </div>
  );
}
