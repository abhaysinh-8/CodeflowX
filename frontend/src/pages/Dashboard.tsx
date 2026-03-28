import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layout, Settings,
  ChevronRight, Play, Database, Shield,
  Loader2, Sparkles, Binary
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useFlowchartAPI } from '../hooks/useFlowchartAPI';
import { useExecutionAPI } from '../hooks/useExecutionAPI';
import FlowchartCanvas from '../components/canvas/FlowchartCanvas';
import IRDebugPanel from '../components/canvas/IRDebugPanel';
import CodeEditorPanel from '../components/editor/CodeEditorPanel';
import LanguageSelector from '../components/editor/LanguageSelector';
import DependencyGraph from '../components/dependency/DependencyGraph';
import ExecutionVisualizer from '../components/execution/ExecutionVisualizer';
import CoverageWorkspace from '../components/coverage/CoverageWorkspace';
import ExplanationPanel from '../components/ExplanationPanel';
import GitHubWorkspace from '../components/github/GitHubWorkspace';
import { Button } from '../components/ui/Button';
import { useExplainAPI } from '../hooks/useExplainAPI';

export default function Dashboard() {
  const {
    isLoadingFlowchart,
    isLoadingExecution,
    isLoadingDependency,
    isLoadingCoverage,
    dependencyData,
    syncViewsEnabled,
    setSyncViewsEnabled,
    selectionHistory,
    selectionHistoryIndex,
    goSelectionBack,
    goSelectionForward,
    selectNode,
  } = useStore();
  const { analyze: analyzeFlowchart } = useFlowchartAPI();
  const executionAPI = useExecutionAPI();
  const explainAPI = useExplainAPI();

  const [activeTab, setActiveTab] = useState('flowchart');
  const isLoading = activeTab === 'dependency'
    ? isLoadingDependency
    : activeTab === 'coverage'
      ? isLoadingCoverage
    : activeTab === 'execution'
      ? isLoadingExecution
      : activeTab === 'github'
        ? false
      : isLoadingFlowchart;

  const analyzeActiveTab = () => {
    analyzeFlowchart();
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

            <div className="flex items-center gap-2">
            <button
              onClick={goSelectionBack}
              disabled={selectionHistoryIndex <= 0}
              className="px-2 py-1 rounded border border-white/10 bg-white/5 text-xs text-white/60 disabled:opacity-40"
              title="Cross-view back"
            >
              {'<'}
            </button>
            <button
              onClick={goSelectionForward}
              disabled={selectionHistoryIndex >= selectionHistory.length - 1}
              className="px-2 py-1 rounded border border-white/10 bg-white/5 text-xs text-white/60 disabled:opacity-40"
              title="Cross-view forward"
            >
              {'>'}
            </button>
            <button
              onClick={() => setSyncViewsEnabled(!syncViewsEnabled)}
              className={`px-2 py-1 rounded border text-[10px] uppercase tracking-widest ${
                syncViewsEnabled
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-white/60'
              }`}
              title="Enable/disable cross-view sync"
            >
              {syncViewsEnabled ? 'Sync On' : 'Sync Off'}
            </button>
            <LanguageSelector />
            {activeTab !== 'github' ? (
              <Button
                size="sm"
                variant="primary"
                onClick={analyzeActiveTab}
                disabled={isLoading}
                className="gap-2 shadow-blue-500/10"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                Analyze
              </Button>
            ) : null}
          </div>
        </header>

        {/* Workspace Area */}
        <div className="flex-1 flex min-h-0 relative">
          {/* Editor Section */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-white/5">
            <div className="flex items-center gap-1 p-2 bg-slate-950/40 border-b border-white/5">
              <div className="px-3 py-1.5 rounded-md bg-white/5 text-[10px] uppercase tracking-wider font-bold text-blue-400 border border-white/5">Editor</div>
            </div>
            <div className="flex-1 overflow-hidden relative p-2">
              <CodeEditorPanel onRun={analyzeActiveTab} />
            </div>
          </div>

          {/* Visualization Section */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950/10">
            <div className="flex items-center justify-between p-2 bg-slate-950/40 border-b border-white/5">
              <div className="flex gap-2">
                {['flowchart', 'execution', 'dependency', 'coverage', 'github'].map(tab => (
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

            <div className="flex-1 min-h-0 p-4 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="h-full"
                >
                  {activeTab === 'flowchart' && (
                    <FlowchartCanvas
                      onExplainRequest={(type, targetId, payload = {}) => {
                        void explainAPI.requestExplanation(type, targetId, payload);
                      }}
                    />
                  )}
                  {activeTab === 'execution' && (
                    <ExecutionVisualizer
                      runExecution={executionAPI.runExecution}
                      play={executionAPI.play}
                      pause={executionAPI.pause}
                      jumpToStep={executionAPI.jumpToStep}
                      playToNextBreakpoint={executionAPI.playToNextBreakpoint}
                      updateSpeed={executionAPI.updateSpeed}
                      refreshBreakpointHits={executionAPI.refreshBreakpointHits}
                      isSocketConnected={executionAPI.isSocketConnected}
                    />
                  )}
                  {activeTab === 'dependency' && (
                    <DependencyGraph
                      key={dependencyData?.graphId ?? 'dependency-empty'}
                      onOpenFlowchartNode={(irNodeId) => {
                        selectNode(irNodeId, 'dependency');
                        setActiveTab('flowchart');
                      }}
                      onExplainEdge={(edgeId, payload = {}) => {
                        void explainAPI.requestExplanation('edge', edgeId, payload);
                      }}
                    />
                  )}
                  {activeTab === 'coverage' && (
                    <CoverageWorkspace
                      onExplainRequest={(type, targetId, payload = {}) => {
                        void explainAPI.requestExplanation(type, targetId, payload);
                      }}
                    />
                  )}
                  {activeTab === 'github' && <GitHubWorkspace />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Explanation Panel */}
          <div className="w-[340px] border-l border-white/5 bg-slate-950/30 p-3">
            <ExplanationPanel onExplainMore={() => { void explainAPI.explainMore(); }} />
          </div>

          {/* IR Debug Panel */}
          <IRDebugPanel />
        </div>
      </div>
    </div>
  );
}
