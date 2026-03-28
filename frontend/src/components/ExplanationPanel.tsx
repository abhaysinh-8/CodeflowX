import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, History, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { toast } from './ui/Toast';
import { useExplanationStore } from '../store/explanationStore';

interface ExplanationPanelProps {
  onExplainMore: () => void;
}

function confidenceClass(confidence: number): string {
  if (confidence > 0.75) {
    return 'bg-emerald-500/20 text-emerald-100 border-emerald-400/40';
  }
  if (confidence >= 0.4) {
    return 'bg-amber-500/20 text-amber-100 border-amber-400/40';
  }
  return 'bg-rose-500/20 text-rose-100 border-rose-400/40';
}

export default function ExplanationPanel({ onExplainMore }: ExplanationPanelProps) {
  const {
    currentExplanation,
    currentStreamText,
    isLoading,
    error,
    history,
    isOpen,
    setOpen,
    reopenFromHistory,
  } = useExplanationStore(useShallow((state) => ({
    currentExplanation: state.currentExplanation,
    currentStreamText: state.currentStreamText,
    isLoading: state.isLoading,
    error: state.error,
    history: state.history,
    isOpen: state.isOpen,
    setOpen: state.setOpen,
    reopenFromHistory: state.reopenFromHistory,
  })));
  const [showHistory, setShowHistory] = useState(false);
  const streamRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!streamRef.current) return;
    streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [currentStreamText, isLoading]);

  const relevantLines = useMemo(() => {
    if (!currentExplanation?.relevant_lines?.length) return null;
    const start = Number(currentExplanation.relevant_lines[0] ?? 0);
    const end = Number(currentExplanation.relevant_lines[1] ?? start);
    if (start <= 0) return null;
    return [start, Math.max(start, end)];
  }, [currentExplanation?.relevant_lines]);

  const copyExplanation = async () => {
    const text = currentExplanation?.explanation || currentStreamText;
    if (!text.trim()) {
      toast.info('No explanation text to copy yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Explanation copied to clipboard.');
    } catch {
      toast.error('Failed to copy explanation.');
    }
  };

  return (
    <div className="h-full min-h-0 rounded-2xl border border-white/10 bg-slate-950/70 flex flex-col">
      <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
          <span className="text-[10px] uppercase tracking-widest text-slate-300">AI Explanation</span>
        </div>
        <button
          onClick={() => setOpen(!isOpen)}
          className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
        >
          {isOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {!isOpen && (
        <div className="px-3 py-4 text-xs text-slate-500">
          Right-click a node/edge/coverage region and click <span className="text-slate-300">Explain this</span>.
        </div>
      )}

      {isOpen && (
        <>
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
            <button
              onClick={copyExplanation}
              className="text-[10px] px-2 py-1 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            >
              <Copy className="w-3 h-3 inline-block mr-1" />
              Copy
            </button>
            <button
              onClick={onExplainMore}
              disabled={!currentExplanation && !currentStreamText}
              className="text-[10px] px-2 py-1 rounded border border-cyan-400/30 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
            >
              Explain more
            </button>
            {currentExplanation && (
              <span className={`ml-auto text-[10px] px-2 py-1 rounded border ${confidenceClass(currentExplanation.confidence)}`}>
                Confidence {(currentExplanation.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <div ref={streamRef} className="flex-1 min-h-0 overflow-auto px-3 py-3 text-sm leading-6 text-slate-200">
            {isLoading && !currentStreamText && (
              <div className="text-xs text-cyan-200 animate-pulse">Generating explanation...</div>
            )}
            {error && (
              <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-500/30 rounded px-2 py-1">
                {error}
              </div>
            )}
            {!error && !isLoading && !currentStreamText && (
              <div className="text-xs text-slate-500 italic">No explanation yet.</div>
            )}
            {currentStreamText && (
              <div className="whitespace-pre-wrap break-words">{currentStreamText}</div>
            )}
          </div>

          {relevantLines && (
            <div className="px-3 py-2 border-t border-white/10 text-[11px] text-slate-300">
              Relevant lines: <span className="text-cyan-200">L{relevantLines[0]}-L{relevantLines[1]}</span>
            </div>
          )}

          <div className="border-t border-white/10">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full px-3 py-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-slate-300 bg-white/[0.02] hover:bg-white/[0.05]"
            >
              <span className="inline-flex items-center gap-1.5">
                <History className="w-3 h-3" />
                History
              </span>
              {showHistory ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            </button>
            {showHistory && (
              <div className="max-h-44 overflow-auto px-2 py-2 space-y-1">
                {history.length === 0 && (
                  <div className="text-xs text-slate-500 italic px-1 py-1">No past explanations.</div>
                )}
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => reopenFromHistory(item.id)}
                    className="w-full text-left rounded border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] px-2 py-1.5"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-slate-400">
                      {item.type} - {item.targetId}
                    </div>
                    <div className="text-xs text-slate-200 line-clamp-2">
                      {item.explanation}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

