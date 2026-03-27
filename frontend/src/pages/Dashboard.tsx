import { motion } from 'framer-motion';
import { Layout, Zap, Share2, Search, Code2, Settings, ChevronRight, Play, Database, Shield } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/ui/Button';

// Monaco Editor Mock (since we can't easily install full monaco in this env without more config)
const CodeEditor = () => (
  <div className="flex-grow glass border-white/5 rounded-2xl p-6 font-mono text-sm overflow-auto group">
    <div className="flex justify-between items-center mb-4 text-white/20">
      <span className="text-[10px] uppercase tracking-widest">ai-core-module.ts</span>
      <span className="text-[10px]">TypeScript</span>
    </div>
    <div className="space-y-1">
      <p><span className="text-purple-400">import</span> {'{'} analyze {'}'} <span className="text-purple-400">from</span> <span className="text-green-400">"./internal-engine"</span>;</p>
      <p><span className="text-purple-400">export async function</span> <span className="text-blue-400">processStream</span>(input: any) {'{'}</p>
      <p className="pl-4"><span className="text-purple-400">const</span> results = <span className="text-purple-400">await</span> analyze(input);</p>
      <p className="pl-4"><span className="text-purple-400">if</span> (results.valid) {'{'}</p>
      <p className="pl-8"><span className="text-purple-400">return</span> results.data.<span className="text-blue-400">map</span>(item ={'>'} item.<span className="text-blue-400">process</span>());</p>
      <p className="pl-4">{'}'}</p>
      <p className="pl-4"><span className="text-purple-400">throw new</span> <span className="text-yellow-400">Error</span>(<span className="text-green-400">"Invalid stream data"</span>);</p>
      <p>{'}'}</p>
    </div>
    <div className="absolute bottom-6 right-6 hidden group-hover:block transition-all">
       <Button size="sm" className="gap-2 shadow-blue-500/50 shadow-lg">
         <Play className="w-3 h-3 fill-current" /> Run Analysis
       </Button>
    </div>
  </div>
);

// Tab Content Placeholders
const FlowchartTab = () => (
    <div className="h-full flex flex-col items-center justify-center glass border-blue-500/30 rounded-2xl relative overflow-hidden bg-primary/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
        <div className="flex items-center gap-12 z-10">
           <div className="w-20 h-20 rounded-2xl glass border-primary/50 flex items-center justify-center">
             <Code2 className="w-10 h-10 text-primary" />
           </div>
           <div className="w-16 h-0.5 bg-gradient-to-r from-primary to-purple-500" />
           <div className="w-24 h-24 rounded-3xl glass border-purple-500/50 flex items-center justify-center animate-glow">
             <Zap className="w-12 h-12 text-purple-400" />
           </div>
        </div>
        <p className="mt-12 text-white/40 font-mono text-xs uppercase tracking-[0.2em] z-10">Generative Flow Engine Active</p>
    </div>
);

const ExecutionTab = () => (
    <div className="h-full glass border-white/5 rounded-2xl p-6">
        <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" /> Step-by-Step Simulation
        </h4>
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="p-4 glass border-white/5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-white/20 font-mono">0{i}</span>
                        <span className="text-sm text-white/70 font-medium">Processing entry point node_{i}...</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500/40 group-hover:bg-green-500 transition-colors" />
                </div>
            ))}
        </div>
    </div>
);

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('flowchart');

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Sidebar */}
      <aside className="w-20 lg:w-24 border-right border-white/5 flex flex-col items-center py-8 gap-10 glass border-r z-20">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/20">
          <Code2 className="w-8 h-8 text-white" />
        </div>
        
        <nav className="flex flex-col gap-8">
            <Layout className="w-6 h-6 text-primary cursor-pointer transition-colors" />
            <Database className="w-6 h-6 text-white/20 hover:text-white cursor-pointer" />
            <Share2 className="w-6 h-6 text-white/20 hover:text-white cursor-pointer" />
            <Search className="w-6 h-6 text-white/20 hover:text-white cursor-pointer" />
            <Shield className="w-6 h-6 text-white/20 hover:text-white cursor-pointer" />
        </nav>

        <div className="mt-auto flex flex-col gap-8">
            <Settings className="w-6 h-6 text-white/20 hover:text-white cursor-pointer" />
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border border-white/20" />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col p-6 gap-6 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between">
           <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                Project <span className="text-white/40"><ChevronRight className="w-4 h-4" /></span> AI-Core-Dist
              </h2>
              <p className="text-xs text-white/30 font-mono">ID: xf82-codeflow-plus</p>
           </div>
           <div className="flex items-center gap-4">
              <Button size="sm" variant="glass" className="gap-2">
                <Share2 className="w-4 h-4" /> Export
              </Button>
              <Button size="sm" variant="primary">Deploy v1.2</Button>
           </div>
        </header>

        {/* Workspace Area */}
        <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0">
           {/* Code Section */}
           <div className="w-full lg:w-1/2 flex flex-col gap-4 min-h-0">
             <div className="flex items-center gap-6 border-b border-white/5 pb-2">
                <span className="text-sm font-bold border-b border-primary pb-2 px-2">Editor</span>
                <span className="text-sm text-white/20 font-medium pb-2 cursor-pointer hover:text-white/40">Terminal</span>
                <span className="text-sm text-white/20 font-medium pb-2 cursor-pointer hover:text-white/40">History</span>
             </div>
             <CodeEditor />
           </div>

           {/* Visualization Section */}
           <div className="w-full lg:w-1/2 flex flex-col gap-4 min-h-0">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex gap-6">
                    <button 
                        onClick={() => setActiveTab('flowchart')}
                        className={`text-sm font-bold pb-2 px-2 transition-colors ${activeTab === 'flowchart' ? 'border-b border-primary text-white' : 'text-white/20'}`}
                    >Flowchart</button>
                    <button 
                        onClick={() => setActiveTab('execution')}
                        className={`text-sm font-bold pb-2 px-2 transition-colors ${activeTab === 'execution' ? 'border-b border-primary text-white' : 'text-white/20'}`}
                    >Execution</button>
                    <button 
                        onClick={() => setActiveTab('dependency')}
                        className={`text-sm font-bold pb-2 px-2 transition-colors ${activeTab === 'dependency' ? 'border-b border-primary text-white' : 'text-white/20'}`}
                    >Dependency</button>
                </div>
                <Button size="sm" variant="glass" className="h-7 px-2">
                    <Maximize2 className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="flex-grow min-h-0">
                 {activeTab === 'flowchart' && <FlowchartTab />}
                 {activeTab === 'execution' && <ExecutionTab />}
                 {activeTab === 'dependency' && <div className="h-full glass border-white/5 rounded-2xl flex items-center justify-center italic text-white/20">Dependency Graph (BETA)</div>}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}

const Maximize2 = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" width="24" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
);
