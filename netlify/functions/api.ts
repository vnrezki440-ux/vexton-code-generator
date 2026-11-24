import net from 'node:net';
import {
  extractCandidateSessionTokens,
  generateSessionToken,
  getMissingRequiredAuthEnvVars,
  getServerAuthConfig,
  hashSessionToken,
  isStrictAuthEnvRequired,
  SESSION_COOKIE_NAME,
  SESSION_RENEW_INTERVAL_MS,
  SESSION_TTL_MS,
  verifyAdminCredentials,
  verifyBlockSecurityKey,
  verifySignedSessionToken,
} from '../../server/auth.ts';
import type {
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  TimeUnit,
  VpnCodeRecord,
  VpnProtocol,
} from '../../src/types/vpn.ts';
import { normalizeVpnCountry, VPN_PROTOCOLS } from '../../src/utils/vpnParser.ts';
import {
  PersistentStorageUnavailableError,
  resolveNetlifyWorkspaceStore,
  type VextonWorkspaceState,
  type WorkspaceStore,
} from '../lib/store.ts';

function normalizeProtocol(value: unknown): VpnProtocol {
  return typeof value === 'string' && VPN_PROTOCOLS.includes(value as VpnProtocol)
    ? (value as VpnProtocol)
    : 'VLESS';
}

function normalizeTimeUnit(value: unknown): TimeUnit {
  if (value === 'minutes' || value === 'hours' || value === 'days') {
    return value;
  }
  return 'days';
}

function isForbiddenHost(host: string): boolean {
  const lower = host.trim().toLowerCase();
  return (
    !lower ||
    lower === '169.254.169.254' ||
    lower === 'metadata.google.internal' ||
    /\s/.test(lower)
  );
}

function measureTcpPing(
  host: string,
  port: number,
  timeoutMs: number = 4000
): Promise<{
  reachable: boolean;
  latencyMs: number | null;
  errorCode?: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (result: {
      reachable: boolean;
      latencyMs: number | null;
      errorCode?: string;
      error?: string;
    }) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const elapsed = Math.max(1, Math.round(performance.now() - start));
      finish({ reachable: true, latencyMs: elapsed });
    });

    socket.on('timeout', () => {
      finish({
        reachable: false,
        latencyMs: null,
        errorCode: 'TIMEOUT',
        error: `Превышен таймаут ожидания (${timeoutMs / 1000} с)`,
      });
    });

    socket.on('error', (err: NodeJS.ErrnoException) => {
      const code = err.code || 'ERR_NETWORK';
      const errorCode =
        code === 'ECONNREFUSED'
          ? 'CONNREFUSED'
          : code === 'ENOTFOUND'
            ? 'NOTFOUND'
            : code === 'EHOSTUNREACH' || code === 'ENETUNREACH'
              ? 'UNREACHABLE'
              : 'NETWORK';
      const readableError =
        code === 'ECONNREFUSED'
          ? 'Сервер отклонил подключение (порт закрыт)'
          : code === 'ENOTFOUND'
            ? 'Доменное имя сервера не найдено (DNS)'
            : code === 'EHOSTUNREACH' || code === 'ENETUNREACH'
              ? 'Сервер недоступен по сети'
              : `Сервер недоступен (${code})`;
      finish({
        reachable: false,
        latencyMs: null,
        errorCode,
        error: readableError,
      });
    });
  });
}

function isHttpsWebRequest(req: Request): boolean {
  const url = new URL(req.url);
  if (url.protocol === 'https:') return true;
  const xfProto = String(req.headers.get('x-forwarded-proto') || '').toLowerCase();
  if (xfProto.includes('https')) return true;
  const origin = String(req.headers.get('origin') || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.get('referer') || '').toLowerCase();
  if (referer.startsWith('https://')) return true;
  const host = String(req.headers.get('host') || '').toLowerCase();
  if (host.endsWith('.netlify.app') || host.endsWith('.run.app')) return true;
  return false;
}

function isCrossSiteIframeWebRequest(req: Request): boolean {
  const fetchSite = String(req.headers.get('sec-fetch-site') || '').toLowerCase();
  const fetchDest = String(req.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (fetchSite === 'cross-site' || fetchDest === 'iframe') return true;
  const host = String(req.headers.get('host') || '').toLowerCase();
  return host.endsWith('.run.app');
}

function buildSessionCookieHeader(
  req: Request,
  token: string,
  maxAgeSeconds: number
): string {
  const isHttps = isHttpsWebRequest(req);
  const sameSite = isHttps
    ? isCrossSiteIframeWebRequest(req)
      ? 'SameSite=None; Secure; Partitioned'
      : 'SameSite=Lax; Secure'
    : 'SameSite=Lax';
  const expiryAttr =
    maxAgeSeconds <= 0
      ? 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      : `Max-Age=${maxAgeSeconds}`;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${expiryAttr}; ${sameSite}`;
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      ...extraHeaders,
    },
  });
}

function normalizeApiPath(rawUrl: string): string {
  const url = new URL(rawUrl);
  let pathname = url.pathname;
  if (pathname.startsWith('/.netlify/functions/api')) {
    pathname = `/api${pathname.slice('/.netlify/functions/api'.length)}`;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return pathname;
}

function extractTokensFromWebRequest(req: Request): string[] {
  return extractCandidateSessionTokens({
    headers: {
      cookie: req.headers.get('cookie') ?? undefined,
      authorization: req.headers.get('authorization') ?? undefined,
    },
  });
}

interface AuthSessionInfo {
  token: string;
  tokenHash: string;
  username: string;
  expiresAt: string;
}

export function createNetlifyApiHandler(store: WorkspaceStore) {
  const authenticateFromState = (
    req: Request,
    state: VextonWorkspaceState
  ): AuthSessionInfo | null => {
    const candidates = extractTokensFromWebRequest(req);
    const nowIso = new Date().toISOString();

    for (const token of candidates) {
      const tokenHash = hashSessionToken(token);
      if (state.revokedSessions[tokenHash]) {
        continue;
      }

      const stored = state.sessions[tokenHash];
      if (stored && stored.expiresAt > nowIso) {
        return {
          token,
          tokenHash,
          username: stored.username,
          expiresAt: stored.expiresAt,
        };
      }

      const signed = verifySignedSessionToken(token);
      if (signed) {
        return {
          token,
          tokenHash,
          username: signed.username,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        };
      }
    }

    return null;
  };

  const maybeRenewSession = async (
    req: Request,
    auth: AuthSessionInfo,
    forceCookieRefresh: boolean
  ): Promise<{ auth: AuthSessionInfo; setCookie?: string }> => {
    const now = Date.now();
    const expMs = new Date(auth.expiresAt).getTime();
    const shouldExtendDb =
      Number.isNaN(expMs) || expMs - now < SESSION_TTL_MS - SESSION_RENEW_INTERVAL_MS;

    const signed = verifySignedSessionToken(auth.token, now);
    const shouldRotate = signed !== null && signed.exp - now < SESSION_TTL_MS / 2;

    if (shouldRotate) {
      const nextToken = generateSessionToken(auth.username, SESSION_TTL_MS);
      const nextHash = hashSessionToken(nextToken);
      const nextExpiresAt = new Date(now + SESSION_TTL_MS).toISOString();
      const graceExpiresAt = new Date(now + 120_000).toISOString();

      await store.mutate((state) => {
        const nextSessions = {
          ...state.sessions,
          [auth.tokenHash]: {
            username: auth.username,
            createdAt: state.sessions[auth.tokenHash]?.createdAt ?? new Date(now).toISOString(),
            expiresAt: graceExpiresAt,
          },
          [nextHash]: {
            username: auth.username,
            createdAt: new Date(now).toISOString(),
            expiresAt: nextExpiresAt,
          },
        };
        return {
          nextState: { ...state, sessions: nextSessions },
          result: null,
        };
      });

      return {
        auth: {
          token: nextToken,
          tokenHash: nextHash,
          username: auth.username,
          expiresAt: nextExpiresAt,
        },
        setCookie: buildSessionCookieHeader(
          req,
          nextToken,
          Math.floor(SESSION_TTL_MS / 1000)
        ),
      };
    }

    if (shouldExtendDb || forceCookieRefresh) {
      let updatedExpiresAt = auth.expiresAt;
      if (shouldExtendDb) {
        updatedExpiresAt = new Date(now + SESSION_TTL_MS).toISOString();
        await store.mutate((state) => ({
          nextState: {
            ...state,
            sessions: {
              ...state.sessions,
              [auth.tokenHash]: {
                username: auth.username,
                createdAt:
                  state.sessions[auth.tokenHash]?.createdAt ?? new Date(now).toISOString(),
                expiresAt: updatedExpiresAt,
              },
            },
          },
          result: null,
        }));
      }

      return {
        auth: { ...auth, expiresAt: updatedExpiresAt },
        setCookie: buildSessionCookieHeader(
          req,
          auth.token,
          Math.floor(SESSION_TTL_MS / 1000)
        ),
      };
    }

    return { auth };
  };

  return async function handleRequest(req: Request): Promise<Response> {
    try {
      const method = req.method.toUpperCase();
      const apiPath = normalizeApiPath(req.url);

      // Public health check
      if (method === 'GET' && apiPath === '/api/health') {
        const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
        return jsonResponse({
          ok: true,
          service: 'vexton-vpn-code-generator',
          database: store.backendName,
          storagePersistent: store.backendName !== 'json-file-local',
          realtime: 'polling',
          connectedDevices: 1,
          authConfigured: missingEnvVars.length === 0,
          ...(missingEnvVars.length > 0 ? { missingAuthEnvVars: missingEnvVars } : {}),
        });
      }

    // Login
    if (method === 'POST' && apiPath === '/api/auth/login') {
      const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
      if (missingEnvVars.length > 0) {
        return jsonResponse(
          {
            authenticated: false,
            errorCode: 'SERVER_CONFIG_ERROR',
            missingEnvVars,
          },
          503
        );
      }

      const body = (await req.json().catch(() => ({}))) as {
        username?: unknown;
        password?: unknown;
      };
      const username =
        typeof body.username === 'string' && body.username.trim()
          ? body.username.trim()
          : getServerAuthConfig().adminUser;
      const password = typeof body.password === 'string' ? body.password : '';

      if (!password.trim()) {
        return jsonResponse({ authenticated: false, errorCode: 'EMPTY' }, 400);
      }

      if (!verifyAdminCredentials(username, password)) {
        return jsonResponse(
          { authenticated: false, errorCode: 'INVALID_CREDENTIALS' },
          401
        );
      }

      const token = generateSessionToken(username, SESSION_TTL_MS);
      const tokenHash = hashSessionToken(token);
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

      await store.mutate((state) => ({
        nextState: {
          ...state,
          sessions: {
            ...state.sessions,
            [tokenHash]: { username, createdAt: nowIso, expiresAt },
          },
        },
        result: null,
      }));

      return jsonResponse(
        { authenticated: true, username, expiresAt },
        200,
        {
          'Set-Cookie': buildSessionCookieHeader(
            req,
            token,
            Math.floor(SESSION_TTL_MS / 1000)
          ),
        }
      );
    }

    // Session check + sliding renewal
    if (method === 'GET' && apiPath === '/api/auth/me') {
      const state = await store.load();
      const auth = authenticateFromState(req, state);
      if (!auth) {
        return jsonResponse({ authenticated: false });
      }
      const renewed = await maybeRenewSession(req, auth, true);
      const headers: Record<string, string> = {};
      if (renewed.setCookie) {
        headers['Set-Cookie'] = renewed.setCookie;
      }
      return jsonResponse(
        {
          authenticated: true,
          username: renewed.auth.username,
          expiresAt: renewed.auth.expiresAt,
          connectedDevices: 1,
        },
        200,
        headers
      );
    }

    // Manual Logout
    if (method === 'POST' && apiPath === '/api/auth/logout') {
      const tokens = extractTokensFromWebRequest(req);
      if (tokens.length > 0) {
        const revokedAt = new Date().toISOString();
        await store.mutate((state) => {
          const nextSessions = { ...state.sessions };
          const nextRevoked = { ...state.revokedSessions };
          for (const token of tokens) {
            const hash = hashSessionToken(token);
            delete nextSessions[hash];
            nextRevoked[hash] = revokedAt;
          }
          return {
            nextState: {
              ...state,
              sessions: nextSessions,
              revokedSessions: nextRevoked,
            },
            result: null,
          };
        });
      }

      return jsonResponse(
        { authenticated: false },
        200,
        { 'Set-Cookie': buildSessionCookieHeader(req, '', 0) }
      );
    }

    // All endpoints below require authenticated admin session
    const initialState = await store.load();
    const auth = authenticateFromState(req, initialState);
    if (!auth) {
      return jsonResponse(
        {
          authenticated: false,
          error: 'Требуется авторизация администратора',
        },
        401
      );
    }

    const renewed = await maybeRenewSession(req, auth, false);
    const cookieHeader: Record<string, string> = renewed.setCookie
      ? { 'Set-Cookie': renewed.setCookie }
      : {};

    // Workspace load
    if (method === 'GET' && apiPath === '/api/workspace') {
      return jsonResponse(
        {
          codes: initialState.codes,
          blockTemplates: initialState.blockTemplates,
          architecture: initialState.architecture,
          revision: initialState.revision,
          connectedDevices: 1,
          serverTime: new Date().toISOString(),
        },
        200,
        cookieHeader
      );
    }

    // Idempotent legacy migration
    if (method === 'POST' && apiPath === '/api/sync/migrate') {
      const body = (await req.json().catch(() => ({}))) as {
        codes?: VpnCodeRecord[];
        blockTemplates?: ProtocolConfigTemplate[];
      };

      const res = await store.mutate((state) => {
        let importedCodes = 0;
        let importedTemplates = 0;
        const codeIds = new Set(state.codes.map((c) => c.id));
        const nextCodes = [...state.codes];

        if (Array.isArray(body.codes)) {
          for (const item of body.codes) {
            if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
            if (codeIds.has(item.id.trim())) continue;
            codeIds.add(item.id.trim());
            const now = new Date().toISOString();
            nextCodes.push({
              ...item,
              id: item.id.trim(),
              name: (typeof item.name === 'string' && item.name.trim()) || 'VPN-Code',
              protocol: normalizeProtocol(item.protocol),
              country: normalizeVpnCountry(item.country),
              durationAmount: Math.max(1, Math.trunc(Number(item.durationAmount) || 1)),
              durationUnit: normalizeTimeUnit(item.durationUnit),
              durationLabel: item.durationLabel || '',
              expiresAt: item.expiresAt || now,
              createdAt: item.createdAt || now,
              updatedAt: item.updatedAt || item.createdAt || now,
              rawConfig: item.rawConfig ?? '',
              configSource:
                item.configSource || (item.rawConfig?.trim() ? 'block_fix' : 'pending'),
            });
            importedCodes += 1;
          }
        }

        const nextTemplates = [...state.blockTemplates];
        const tplScopes = new Set(
          nextTemplates.map((t) => `${t.protocol}::${t.countryScope}`)
        );
        if (Array.isArray(body.blockTemplates)) {
          for (const tpl of body.blockTemplates) {
            if (!tpl || typeof tpl.id !== 'string' || !tpl.rawConfig?.trim()) continue;
            const protocol = normalizeProtocol(tpl.protocol);
            const countryScope =
              tpl.countryScope === 'ALL' ? 'ALL' : normalizeVpnCountry(tpl.countryScope);
            const scopeKey = `${protocol}::${countryScope}`;
            if (tplScopes.has(scopeKey)) continue;
            tplScopes.add(scopeKey);
            nextTemplates.push({
              id: tpl.id.trim(),
              protocol,
              countryScope,
              rawConfig: tpl.rawConfig.trim(),
              note: tpl.note?.trim() || undefined,
              updatedAt: tpl.updatedAt || new Date().toISOString(),
            });
            importedTemplates += 1;
          }
        }

        return {
          nextState: {
            ...state,
            codes: nextCodes,
            blockTemplates: nextTemplates,
          },
          result: {
            importedCodes,
            importedTemplates,
            codes: nextCodes,
            blockTemplates: nextTemplates,
            architecture: state.architecture,
          },
        };
      });

      return jsonResponse(res, 200, cookieHeader);
    }

    // List codes
    if (method === 'GET' && apiPath === '/api/codes') {
      return jsonResponse({ codes: initialState.codes }, 200, cookieHeader);
    }

    // Create code
    if (method === 'POST' && apiPath === '/api/codes') {
      const body = (await req.json().catch(() => ({}))) as Partial<VpnCodeRecord>;
      if (!body || typeof body.id !== 'string' || !body.id.trim()) {
        return jsonResponse({ error: 'Некорректные данные записи' }, 400, cookieHeader);
      }
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return jsonResponse({ error: 'Название VPN-кода обязательно' }, 400, cookieHeader);
      }

      const now = new Date().toISOString();
      const record: VpnCodeRecord = {
        id: body.id.trim(),
        name: body.name.trim() || 'VPN-Code',
        protocol: normalizeProtocol(body.protocol),
        country: normalizeVpnCountry(body.country),
        durationAmount: Math.max(1, Math.trunc(Number(body.durationAmount) || 1)),
        durationUnit: normalizeTimeUnit(body.durationUnit),
        durationLabel: typeof body.durationLabel === 'string' ? body.durationLabel : '',
        expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : now,
        createdAt: typeof body.createdAt === 'string' ? body.createdAt : now,
        updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : now,
        rawConfig: typeof body.rawConfig === 'string' ? body.rawConfig : '',
        configSource:
          body.rawConfig && body.rawConfig.trim().length > 0
            ? body.configSource === 'manual'
              ? 'manual'
              : 'block_fix'
            : 'pending',
        lastPing: body.lastPing,
      };

      const saved = await store.mutate((state) => {
        const filtered = state.codes.filter((c) => c.id !== record.id);
        return {
          nextState: { ...state, codes: [record, ...filtered] },
          result: record,
        };
      });

      return jsonResponse({ record: saved }, 201, cookieHeader);
    }

    // Update code
    if (method === 'PUT' && apiPath.startsWith('/api/codes/')) {
      const id = decodeURIComponent(apiPath.slice('/api/codes/'.length)).trim();
      if (!id) {
        return jsonResponse({ error: 'ID записи обязателен' }, 400, cookieHeader);
      }
      const patch = (await req.json().catch(() => ({}))) as Partial<VpnCodeRecord>;

      const updated = await store.mutate((state) => {
        const existing = state.codes.find((c) => c.id === id);
        if (!existing) {
          return { nextState: state, result: null };
        }
        const nextRawConfig =
          typeof patch.rawConfig === 'string' ? patch.rawConfig : existing.rawConfig;
        const hasLastPingField = Object.prototype.hasOwnProperty.call(patch, 'lastPing');
        const nextRecord: VpnCodeRecord = {
          ...existing,
          name:
            typeof patch.name === 'string' && patch.name.trim()
              ? patch.name.trim()
              : existing.name,
          protocol:
            typeof patch.protocol === 'string'
              ? normalizeProtocol(patch.protocol)
              : existing.protocol,
          country:
            typeof patch.country === 'string'
              ? normalizeVpnCountry(patch.country)
              : existing.country,
          durationAmount:
            patch.durationAmount !== undefined
              ? Math.max(
                  1,
                  Math.trunc(Number(patch.durationAmount) || existing.durationAmount)
                )
              : existing.durationAmount,
          durationUnit:
            typeof patch.durationUnit === 'string'
              ? normalizeTimeUnit(patch.durationUnit)
              : existing.durationUnit,
          durationLabel:
            typeof patch.durationLabel === 'string'
              ? patch.durationLabel
              : existing.durationLabel,
          expiresAt:
            typeof patch.expiresAt === 'string' ? patch.expiresAt : existing.expiresAt,
          updatedAt: new Date().toISOString(),
          rawConfig: nextRawConfig,
          configSource:
            nextRawConfig.trim().length > 0
              ? patch.configSource ??
                (existing.configSource === 'pending' ? 'block_fix' : existing.configSource)
              : 'pending',
          lastPing: hasLastPingField ? patch.lastPing : existing.lastPing,
        };

        return {
          nextState: {
            ...state,
            codes: state.codes.map((c) => (c.id === id ? nextRecord : c)),
          },
          result: nextRecord,
        };
      });

      if (!updated) {
        return jsonResponse({ error: 'Запись не найдена' }, 404, cookieHeader);
      }
      return jsonResponse({ record: updated }, 200, cookieHeader);
    }

    // Delete single code
    if (method === 'DELETE' && apiPath.startsWith('/api/codes/')) {
      const id = decodeURIComponent(apiPath.slice('/api/codes/'.length)).trim();
      if (!id) {
        return jsonResponse({ error: 'ID записи обязателен' }, 400, cookieHeader);
      }

      const deleted = await store.mutate((state) => {
        const nextCodes = state.codes.filter((c) => c.id !== id);
        return {
          nextState: { ...state, codes: nextCodes },
          result: nextCodes.length !== state.codes.length,
        };
      });
      return jsonResponse({ deleted, id }, 200, cookieHeader);
    }

    // Clear all codes
    if (method === 'DELETE' && apiPath === '/api/codes') {
      const deletedCount = await store.mutate((state) => ({
        nextState: { ...state, codes: [] },
        result: state.codes.length,
      }));
      return jsonResponse({ deletedCount }, 200, cookieHeader);
    }

    // Upsert template
    if (method === 'POST' && apiPath === '/api/templates') {
      const tpl = (await req.json().catch(() => ({}))) as Partial<ProtocolConfigTemplate>;
      if (
        !tpl ||
        typeof tpl.id !== 'string' ||
        typeof tpl.rawConfig !== 'string' ||
        !tpl.rawConfig.trim()
      ) {
        return jsonResponse(
          { error: 'Укажите корректную конфигурацию сервера' },
          400,
          cookieHeader
        );
      }

      const protocol = normalizeProtocol(tpl.protocol);
      const countryScope =
        tpl.countryScope === 'ALL' ? 'ALL' : normalizeVpnCountry(tpl.countryScope);
      const saved = await store.mutate((state) => {
        const existing = state.blockTemplates.find(
          (item) => item.protocol === protocol && item.countryScope === countryScope
        );
        const nextTpl: ProtocolConfigTemplate = {
          id: existing?.id ?? tpl.id!.trim(),
          protocol,
          countryScope,
          rawConfig: tpl.rawConfig!.trim(),
          note: tpl.note?.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };
        const remaining = state.blockTemplates.filter(
          (item) => !(item.protocol === protocol && item.countryScope === countryScope)
        );
        return {
          nextState: { ...state, blockTemplates: [nextTpl, ...remaining] },
          result: nextTpl,
        };
      });

      return jsonResponse({ template: saved }, 200, cookieHeader);
    }

    // Delete template
    if (method === 'DELETE' && apiPath.startsWith('/api/templates/')) {
      const id = decodeURIComponent(apiPath.slice('/api/templates/'.length)).trim();
      if (!id) {
        return jsonResponse({ error: 'ID шаблона обязателен' }, 400, cookieHeader);
      }

      const deleted = await store.mutate((state) => {
        const nextTpls = state.blockTemplates.filter((t) => t.id !== id);
        return {
          nextState: { ...state, blockTemplates: nextTpls },
          result: nextTpls.length !== state.blockTemplates.length,
        };
      });
      return jsonResponse({ deleted, id }, 200, cookieHeader);
    }

    // Save architecture
    if (method === 'PUT' && apiPath === '/api/architecture') {
      const nextConfig = (await req.json().catch(() => ({}))) as Partial<ServerArchitectureConfig>;
      const saved = await store.mutate((state) => {
        const merged: ServerArchitectureConfig = {
          ...state.architecture,
          ...nextConfig,
        };
        return {
          nextState: { ...state, architecture: merged },
          result: merged,
        };
      });
      return jsonResponse({ architecture: saved }, 200, cookieHeader);
    }

    // Secondary security key gate ("Исправление блока")
    if (method === 'POST' && apiPath === '/api/security/verify') {
      const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
      if (missingEnvVars.length > 0) {
        return jsonResponse(
          { valid: false, errorCode: 'SERVER_CONFIG_ERROR', missingEnvVars },
          503,
          cookieHeader
        );
      }

      const body = (await req.json().catch(() => ({}))) as { key?: unknown };
      const candidate = typeof body.key === 'string' ? body.key.trim() : '';

      if (!candidate) {
        return jsonResponse({ valid: false, errorCode: 'EMPTY' }, 400, cookieHeader);
      }

      if (!verifyBlockSecurityKey(candidate)) {
        return jsonResponse({ valid: false, errorCode: 'INVALID_KEY' }, 401, cookieHeader);
      }

      return jsonResponse({ valid: true }, 200, cookieHeader);
    }

    // Live TCP Ping probe
    if (method === 'POST' && apiPath === '/api/ping') {
      const body = (await req.json().catch(() => ({}))) as {
        host?: unknown;
        port?: unknown;
      };
      const host = typeof body.host === 'string' ? body.host.trim() : '';
      const port = Number(body.port);

      if (!host || isForbiddenHost(host)) {
        return jsonResponse(
          {
            reachable: false,
            latencyMs: null,
            error: 'Некорректный адрес сервера для проверки',
          },
          400,
          cookieHeader
        );
      }

      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return jsonResponse(
          {
            reachable: false,
            latencyMs: null,
            error: 'Некорректный порт сервера (допустимо 1–65535)',
          },
          400,
          cookieHeader
        );
      }

      const result = await measureTcpPing(host, port, 4000);
      return jsonResponse({ ...result, host, port }, 200, cookieHeader);
    }

    return jsonResponse({ error: 'Not found' }, 404, cookieHeader);
    } catch (err) {
      const message =
        err instanceof PersistentStorageUnavailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка серверного хранилища';
      return jsonResponse(
        {
          errorCode: 'STORAGE_ERROR',
          error: message,
        },
        503
      );
    }
  };
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const store = resolveNetlifyWorkspaceStore();
    const handle = createNetlifyApiHandler(store);
    return await handle(req);
  } catch (err) {
    const message =
      err instanceof PersistentStorageUnavailableError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Серверное хранилище недоступно';
    return jsonResponse(
      {
        errorCode: 'STORAGE_ERROR',
        error: message,
      },
      503
    );
  }
}
