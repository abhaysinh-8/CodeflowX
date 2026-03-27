import React from 'react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { CustomNode } from './nodes/CustomNode';
import { useFlowchartStore } from '../../store/useFlowchartStore';

const nodeTypes = {
  custom: CustomNode,
};

export const FlowchartSection = () => {
  const { nodes, edges } = useFlowchartStore();
  
  return (
    <div className="w-full h-full bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        className="bg-dot-white/[0.2]"
      >
        <Background color="#334155" gap={20} />
        <Controls className="!bg-slate-800 !border-white/20 !text-white" />
        <MiniMap 
          nodeColor={() => '#3b82f6'} 
          maskColor="rgba(15, 23, 42, 0.5)"
          className="!bg-slate-800 !border-white/20"
        />
      </ReactFlow>
      
      {!nodes.length && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <p className="text-white/40 text-sm font-medium">Run analysis to generate flowchart</p>
        </div>
      )}
    </div>
  );
};
