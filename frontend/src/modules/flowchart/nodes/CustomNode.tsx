import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Terminal, Cpu, GitBranch, Package, Box } from 'lucide-react';

interface NodeStyle { icon: React.ElementType; color: string; radius: string; }

const NODE_STYLES: Record<string, NodeStyle> = {
  rectangle: { icon: Cpu, color: 'bg-blue-500/20 border-blue-500', radius: 'rounded-md' },
  diamond: { icon: GitBranch, color: 'bg-amber-500/20 border-amber-500', radius: 'rounded-full rotate-45' },
  rounded: { icon: Package, color: 'bg-emerald-500/20 border-emerald-500', radius: 'rounded-2xl' },
  circle: { icon: Terminal, color: 'bg-purple-500/20 border-purple-500', radius: 'rounded-full' },
  parallelogram: { icon: Box, color: 'bg-cyan-500/20 border-cyan-500', radius: 'rounded-none transform -skew-x-12' },
};

interface CustomNodeData { label: string; shape: string; }

export const CustomNode = memo(({ data }: { data: CustomNodeData }) => {
  const { label, shape } = data;
  const style = NODE_STYLES[shape] || NODE_STYLES.rectangle;
  const Icon = style.icon;

  return (
    <div className={`px-4 py-2 shadow-lg border-2 ${style.color} ${style.radius} min-w-[120px] backdrop-blur-md`}>
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-white/50" />
      
      <div className={`flex items-center gap-2 ${shape === 'diamond' ? '-rotate-45' : ''}`}>
        <Icon className="w-4 h-4 text-white/80" />
        <span className="text-xs font-medium text-white/90">{label}</span>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-white/50" />
    </div>
  );
});
