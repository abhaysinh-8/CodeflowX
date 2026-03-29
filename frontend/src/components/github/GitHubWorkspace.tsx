import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronRight, GitBranch, Loader2, Search, Square } from 'lucide-react';

import { nodeTypes } from '../nodes';
import { useGithubAPI, type GitHubProgressPayload } from '../../hooks/useGithubAPI';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';

interface FileTreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: FileTreeNode[];
}

interface SearchResult {
  name: string;
  path: string;
  language: string;
  ir_node_id: string;
  line: number;
  score: number;
}

const FLOW_NODE_TYPES = new Set([
  'function_def',
  'if_stmt',
  'for_loop',
  'while_loop',
  'terminal',
  'call',
  'try_except',
]);

function normalizeNodeType(type: unknown): string {
  const normalized = String(type ?? '').trim();
  return FLOW_NODE_TYPES.has(normalized) ? normalized : 'custom';
}

function flattenTree(nodes: FileTreeNode[]): string[] {
  const files: string[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.type === 'file') {
      files.push(current.path);
      continue;
    }
    for (const child of current.children) {
      stack.push(child);
    }
  }
  files.sort();
  return files;
}

function validateRepoUrl(value: string): boolean {
  return /^https?:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/i.test(value.trim());
}

function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return 'ETA --';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) {
    return `ETA ${secs}s`;
  }
  return `ETA ${mins}m ${secs}s`;
}

function FileTreeView({
  nodes,
  selectedFile,
  onSelect,
}: {
  nodes: FileTreeNode[];
  selectedFile: string | null;
  onSelect: (path: string) => void;
}) {
  const renderNode = (node: FileTreeNode) => {
    if (node.type === 'file') {
      const selected = selectedFile === node.path;
      return (
        <button
          key={node.path}
          type="button"
          onClick={() => onSelect(node.path)}
          className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
            selected ? 'bg-blue-500/25 text-blue-100' : 'text-slate-300 hover:bg-white/10'
          }`}
        >
          {node.name}
        </button>
      );
    }

    return (
      <div key={node.path || node.name} className="pl-2 border-l border-white/10 ml-1">
        <div className="text-[11px] uppercase tracking-widest text-white/40 py-1">{node.name}</div>
        <div className="space-y-1">
          {node.children.map((child) => renderNode(child))}
        </div>
      </div>
    );
  };

  return <div className="space-y-1">{nodes.map((node) => renderNode(node))}</div>;
}

export default function GitHubWorkspace() {
  const githubAPI = useGithubAPI();

  const [isOAuthConnected, setIsOAuthConnected] = useState(false);
  const [oauthMessage, setOauthMessage] = useState('GitHub account not connected yet.');

  const [repoUrl, setRepoUrl] = useState('https://github.com/pypa/sampleproject');
  const [repoId, setRepoId] = useState<string | null>(null);

  const [isConnectingRepo, setIsConnectingRepo] = useState(false);
  const [progress, setProgress] = useState<GitHubProgressPayload>({
    status: 'idle',
    files_parsed: 0,
    total_files: 0,
    current_file: '',
    progress: 0,
  });
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [flowchartNodes, setFlowchartNodes] = useState<Node[]>([]);
  const [flowchartEdges, setFlowchartEdges] = useState<Edge[]>([]);
  const [isLoadingFileFlowchart, setIsLoadingFileFlowchart] = useState(false);

  const [dependencyNodes, setDependencyNodes] = useState<Array<Record<string, unknown>>>([]);
  const [dependencyEdgesCount, setDependencyEdgesCount] = useState(0);
  const [moduleFilter, setModuleFilter] = useState('');

  const [stats, setStats] = useState<Record<string, number>>({
    total_files: 0,
    total_functions: 0,
    total_classes: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [highlightIrNodeId, setHighlightIrNodeId] = useState<string | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const progressSamplesRef = useRef<Array<{ at: number; parsed: number }>>([]);

  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const updateEta = useCallback((payload: GitHubProgressPayload) => {
    const now = Date.now();
    const sample = { at: now, parsed: payload.files_parsed };

    const nextSamples = [...progressSamplesRef.current, sample].filter((item) => now - item.at <= 30000);
    progressSamplesRef.current = nextSamples;

    if (payload.total_files <= 0 || payload.files_parsed <= 0 || nextSamples.length < 2) {
      setEtaSeconds(null);
      return;
    }

    const first = nextSamples[0];
    const last = nextSamples[nextSamples.length - 1];
    const deltaFiles = last.parsed - first.parsed;
    const deltaSeconds = (last.at - first.at) / 1000;

    if (deltaFiles <= 0 || deltaSeconds <= 0) {
      setEtaSeconds(null);
      return;
    }

    const speed = deltaFiles / deltaSeconds;
    const remaining = Math.max(0, payload.total_files - payload.files_parsed);
    setEtaSeconds(remaining / speed);
  }, []);

  const handleProgressUpdate = useCallback((payload: GitHubProgressPayload) => {
    setProgress(payload);
    updateEta(payload);
  }, [updateEta]);

  const loadGraph = useCallback(async (
    targetRepoId: string,
    filter = '',
  ) => {
    const response = await githubAPI.fetchGraph(targetRepoId, {
      limit: 1000,
      module: filter || undefined,
    });

    if (response.status !== 'success') {
      return;
    }

    setDependencyNodes(response.nodes ?? []);
    setDependencyEdgesCount((response.edges ?? []).length);

    const tree = (response.file_tree ?? []) as unknown as FileTreeNode[];
    setFileTree(tree);

    const graphStats = response.stats ?? {};
    setStats({
      total_files: Number(graphStats.total_files ?? 0),
      total_functions: Number(graphStats.total_functions ?? 0),
      total_classes: Number(graphStats.total_classes ?? 0),
    });

    if (!selectedFile) {
      const files = flattenTree(tree);
      if (files.length > 0) {
        setSelectedFile(files[0]);
      }
    }
  }, [githubAPI, selectedFile]);

  const loadFileFlowchart = useCallback(async (targetRepoId: string, filePath: string) => {
    setIsLoadingFileFlowchart(true);
    try {
      const response = await githubAPI.fetchFileFlowchart(targetRepoId, filePath);
      const flowchart = response?.flowchart ?? { nodes: [], edges: [] };
      const nodes: Node[] = (flowchart.nodes ?? []).map((node: Node, index: number) => ({
        ...node,
        id: node.id ?? `node-${index}`,
        type: normalizeNodeType(node.type),
        selected: String((node.data as Record<string, unknown> | undefined)?.ir_node_id ?? '') === (highlightIrNodeId ?? ''),
      }));
      const edges: Edge[] = (flowchart.edges ?? []).map((edge: Edge, index: number) => ({
        ...edge,
        id: edge.id ?? `edge-${index}`,
      }));

      setFlowchartNodes(nodes);
      setFlowchartEdges(edges);
      setSelectedFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load file flowchart.';
      toast.error(message);
    } finally {
      setIsLoadingFileFlowchart(false);
    }
  }, [githubAPI, highlightIrNodeId]);

  const connectGitHub = useCallback(async () => {
    const result = await githubAPI.connectGitHub();
    setIsOAuthConnected(result.ok);
    setOauthMessage(result.message);
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  }, [githubAPI]);

  const connectRepository = useCallback(async () => {
    if (!validateRepoUrl(repoUrl)) {
      toast.error('Please enter a valid GitHub repository URL.');
      return;
    }

    setIsConnectingRepo(true);
    setFlowchartNodes([]);
    setFlowchartEdges([]);
    setSearchResults([]);
    setSelectedFile(null);
    progressSamplesRef.current = [];

    try {
      const connected = await githubAPI.connectRepository(repoUrl);
      setRepoId(connected.repo_id);
      setProgress({
        status: 'queued',
        files_parsed: 0,
        total_files: 0,
        current_file: '',
        progress: 0,
      });

      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      unsubscribeRef.current = githubAPI.subscribeProgress(connected.repo_id, (message) => {
        handleProgressUpdate(message);
        if (message.status === 'completed') {
          void loadGraph(connected.repo_id, moduleFilter);
        }
      });

      const initial = await githubAPI.fetchStatus(connected.repo_id);
      handleProgressUpdate(initial);
      toast.success(`Repository connected. ID: ${connected.repo_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect repository.';
      toast.error(message);
    } finally {
      setIsConnectingRepo(false);
    }
  }, [githubAPI, handleProgressUpdate, loadGraph, moduleFilter, repoUrl]);

  const cancelAnalysis = useCallback(async () => {
    if (!repoId) return;
    try {
      await githubAPI.cancel(repoId);
      toast.info('Cancel requested.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel analysis.';
      toast.error(message);
    }
  }, [githubAPI, repoId]);

  useEffect(() => {
    if (!repoId) return;

    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      if (!query) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await githubAPI.search(repoId, query);
        setSearchResults((response.results ?? []) as SearchResult[]);
      } catch {
        setSearchResults([]);
      }
    }, 320);

    return () => window.clearTimeout(timer);
  }, [githubAPI, repoId, searchQuery]);

  useEffect(() => {
    if (!repoId || !selectedFile) return;
    void loadFileFlowchart(repoId, selectedFile);
  }, [repoId, selectedFile, loadFileFlowchart]);

  const breadcrumb = useMemo(() => {
    if (!selectedFile) return [];
    return selectedFile.split('/').filter(Boolean);
  }, [selectedFile]);

  const dependencyModules = useMemo(() => {
    const values = new Set<string>();
    for (const node of dependencyNodes) {
      const moduleName = String(node.module ?? node.file_path ?? '').trim();
      if (moduleName) values.add(moduleName);
    }
    return Array.from(values).sort();
  }, [dependencyNodes]);

  return (
    <div className="h-full flex gap-3 min-h-0">
      <div className="w-[360px] shrink-0 rounded-2xl border border-white/10 bg-slate-950/60 p-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              GitHub Analysis
            </h3>
            <p className="text-[11px] text-white/50 mt-1">{oauthMessage}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={connectGitHub} className="rounded-lg px-3 py-1.5 text-xs">
            Connect GitHub
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-[11px] uppercase tracking-widest text-white/50">Repository URL</label>
          <input
            value={repoUrl}
            onChange={(event) => setRepoUrl(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60"
            placeholder="https://github.com/user/repo"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={connectRepository}
              disabled={isConnectingRepo || !isOAuthConnected}
              className="rounded-lg px-3 py-1.5 text-xs"
            >
              {isConnectingRepo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Analyze Repository
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelAnalysis}
              disabled={!repoId || progress.status === 'completed'}
              className="rounded-lg px-3 py-1.5 text-xs text-rose-200 border border-rose-400/30"
            >
              <Square className="w-3.5 h-3.5" />
              Cancel
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-slate-900/60 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-white/50">
            <span>Progress</span>
            <span>{formatEta(etaSeconds)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.max(1, Math.min(100, progress.progress || 0))}%` }}
            />
          </div>
          <div className="text-xs text-white/70">
            {progress.files_parsed} / {progress.total_files} files parsed
          </div>
          <div className="text-[11px] text-white/50 truncate">{progress.current_file || 'Waiting for analysis to start...'}</div>
          {progress.error ? <div className="text-[11px] text-rose-300">{progress.error}</div> : null}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Files</div>
            <div className="text-lg font-semibold text-white">{stats.total_files ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Functions</div>
            <div className="text-lg font-semibold text-white">{stats.total_functions ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-2">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Classes</div>
            <div className="text-lg font-semibold text-white">{stats.total_classes ?? 0}</div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5">
            <Search className="w-3.5 h-3.5 text-white/45" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-transparent text-xs text-white outline-none"
              placeholder="Search function names"
            />
          </div>
          {searchResults.length > 0 ? (
            <div className="mt-2 max-h-36 overflow-y-auto space-y-1">
              {searchResults.map((result) => (
                <button
                  key={`${result.path}:${result.ir_node_id}`}
                  type="button"
                  onClick={() => {
                    setHighlightIrNodeId(result.ir_node_id);
                    setSelectedFile(result.path);
                  }}
                  className="w-full text-left rounded-md px-2 py-1.5 bg-white/5 hover:bg-white/10"
                >
                  <div className="text-xs text-white">{result.name}</div>
                  <div className="text-[11px] text-white/50 truncate">{result.path}:{result.line}</div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-widest text-white/50">File Tree</div>
            <div className="text-[11px] text-white/40">{fileTree.length > 0 ? 'Ready' : 'No files yet'}</div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-slate-900/60 p-2">
            <FileTreeView
              nodes={fileTree}
              selectedFile={selectedFile}
              onSelect={(path) => {
                setHighlightIrNodeId(null);
                setSelectedFile(path);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/50">Dependency Graph Filter</div>
              <div className="text-sm text-white">
                {dependencyNodes.length} nodes, {dependencyEdgesCount} edges
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={moduleFilter}
                onChange={(event) => setModuleFilter(event.target.value)}
                className="w-52 rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1.5 text-xs text-white outline-none"
                placeholder="Filter by directory/module"
              />
              <Button
                size="sm"
                variant="secondary"
                className="rounded-lg px-3 py-1.5 text-xs"
                onClick={() => {
                  if (!repoId) return;
                  void loadGraph(repoId, moduleFilter);
                }}
                disabled={!repoId}
              >
                Apply Filter
              </Button>
            </div>
          </div>
          {dependencyModules.length > 0 ? (
            <div className="mt-2 text-[11px] text-white/50 truncate">
              Modules: {dependencyModules.slice(0, 8).join(', ')}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-3 flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/50">File Flowchart</div>
              <div className="flex items-center gap-1 text-xs text-white/70">
                {breadcrumb.length === 0 ? (
                  <span>Choose a file from the repository tree</span>
                ) : (
                  breadcrumb.map((part, index) => (
                    <span key={`${part}-${index}`} className="inline-flex items-center gap-1">
                      {index > 0 ? <ChevronRight className="w-3 h-3 text-white/35" /> : null}
                      <span className={index === breadcrumb.length - 1 ? 'text-blue-200' : ''}>{part}</span>
                    </span>
                  ))
                )}
              </div>
            </div>
            {isLoadingFileFlowchart ? <Loader2 className="w-4 h-4 animate-spin text-blue-300" /> : null}
          </div>

          <div className="h-[calc(100%-3rem)] rounded-xl border border-white/10 overflow-hidden">
            <ReactFlow
              nodes={flowchartNodes}
              edges={flowchartEdges}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              className="bg-[#020617]"
            >
              <Controls position="top-right" />
              <MiniMap pannable zoomable />
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#334155" />
            </ReactFlow>
          </div>
        </div>
      </div>
    </div>
  );
}
