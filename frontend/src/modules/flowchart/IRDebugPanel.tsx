import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ListTree, Code2 } from 'lucide-react';
import { useFlowchartStore } from '../../store/useFlowchartStore';

const IRNodeView = ({ node, depth = 0 }: { node: any, depth?: number }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-2">
      <div 
        className={`flex items-center gap-2 py-1 px-2 rounded-md transition-colors cursor-pointer ${hasChildren ? 'hover:bg-white/5' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {hasChildren ? (
          isOpen ? <ChevronDown className="w-3 h-3 text-white/40" /> : <ChevronRight className="w-3 h-3 text-white/40" />
        ) : (
          <div className="w-3" />
        )}
        <span className="text-[10px] font-mono text-blue-400">[{node.type}]</span>
        <span className="text-xs font-medium text-white/80">{node.name || 'anonymous'}</span>
        <span className="text-[10px] font-mono text-white/20 ml-auto">{node.source_start}-{node.source_end}</span>
      </div>
      
      {isOpen && hasChildren && (
        <div className="ml-2 border-l border-white/10 mt-1">
          {node.children.map((child: any) => (
            <IRNodeView key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const IRDebugPanel = () => {
  const { ir } = useFlowchartStore();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!ir) return null;

  return (
    <div className={`flex flex-col border-l border-white/10 bg-slate-950/50 backdrop-blur-xl transition-all duration-300 ${isCollapsed ? 'w-10' : 'w-80'}`}>
      <div 
        className="flex items-center gap-2 p-3 border-b border-white/10 cursor-pointer hover:bg-white/5"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ListTree className="w-4 h-4 text-blue-400 shrink-0" />
        {!isCollapsed && <span className="text-xs font-bold uppercase tracking-wider text-white/60">IR Debug Tree</span>}
      </div>
      
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10">
          <IRNodeView node={ir} />
        </div>
      )}
    </div>
  );
};
