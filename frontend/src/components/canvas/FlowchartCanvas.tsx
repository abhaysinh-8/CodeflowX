import { useCallback } from 'react';
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
} from '@xyflow/react';
import type { Node, Edge, Connection, NodeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from '../nodes';
import { useStore } from '../../store/useStore';
import { AlertTriangle, Loader2 } from 'lucide-react';

// Demo nodes shown until user runs their first analysis
const DEMO_NODES: Node[] = [
  { id: 't1', type: 'terminal',      data: { label: 'Start', terminal_type: 'start' },                    position: { x: 200, y: 20  } },
  { id: 'f1', type: 'function_def',  data: { label: 'main()', name: 'main', source_start: 1, source_end: 20 }, position: { x: 180, y: 110 } },
  { id: 'd1', type: 'if_stmt',       data: { label: 'x > 0?', condition: 'x > 0' },                       position: { x: 165, y: 220 } },
  { id: 'l1', type: 'for_loop',      data: { label: 'for i in items', loop_count: 3 },                    position: { x: 60,  y: 340 } },
  { id: 'c1', type: 'call',          data: { label: 'process(x)', callee: 'process', source_start: 14 },  position: { x: 310, y: 340 } },
  { id: 'tc', type: 'try_except',    data: { label: 'try block', exception_type: 'ValueError' },          position: { x: 180, y: 460 } },
  { id: 't2', type: 'terminal',      data: { label: 'End',   terminal_type: 'end'   },                    position: { x: 200, y: 580 } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e-t1-f1', source: 't1', target: 'f1', animated: true, style: { stroke: '#3b82f6' } },
  { id: 'e-f1-d1', source: 'f1', target: 'd1' },
  { id: 'e-d1-l1', source: 'd1', target: 'l1', sourceHandle: 'true',  label: 'true',  style: { stroke: '#22c55e' } },
  { id: 'e-d1-c1', source: 'd1', target: 'c1', sourceHandle: 'false', label: 'false', style: { stroke: '#ef4444' } },
  { id: 'e-l1-tc', source: 'l1', target: 'tc' },
  { id: 'e-c1-tc', source: 'c1', target: 'tc' },
  { id: 'e-tc-t2', source: 'tc', target: 't2', sourceHandle: 'exit' },
];

export default function FlowchartCanvas() {
  const { flowchartData, isLoadingFlowchart, flowchartError, setSelectedNodeId } = useStore();

  const displayNodes = flowchartData?.nodes ?? DEMO_NODES;
  const displayEdges = flowchartData?.edges ?? DEMO_EDGES;

  const [nodes, , onNodesChange] = useNodesState(displayNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(displayEdges);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  // Node click → sync selectedNodeId across views
  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  // Node hover tooltip title — shows name and line range from node data
  const nodesWithTooltip = nodes.map((n) => ({
    ...n,
    title: [
      n.data?.label,
      n.data?.source_start != null
        ? `Lines ${n.data.source_start}–${n.data.source_end ?? n.data.source_start}`
        : null,
    ].filter(Boolean).join(' · '),
  }));
  if (isLoadingFlowchart) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 glass border-white/5 rounded-2xl">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="text-white/40 text-sm font-mono animate-pulse">Generating flowchart...</p>
        {/* Skeleton lines */}
        <div className="flex flex-col gap-3 w-40 mt-4">
          {[80, 60, 90, 50].map((w, i) => (
            <div key={i} className="h-3 bg-white/5 rounded-full animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (flowchartError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 glass border-rose-500/20 rounded-2xl p-8">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
        <p className="text-rose-300 text-sm font-semibold text-center">Analysis Error</p>
        <p className="text-rose-400/70 text-xs font-mono text-center max-w-sm">{flowchartError}</p>
        <button
          onClick={() => useStore.getState().setFlowchartError(null)}
          className="text-xs px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 transition-colors"
        >
          Dismiss
        </button>
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
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="bg-[#080c14]"
      >
        <Controls
          className="!bg-white/5 !border-white/10 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          className="!bg-[#080c14] !border-white/10 !rounded-xl overflow-hidden"
          nodeColor={(node) => {
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
        </Panel>
      </ReactFlow>
    </div>
  );
}
