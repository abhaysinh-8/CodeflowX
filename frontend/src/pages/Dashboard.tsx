import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layout, Zap, Share2, Search, Code2, Settings, 
  ChevronRight, Play, Database, Shield, Maximize2,
  Loader2, AlertCircle, Sparkles, Binary
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useFlowchartStore } from '../store/useFlowchartStore';
import { FlowchartSection } from '../modules/flowchart/FlowchartSection';
import { IRDebugPanel } from '../modules/flowchart/IRDebugPanel';
import { Button } from '../components/ui/Button';

export default function Dashboard() {
  const { 
    code, language, setCode, setLanguage, 
    setData, setLoading, setError, 
    isLoading, error 
  } = useFlowchartStore();
  
  const [activeTab, setActiveTab] = useState('flowchart');
  const [token, setToken] = useState<string | null>(null);

  // Auto-login for demo purposes
  useEffect(() => {
    const login = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/login', { method: 'POST' });
        const data = await res.json();
        setToken(data.access_token);
      } catch (err) {
        console.error("Failed to login", err);
      }
    };
    login();
  }, []);

  const handleRunAnalysis = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/flowchart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, language })
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        setData({
          nodes: data.nodes,
          edges: data.edges,
          ir: data.ir
        });
        setActiveTab('flowchart');
      } else {
        setError(data.error || 'Failed to analyze code');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] overflow-hidden text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-16 lg:w-20 border-r border-white/5 flex flex-col items-center py-6 gap-8 bg-slate-950/50 backdrop-blur-xl z-30">
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex flex-col gap-6">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Layout className="w-5 h-5" /></div>
            <div className="p-2 text-slate-500 hover:text-slate-200 transition-colors"><Database className="w-5 h-5" /></div>
            <div className="p-2 text-slate-500 hover:text-slate-200 transition-colors"><Binary className="w-5 h-5" /></div>
            <div className="p-2 text-slate-500 hover:text-slate-200 transition-colors"><Shield className="w-5 h-5" /></div>
        </nav>

        <div className="mt-auto flex flex-col gap-6 p-4 border-t border-white/5 w-full items-center">
            <Settings className="w-5 h-5 text-slate-500 hover:text-slate-200 cursor-pointer" />
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-white/10" />
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-slate-950/20 backdrop-blur-md">
           <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold tracking-tight">CodeFlowX<span className="text-blue-500">+</span></h2>
              <div className="h-4 w-px bg-white/10" />
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span>main</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-slate-300">flow_engine.py</span>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-900 border border-white/10 rounded-md px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
                <option value="java">Java</option>
              </select>
              <Button 
                size="sm" 
                variant="primary" 
                onClick={handleRunAnalysis}
                disabled={isLoading}
                className="gap-2 shadow-blue-500/10"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Analyze
              </Button>
           </div>
        </header>

        {/* Workspace Area */}
        <div className="flex-1 flex min-h-0 relative">
            {/* Editor Section */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
                <div className="flex items-center gap-1 p-2 bg-slate-950/40 border-b border-white/5">
                    <div className="px-3 py-1.5 rounded-md bg-white/5 text-[10px] uppercase tracking-wider font-bold text-blue-400 border border-white/5">Editor</div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <Editor
                      height="100%"
                      defaultLanguage="python"
                      language={language}
                      theme="vs-dark"
                      value={code}
                      onChange={(val) => setCode(val || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: 'JetBrains Mono, Menlo, monospace',
                        backgroundColor: '#020617',
                        lineNumbersMinChars: 3,
                        scrollBeyondLastLine: false,
                        padding: { top: 20 },
                      }}
                    />
                </div>
            </div>

            {/* Visualization Section */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950/10">
                <div className="flex items-center justify-between p-2 bg-slate-950/40 border-b border-white/5">
                    <div className="flex gap-2">
                        {['flowchart', 'execution', 'dependency'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-bold transition-all ${activeTab === tab ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex-1 min-h-0 p-4 overflow-hidden relative">
                    <AnimatePresence mode="wait">
                        <motion.div 
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full"
                        >
                            {activeTab === 'flowchart' && <FlowchartSection />}
                            {activeTab === 'execution' && (
                                <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">Execution Simulation (Coming Soon)</div>
                            )}
                            {activeTab === 'dependency' && (
                                <div className="h-full flex items-center justify-center text-slate-500 italic text-xs">Dependency Graph (Coming Soon)</div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {error && (
                        <div className="absolute bottom-8 right-8 max-w-sm p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-md flex gap-3 items-start animate-in fade-in slide-in-from-bottom-4">
                            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                            <div>
                                <h4 className="text-sm font-bold text-red-400">Analysis Error</h4>
                                <p className="text-xs text-red-300/70 mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* IR Debug Panel */}
            <IRDebugPanel />
        </div>
      </div>
    </div>
  );
}
