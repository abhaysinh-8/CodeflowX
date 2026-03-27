import { useState } from 'react';
import { ChevronDown, ChevronRight, Bug } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface IRNode {
  id: string;
  type: string;
  name?: string;
  source_start?: number;
  source_end?: number;
  children: string[];
  metadata?: Record<string, unknown>;
}

function IRTreeNode({ node, depth = 0 }: { node: IRNode; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const { setSelectedNodeId } = useStore();
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded cursor-pointer hover:bg-white/5 group"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          setSelectedNodeId(node.id);
          if (hasChildren) setExpanded(e => !e);
        }}
      >
        <span className="w-3 h-3 flex-shrink-0 text-white/20">
          {hasChildren
            ? (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            : null}
        </span>
        <span className="text-[10px] font-mono">
          <span className="text-purple-400">{node.type}</span>
          {node.name && <span className="text-white/60"> {node.name}</span>}
          {node.source_start !== undefined && (
            <span className="text-white/20"> :L{node.source_start}</span>
          )}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(childId => (
            <div key={childId} className="text-[10px] font-mono text-white/20 py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}>
              → <span className="text-blue-400/60">{childId.slice(0, 8)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IRDebugPanel() {
  const { irNodes } = useStore();
  const [open, setOpen] = useState(false);

  // Only render in dev mode
  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={() => setOpen(o => !o)}
        title="Toggle IR Debug Panel (dev only)"
        className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest glass rounded-xl border-white/10 text-white/30 hover:text-white/60 transition-colors"
      >
        <Bug className="w-3 h-3" />
        IR Debug
        <span className="ml-1 text-blue-400/60">{irNodes.length}</span>
      </button>

      {open && (
        <div className="absolute bottom-10 left-0 w-72 max-h-80 overflow-auto glass rounded-xl border-white/10 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              IR Tree — {irNodes.length} nodes
            </h4>
            <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white/60 text-xs">✕</button>
          </div>
          <div className="space-y-0.5">
            {irNodes.length === 0 ? (
              <p className="text-[10px] text-white/20 italic">Run analysis to populate IR tree</p>
            ) : (
              (irNodes as IRNode[]).map(n => <IRTreeNode key={n.id} node={n} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
