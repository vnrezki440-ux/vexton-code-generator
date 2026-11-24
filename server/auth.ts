import crypto from 'node:crypto';
import type { Request } from 'express';

export const SESSION_COOKIE_NAME = 'vexton_admin_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_RENEW_INTERVAL_MS = 60 * 1000;

export const REQUIRED_SECRET_ENV_VARS = [
  'VEXTON_ADMIN_PASSWORD',
  'VEXTON_SECURITY_KEY',
  'VEXTON_SESSION_SECRET',
] as const;

export function isStrictAuthEnvRequired(): boolean {
  return (
    process.env.VEXTON_REQUIRE_ENV === 'true' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NETLIFY === 'true' ||
    Boolean((process.env.CONTEXT || '').trim())
  );
}

export function getMissingRequiredAuthEnvVars(): string[] {
  return REQUIRED_SECRET_ENV_VARS.filter((name) => !(process.env[name] || '').trim());
}

const DEFAULT_ADMIN_PASSWORD_SHA256 =
  'b57e648120ba2737e33bbc95e51501b57609c0dc94bbd13982d12411cca4b7fc';
const DEFAULT_SECURITY_KEY_SHA256 =
  '80e33499400613aaddbf75faa4154061297d6aa8c7bb57a4edb75c3d27a30516';

function sha256Buffer(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

export function getServerAuthConfig() {
  const adminUser = (process.env.VEXTON_ADMIN_USER || 'admin').trim();
  const explicitPassword = (process.env.VEXTON_ADMIN_PASSWORD || '').trim();
  const explicitSecurityKey = (process.env.VEXTON_SECURITY_KEY || '').trim();
  const strictEnv = isStrictAuthEnvRequired();

  const adminPasswordHash = explicitPassword
    ? sha256Buffer(explicitPassword)
    : strictEnv
      ? null
      : Buffer.from(DEFAULT_ADMIN_PASSWORD_SHA256, 'hex');
  const securityKeyHash = explicitSecurityKey
    ? sha256Buffer(explicitSecurityKey)
    : strictEnv
      ? null
      : Buffer.from(DEFAULT_SECURITY_KEY_SHA256, 'hex');
  return { adminUser, adminPasswordHash, securityKeyHash };
}

function getSessionSigningSecret(): Buffer | null {
  const explicit = (process.env.VEXTON_SESSION_SECRET || '').trim();
  if (explicit) {
    return crypto.createHash('sha256').update(`explicit:${explicit}`, 'utf8').digest();
  }
  if (isStrictAuthEnvRequired()) {
    return null;
  }
  const { adminUser, adminPasswordHash, securityKeyHash } = getServerAuthConfig();
  if (!adminPasswordHash || !securityKeyHash) {
    return null;
  }
  return crypto
    .createHash('sha256')
    .update(
      `vexton-session-v2:${adminUser}:${adminPasswordHash.toString('hex')}:${securityKeyHash.toString('hex')}`,
      'utf8'
    )
    .digest();
}

export function timingSafeCompareUtf8(a: string, b: string): boolean {
  const aHash = sha256Buffer(a);
  const bHash = sha256Buffer(b);
  return crypto.timingSafeEqual(aHash, bHash);
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  if (isStrictAuthEnvRequired() && getMissingRequiredAuthEnvVars().length > 0) {
    return false;
  }
  const { adminUser, adminPasswordHash } = getServerAuthConfig();
  if (!adminPasswordHash) return false;
  const u = username.trim();
  const p = password.trim();
  if (!u || !p) return false;
  return (
    timingSafeCompareUtf8(u, adminUser) &&
    crypto.timingSafeEqual(sha256Buffer(p), adminPasswordHash)
  );
}

export function verifyBlockSecurityKey(candidate: string): boolean {
  if (isStrictAuthEnvRequired() && getMissingRequiredAuthEnvVars().length > 0) {
    return false;
  }
  const { securityKeyHash } = getServerAuthConfig();
  if (!securityKeyHash) return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;
  return crypto.timingSafeEqual(sha256Buffer(trimmed), securityKeyHash);
}

export interface VerifiedSessionPayload {
  username: string;
  iat: number;
  exp: number;
  jti: string;
}

export function generateSessionToken(
  username: string = 'admin',
  ttlMs: number = SESSION_TTL_MS
): string {
  const signingSecret = getSessionSigningSecret();
  if (!signingSecret) {
    throw new Error(
      `Missing required secret environment variables: ${getMissingRequiredAuthEnvVars().join(', ')}`
    );
  }
  const now = Date.now();
  const payload: VerifiedSessionPayload = {
    username: username.trim() || 'admin',
    iat: now,
    exp: now + ttlMs,
    jti: crypto.randomBytes(16).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', signingSecret)
    .update(payloadB64, 'utf8')
    .digest('base64url');
  return `${payloadB64}.${sigB64}`;
}

export function verifySignedSessionToken(
  token: string,
  nowMs: number = Date.now()
): VerifiedSessionPayload | null {
  const signingSecret = getSessionSigningSecret();
  if (!signingSecret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', signingSecret)
    .update(payloadB64, 'utf8')
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as Partial<VerifiedSessionPayload>;
    if (
      typeof parsed.username !== 'string' ||
      !parsed.username.trim() ||
      typeof parsed.exp !== 'number' ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp <= nowMs
    ) {
      return null;
    }
    return {
      username: parsed.username.trim(),
      iat: typeof parsed.iat === 'number' ? parsed.iat : nowMs,
      exp: parsed.exp,
      jti: typeof parsed.jti === 'string' ? parsed.jti : '',
    };
  } catch {
    return null;
  }
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function extractCandidateSessionTokens(
  req: Pick<Request, 'headers'>,
  queryToken?: string | null
): string[] {
  const candidates: string[] = [];
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    candidates.push(cookies[SESSION_COOKIE_NAME]);
  }

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && !candidates.includes(token)) {
      candidates.push(token);
    }
  }

  if (typeof queryToken === 'string' && queryToken.trim()) {
    const token = queryToken.trim();
    if (!candidates.includes(token)) {
      candidates.push(token);
    }
  }

  return candidates;
}

export function extractSessionTokenFromRequest(
  req: Pick<Request, 'headers'>,
  queryToken?: string | null
): string | null {
  const candidates = extractCandidateSessionTokens(req, queryToken);
  return candidates[0] ?? null;
}
