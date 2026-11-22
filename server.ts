import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';
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
} from './server/auth.ts';
import { VextonDatabase } from './server/db.ts';
import {
  ensureNetlifyExportArchive,
  NETLIFY_ARCHIVE_FILENAME,
} from './server/netlifyArchive.ts';
import type {
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  SyncSocketEvent,
  VpnCodeRecord,
} from './src/types/vpn.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DB_PATH =
  process.env.VEXTON_DB_PATH || path.resolve(__dirname, 'data', 'vexton.db');

interface AuthenticatedRequest extends Request {
  adminUser?: string;
  sessionTokenHash?: string;
}

interface AliveWebSocket extends WebSocket {
  isAlive?: boolean;
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

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const xfProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (xfProto.includes('https')) return true;
  const origin = String(req.headers.origin || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.referer || '').toLowerCase();
  if (referer.startsWith('https://')) return true;
  const host = String(req.headers.host || '').toLowerCase();
  if (host.endsWith('.run.app')) return true;
  return false;
}

function isCrossSiteIframeRequest(req: Request): boolean {
  const fetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  const fetchDest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  if (fetchSite === 'cross-site' || fetchDest === 'iframe') return true;
  const host = String(req.headers.host || '').toLowerCase();
  return host.endsWith('.run.app');
}

function buildSessionCookieHeader(
  req: Request,
  token: string,
  maxAgeSeconds: number
): string {
  const isHttps = isHttpsRequest(req);
  const sameSite = isHttps
    ? isCrossSiteIframeRequest(req)
      ? 'SameSite=None; Secure; Partitioned'
      : 'SameSite=Lax; Secure'
    : 'SameSite=Lax';
  const expiryAttr =
    maxAgeSeconds <= 0
      ? 'Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      : `Max-Age=${maxAgeSeconds}`;
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${expiryAttr}; ${sameSite}`;
}

async function startServer() {
  const db = new VextonDatabase(DB_PATH);
  const persistentArchiveDir = path.dirname(path.resolve(DB_PATH));
  let archiveBuildPromise: Promise<string> | null = null;

  const resolveOrRebuildArchive = async (): Promise<string> => {
    const primaryPath = path.resolve(__dirname, NETLIFY_ARCHIVE_FILENAME);
    try {
      if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).size > 0) {
        return primaryPath;
      }
    } catch {
      // Rebuild below if stat fails
    }

    if (!archiveBuildPromise) {
      archiveBuildPromise = Promise.resolve().then(() => {
        const result = ensureNetlifyExportArchive(__dirname, {
          persistentDir: persistentArchiveDir,
          forceRebuild: true,
        });
        return result.primaryPath;
      }).finally(() => {
        archiveBuildPromise = null;
      });
    }
    return archiveBuildPromise;
  };

  try {
    const initialArchive = ensureNetlifyExportArchive(__dirname, {
      persistentDir: persistentArchiveDir,
      forceRebuild: true,
    });
    console.log(
      `Prepared ${NETLIFY_ARCHIVE_FILENAME} (${initialArchive.fileCount} files, ${initialArchive.sizeBytes} bytes)`
    );
  } catch (err) {
    console.error('Failed to pre-build Netlify ZIP archive:', err);
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '512kb' }));
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  const broadcastSyncEvent = (event: SyncSocketEvent) => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  const authenticateToken = (token: string) => {
    const tokenHash = hashSessionToken(token);
    if (db.isSessionRevoked(tokenHash)) {
      return null;
    }

    const dbSession = db.findValidSession(tokenHash);
    if (dbSession) {
      return {
        token,
        username: dbSession.username,
        tokenHash,
        expiresAt: dbSession.expiresAt,
      };
    }

    const signed = verifySignedSessionToken(token);
    if (signed) {
      const { expiresAt } = db.extendSession(tokenHash, signed.username, SESSION_TTL_MS);
      return {
        token,
        username: signed.username,
        tokenHash,
        expiresAt,
      };
    }

    return null;
  };

  const authenticateRequest = (req: Request, queryToken?: string | null) => {
    const candidates = extractCandidateSessionTokens(req, queryToken);
    for (const candidate of candidates) {
      const auth = authenticateToken(candidate);
      if (auth) return auth;
    }
    return null;
  };

  const renewSessionIfNeeded = (
    req: Request,
    res: Response,
    auth: { token: string; tokenHash: string; username: string; expiresAt: string },
    forceCookieRefresh = false
  ): { token: string; tokenHash: string; username: string; expiresAt: string } => {
    const now = Date.now();
    const dbExpMs = new Date(auth.expiresAt).getTime();
    const shouldExtendDb =
      Number.isNaN(dbExpMs) || dbExpMs - now < SESSION_TTL_MS - SESSION_RENEW_INTERVAL_MS;

    const signed = verifySignedSessionToken(auth.token, now);
    const shouldRotateSignedToken =
      signed !== null && signed.exp - now < SESSION_TTL_MS / 2;

    if (shouldRotateSignedToken) {
      const nextToken = generateSessionToken(auth.username, SESSION_TTL_MS);
      const nextHash = hashSessionToken(nextToken);
      const { expiresAt } = db.createSession(nextHash, auth.username, SESSION_TTL_MS);
      // Grace period of 2 minutes on old session hash for concurrent in-flight requests
      db.extendSession(auth.tokenHash, auth.username, 120_000);
      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(req, nextToken, Math.floor(SESSION_TTL_MS / 1000))
      );
      return {
        token: nextToken,
        tokenHash: nextHash,
        username: auth.username,
        expiresAt,
      };
    }

    if (shouldExtendDb || forceCookieRefresh) {
      const { expiresAt } = shouldExtendDb
        ? db.extendSession(auth.tokenHash, auth.username, SESSION_TTL_MS)
        : { expiresAt: auth.expiresAt };
      res.setHeader(
        'Set-Cookie',
        buildSessionCookieHeader(req, auth.token, Math.floor(SESSION_TTL_MS / 1000))
      );
      return {
        ...auth,
        expiresAt,
      };
    }

    return auth;
  };

  const requireAdminAuth = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    const auth = authenticateRequest(req);
    if (!auth) {
      res.status(401).json({
        authenticated: false,
        error: 'Требуется авторизация администратора',
      });
      return;
    }
    const renewed = renewSessionIfNeeded(req, res, auth, false);
    req.adminUser = renewed.username;
    req.sessionTokenHash = renewed.tokenHash;
    next();
  };

  // Public health check
  app.get('/api/health', (_req: Request, res: Response) => {
    const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
    res.json({
      ok: true,
      service: 'vexton-vpn-code-generator',
      database: 'sqlite',
      realtime: 'websocket',
      connectedDevices: wss.clients.size,
      authConfigured: missingEnvVars.length === 0,
      ...(missingEnvVars.length > 0 ? { missingAuthEnvVars: missingEnvVars } : {}),
    });
  });

  // Admin Authentication routes
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
    if (missingEnvVars.length > 0) {
      res.status(503).json({
        authenticated: false,
        errorCode: 'SERVER_CONFIG_ERROR',
        missingEnvVars,
      });
      return;
    }

    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    const username =
      typeof body.username === 'string' && body.username.trim()
        ? body.username.trim()
        : getServerAuthConfig().adminUser;
    const password = typeof body.password === 'string' ? body.password : '';

    if (!password.trim()) {
      res.status(400).json({ authenticated: false, errorCode: 'EMPTY' });
      return;
    }

    if (!verifyAdminCredentials(username, password)) {
      res.status(401).json({ authenticated: false, errorCode: 'INVALID_CREDENTIALS' });
      return;
    }

    const token = generateSessionToken(username, SESSION_TTL_MS);
    const tokenHash = hashSessionToken(token);
    const { expiresAt } = db.createSession(tokenHash, username, SESSION_TTL_MS);

    res.setHeader(
      'Set-Cookie',
      buildSessionCookieHeader(req, token, Math.floor(SESSION_TTL_MS / 1000))
    );
    res.json({
      authenticated: true,
      username,
      expiresAt,
    });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const auth = authenticateRequest(req);
    if (!auth) {
      res.json({ authenticated: false });
      return;
    }
    const renewed = renewSessionIfNeeded(req, res, auth, true);
    res.json({
      authenticated: true,
      username: renewed.username,
      expiresAt: renewed.expiresAt,
      connectedDevices: wss.clients.size,
    });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const tokens = extractCandidateSessionTokens(req);
    for (const token of tokens) {
      db.revokeSession(hashSessionToken(token));
    }
    res.setHeader('Set-Cookie', buildSessionCookieHeader(req, '', 0));
    res.json({ authenticated: false });
  });

  // Protected: Load full shared workspace from SQLite
  app.get('/api/workspace', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      codes: db.listCodes(),
      blockTemplates: db.listTemplates(),
      architecture: db.getArchitecture(),
      connectedDevices: wss.clients.size,
      serverTime: new Date().toISOString(),
    });
  });

  // Protected: One-time idempotent migration from legacy localStorage records
  app.post('/api/sync/migrate', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = (req.body ?? {}) as {
      codes?: VpnCodeRecord[];
      blockTemplates?: ProtocolConfigTemplate[];
    };
    const result = db.importLegacyWorkspace(body);
    const codes = db.listCodes();
    const blockTemplates = db.listTemplates();
    const architecture = db.getArchitecture();

    if (result.importedCodes > 0 || result.importedTemplates > 0) {
      broadcastSyncEvent({
        type: 'workspace:sync',
        codes,
        blockTemplates,
        architecture,
      });
    }

    res.json({
      ...result,
      codes,
      blockTemplates,
      architecture,
    });
  });

  // Protected: VPN Codes CRUD + Real-Time Broadcast
  app.get('/api/codes', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
    res.json({ codes: db.listCodes() });
  });

  app.post('/api/codes', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Partial<VpnCodeRecord>;
    if (!body || typeof body.id !== 'string' || !body.id.trim()) {
      res.status(400).json({ error: 'Некорректные данные записи' });
      return;
    }
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'Название VPN-кода обязательно' });
      return;
    }

    const saved = db.createCode(body as VpnCodeRecord);
    broadcastSyncEvent({ type: 'code:created', record: saved });
    res.status(201).json({ record: saved });
  });

  app.put('/api/codes/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id?.trim();
    if (!id) {
      res.status(400).json({ error: 'ID записи обязателен' });
      return;
    }
    const patch = (req.body ?? {}) as Partial<VpnCodeRecord>;
    const updated = db.updateCode(id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Запись не найдена' });
      return;
    }
    broadcastSyncEvent({ type: 'code:updated', record: updated });
    res.json({ record: updated });
  });

  app.delete('/api/codes/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id?.trim();
    if (!id) {
      res.status(400).json({ error: 'ID записи обязателен' });
      return;
    }
    const deleted = db.deleteCode(id);
    if (deleted) {
      broadcastSyncEvent({ type: 'code:deleted', id });
    }
    res.json({ deleted, id });
  });

  app.delete('/api/codes', requireAdminAuth, (_req: AuthenticatedRequest, res: Response) => {
    const deletedCount = db.clearAllCodes();
    broadcastSyncEvent({ type: 'codes:cleared' });
    res.json({ deletedCount });
  });

  // Protected: Block Fix Protocol Config Templates CRUD + Real-Time Broadcast
  app.post('/api/templates', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const tpl = req.body as Partial<ProtocolConfigTemplate>;
    if (
      !tpl ||
      typeof tpl.id !== 'string' ||
      typeof tpl.rawConfig !== 'string' ||
      !tpl.rawConfig.trim()
    ) {
      res.status(400).json({ error: 'Укажите корректную конфигурацию сервера' });
      return;
    }
    const saved = db.upsertTemplate(tpl as ProtocolConfigTemplate);
    broadcastSyncEvent({ type: 'template:upserted', template: saved });
    res.json({ template: saved });
  });

  app.delete('/api/templates/:id', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id?.trim();
    if (!id) {
      res.status(400).json({ error: 'ID шаблона обязателен' });
      return;
    }
    const deleted = db.deleteTemplate(id);
    if (deleted) {
      broadcastSyncEvent({ type: 'template:deleted', id });
    }
    res.json({ deleted, id });
  });

  // Protected: Server Architecture settings + Real-Time Broadcast
  app.put('/api/architecture', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const nextConfig = (req.body ?? {}) as ServerArchitectureConfig;
    const saved = db.saveArchitecture(nextConfig);
    broadcastSyncEvent({ type: 'architecture:updated', architecture: saved });
    res.json({ architecture: saved });
  });

  // Protected: Secondary security key gate for "Исправление блока"
  app.post('/api/security/verify', requireAdminAuth, (req: AuthenticatedRequest, res: Response) => {
    const missingEnvVars = isStrictAuthEnvRequired() ? getMissingRequiredAuthEnvVars() : [];
    if (missingEnvVars.length > 0) {
      res.status(503).json({ valid: false, errorCode: 'SERVER_CONFIG_ERROR', missingEnvVars });
      return;
    }

    const body = (req.body ?? {}) as { key?: unknown };
    const candidate = typeof body.key === 'string' ? body.key.trim() : '';

    if (!candidate) {
      res.status(400).json({ valid: false, errorCode: 'EMPTY' });
      return;
    }

    if (!verifyBlockSecurityKey(candidate)) {
      res.status(401).json({ valid: false, errorCode: 'INVALID_KEY' });
      return;
    }

    res.json({ valid: true });
  });

  // Protected: Live TCP Ping probe
  app.post('/api/ping', requireAdminAuth, async (req: AuthenticatedRequest, res: Response) => {
    const body = (req.body ?? {}) as { host?: unknown; port?: unknown };
    const host = typeof body.host === 'string' ? body.host.trim() : '';
    const port = Number(body.port);

    if (!host || isForbiddenHost(host)) {
      res.status(400).json({
        reachable: false,
        latencyMs: null,
        error: 'Некорректный адрес сервера для проверки',
      });
      return;
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      res.status(400).json({
        reachable: false,
        latencyMs: null,
        error: 'Некорректный порт сервера (допустимо 1–65535)',
      });
      return;
    }

    const result = await measureTcpPing(host, port, 4000);
    res.json({
      ...result,
      host,
      port,
    });
  });

  // WebSocket upgrade handling on /ws with admin session verification
  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname !== '/ws') {
      return;
    }

    const auth = authenticateRequest(
      request as unknown as Request,
      reqUrl.searchParams.get('token')
    );
    if (!auth) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: AliveWebSocket) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.send(
      JSON.stringify({
        type: 'sync:connected',
        connectedClients: wss.clients.size,
        serverTime: new Date().toISOString(),
      } satisfies SyncSocketEvent)
    );

    broadcastSyncEvent({
      type: 'clients:count',
      count: wss.clients.size,
    });

    ws.on('close', () => {
      broadcastSyncEvent({
        type: 'clients:count',
        count: wss.clients.size,
      });
    });
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      const aliveClient = client as AliveWebSocket;
      if (aliveClient.isAlive === false) {
        aliveClient.terminate();
        continue;
      }
      aliveClient.isAlive = false;
      aliveClient.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  // Direct download endpoint for the prepared Netlify export archive (kept outside dist/public)
  app.get('/download/vexton-vpn-netlify-ready.zip', async (_req: Request, res: Response) => {
    try {
      const zipPath = await resolveOrRebuildArchive();
      const stat = fs.statSync(zipPath);
      if (!stat.isFile() || stat.size === 0) {
        throw new Error('Архив пустой или повреждён');
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${NETLIFY_ARCHIVE_FILENAME}"`
      );
      res.setHeader('Content-Length', String(stat.size));
      res.sendFile(zipPath, (err) => {
        if (err && !res.headersSent) {
          res.status(500).json({ error: 'Не удалось передать ZIP-архив' });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка формирования архива';
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      }
    }
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message =
      err instanceof Error ? err.message : 'Ошибка серверной базы данных';
    if (!res.headersSent) {
      res.status(503).json({
        errorCode: 'STORAGE_ERROR',
        error: message,
      });
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `VEXTON VPN CODE GENERATOR listening on http://0.0.0.0:${PORT} (DB: ${DB_PATH})`
    );
  });

  const gracefulShutdown = () => {
    clearInterval(heartbeatInterval);
    try {
      db.close();
    } catch {
      // Ignore already-closed DB
    }
    httpServer.close(() => process.exit(0));
  };

  process.once('SIGINT', gracefulShutdown);
  process.once('SIGTERM', gracefulShutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
