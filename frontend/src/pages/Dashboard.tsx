import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Layout, Zap, Share2, Search, Code2, Settings,
  ChevronRight, Database, Shield, GitBranch, Activity
} from 'lucide-react';
import { useStore } from '../store/useStore';
import CodeEditorPanel from '../components/editor/CodeEditorPanel';
import LanguageSelector from '../components/editor/LanguageSelector';
import FlowchartCanvas from '../components/canvas/FlowchartCanvas';
import IRDebugPanel from '../components/canvas/IRDebugPanel';
import { ToastContainer } from '../components/ui/Toast';
import { useFlowchartAPI } from '../hooks/useFlowchartAPI';

const NAV_ITEMS = [
  { icon: Layout,     label: 'Flowchart',   id: 'flowchart'   },
  { icon: Zap,        label: 'Execution',   id: 'execution'   },
  { icon: Share2,     label: 'Dependency',  id: 'dependency'  },
  { icon: Activity,   label: 'Coverage',    id: 'coverage'    },
  { icon: GitBranch,  label: 'GitHub',      id: 'github'      },
  { icon: Search,     label: 'Search',      id: 'search'      },
  { icon: Database,   label: 'Storage',     id: 'storage'     },
  { icon: Shield,     label: 'Security',    id: 'security'    },
];

// Tabs in the visualization panel
const VIZ_TABS = ['Flowchart', 'Execution', 'Dependency'];

const ExecutionTab = () => (
  <div className="h-full glass border-white/5 rounded-2xl p-6">
    <h4 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
      <Zap className="w-4 h-4 text-yellow-400" /> Step-by-Step Simulation
    </h4>
    <div className="space-y-3">
      {['Initialized environment', 'Fetched dependencies', 'Analyzing control flow', 'Generating graph'].map((step, i) => (
        <div key={i} className="p-3 glass border-white/5 rounded-xl flex items-center justify-between group hover:border-white/10 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/20 font-mono w-5">0{i + 1}</span>
            <span className="text-sm text-white/70">{step}</span>
          </div>
          <div className={`w-2 h-2 rounded-full ${i < 2 ? 'bg-green-500' : i === 2 ? 'bg-blue-400 animate-pulse' : 'bg-white/10'}`} />
        </div>
      ))}
    </div>
    <p className="text-[10px] text-white/20 font-mono mt-6 text-center">Phase 2 — Execution Visualizer (Coming Soon)</p>
  </div>
);

const DependencyTab = () => (
  <div className="h-full glass border-white/5 rounded-2xl flex flex-col items-center justify-center gap-4">
    <Share2 className="w-10 h-10 text-white/10" />
    <p className="text-white/30 text-sm font-semibold">Dependency Graph</p>
    <p className="text-white/20 text-xs font-mono">Phase 3 — Coming Soon</p>
  </div>
);

export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('flowchart');
  const [activeTab, setActiveTab] = useState('Flowchart');
  const { flowchartData } = useStore();
  const { analyze } = useFlowchartAPI();

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-[72px] border-r border-white/5 flex flex-col items-center py-6 gap-8 glass z-20 flex-shrink-0">
        {/* Logo */}
        <div className="p-2.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg shadow-blue-500/20">
          <Code2 className="w-6 h-6 text-white" />
        </div>

        <nav className="flex flex-col gap-5 flex-grow" aria-label="Main navigation">
          {NAV_ITEMS.map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              title={label}
              aria-label={label}
              aria-current={activeNav === id ? 'page' : undefined}
              className={`
                p-2 rounded-xl transition-all duration-200
                ${activeNav === id
                  ? 'bg-blue-500/20 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                  : 'text-white/20 hover:text-white hover:bg-white/5'}
              `}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </nav>

        <div className="flex flex-col items-center gap-4">
          <button title="Settings" aria-label="Settings" className="text-white/20 hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 border-2 border-white/20 cursor-pointer"
            title="Abhaysinh"
            aria-label="User profile"
          />
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────── */}
      <main className="flex-grow flex flex-col p-5 gap-5 overflow-hidden min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                CodeFlowX+
                <ChevronRight className="w-4 h-4 text-white/30" />
                <span className="text-white/60 font-medium">Workspace</span>
              </h1>
              <p className="text-[10px] text-white/20 font-mono">Phase 1 — Flowchart Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector />
            {flowchartData && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-mono"
              >
                ✓ {flowchartData.nodes.length} nodes · {flowchartData.edges.length} edges
              </motion.span>
            )}
          </div>
        </header>

        {/* ── Split Workspace ─────────────────────────────── */}
        <div className="flex-grow flex gap-5 min-h-0">
          {/* Left: Code Editor */}
          <div className="w-[46%] flex flex-col gap-3 min-h-0 flex-shrink-0">
            {/* Editor sub-header */}
            <div className="flex items-center gap-4 border-b border-white/5 pb-2 flex-shrink-0">
              <span className="text-sm font-bold border-b-2 border-blue-500 pb-2 px-1">Editor</span>
              <span className="text-sm text-white/20 font-medium pb-2">History</span>
            </div>
            <div className="flex-grow min-h-0">
              <CodeEditorPanel onRun={analyze} />
            </div>
          </div>

          {/* Right: Visualization Panel */}
          <div className="flex-grow flex flex-col gap-3 min-h-0 min-w-0">
            {/* Viz sub-header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-shrink-0">
              <div className="flex gap-4">
                {VIZ_TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      text-sm font-bold pb-2 px-1 transition-colors border-b-2
                      ${activeTab === tab
                        ? 'border-blue-500 text-white'
                        : 'border-transparent text-white/20 hover:text-white/50'}
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Node/Edge badge */}
              <div className="flex items-center gap-2 text-[10px] text-white/30 font-mono">
                {activeTab === 'Flowchart' && flowchartData && (
                  <>
                    <span>{flowchartData.nodes.length} nodes</span>
                    <span className="text-white/10">·</span>
                    <span>{flowchartData.edges.length} edges</span>
                  </>
                )}
              </div>
            </div>

            {/* Canvas area */}
            <div className="flex-grow min-h-0">
              {activeTab === 'Flowchart'   && <FlowchartCanvas />}
              {activeTab === 'Execution'   && <ExecutionTab />}
              {activeTab === 'Dependency'  && <DependencyTab />}
            </div>
          </div>
        </div>
      </main>

      {/* Floating UI */}
      <IRDebugPanel />
      <ToastContainer />
    </div>
  );
}
