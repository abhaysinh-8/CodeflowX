import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import type { Language } from '../../store/useStore';
import { ChevronDown } from 'lucide-react';

const LANGUAGES: { value: Language; label: string; gutter: string; partial?: boolean }[] = [
  { value: 'python',     label: 'Python 3.x',     gutter: 'bg-blue-500'   },
  { value: 'javascript', label: 'JavaScript',      gutter: 'bg-yellow-500' },
  { value: 'typescript', label: 'TypeScript',      gutter: 'bg-cyan-500'   },
  { value: 'java',       label: 'Java 11+',        gutter: 'bg-orange-500', partial: true },
];

interface LanguageSelectorProps {
  className?: string;
}

export default function LanguageSelector({ className = '' }: LanguageSelectorProps) {
  const { language, setLanguage } = useStore();
  const selectRef = useRef<HTMLDivElement>(null);

  const cycleLanguage = useCallback(() => {
    const langs = LANGUAGES.map(l => l.value);
    const idx = langs.indexOf(language);
    setLanguage(langs[(idx + 1) % langs.length]);
  }, [language, setLanguage]);

  // Keyboard shortcut: Ctrl+Shift+L
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        cycleLanguage();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleLanguage]);

  const current = LANGUAGES.find(l => l.value === language) ?? LANGUAGES[0];

  return (
    <div ref={selectRef} className={`relative group ${className}`}>
      <button
        aria-label="Select programming language"
        title="Switch language (Ctrl+Shift+L)"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 transition-all"
      >
        <span className={`w-2 h-2 rounded-full ${current.gutter}`} />
        {current.label}
        {current.partial && <span className="text-amber-400/70 text-[9px]">⚠</span>}
        <ChevronDown className="w-3 h-3 text-white/40" />
      </button>

      {/* Dropdown appearing on hover */}
      <div className="absolute top-full left-0 mt-1 z-50 hidden group-focus-within:block group-hover:block">
        <div className="glass rounded-xl shadow-xl overflow-hidden w-44 py-1">
          {LANGUAGES.map(lang => (
            <button
              key={lang.value}
              onClick={() => setLanguage(lang.value)}
              className={`
                w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-left transition-colors
                ${language === lang.value ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}
              `}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lang.gutter}`} />
              <span>{lang.label}</span>
              {lang.partial && (
                <span className="ml-auto text-[9px] text-amber-400/70 bg-amber-500/10 px-1 rounded">partial</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
