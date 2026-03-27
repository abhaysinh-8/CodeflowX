import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Pause,
  Play,
  StepBack,
  StepForward,
  TimerReset,
  Gauge,
  Pin,
  PinOff,
  CircleDot,
  ListTree,
  X,
  ChevronsRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { nodeTypes } from '../nodes';
import type { ExecutionVariableState } from '../../types/execution';

interface ExecutionVisualizerProps {
  runExecution: () => Promise<void>;
  play: () => void;
  pause: () => void;
  jumpToStep: (stepIndex: number) => void;
  playToNextBreakpoint: () => void;
  updateSpeed: (speed: number) => void;
  refreshBreakpointHits: () => Promise<void>;
  isSocketConnected: boolean;
}

function branchEdgeStyle(branchTaken: string | null | undefined): { stroke: string; strokeDasharray?: string } {
  if (branchTaken === 'true') return { stroke: '#22c55e' };
  if (branchTaken === 'false') return { stroke: '#ef4444' };
  if (branchTaken === 'loop') return { stroke: '#f59e0b' };
  if (branchTaken === 'exception') return { stroke: '#ef4444', strokeDasharray: '6 4' };
  return { stroke: '#38bdf8' };
}

function scopeBadge(scope: ExecutionVariableState['scope']): string {
  return scope === 'local'
    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40';
}

function typeBadge(type: ExecutionVariableState['type']): string {
  if (type === 'int') return 'bg-blue-500/15 text-blue-300 border-blue-500/40';
  if (type === 'str') return 'bg-green-500/15 text-green-300 border-green-500/40';
  if (type === 'list') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
  if (type === 'dict') return 'bg-violet-500/15 text-violet-300 border-violet-500/40';
  if (type === 'bool') return 'bg-orange-500/15 text-orange-300 border-orange-500/40';
  return 'bg-slate-500/15 text-slate-300 border-slate-500/40';
}

function Primitive({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-slate-400">null</span>;
  if (typeof value === 'string') return <span className="text-emerald-300">"{value}"</span>;
  if (typeof value === 'number') return <span className="text-sky-300">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="text-amber-300">{String(value)}</span>;
  return <span className="text-slate-300">{String(value)}</span>;
}

function ValueTree({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || typeof value !== 'object') {
    return <Primitive value={value} />;
  }
  if (Array.isArray(value)) {
    return (
      <details open={depth < 1} className="text-[11px]">
        <summary className="cursor-pointer text-slate-300">list[{value.length}]</summary>
        <div className="pl-3 border-l border-white/10 space-y-0.5 mt-1">
          {value.map((item, idx) => (
            <div key={`${depth}-arr-${idx}`} className="flex gap-1">
              <span className="text-slate-500">{idx}:</span>
              <ValueTree value={item} depth={depth + 1} />
            </div>
          ))}
        </div>
      </details>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <details open={depth < 1} className="text-[11px]">
      <summary className="cursor-pointer text-slate-300">dict{'{'}{entries.length}{'}'}</summary>
      <div className="pl-3 border-l border-white/10 space-y-0.5 mt-1">
        {entries.map(([key, item]) => (
          <div key={`${depth}-obj-${key}`} className="flex gap-1">
            <span className="text-slate-500">{key}:</span>
            <ValueTree value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    </details>
  );
}

export default function ExecutionVisualizer({
  runExecution,
  play,
  pause,
  jumpToStep,
  playToNextBreakpoint,
  updateSpeed,
  refreshBreakpointHits,
  isSocketConnected,
}: ExecutionVisualizerProps) {
  const {
    flowchartData,
    setSelectedNodeId,
    executionSteps,
    currentExecutionStep,
    nextExecutionStep,
    prevExecutionStep,
    setCurrentExecutionStep,
    executionBreakpoints,
    toggleExecutionBreakpoint,
    breakpointHits,
    isLoadingExecution,
    executionError,
    isExecutionPlaying,
    executionSpeed,
    pinnedVariables,
    togglePinnedVariable,
  } = useStore();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [instance, setInstance] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const [conditionalBreakpoints, setConditionalBreakpoints] = useState<Record<string, string>>({});
  const focusedFlowNodeIdRef = useRef<string | null>(null);

  const totalSteps = executionSteps.length;
  const currentStep = executionSteps[currentExecutionStep];

  const decoratedNodes = useMemo(() => {
    const baseNodes = flowchartData?.nodes ?? [];
    const activeId = currentStep?.active_node_id;
    const prevId = currentStep?.prev_node_id;
    const loopCounts = currentStep?.loop_counts ?? {};
    return baseNodes.map((node) => {
      const isActive = node.id === activeId;
      const isPrevious = node.id === prevId;
      const hasBreakpoint = executionBreakpoints.includes(node.id);
      const loopCount = loopCounts[node.id];
      return {
        ...node,
        data: {
          ...(node.data ?? {}),
          is_active: isActive,
          loop_count: typeof loopCount === 'number' ? loopCount : (node.data as Record<string, unknown>)?.loop_count,
          has_breakpoint: hasBreakpoint,
        },
        style: {
          ...(node.style ?? {}),
          opacity: isPrevious ? 0.5 : 1,
          transition: 'all 160ms ease',
          boxShadow: hasBreakpoint ? '0 0 0 2px rgba(239,68,68,0.65)' : undefined,
        },
      };
    });
  }, [currentStep, executionBreakpoints, flowchartData?.nodes]);

  const decoratedEdges = useMemo(() => {
    const baseEdges = flowchartData?.edges ?? [];
    const traversed = currentStep?.edge_traversed;
    const branchStyle = branchEdgeStyle(currentStep?.branch_taken ?? null);
    return baseEdges.map((edge) => {
      const isActiveEdge = Boolean(
        traversed &&
          edge.source === traversed.from_id &&
          edge.target === traversed.to_id &&
          (!traversed.label || !edge.label || String(edge.label) === traversed.label)
      );
      if (!isActiveEdge) {
        return {
          ...edge,
          animated: false,
          style: {
            ...(edge.style ?? {}),
            opacity: 0.22,
          },
        };
      }
      return {
        ...edge,
        animated: true,
        style: {
          ...(edge.style ?? {}),
          opacity: 1,
          strokeWidth: 2.6,
          ...branchStyle,
        },
      };
    });
  }, [currentStep, flowchartData?.edges]);

  useEffect(() => {
    setNodes(decoratedNodes);
    setEdges(decoratedEdges);
  }, [decoratedEdges, decoratedNodes, setEdges, setNodes]);

  useEffect(() => {
    if (!instance || !currentStep) return;
    const activeNode = decoratedNodes.find((node) => node.id === currentStep.active_node_id);
    if (!activeNode) return;
    instance.setCenter(activeNode.position.x, activeNode.position.y, { zoom: 1.15, duration: 260 });
  }, [currentStep, decoratedNodes, instance]);

  useEffect(() => {
    if (!currentStep) return;    const activeNode = decoratedNodes.find((node) => node.id === currentStep.active_node_id);
    const irNodeId = (activeNode?.data as Record<string, unknown> | undefined)?.ir_node_id;
    if (typeof irNodeId === 'string' && irNodeId) {
      setSelectedNodeId(irNodeId);
    }
  }, [currentStep, decoratedNodes, setSelectedNodeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (totalSteps > 0) {
          pause();
          const next = Math.min(currentExecutionStep + 1, totalSteps - 1);
          setCurrentExecutionStep(next);
          jumpToStep(next);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (totalSteps > 0) {
          pause();
          const prev = Math.max(currentExecutionStep - 1, 0);
          setCurrentExecutionStep(prev);
          jumpToStep(prev);
        }
      } else if (event.code === 'Space') {
        event.preventDefault();
        if (isExecutionPlaying) {
          pause();
        } else {
          play();
        }
      } else if (event.key === 'F9') {
        event.preventDefault();
        const targetNodeId = focusedFlowNodeIdRef.current ?? currentStep?.active_node_id ?? null;
        if (targetNodeId && targetNodeId.startsWith('node-')) {
          toggleExecutionBreakpoint(targetNodeId);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    currentExecutionStep,
    currentStep?.active_node_id,
    isExecutionPlaying,
    jumpToStep,
    pause,
    play,
    setCurrentExecutionStep,
    toggleExecutionBreakpoint,
    totalSteps,
  ]);

  const variableRows = useMemo(() => {
    const variables = currentStep?.variables ?? {};
    const entries = Object.entries(variables);
    entries.sort(([a], [b]) => {
      const pinA = pinnedVariables.includes(a) ? 1 : 0;
      const pinB = pinnedVariables.includes(b) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return a.localeCompare(b);
    });
    return entries;
  }, [currentStep?.variables, pinnedVariables]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      focusedFlowNodeIdRef.current = node.id;
      const irNodeId = (node.data as Record<string, unknown> | undefined)?.ir_node_id;
      setSelectedNodeId(typeof irNodeId === 'string' && irNodeId ? irNodeId : node.id);
      if (!executionBreakpoints.includes(node.id)) {
        toggleExecutionBreakpoint(node.id);
      }
    },
    [executionBreakpoints, setSelectedNodeId, toggleExecutionBreakpoint]
  );

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault();
      const condition = window.prompt('Conditional breakpoint expression (optional):', conditionalBreakpoints[node.id] ?? '');
      if (condition === null) return;
      if (!executionBreakpoints.includes(node.id)) {
        toggleExecutionBreakpoint(node.id);
      }
      setConditionalBreakpoints((prev) => ({
        ...prev,
        [node.id]: condition.trim(),
      }));
    },
    [conditionalBreakpoints, executionBreakpoints, toggleExecutionBreakpoint]
  );

  const goNext = () => {
    if (!totalSteps) return;
    pause();
    nextExecutionStep();
    const next = Math.min(currentExecutionStep + 1, totalSteps - 1);
    jumpToStep(next);
  };

  const goPrev = () => {
    if (!totalSteps) return;
    pause();
    prevExecutionStep();
    const prev = Math.max(currentExecutionStep - 1, 0);
    jumpToStep(prev);
  };

  if (!flowchartData) {
    return <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">Generate a flowchart first, then run Execution.</div>;
  }

  return (
    <div className="h-full w-full grid grid-cols-[1fr_360px] gap-3">
      <div className="h-full rounded-2xl overflow-hidden border border-white/5 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onInit={setInstance}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="bg-[#070b12]"
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!bg-white/5 !border-white/10 !rounded-xl overflow-hidden [&>button]:!bg-transparent [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10" />
          <MiniMap
            className="!bg-[#080c14] !border-white/10 !rounded-xl overflow-hidden"
            nodeColor={(node) => (node.id === currentStep?.active_node_id ? '#38bdf8' : '#64748b')}
            maskColor="rgba(0,0,0,0.45)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
          <Panel position="top-left" className="pointer-events-auto">
            <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
              <button
                onClick={goPrev}
                className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                title="Previous step (Left Arrow)"
              >
                <StepBack className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={isExecutionPlaying ? pause : play}
                className="px-2 py-1 rounded bg-blue-500/20 border border-blue-400/40 text-blue-100 hover:bg-blue-500/30"
                title="Play/Pause (Space)"
              >
                {isExecutionPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              </button>
              <button
                onClick={goNext}
                className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                title="Next step (Right Arrow)"
              >
                <StepForward className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={goPrev}
                className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                title="Reverse step"
              >
                <TimerReset className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={playToNextBreakpoint}
                className="px-2 py-1 rounded bg-rose-500/15 border border-rose-500/30 text-rose-200 hover:bg-rose-500/25"
                title="Play to next breakpoint"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={runExecution}
                className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 hover:bg-emerald-500/30"
                title="Rebuild execution steps"
              >
                Run
              </button>
            </div>
          </Panel>
          <Panel position="top-right" className="pointer-events-auto">
            <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 min-w-[260px]">
              <Gauge className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.5}
                value={executionSpeed}
                onChange={(event) => updateSpeed(Number(event.target.value))}
                className="flex-1 accent-blue-400"
              />
              <span className="text-[11px] text-slate-300">{executionSpeed.toFixed(1)}x</span>
            </div>
          </Panel>
          <Panel position="bottom-center" className="pointer-events-auto">
            <div className="bg-black/45 border border-white/10 rounded-xl px-3 py-2 min-w-[440px]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-300 uppercase tracking-widest">
                  Step {Math.min(currentExecutionStep + 1, Math.max(totalSteps, 1))} of {totalSteps || 0}
                </span>
                <span className={`text-[10px] uppercase tracking-widest ${isSocketConnected ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {isSocketConnected ? 'WS Connected' : 'WS Offline'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(0, totalSteps - 1)}
                value={Math.min(currentExecutionStep, Math.max(0, totalSteps - 1))}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setCurrentExecutionStep(next);
                  jumpToStep(next);
                }}
                className="w-full accent-blue-400"
              />
            </div>
          </Panel>
        </ReactFlow>

        {isLoadingExecution && (
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center text-sm text-slate-200">
            Building execution steps...
          </div>
        )}
        {executionError && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs rounded-lg px-3 py-2">
            {executionError}
          </div>
        )}
      </div>

      <div className="h-full flex flex-col gap-3 min-h-0">
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 min-h-0 flex-1 flex flex-col">
          <header className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-300">Variable Watch</h3>
            <button onClick={refreshBreakpointHits} className="text-[10px] text-slate-400 hover:text-slate-200">Refresh</button>
          </header>
          <div className="overflow-auto p-2 space-y-2">
            {variableRows.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Run execution to inspect variables.</p>
            ) : (
              variableRows.map(([name, variable]) => {
                const changed = variable.change_type !== 'unchanged';
                const pinned = pinnedVariables.includes(name);
                return (
                  <div
                    key={name}
                    className={`rounded-lg border px-2 py-2 ${changed ? 'border-amber-400/40 bg-amber-400/10' : 'border-white/10 bg-white/[0.02]'}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-100 font-semibold">{name}</span>
                        <span className={`text-[9px] uppercase px-1.5 py-0.5 border rounded ${scopeBadge(variable.scope)}`}>{variable.scope}</span>
                        <span className={`text-[9px] uppercase px-1.5 py-0.5 border rounded ${typeBadge(variable.type)}`}>{variable.type}</span>
                      </div>
                      <button
                        onClick={() => togglePinnedVariable(name)}
                        className="text-slate-400 hover:text-slate-200"
                        title={pinned ? 'Unpin variable' : 'Pin variable'}
                      >
                        {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      <ValueTree value={variable.value} />
                    </div>
                    {changed && (
                      <div className="mt-1 text-[10px] text-amber-200/90">
                        {variable.change_type === 'added' && 'Added'}
                        {variable.change_type === 'removed' && 'Removed'}
                        {variable.change_type === 'changed' && (
                          <>
                            Changed: <Primitive value={variable.prev_value} /> -&gt; <Primitive value={variable.value} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70">
          <header className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-300">Breakpoints</h3>
            <span className="text-[10px] text-slate-400">{executionBreakpoints.length}</span>
          </header>
          <div className="max-h-36 overflow-auto p-2 space-y-1">
            {executionBreakpoints.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Click any node to add a breakpoint. F9 toggles selected node.</p>
            ) : (
              executionBreakpoints.map((nodeId) => (
                <div key={nodeId} className="flex items-center justify-between gap-2 text-xs bg-white/[0.03] border border-white/10 rounded px-2 py-1">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-3 h-3 text-rose-400" />
                    <span className="text-slate-200">{nodeId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {conditionalBreakpoints[nodeId] && (
                      <span className="text-[10px] text-amber-300 truncate max-w-[120px]">{conditionalBreakpoints[nodeId]}</span>
                    )}
                    <button onClick={() => toggleExecutionBreakpoint(nodeId)} className="text-slate-400 hover:text-slate-200" title="Remove breakpoint">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-950/70 min-h-0 flex-1 flex flex-col">
          <header className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <ListTree className="w-3.5 h-3.5" />
              Call Stack
            </h3>
            <span className="text-[10px] text-slate-400">{currentStep?.call_stack?.length ?? 0}</span>
          </header>
          <div className="p-2 overflow-auto">
            {!currentStep?.call_stack?.length ? (
              <p className="text-xs text-slate-500 italic">No active frames.</p>
            ) : (
              [...currentStep.call_stack].reverse().map((frame, index) => (
                <button
                  key={`${frame.ir_node_id}-${index}`}
                  onClick={() => { focusedFlowNodeIdRef.current = `node-${frame.ir_node_id}`; setSelectedNodeId(frame.ir_node_id); }}
                  className="w-full text-left mb-1 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 hover:bg-white/[0.06]"
                >
                  <div className="text-xs text-slate-100 font-semibold">{frame.function_name}</div>
                  <div className="text-[10px] text-slate-400">{frame.file}:L{frame.source_line}</div>
                </button>
              ))
            )}
            {breakpointHits.length > 0 && (
              <div className="mt-2 border-t border-white/10 pt-2 space-y-1">
                {breakpointHits.map((hit) => (
                  <div key={`${hit.node_id}-${hit.step_id}`} className="text-[10px] text-rose-200 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-1">
                    {hit.node_id} hit x{hit.hit_count} at step {hit.step_id}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}











