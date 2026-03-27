import { useCallback, useEffect, useRef } from 'react';
import MonacoEditor, { useMonaco } from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditorNS } from 'monaco-editor';
import { Upload, FileCode } from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Language } from '../../store/useStore';

const LANGUAGE_DISPLAY: Record<Language, string> = {
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  java: 'Java',
};

const MONACO_LANG_MAP: Record<Language, string> = {
  python: 'python',
  javascript: 'javascript',
  typescript: 'typescript',
  java: 'java',
};

const EXT_LANG_MAP: Record<string, Language> = {
  py: 'python',
  js: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  java: 'java',
};

const LANG_COLORS: Record<Language, string> = {
  python: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  javascript: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  typescript: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  java: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
};

/** Heuristically detect language from pasted code. */
function detectLanguageFromCode(code: string): Language | null {
  const trimmed = code.trimStart();
  // Java: class/public/import com./package
  if (/^(public\s+class|class\s+\w|import\s+java|package\s+\w)/.test(trimmed)) return 'java';
  // TypeScript: type annotations with : Type, interface, enum, as keyword
  if (/:\s*(string|number|boolean|void|any|unknown)\b|^(interface|enum|type)\s+\w/.test(trimmed)) return 'typescript';
  // JavaScript: const/let/var, =>, require(, console.log
  if (/^(const|let|var)\s+|=>|require\s*\(|console\.log/.test(trimmed)) return 'javascript';
  // Python: def, import, print(, for x in, elif, self.
  if (/^(def |import |from |class |print\(|elif |@)/.test(trimmed) || /\bself\./.test(trimmed)) return 'python';
  return null;
}

/** Recursively locate an IR node by id in the stored tree (backend returns nested IR objects). */
function findIRNode(nodes: unknown[], targetId: string): { source_start?: number; source_end?: number } | null {
  for (const n of nodes) {
    const node = n as { id?: string; source_start?: number; source_end?: number; children?: unknown[] };
    if (node.id === targetId) return node;
    if (node.children?.length) {
      const found = findIRNode(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

/** Locate the narrowest IR node that contains a given source line. */
function findIRNodeByLine(
  nodes: unknown[],
  line: number
): { id?: string; source_start?: number; source_end?: number; children?: unknown[] } | null {
  let best: { id?: string; source_start?: number; source_end?: number; children?: unknown[] } | null = null;
  for (const n of nodes) {
    const node = n as { id?: string; source_start?: number; source_end?: number; children?: unknown[] };
    const start = Number(node.source_start ?? -1);
    const endRaw = Number(node.source_end ?? start);
    const end = endRaw >= start ? endRaw : start;
    if (start > 0 && line >= start && line <= end) {
      const childBest = node.children?.length ? findIRNodeByLine(node.children, line) : null;
      const candidate = childBest ?? node;
      if (!best) {
        best = candidate;
      } else {
        const bestSpan = Number(best.source_end ?? best.source_start ?? 0) - Number(best.source_start ?? 0);
        const candSpan = Number(candidate.source_end ?? candidate.source_start ?? 0) - Number(candidate.source_start ?? 0);
        if (candSpan <= bestSpan) {
          best = candidate;
        }
      }
    }
  }
  return best;
}

interface CodeEditorPanelProps {
  onRun?: () => void;
}

export default function CodeEditorPanel({ onRun }: CodeEditorPanelProps) {
  const { code, language, setCode, setLanguage, selectedNodeId, irNodes, syntaxErrorLine, coverageData } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const languageRef = useRef<Language>(language);
  const irDecorIdsRef = useRef<string[]>([]);
  const errDecorIdsRef = useRef<string[]>([]);
  const monaco = useMonaco();

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // IR node click → reveal + highlight the corresponding source lines
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco) return;

    if (!selectedNodeId) {
      irDecorIdsRef.current = editor.deltaDecorations(irDecorIdsRef.current, []);
      return;
    }

    const node = findIRNode(irNodes, selectedNodeId);
    if (node?.source_start == null) return;

    const startLine = Math.max(1, node.source_start);
    const endLine = Math.max(startLine, node.source_end ?? startLine);
    editor.revealLineInCenter(startLine);
    const coverage = coverageData?.coverage_node_coverage_map?.[selectedNodeId];
    const className = coverage?.coverage_status === 'uncovered'
      ? 'monaco-coverage-uncovered-highlight'
      : 'monaco-ir-highlight';
    irDecorIdsRef.current = editor.deltaDecorations(irDecorIdsRef.current, [{
      range: new monaco.Range(startLine, 1, endLine, Number.MAX_SAFE_INTEGER),
      options: { isWholeLine: true, className },
    }]);
  }, [selectedNodeId, irNodes, monaco, coverageData]);

  // Syntax error → red line decoration
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !monaco) return;

    if (!syntaxErrorLine) {
      errDecorIdsRef.current = editor.deltaDecorations(errDecorIdsRef.current, []);
      return;
    }

    editor.revealLineInCenter(syntaxErrorLine);
    errDecorIdsRef.current = editor.deltaDecorations(errDecorIdsRef.current, [{
      range: new monaco.Range(syntaxErrorLine, 1, syntaxErrorLine, Number.MAX_SAFE_INTEGER),
      options: { isWholeLine: true, className: 'monaco-error-highlight' },
    }]);
  }, [syntaxErrorLine, monaco]);

  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Ctrl+Shift+L — cycle language
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyL,
      () => {
        const langs: Language[] = ['python', 'javascript', 'typescript', 'java'];
        const idx = langs.indexOf(languageRef.current);
        setLanguage(langs[(idx + 1) % langs.length]);
      }
    );

    // Paste detection — auto-set language from clipboard content
    editor.onDidPaste(() => {
      const pasted = editor.getValue();
      const detected = detectLanguageFromCode(pasted);
      if (detected && detected !== languageRef.current) {
        setLanguage(detected);
      }
    });

    // Bidirectional sync: source line click selects corresponding flowchart/dependency node.
    editor.onDidChangeCursorPosition((event) => {
      const line = event.position.lineNumber;
      if (!line || line < 1) return;
      const hit = findIRNodeByLine(useStore.getState().irNodes, line);
      if (hit?.id) {
        useStore.getState().selectNode(hit.id, 'editor');
      }
    });
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const detectedLang = EXT_LANG_MAP[ext] ?? 'python';
    setLanguage(detectedLang);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCode(ev.target?.result as string ?? '');
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }, [setCode, setLanguage]);

  const isPartiallySupported = language === 'java';

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {/* Language Badge */}
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LANG_COLORS[language]}`}>
            {LANGUAGE_DISPLAY[language]}
          </span>
          {isPartiallySupported && (
            <span className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              ⚠ Partial support
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".py,.js,.ts,.tsx,.jsx,.java"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload code file"
            aria-label="Upload code file"
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRun}
            title="Run Analysis"
            aria-label="Run flowchart analysis"
            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shadow-blue-500/20"
          >
            <FileCode className="w-3 h-3" />
            Analyze
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-grow rounded-xl overflow-hidden border border-white/5 bg-[#0d1117]">
        <MonacoEditor
          height="100%"
          language={MONACO_LANG_MAP[language]}
          value={code}
          onChange={(val) => setCode(val ?? '')}
          theme="vs-dark"
          onMount={handleEditorMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 14, bottom: 14 },
            lineNumbers: 'on',
            renderLineHighlight: 'gutter',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            bracketPairColorization: { enabled: true },
            wordWrap: 'on',
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}
