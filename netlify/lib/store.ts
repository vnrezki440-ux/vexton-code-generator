import { getStore } from '@netlify/blobs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  VpnCodeRecord,
} from '../../src/types/vpn.ts';

export const DEFAULT_NETLIFY_ARCHITECTURE: ServerArchitectureConfig = {
  adapterMode: 'rest_api_ready',
  apiBaseUrl: '',
  authHeaderName: 'Authorization',
  autoPingOnCreate: true,
  syncEndpointPath: '/api/workspace',
  convertVlessToBase64: false,
};

export interface StoredSessionRecord {
  username: string;
  createdAt: string;
  expiresAt: string;
}

export interface VextonWorkspaceState {
  revision: number;
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
  architecture: ServerArchitectureConfig;
  sessions: Record<string, StoredSessionRecord>;
  revokedSessions: Record<string, string>;
}

export interface WorkspaceStore {
  readonly backendName: string;
  load(): Promise<VextonWorkspaceState>;
  mutate<T>(
    mutator: (state: VextonWorkspaceState) => { nextState: VextonWorkspaceState; result: T }
  ): Promise<T>;
}

export class PersistentStorageUnavailableError extends Error {
  constructor(
    message = 'Постоянное серверное хранилище (Netlify Blobs / Upstash Redis) не настроено'
  ) {
    super(message);
    this.name = 'PersistentStorageUnavailableError';
  }
}

export function createEmptyWorkspaceState(): VextonWorkspaceState {
  return {
    revision: 0,
    codes: [],
    blockTemplates: [],
    architecture: { ...DEFAULT_NETLIFY_ARCHITECTURE },
    sessions: {},
    revokedSessions: {},
  };
}

export function normalizeWorkspaceState(raw: unknown): VextonWorkspaceState {
  if (!raw || typeof raw !== 'object') {
    return createEmptyWorkspaceState();
  }
  const obj = raw as Partial<VextonWorkspaceState>;
  const revision =
    typeof obj.revision === 'number' && Number.isFinite(obj.revision) && obj.revision >= 0
      ? Math.trunc(obj.revision)
      : 0;
  return {
    revision,
    codes: Array.isArray(obj.codes) ? obj.codes : [],
    blockTemplates: Array.isArray(obj.blockTemplates) ? obj.blockTemplates : [],
    architecture:
      obj.architecture && typeof obj.architecture === 'object'
        ? { ...DEFAULT_NETLIFY_ARCHITECTURE, ...obj.architecture }
        : { ...DEFAULT_NETLIFY_ARCHITECTURE },
    sessions:
      obj.sessions && typeof obj.sessions === 'object' && !Array.isArray(obj.sessions)
        ? obj.sessions
        : {},
    revokedSessions:
      obj.revokedSessions &&
      typeof obj.revokedSessions === 'object' &&
      !Array.isArray(obj.revokedSessions)
        ? obj.revokedSessions
        : {},
  };
}

export function pruneWorkspaceSessions(state: VextonWorkspaceState): VextonWorkspaceState {
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const nextSessions: Record<string, StoredSessionRecord> = {};
  for (const [hash, session] of Object.entries(state.sessions)) {
    if (session && typeof session.expiresAt === 'string' && session.expiresAt > nowIso) {
      nextSessions[hash] = session;
    }
  }

  const nextRevoked: Record<string, string> = {};
  for (const [hash, revokedAt] of Object.entries(state.revokedSessions)) {
    if (typeof revokedAt === 'string' && revokedAt > cutoffIso) {
      nextRevoked[hash] = revokedAt;
    }
  }

  return {
    ...state,
    sessions: nextSessions,
    revokedSessions: nextRevoked,
  };
}

function finalizeMutatedState(
  previousState: VextonWorkspaceState,
  candidateState: VextonWorkspaceState
): VextonWorkspaceState {
  const normalized = pruneWorkspaceSessions(normalizeWorkspaceState(candidateState));
  return {
    ...normalized,
    revision: Math.max(previousState.revision, normalized.revision) + 1,
  };
}

/**
 * In-memory workspace store for deterministic unit testing.
 */
export class MemoryWorkspaceStore implements WorkspaceStore {
  readonly backendName = 'memory';
  private state: VextonWorkspaceState;

  constructor(initial?: VextonWorkspaceState) {
    this.state = initial ? normalizeWorkspaceState(initial) : createEmptyWorkspaceState();
  }

  async load(): Promise<VextonWorkspaceState> {
    return structuredClone(this.state);
  }

  async mutate<T>(
    mutator: (state: VextonWorkspaceState) => { nextState: VextonWorkspaceState; result: T }
  ): Promise<T> {
    const current = structuredClone(this.state);
    const { nextState, result } = mutator(current);
    this.state = finalizeMutatedState(current, nextState);
    return result;
  }
}

/**
 * Built-in Netlify Blobs store with strong consistency and ETag optimistic concurrency control
 * so multi-user/multi-device updates never overwrite each other.
 */
export class NetlifyBlobsWorkspaceStore implements WorkspaceStore {
  readonly backendName = 'netlify-blobs';
  private readonly storeName = 'vexton-vpn-store';
  private readonly blobKey = 'workspace-v1';

  private createClientStore(consistency: 'strong' | 'eventual' = 'strong') {
    const siteID = (process.env.NETLIFY_SITE_ID || '').trim();
    const token = (process.env.NETLIFY_AUTH_TOKEN || '').trim();
    if (siteID && token) {
      return getStore({ name: this.storeName, consistency, siteID, token });
    }
    return getStore({ name: this.storeName, consistency });
  }

  private isConsistencyUnavailableError(err: unknown): boolean {
    return Boolean(
      err &&
        typeof err === 'object' &&
        'name' in err &&
        (err as { name?: unknown }).name === 'BlobsConsistencyError'
    );
  }

  async load(): Promise<VextonWorkspaceState> {
    const store = this.createClientStore('strong');
    try {
      const raw = await store.get(this.blobKey, { type: 'json', consistency: 'strong' });
      return normalizeWorkspaceState(raw);
    } catch (err) {
      if (this.isConsistencyUnavailableError(err)) {
        const raw = await store.get(this.blobKey, { type: 'json', consistency: 'eventual' });
        return normalizeWorkspaceState(raw);
      }
      throw err;
    }
  }

  async mutate<T>(
    mutator: (state: VextonWorkspaceState) => { nextState: VextonWorkspaceState; result: T }
  ): Promise<T> {
    const store = this.createClientStore('strong');
    const maxAttempts = 8;
    let consistency: 'strong' | 'eventual' = 'strong';

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let existing: Awaited<ReturnType<typeof store.getWithMetadata>> | null = null;
      try {
        existing = await store.getWithMetadata(this.blobKey, {
          type: 'json',
          consistency,
        });
      } catch (err) {
        if (consistency === 'strong' && this.isConsistencyUnavailableError(err)) {
          consistency = 'eventual';
          existing = await store.getWithMetadata(this.blobKey, {
            type: 'json',
            consistency: 'eventual',
          });
        } else {
          throw err;
        }
      }

      const currentState = normalizeWorkspaceState(existing?.data);
      const { nextState, result } = mutator(currentState);
      const cleaned = finalizeMutatedState(currentState, nextState);

      const writeRes = existing?.etag
        ? await store.setJSON(this.blobKey, cleaned, { onlyIfMatch: existing.etag })
        : await store.setJSON(this.blobKey, cleaned, { onlyIfNew: true });

      if (writeRes.modified) {
        return result;
      }

      await new Promise((resolve) => setTimeout(resolve, 25 + attempt * 20));
    }

    throw new Error('Failed to commit workspace update due to concurrent modifications');
  }
}

/**
 * Optional Upstash Redis REST backend for external multi-region strong consistency on Netlify.
 */
export class UpstashRedisWorkspaceStore implements WorkspaceStore {
  readonly backendName = 'upstash-redis';
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly key = 'vexton:workspace:v1';

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  private async runCommand<T>(command: unknown[]): Promise<T> {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!res.ok) {
      throw new Error(`Upstash Redis HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { result?: T; error?: string };
    if (payload.error) {
      throw new Error(`Upstash Redis error: ${payload.error}`);
    }
    return payload.result as T;
  }

  async load(): Promise<VextonWorkspaceState> {
    const raw = await this.runCommand<string | null>(['GET', this.key]);
    if (!raw) return createEmptyWorkspaceState();
    try {
      return normalizeWorkspaceState(JSON.parse(raw));
    } catch {
      return createEmptyWorkspaceState();
    }
  }

  async mutate<T>(
    mutator: (state: VextonWorkspaceState) => { nextState: VextonWorkspaceState; result: T }
  ): Promise<T> {
    const current = await this.load();
    const { nextState, result } = mutator(current);
    const cleaned = finalizeMutatedState(current, nextState);
    await this.runCommand(['SET', this.key, JSON.stringify(cleaned)]);
    return result;
  }
}

/**
 * Pure Node fs JSON fallback (no node:sqlite dependency) for local `netlify dev` ONLY.
 */
export class JsonFileWorkspaceStore implements WorkspaceStore {
  readonly backendName = 'json-file-local';
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath =
      filePath ||
      process.env.VEXTON_LOCAL_STATE_PATH ||
      path.resolve(process.cwd(), '.netlify', 'vexton-local-state.json');
  }

  async load(): Promise<VextonWorkspaceState> {
    try {
      if (!fs.existsSync(this.filePath)) {
        return createEmptyWorkspaceState();
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return normalizeWorkspaceState(JSON.parse(raw));
    } catch {
      return createEmptyWorkspaceState();
    }
  }

  async mutate<T>(
    mutator: (state: VextonWorkspaceState) => { nextState: VextonWorkspaceState; result: T }
  ): Promise<T> {
    const current = await this.load();
    const { nextState, result } = mutator(current);
    const cleaned = finalizeMutatedState(current, nextState);
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(cleaned, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
    return result;
  }
}

export function isServerlessProductionRuntime(): boolean {
  return Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY === 'true' ||
      (process.env.CONTEXT || '').trim() ||
      (process.env.DEPLOY_ID || '').trim()
  );
}

export function resolveNetlifyWorkspaceStore(): WorkspaceStore {
  const upstashUrl = (process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const upstashToken = (process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (upstashUrl && upstashToken) {
    return new UpstashRedisWorkspaceStore(upstashUrl, upstashToken);
  }

  const hasNetlifyBlobsContext =
    Boolean((globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext) ||
    Boolean((process.env.NETLIFY_BLOBS_CONTEXT || '').trim()) ||
    Boolean((process.env.NETLIFY_SITE_ID || '').trim() && (process.env.NETLIFY_AUTH_TOKEN || '').trim());

  if (hasNetlifyBlobsContext) {
    return new NetlifyBlobsWorkspaceStore();
  }

  if (isServerlessProductionRuntime()) {
    throw new PersistentStorageUnavailableError();
  }

  return new JsonFileWorkspaceStore();
}
