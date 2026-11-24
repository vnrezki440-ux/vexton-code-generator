import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import type {
  CountryScope,
  PingResult,
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  TimeUnit,
  VpnCodeRecord,
  VpnCountry,
  VpnProtocol,
} from '../src/types/vpn.ts';
import { normalizeVpnCountry, VPN_PROTOCOLS } from '../src/utils/vpnParser.ts';

export const DEFAULT_SERVER_ARCHITECTURE: ServerArchitectureConfig = {
  adapterMode: 'rest_api_ready',
  apiBaseUrl: '',
  authHeaderName: 'Authorization',
  autoPingOnCreate: true,
  syncEndpointPath: '/api/workspace',
  convertVlessToBase64: false,
};

interface CodeRow {
  id: string;
  name: string;
  protocol: string;
  country: string;
  duration_amount: number;
  duration_unit: string;
  duration_label: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  raw_config: string;
  config_source: string;
  last_ping_json: string | null;
}

interface TemplateRow {
  id: string;
  protocol: string;
  country_scope: string;
  raw_config: string;
  note: string | null;
  updated_at: string;
}

interface SettingRow {
  value_json: string;
}

interface SessionRow {
  token_hash: string;
  username: string;
  created_at: string;
  expires_at: string;
}

function normalizeProtocol(value: string): VpnProtocol {
  return VPN_PROTOCOLS.includes(value as VpnProtocol)
    ? (value as VpnProtocol)
    : 'VLESS';
}

function normalizeTimeUnit(value: string): TimeUnit {
  if (value === 'minutes' || value === 'hours' || value === 'days') {
    return value;
  }
  return 'days';
}

function normalizeCountryScope(value: string): CountryScope {
  if (value === 'ALL') return 'ALL';
  return normalizeVpnCountry(value);
}

function rowToCodeRecord(row: CodeRow): VpnCodeRecord {
  let lastPing: PingResult | undefined;
  if (row.last_ping_json) {
    try {
      lastPing = JSON.parse(row.last_ping_json) as PingResult;
    } catch {
      lastPing = undefined;
    }
  }

  const configSource =
    row.config_source === 'block_fix' ||
    row.config_source === 'manual' ||
    row.config_source === 'pending'
      ? row.config_source
      : row.raw_config.trim().length > 0
        ? 'block_fix'
        : 'pending';

  return {
    id: row.id,
    name: row.name.trim() || 'VPN-Code',
    protocol: normalizeProtocol(row.protocol),
    country: normalizeVpnCountry(row.country),
    durationAmount: Math.max(1, Math.trunc(Number(row.duration_amount) || 1)),
    durationUnit: normalizeTimeUnit(row.duration_unit),
    durationLabel: row.duration_label || '',
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    rawConfig: row.raw_config ?? '',
    configSource,
    lastPing,
  };
}

function rowToTemplate(row: TemplateRow): ProtocolConfigTemplate {
  return {
    id: row.id,
    protocol: normalizeProtocol(row.protocol),
    countryScope: normalizeCountryScope(row.country_scope),
    rawConfig: row.raw_config ?? '',
    note: row.note ?? undefined,
    updatedAt: row.updated_at,
  };
}

export class VextonDatabase {
  private readonly db: DatabaseSync;

  constructor(dbFilePath: string) {
    const resolved = path.resolve(dbFilePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec('PRAGMA busy_timeout = 5000;');
    this.db.exec('PRAGMA journal_mode = DELETE;');
    this.db.exec('PRAGMA synchronous = FULL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vpn_codes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        protocol TEXT NOT NULL,
        country TEXT NOT NULL,
        duration_amount INTEGER NOT NULL,
        duration_unit TEXT NOT NULL,
        duration_label TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        raw_config TEXT NOT NULL DEFAULT '',
        config_source TEXT NOT NULL DEFAULT 'pending',
        last_ping_json TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_vpn_codes_created_at
        ON vpn_codes (created_at DESC);

      CREATE TABLE IF NOT EXISTS block_templates (
        id TEXT PRIMARY KEY,
        protocol TEXT NOT NULL,
        country_scope TEXT NOT NULL,
        raw_config TEXT NOT NULL,
        note TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE (protocol, country_scope)
      );

      CREATE TABLE IF NOT EXISTS server_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revoked_sessions (
        token_hash TEXT PRIMARY KEY,
        revoked_at TEXT NOT NULL
      );
    `);
  }

  close(): void {
    this.db.close();
  }

  listCodes(): VpnCodeRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM vpn_codes ORDER BY created_at DESC, rowid DESC')
      .all() as unknown as CodeRow[];
    return rows.map(rowToCodeRecord);
  }

  getCodeById(id: string): VpnCodeRecord | null {
    const row = this.db
      .prepare('SELECT * FROM vpn_codes WHERE id = ?')
      .get(id) as unknown as CodeRow | undefined;
    return row ? rowToCodeRecord(row) : null;
  }

  createCode(input: VpnCodeRecord): VpnCodeRecord {
    const now = new Date().toISOString();
    const record: VpnCodeRecord = {
      ...input,
      name: input.name.trim() || 'VPN-Code',
      protocol: normalizeProtocol(input.protocol),
      country: normalizeVpnCountry(input.country),
      durationAmount: Math.max(1, Math.trunc(Number(input.durationAmount) || 1)),
      durationUnit: normalizeTimeUnit(input.durationUnit),
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now,
      rawConfig: input.rawConfig ?? '',
      configSource:
        input.rawConfig && input.rawConfig.trim().length > 0
          ? input.configSource === 'manual'
            ? 'manual'
            : 'block_fix'
          : 'pending',
    };

    this.db
      .prepare(
        `INSERT INTO vpn_codes (
          id, name, protocol, country, duration_amount, duration_unit,
          duration_label, expires_at, created_at, updated_at, raw_config,
          config_source, last_ping_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          protocol = excluded.protocol,
          country = excluded.country,
          duration_amount = excluded.duration_amount,
          duration_unit = excluded.duration_unit,
          duration_label = excluded.duration_label,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at,
          raw_config = excluded.raw_config,
          config_source = excluded.config_source,
          last_ping_json = excluded.last_ping_json`
      )
      .run(
        record.id,
        record.name,
        record.protocol,
        record.country,
        record.durationAmount,
        record.durationUnit,
        record.durationLabel,
        record.expiresAt,
        record.createdAt,
        record.updatedAt ?? now,
        record.rawConfig,
        record.configSource,
        record.lastPing ? JSON.stringify(record.lastPing) : null
      );

    return this.getCodeById(record.id) ?? record;
  }

  updateCode(id: string, patch: Partial<VpnCodeRecord>): VpnCodeRecord | null {
    const existing = this.getCodeById(id);
    if (!existing) return null;

    const nextName =
      typeof patch.name === 'string' && patch.name.trim()
        ? patch.name.trim()
        : existing.name;
    const nextCountry: VpnCountry =
      typeof patch.country === 'string'
        ? normalizeVpnCountry(patch.country)
        : existing.country;
    const nextProtocol: VpnProtocol =
      typeof patch.protocol === 'string'
        ? normalizeProtocol(patch.protocol)
        : existing.protocol;
    const nextRawConfig =
      typeof patch.rawConfig === 'string' ? patch.rawConfig : existing.rawConfig;
    const nextDurationAmount =
      patch.durationAmount !== undefined
        ? Math.max(1, Math.trunc(Number(patch.durationAmount) || existing.durationAmount))
        : existing.durationAmount;
    const nextDurationUnit =
      typeof patch.durationUnit === 'string'
        ? normalizeTimeUnit(patch.durationUnit)
        : existing.durationUnit;
    const nextDurationLabel =
      typeof patch.durationLabel === 'string'
        ? patch.durationLabel
        : existing.durationLabel;
    const nextExpiresAt =
      typeof patch.expiresAt === 'string' ? patch.expiresAt : existing.expiresAt;

    const nextConfigSource =
      nextRawConfig.trim().length > 0
        ? patch.configSource ?? (existing.configSource === 'pending' ? 'block_fix' : existing.configSource)
        : 'pending';

    const hasLastPingField = Object.prototype.hasOwnProperty.call(patch, 'lastPing');
    const nextLastPing = hasLastPingField ? patch.lastPing : existing.lastPing;
    const updatedAt = new Date().toISOString();

    this.db
      .prepare(
        `UPDATE vpn_codes
         SET name = ?,
             protocol = ?,
             country = ?,
             duration_amount = ?,
             duration_unit = ?,
             duration_label = ?,
             expires_at = ?,
             updated_at = ?,
             raw_config = ?,
             config_source = ?,
             last_ping_json = ?
         WHERE id = ?`
      )
      .run(
        nextName,
        nextProtocol,
        nextCountry,
        nextDurationAmount,
        nextDurationUnit,
        nextDurationLabel,
        nextExpiresAt,
        updatedAt,
        nextRawConfig,
        nextConfigSource,
        nextLastPing ? JSON.stringify(nextLastPing) : null,
        id
      );

    return this.getCodeById(id);
  }

  deleteCode(id: string): boolean {
    const info = this.db.prepare('DELETE FROM vpn_codes WHERE id = ?').run(id);
    return Number(info.changes) > 0;
  }

  clearAllCodes(): number {
    const info = this.db.prepare('DELETE FROM vpn_codes').run();
    return Number(info.changes);
  }

  listTemplates(): ProtocolConfigTemplate[] {
    const rows = this.db
      .prepare('SELECT * FROM block_templates ORDER BY updated_at DESC')
      .all() as unknown as TemplateRow[];
    return rows.map(rowToTemplate);
  }

  upsertTemplate(input: ProtocolConfigTemplate): ProtocolConfigTemplate {
    const protocol = normalizeProtocol(input.protocol);
    const countryScope = normalizeCountryScope(input.countryScope);
    const updatedAt = new Date().toISOString();

    const existing = this.db
      .prepare('SELECT * FROM block_templates WHERE protocol = ? AND country_scope = ?')
      .get(protocol, countryScope) as unknown as TemplateRow | undefined;

    const targetId = existing?.id ?? input.id;

    this.db
      .prepare(
        `INSERT INTO block_templates (id, protocol, country_scope, raw_config, note, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(protocol, country_scope) DO UPDATE SET
           raw_config = excluded.raw_config,
           note = excluded.note,
           updated_at = excluded.updated_at`
      )
      .run(
        targetId,
        protocol,
        countryScope,
        input.rawConfig.trim(),
        input.note?.trim() || null,
        updatedAt
      );

    const saved = this.db
      .prepare('SELECT * FROM block_templates WHERE protocol = ? AND country_scope = ?')
      .get(protocol, countryScope) as unknown as TemplateRow;

    return rowToTemplate(saved);
  }

  deleteTemplate(id: string): boolean {
    const info = this.db.prepare('DELETE FROM block_templates WHERE id = ?').run(id);
    return Number(info.changes) > 0;
  }

  getArchitecture(): ServerArchitectureConfig {
    const row = this.db
      .prepare('SELECT value_json FROM server_settings WHERE key = ?')
      .get('architecture') as unknown as SettingRow | undefined;
    if (!row) {
      return { ...DEFAULT_SERVER_ARCHITECTURE };
    }
    try {
      const parsed = JSON.parse(row.value_json) as Partial<ServerArchitectureConfig>;
      return { ...DEFAULT_SERVER_ARCHITECTURE, ...parsed };
    } catch {
      return { ...DEFAULT_SERVER_ARCHITECTURE };
    }
  }

  saveArchitecture(config: ServerArchitectureConfig): ServerArchitectureConfig {
    const merged: ServerArchitectureConfig = {
      ...DEFAULT_SERVER_ARCHITECTURE,
      ...config,
    };
    const updatedAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO server_settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`
      )
      .run('architecture', JSON.stringify(merged), updatedAt);
    return merged;
  }

  importLegacyWorkspace(payload: {
    codes?: VpnCodeRecord[];
    blockTemplates?: ProtocolConfigTemplate[];
  }): { importedCodes: number; importedTemplates: number } {
    let importedCodes = 0;
    let importedTemplates = 0;

    if (Array.isArray(payload.codes)) {
      const insertCode = this.db.prepare(
        `INSERT OR IGNORE INTO vpn_codes (
          id, name, protocol, country, duration_amount, duration_unit,
          duration_label, expires_at, created_at, updated_at, raw_config,
          config_source, last_ping_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const item of payload.codes) {
        if (!item || typeof item.id !== 'string' || !item.id.trim()) continue;
        const now = new Date().toISOString();
        const res = insertCode.run(
          item.id.trim(),
          (typeof item.name === 'string' && item.name.trim()) || 'VPN-Code',
          normalizeProtocol(item.protocol),
          normalizeVpnCountry(item.country),
          Math.max(1, Math.trunc(Number(item.durationAmount) || 1)),
          normalizeTimeUnit(item.durationUnit),
          item.durationLabel || '',
          item.expiresAt || now,
          item.createdAt || now,
          item.updatedAt || item.createdAt || now,
          item.rawConfig ?? '',
          item.configSource || (item.rawConfig?.trim() ? 'block_fix' : 'pending'),
          item.lastPing ? JSON.stringify(item.lastPing) : null
        );
        if (Number(res.changes) > 0) importedCodes += 1;
      }
    }

    if (Array.isArray(payload.blockTemplates)) {
      const insertTpl = this.db.prepare(
        `INSERT OR IGNORE INTO block_templates (
          id, protocol, country_scope, raw_config, note, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const tpl of payload.blockTemplates) {
        if (!tpl || typeof tpl.id !== 'string' || !tpl.rawConfig?.trim()) continue;
        const res = insertTpl.run(
          tpl.id.trim(),
          normalizeProtocol(tpl.protocol),
          normalizeCountryScope(tpl.countryScope),
          tpl.rawConfig.trim(),
          tpl.note?.trim() || null,
          tpl.updatedAt || new Date().toISOString()
        );
        if (Number(res.changes) > 0) importedTemplates += 1;
      }
    }

    return { importedCodes, importedTemplates };
  }

  createSession(tokenHash: string, username: string, ttlMs: number): { expiresAt: string } {
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlMs).toISOString();

    this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(createdAt);
    this.db
      .prepare(
        `INSERT INTO admin_sessions (token_hash, username, created_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           username = excluded.username,
           expires_at = excluded.expires_at`
      )
      .run(tokenHash, username, createdAt, expiresAt);

    return { expiresAt };
  }

  findValidSession(tokenHash: string): { username: string; expiresAt: string } | null {
    const nowIso = new Date().toISOString();
    const row = this.db
      .prepare('SELECT * FROM admin_sessions WHERE token_hash = ?')
      .get(tokenHash) as unknown as SessionRow | undefined;

    if (!row) return null;
    if (row.expires_at <= nowIso) {
      this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }
    return { username: row.username, expiresAt: row.expires_at };
  }

  extendSession(tokenHash: string, username: string, ttlMs: number): { expiresAt: string } {
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlMs).toISOString();
    this.db
      .prepare(
        `INSERT INTO admin_sessions (token_hash, username, created_at, expires_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(token_hash) DO UPDATE SET
           expires_at = excluded.expires_at`
      )
      .run(tokenHash, username, createdAt, expiresAt);
    return { expiresAt };
  }

  isSessionRevoked(tokenHash: string): boolean {
    const row = this.db
      .prepare('SELECT token_hash FROM revoked_sessions WHERE token_hash = ?')
      .get(tokenHash) as { token_hash: string } | undefined;
    return Boolean(row);
  }

  revokeSession(tokenHash: string): void {
    const revokedAt = new Date().toISOString();
    this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(tokenHash);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO revoked_sessions (token_hash, revoked_at)
         VALUES (?, ?)`
      )
      .run(tokenHash, revokedAt);
  }

  deleteSession(tokenHash: string): void {
    this.revokeSession(tokenHash);
  }
}
