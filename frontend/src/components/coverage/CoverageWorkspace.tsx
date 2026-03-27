import { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadCloud, Download, Layers, FileCheck2 } from 'lucide-react';
import FlowchartCanvas from '../canvas/FlowchartCanvas';
import { useCoverageAPI } from '../../hooks/useCoverageAPI';
import { useStore } from '../../store/useStore';

function downloadSample(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const SAMPLE_COBERTURA = `<?xml version="1.0" ?>
<coverage>
  <packages>
    <package name="app">
      <classes>
        <class name="main.py" filename="main.py">
          <lines>
            <line number="2" hits="1"/>
            <line number="3" hits="0"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
`;

const SAMPLE_LCOV = `TN:
SF:main.py
DA:2,1
DA:3,0
end_of_record
`;

const SAMPLE_JACOCO = `<?xml version="1.0" encoding="UTF-8"?>
<report name="sample">
  <package name="app">
    <sourcefile name="Main.java">
      <line nr="12" mi="0" ci="1" mb="0" cb="1"/>
      <line nr="13" mi="1" ci="0" mb="1" cb="0"/>
    </sourcefile>
  </package>
</report>
`;

const SAMPLE_NATIVE = JSON.stringify({
  format: 'codeflowx-coverage-v1',
  line_hits: { '2': 1, '3': 0 },
}, null, 2);

export default function CoverageWorkspace() {
  const { importCoverage, exportCoverageReport } = useCoverageAPI();
  const {
    coverageData,
    isLoadingCoverage,
    coverageError,
    coverageOverlayEnabled,
    coverageFilter,
    setCoverageOverlayEnabled,
    setCoverageFilter,
  } = useStore();
  const [isDragging, setDragging] = useState(false);

  const onSelectFile = useCallback((file: File | null) => {
    if (!file) return;
    importCoverage(file);
  }, [importCoverage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'c' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        event.preventDefault();
        setCoverageOverlayEnabled(!coverageOverlayEnabled);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [coverageOverlayEnabled, setCoverageOverlayEnabled]);

  const summary = coverageData?.summary;
  const segments = useMemo(() => {
    if (!summary) return [];
    return [
      { key: 'covered', label: 'Covered', value: summary.covered, color: 'bg-emerald-500/70' },
      { key: 'partial', label: 'Partial', value: summary.partial, color: 'bg-amber-500/70' },
      { key: 'uncovered', label: 'Uncovered', value: summary.uncovered, color: 'bg-rose-500/70' },
      { key: 'dead', label: 'Dead', value: summary.dead, color: 'bg-slate-500/70' },
    ];
  }, [summary]);

  return (
    <div className="h-full w-full grid grid-cols-[1fr_340px] gap-3">
      <div className="h-full min-h-0">
        <FlowchartCanvas />
      </div>
      <div className="h-full min-h-0 rounded-2xl border border-white/10 bg-slate-950/70 p-3 flex flex-col gap-3">
        <div
          className={`rounded-xl border border-dashed p-4 text-center transition-all ${
            isDragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/15 bg-white/[0.02]'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0] ?? null;
            onSelectFile(file);
          }}
        >
          <UploadCloud className="w-6 h-6 text-cyan-300/80 mx-auto mb-2" />
          <div className="text-xs text-slate-300">Drop coverage file here</div>
          <div className="text-[10px] text-slate-500 mt-1">coverage.xml / lcov.info / jacoco.xml / native JSON</div>
          <label className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs cursor-pointer hover:bg-cyan-500/30">
            Choose File
            <input
              type="file"
              className="hidden"
              accept=".xml,.info,.json,.txt"
              onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Coverage Control</div>
            <button
              onClick={() => setCoverageOverlayEnabled(!coverageOverlayEnabled)}
              className={`text-[10px] px-2 py-1 rounded-md border ${
                coverageOverlayEnabled
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                  : 'bg-white/5 border-white/15 text-slate-300'
              }`}
              title="Toggle coverage overlay (C)"
            >
              <Layers className="w-3 h-3 inline-block mr-1" />
              {coverageOverlayEnabled ? 'Overlay On' : 'Overlay Off'}
            </button>
          </div>
          {coverageData && (
            <div className="mt-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>{coverageData.file_name ?? 'coverage file'}</span>
              </div>
              <div className="text-slate-500 mt-1">{coverageData.format} · {(coverageData.file_size ?? 0).toLocaleString()} bytes</div>
            </div>
          )}
          {isLoadingCoverage && (
            <div className="mt-2 text-xs text-cyan-200">Applying coverage...</div>
          )}
          {coverageError && (
            <div className="mt-2 text-xs text-rose-300">{coverageError}</div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Coverage Summary</div>
          {!summary ? (
            <p className="text-xs text-slate-500 italic">Import a coverage file to view summary.</p>
          ) : (
            <>
              <div className="text-xs text-slate-200 mb-2">{summary.coverage_percent.toFixed(2)}% fully covered</div>
              <div className="space-y-1">
                {segments.map((segment) => (
                  <button
                    key={segment.key}
                    onClick={() => setCoverageFilter(segment.key as typeof coverageFilter)}
                    className={`w-full flex items-center justify-between text-xs px-2 py-1 rounded-md border ${
                      coverageFilter === segment.key
                        ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100'
                        : 'border-white/10 bg-white/[0.02] text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${segment.color}`} />
                      {segment.label}
                    </span>
                    <span>{segment.value}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCoverageFilter('all')}
                className="mt-2 w-full text-[11px] px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]"
              >
                Show All Nodes
              </button>
            </>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">Export & Samples</div>
          <button
            onClick={exportCoverageReport}
            className="w-full mb-2 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/30"
          >
            <Download className="w-3.5 h-3.5 inline-block mr-1" />
            Export Coverage Report JSON
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => downloadSample('coverage.xml', SAMPLE_COBERTURA)} className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:bg-white/5">Sample XML</button>
            <button onClick={() => downloadSample('lcov.info', SAMPLE_LCOV)} className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:bg-white/5">Sample LCOV</button>
            <button onClick={() => downloadSample('jacoco.xml', SAMPLE_JACOCO)} className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:bg-white/5">Sample JaCoCo</button>
            <button onClick={() => downloadSample('codeflowx-native.json', SAMPLE_NATIVE)} className="text-[10px] px-2 py-1 rounded border border-white/10 text-slate-300 hover:bg-white/5">Sample Native</button>
          </div>
        </div>
      </div>
    </div>
  );
}

