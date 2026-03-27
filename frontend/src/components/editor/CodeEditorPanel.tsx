import { useCallback, useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';
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

interface CodeEditorPanelProps {
  onRun?: () => void;
}

export default function CodeEditorPanel({ onRun }: CodeEditorPanelProps) {
  const { code, language, setCode, setLanguage } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEditorMount: OnMount = (editor) => {
    // Ctrl+Shift+L — cycle language
    editor.addCommand(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).monaco?.KeyMod?.CtrlCmd | (window as any).monaco?.KeyMod?.Shift | (window as any).monaco?.KeyCode?.KeyL,
      () => {
        const langs: Language[] = ['python', 'javascript', 'typescript', 'java'];
        const idx = langs.indexOf(language);
        setLanguage(langs[(idx + 1) % langs.length]);
      }
    );
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
