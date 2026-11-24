import type {
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  SyncSocketEvent,
  VpnCodeRecord,
} from '../types/vpn';

const LEGACY_SESSION_TOKEN_STORAGE_KEY = 'vexton_admin_session_token_v1';

export type SyncConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface WorkspacePayload {
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
  architecture: ServerArchitectureConfig;
  revision?: number;
  connectedDevices?: number;
  serverTime?: string;
}

function clearLegacySessionTokenStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_SESSION_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage restriction errors
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Требуется авторизация администратора') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ServerRequestError extends Error {
  readonly status: number;
  readonly errorCode?: string;

  constructor(message: string, status: number, errorCode?: string) {
    super(message);
    this.name = 'ServerRequestError';
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function parseFailedResponse(
  res: Response,
  fallbackMessage: string
): Promise<never> {
  if (res.status === 401) {
    throw new UnauthorizedError();
  }
  let message = fallbackMessage;
  let errorCode: string | undefined;
  try {
    const data = (await res.json()) as { error?: unknown; errorCode?: unknown };
    if (typeof data.error === 'string' && data.error.trim()) {
      message = data.error.trim();
    }
    if (typeof data.errorCode === 'string' && data.errorCode.trim()) {
      errorCode = data.errorCode.trim();
    }
  } catch {
    // Response may not be JSON
  }
  throw new ServerRequestError(message, res.status, errorCode);
}

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
    cache: 'no-store',
    credentials: 'include',
  });
}

export async function checkAdminSession(): Promise<{
  authenticated: boolean;
  username?: string;
  connectedDevices?: number;
}> {
  clearLegacySessionTokenStorage();
  try {
    const res = await apiFetch('/api/auth/me', { method: 'GET' });
    if (!res.ok) {
      return { authenticated: false };
    }
    const data = (await res.json()) as {
      authenticated?: boolean;
      username?: string;
      connectedDevices?: number;
    };
    return {
      authenticated: data.authenticated === true,
      username: data.username,
      connectedDevices: data.connectedDevices,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function loginAdmin(
  username: string,
  password: string
): Promise<{
  authenticated: boolean;
  username?: string;
  errorCode?: 'EMPTY' | 'INVALID_CREDENTIALS' | 'SERVER_ERROR' | 'SERVER_CONFIG_ERROR';
}> {
  if (!password.trim()) {
    return { authenticated: false, errorCode: 'EMPTY' };
  }
  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: username.trim() || 'admin',
        password,
      }),
    });
    const data = (await res.json()) as {
      authenticated?: boolean;
      username?: string;
      errorCode?: 'EMPTY' | 'INVALID_CREDENTIALS' | 'SERVER_CONFIG_ERROR';
    };

    if (!res.ok || !data.authenticated) {
      return {
        authenticated: false,
        errorCode:
          data.errorCode ?? (res.status === 503 ? 'SERVER_CONFIG_ERROR' : 'INVALID_CREDENTIALS'),
      };
    }

    clearLegacySessionTokenStorage();
    return {
      authenticated: true,
      username: data.username,
    };
  } catch {
    return { authenticated: false, errorCode: 'SERVER_ERROR' };
  }
}

export async function logoutAdmin(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Best-effort server logout
  } finally {
    clearLegacySessionTokenStorage();
  }
}

export async function fetchWorkspaceFromServer(): Promise<WorkspacePayload> {
  const res = await apiFetch('/api/workspace', { method: 'GET' });
  if (!res.ok) await parseFailedResponse(res, 'Не удалось загрузить данные с сервера');
  return (await res.json()) as WorkspacePayload;
}

export async function migrateLegacyWorkspaceToServer(payload: {
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
}): Promise<WorkspacePayload & { importedCodes: number; importedTemplates: number }> {
  const res = await apiFetch('/api/sync/migrate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseFailedResponse(res, 'Не удалось перенести данные на сервер');
  return (await res.json()) as WorkspacePayload & {
    importedCodes: number;
    importedTemplates: number;
  };
}

export async function createCodeOnServer(
  record: VpnCodeRecord
): Promise<VpnCodeRecord> {
  const res = await apiFetch('/api/codes', {
    method: 'POST',
    body: JSON.stringify(record),
  });
  if (!res.ok) await parseFailedResponse(res, 'Сервер не подтвердил сохранение VPN-кода');
  const data = (await res.json()) as { record: VpnCodeRecord };
  return data.record;
}

export async function updateCodeOnServer(
  id: string,
  patch: Partial<VpnCodeRecord>
): Promise<VpnCodeRecord> {
  const res = await apiFetch(`/api/codes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  if (!res.ok) await parseFailedResponse(res, 'Сервер не подтвердил обновление VPN-кода');
  const data = (await res.json()) as { record: VpnCodeRecord };
  return data.record;
}

export async function deleteCodeOnServer(id: string): Promise<void> {
  const res = await apiFetch(`/api/codes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await parseFailedResponse(res, 'Сервер не подтвердил удаление VPN-кода');
}

export async function clearAllCodesOnServer(): Promise<void> {
  const res = await apiFetch('/api/codes', { method: 'DELETE' });
  if (!res.ok) await parseFailedResponse(res, 'Сервер не подтвердил очистку кодов');
}

export async function upsertTemplateOnServer(
  template: ProtocolConfigTemplate
): Promise<ProtocolConfigTemplate> {
  const res = await apiFetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
  if (!res.ok) {
    await parseFailedResponse(res, 'Сервер не подтвердил сохранение конфигурации сервера');
  }
  const data = (await res.json()) as { template: ProtocolConfigTemplate };
  return data.template;
}

export async function deleteTemplateOnServer(id: string): Promise<void> {
  const res = await apiFetch(`/api/templates/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    await parseFailedResponse(res, 'Сервер не подтвердил удаление конфигурации сервера');
  }
}

export async function saveArchitectureOnServer(
  config: ServerArchitectureConfig
): Promise<ServerArchitectureConfig> {
  const res = await apiFetch('/api/architecture', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
  if (!res.ok) await parseFailedResponse(res, 'Сервер не подтвердил сохранение настроек');
  const data = (await res.json()) as { architecture: ServerArchitectureConfig };
  return data.architecture;
}

export interface SyncSocketSubscription {
  close: () => void;
  markMutation: (revision?: number) => void;
}

const POLL_INTERVAL_MS = 4000;

export function subscribeToRealtimeSync(callbacks: {
  onEvent: (event: SyncSocketEvent) => void;
  onStatusChange: (status: SyncConnectionStatus) => void;
  onReconnectResync: () => void;
  initialRevision?: number;
}): SyncSocketSubscription {
  let closedByUser = false;
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let pollTimer: number | null = null;
  let attempt = 0;
  let hasConnectedOnce = false;
  let pollingActive = false;
  let lastSnapshotSignature = '';
  let pollInFlight = false;
  let mutationEpoch = 0;
  let latestRevision = callbacks.initialRevision ?? 0;

  const stopPolling = () => {
    pollingActive = false;
    if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const runPollCycle = async () => {
    if (closedByUser || !pollingActive) return;
    if (pollInFlight) {
      scheduleNextPoll();
      return;
    }

    const epochAtStart = mutationEpoch;
    pollInFlight = true;
    try {
      const workspace = await fetchWorkspaceFromServer();
      if (closedByUser || !pollingActive) return;

      callbacks.onStatusChange('connected');

      // Discard stale poll response if a local write finished while this GET was in flight
      if (epochAtStart !== mutationEpoch) {
        return;
      }

      if (typeof workspace.revision === 'number') {
        if (workspace.revision < latestRevision) {
          return;
        }
        latestRevision = workspace.revision;
      }

      const signature = JSON.stringify({
        codes: workspace.codes,
        blockTemplates: workspace.blockTemplates,
        architecture: workspace.architecture,
      });

      if (signature !== lastSnapshotSignature) {
        lastSnapshotSignature = signature;
        callbacks.onEvent({
          type: 'workspace:sync',
          codes: workspace.codes,
          blockTemplates: workspace.blockTemplates,
          architecture: workspace.architecture,
          revision: workspace.revision,
        });
      }
    } catch (err) {
      if (closedByUser || !pollingActive) return;
      if (err instanceof UnauthorizedError) {
        callbacks.onStatusChange('offline');
        stopPolling();
        callbacks.onReconnectResync();
        return;
      }
      callbacks.onStatusChange('reconnecting');
    } finally {
      pollInFlight = false;
      if (!closedByUser && pollingActive) {
        scheduleNextPoll();
      }
    }
  };

  const scheduleNextPoll = () => {
    if (closedByUser || !pollingActive) return;
    if (pollTimer !== null) {
      window.clearTimeout(pollTimer);
    }
    const interval = document.visibilityState === 'hidden' ? 12_000 : POLL_INTERVAL_MS;
    pollTimer = window.setTimeout(() => {
      pollTimer = null;
      void runPollCycle();
    }, interval);
  };

  const handleVisibilityOrFocus = () => {
    if (closedByUser || !pollingActive) return;
    if (document.visibilityState === 'visible') {
      void runPollCycle();
    }
  };

  const startPolling = () => {
    if (closedByUser || pollingActive) return;
    pollingActive = true;
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    void runPollCycle();
  };

  const connectWebSocket = () => {
    if (closedByUser || pollingActive) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${wsProtocol}//${window.location.host}/ws`;

    try {
      socket = new WebSocket(url);
    } catch {
      callbacks.onStatusChange('reconnecting');
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      attempt = 0;
      callbacks.onStatusChange('connected');
      if (hasConnectedOnce) {
        callbacks.onReconnectResync();
      }
      hasConnectedOnce = true;
    };

    socket.onmessage = (messageEvent) => {
      try {
        const parsed = JSON.parse(String(messageEvent.data)) as SyncSocketEvent;
        if (parsed && typeof parsed.type === 'string') {
          callbacks.onEvent(parsed);
        }
      } catch {
        // Ignore malformed frame
      }
    };

    socket.onclose = () => {
      if (closedByUser || pollingActive) {
        if (closedByUser) callbacks.onStatusChange('offline');
        return;
      }
      if (!hasConnectedOnce && attempt >= 2) {
        startPolling();
        return;
      }
      callbacks.onStatusChange('reconnecting');
      scheduleReconnect();
    };

    socket.onerror = () => {
      // onclose handles reconnection
    };
  };

  const scheduleReconnect = () => {
    if (closedByUser || pollingActive) return;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
    }
    const delayMs = Math.min(10_000, 1000 * Math.pow(2, Math.min(attempt, 4)));
    attempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectWebSocket();
    }, delayMs);
  };

  // Detect server realtime capability (WebSocket on Express vs HTTP polling on Netlify Functions)
  void (async () => {
    try {
      const res = await apiFetch('/api/health', { method: 'GET' });
      if (closedByUser) return;
      if (res.ok) {
        const health = (await res.json()) as { realtime?: string };
        if (health.realtime === 'polling') {
          startPolling();
          return;
        }
      }
    } catch {
      // Fall back to WebSocket attempt first
    }
    if (!closedByUser) {
      connectWebSocket();
    }
  })();

  return {
    markMutation: (revision?: number) => {
      mutationEpoch += 1;
      lastSnapshotSignature = '';
      if (typeof revision === 'number' && revision > latestRevision) {
        latestRevision = revision;
      }
    },
    close: () => {
      closedByUser = true;
      stopPolling();
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
      callbacks.onStatusChange('offline');
    },
  };
}
