import { useCallback, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

export interface GitHubProgressPayload {
  status: string;
  files_parsed: number;
  total_files: number;
  current_file: string;
  progress: number;
  error?: string | null;
}

interface GraphResponse {
  status: string;
  repo_id: string;
  cursor?: string | null;
  next_cursor?: string | null;
  total_nodes: number;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  module_relationships?: Array<Record<string, unknown>>;
  file_tree?: Array<Record<string, unknown>>;
  stats?: Record<string, number>;
}

async function fetchToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE}/api/v1/login`, { method: 'POST' });
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token as string;
  } catch {
    return null;
  }
}

function encodePathSegment(path: string): string {
  return path
    .split('/')
    .map((item) => encodeURIComponent(item))
    .join('/');
}

export function useGithubAPI() {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    void fetchToken().then((token) => {
      tokenRef.current = token;
    });
  }, []);

  const ensureToken = useCallback(async () => {
    if (!tokenRef.current) {
      tokenRef.current = await fetchToken();
    }
    return tokenRef.current;
  }, []);

  const connectGitHub = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const token = await ensureToken();
    if (!token) {
      return { ok: false, message: 'Failed to create auth token.' };
    }

    return await new Promise((resolve) => {
      const popup = window.open(
        `${API_BASE}/api/v1/github/auth?access_token=${encodeURIComponent(token)}`,
        'github-oauth',
        'width=560,height=720,left=200,top=100'
      );

      if (!popup) {
        resolve({ ok: false, message: 'Popup blocked. Please allow popups for this site.' });
        return;
      }

      let settled = false;

      const finish = (ok: boolean, message: string) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        try {
          popup.close();
        } catch {
          // no-op
        }
        resolve({ ok, message });
      };

      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          finish(false, 'OAuth popup closed before completion.');
        }
      }, 300);

      const onMessage = (event: MessageEvent) => {
        const data = event.data as { status?: string; message?: string } | null;
        if (!data || typeof data !== 'object') return;
        if (data.status === 'success') {
          window.clearInterval(timer);
          finish(true, data.message ?? 'GitHub connected.');
        }
        if (data.status === 'error') {
          window.clearInterval(timer);
          finish(false, data.message ?? 'GitHub OAuth failed.');
        }
      };

      window.addEventListener('message', onMessage);
    });
  }, [ensureToken]);

  const connectRepository = useCallback(async (repoUrl: string): Promise<{ repo_id: string }> => {
    const token = await ensureToken();
    const response = await fetch(`${API_BASE}/api/v1/github/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ repo_url: repoUrl }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `Connect failed (${response.status})`);
    }

    return await response.json();
  }, [ensureToken]);

  const fetchStatus = useCallback(async (repoId: string): Promise<GitHubProgressPayload> => {
    const token = await ensureToken();
    const response = await fetch(`${API_BASE}/api/v1/github/${repoId}/status`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `Status fetch failed (${response.status})`);
    }

    const payload = await response.json();
    return {
      status: payload.status,
      files_parsed: payload.files_parsed,
      total_files: payload.total_files,
      current_file: payload.current_file,
      progress: payload.progress,
    };
  }, [ensureToken]);

  const subscribeProgress = useCallback((repoId: string, onMessage: (payload: GitHubProgressPayload) => void) => {
    const ws = new WebSocket(`${WS_BASE}/ws/github/${repoId}`);

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as GitHubProgressPayload;
        onMessage(parsed);
      } catch {
        // no-op
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const fetchGraph = useCallback(async (
    repoId: string,
    params: {
      cursor?: string | null;
      limit?: number;
      module?: string;
    } = {}
  ): Promise<GraphResponse> => {
    const token = await ensureToken();
    const query = new URLSearchParams();
    if (params.cursor) query.set('cursor', params.cursor);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.module) query.set('module', params.module);

    const response = await fetch(`${API_BASE}/api/v1/github/${repoId}/graph?${query.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `Graph fetch failed (${response.status})`);
    }

    return await response.json();
  }, [ensureToken]);

  const fetchFileFlowchart = useCallback(async (repoId: string, path: string) => {
    const token = await ensureToken();
    const safePath = encodePathSegment(path);
    const response = await fetch(`${API_BASE}/api/v1/github/${repoId}/file/${safePath}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `File flowchart fetch failed (${response.status})`);
    }

    return await response.json();
  }, [ensureToken]);

  const search = useCallback(async (
    repoId: string,
    query: string,
    cursor?: string | null,
    limit = 20,
  ) => {
    const token = await ensureToken();
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${API_BASE}/api/v1/github/${repoId}/search?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `Search failed (${response.status})`);
    }

    return await response.json();
  }, [ensureToken]);

  const cancel = useCallback(async (repoId: string) => {
    const token = await ensureToken();
    const response = await fetch(`${API_BASE}/api/v1/github/${repoId}/cancel`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail?.detail ?? `Cancel failed (${response.status})`);
    }
    return await response.json();
  }, [ensureToken]);

  return {
    connectGitHub,
    connectRepository,
    fetchStatus,
    subscribeProgress,
    fetchGraph,
    fetchFileFlowchart,
    search,
    cancel,
  };
}
