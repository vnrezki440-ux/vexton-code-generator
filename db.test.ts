import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  extractCandidateSessionTokens,
  extractSessionTokenFromRequest,
  generateSessionToken,
  getMissingRequiredAuthEnvVars,
  hashSessionToken,
  isStrictAuthEnvRequired,
  SESSION_COOKIE_NAME,
  verifyAdminCredentials,
  verifyBlockSecurityKey,
  verifySignedSessionToken,
} from './auth';
import { VextonDatabase } from './db';
import type { ProtocolConfigTemplate, VpnCodeRecord } from '../src/types/vpn';

function createTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vexton-db-test-'));
  return path.join(dir, 'vexton.db');
}

test('VextonDatabase creates, updates, lists, and deletes VPN codes preserving name and country', () => {
  const dbPath = createTempDbPath();
  const db = new VextonDatabase(dbPath);

  const sample: VpnCodeRecord = {
    id: 'code-1',
    name: 'Client-TM-Phone',
    protocol: 'VLESS',
    country: 'Туркменистан',
    durationAmount: 30,
    durationUnit: 'days',
    durationLabel: '30 дней',
    expiresAt: '2026-12-30T00:00:00.000Z',
    createdAt: '2026-11-30T00:00:00.000Z',
    rawConfig: 'vless://abc@example.com:443#TM',
    configSource: 'block_fix',
  };

  const created = db.createCode(sample);
  assert.equal(created.name, 'Client-TM-Phone');
  assert.equal(created.country, 'Туркменистан');

  const updated = db.updateCode('code-1', {
    name: 'Client-DE-Updated',
    country: 'Германия',
    durationAmount: 14,
    durationUnit: 'days',
    durationLabel: '14 дней',
    rawConfig: 'vless://updated@de.example.com:443#DE',
  });

  assert.ok(updated);
  assert.equal(updated.name, 'Client-DE-Updated');
  assert.equal(updated.country, 'Германия');
  assert.equal(updated.durationAmount, 14);
  assert.equal(updated.rawConfig, 'vless://updated@de.example.com:443#DE');

  db.close();

  // Reopen DB from disk to verify persistence across restarts
  const reopened = new VextonDatabase(dbPath);
  const all = reopened.listCodes();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'Client-DE-Updated');
  assert.equal(all[0].country, 'Германия');
  assert.equal(reopened.deleteCode('code-1'), true);
  assert.equal(reopened.listCodes().length, 0);
  reopened.close();
});

test('VextonDatabase upserts templates and imports legacy workspace idempotently', () => {
  const dbPath = createTempDbPath();
  const db = new VextonDatabase(dbPath);

  const tpl: ProtocolConfigTemplate = {
    id: 'tpl-1',
    protocol: 'VLESS',
    countryScope: 'Нидерланды',
    rawConfig: 'vless://node@nl.example.com:443',
    updatedAt: '2026-11-14T00:00:00.000Z',
  };

  db.upsertTemplate(tpl);
  assert.equal(db.listTemplates().length, 1);

  db.upsertTemplate({
    ...tpl,
    id: 'tpl-2',
    rawConfig: 'vless://node2@nl.example.com:443',
  });
  // Unique (protocol, countryScope) updates existing row rather than duplicating
  assert.equal(db.listTemplates().length, 1);
  assert.equal(db.listTemplates()[0].rawConfig, 'vless://node2@nl.example.com:443');

  const firstImport = db.importLegacyWorkspace({
    codes: [
      {
        id: 'legacy-1',
        name: 'Legacy-Code',
        protocol: 'Trojan',
        country: 'Швеция',
        durationAmount: 7,
        durationUnit: 'days',
        durationLabel: '7 дней',
        expiresAt: '2026-12-01T00:00:00.000Z',
        createdAt: '2026-11-14T00:00:00.000Z',
        rawConfig: 'trojan://pass@se.example.com:443',
        configSource: 'block_fix',
      },
    ],
  });
  assert.equal(firstImport.importedCodes, 1);

  const secondImport = db.importLegacyWorkspace({
    codes: [
      {
        id: 'legacy-1',
        name: 'Legacy-Code',
        protocol: 'Trojan',
        country: 'Швеция',
        durationAmount: 7,
        durationUnit: 'days',
        durationLabel: '7 дней',
        expiresAt: '2026-12-01T00:00:00.000Z',
        createdAt: '2026-11-14T00:00:00.000Z',
        rawConfig: 'trojan://pass@se.example.com:443',
        configSource: 'block_fix',
      },
    ],
  });
  assert.equal(secondImport.importedCodes, 0);
  db.close();
});

test('Server admin sessions and token extraction work cleanly', () => {
  const prevAdminPwd = process.env.VEXTON_ADMIN_PASSWORD;
  const prevSecKey = process.env.VEXTON_SECURITY_KEY;
  const prevSessSecret = process.env.VEXTON_SESSION_SECRET;
  process.env.VEXTON_ADMIN_PASSWORD = 'demo-admin-pass-test';
  process.env.VEXTON_SECURITY_KEY = 'demo-block-key-test';
  process.env.VEXTON_SESSION_SECRET = 'demo-session-secret-test-value-32chars';

  const dbPath = createTempDbPath();
  const db = new VextonDatabase(dbPath);

  try {
    assert.equal(verifyBlockSecurityKey('demo-block-key-test'), true);
    assert.equal(verifyBlockSecurityKey('demo-admin-pass-test'), false);
    assert.equal(verifyBlockSecurityKey('wrong'), false);
    assert.equal(verifyAdminCredentials('admin', 'demo-admin-pass-test'), true);
    assert.equal(verifyAdminCredentials('admin', 'demo-block-key-test'), false);
    assert.equal(verifyAdminCredentials('admin', 'bad'), false);

    const token = generateSessionToken('admin', 60_000);
    const signedPayload = verifySignedSessionToken(token);
    assert.ok(signedPayload);
    assert.equal(signedPayload.username, 'admin');
    assert.equal(verifySignedSessionToken(`${token}tampered`), null);
    assert.equal(token.includes('demo-admin-pass-test'), false);
    assert.equal(token.includes('demo-block-key-test'), false);
    assert.equal(token.includes('demo-session-secret-test-value-32chars'), false);

    const hash = hashSessionToken(token);
    db.createSession(hash, 'admin', 60_000);

    const valid = db.findValidSession(hash);
    assert.ok(valid);
    assert.equal(valid.username, 'admin');

    const extended = db.extendSession(hash, 'admin', 3_600_000);
    assert.ok(new Date(extended.expiresAt).getTime() > new Date(valid.expiresAt).getTime());

    const extractedBearer = extractSessionTokenFromRequest({
      headers: { authorization: `Bearer ${token}` },
    } as never);
    assert.equal(extractedBearer, token);

    const extractedCookie = extractSessionTokenFromRequest({
      headers: { cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}` },
    } as never);
    assert.equal(extractedCookie, token);

    // HttpOnly cookie takes precedence over stale Authorization Bearer header
    const candidates = extractCandidateSessionTokens({
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
        authorization: 'Bearer stale-token',
      },
    } as never);
    assert.deepEqual(candidates, [token, 'stale-token']);

    db.revokeSession(hash);
    assert.equal(db.findValidSession(hash), null);
    assert.equal(db.isSessionRevoked(hash), true);
  } finally {
    db.close();
    if (prevAdminPwd === undefined) delete process.env.VEXTON_ADMIN_PASSWORD;
    else process.env.VEXTON_ADMIN_PASSWORD = prevAdminPwd;
    if (prevSecKey === undefined) delete process.env.VEXTON_SECURITY_KEY;
    else process.env.VEXTON_SECURITY_KEY = prevSecKey;
    if (prevSessSecret === undefined) delete process.env.VEXTON_SESSION_SECRET;
    else process.env.VEXTON_SESSION_SECRET = prevSessSecret;
  }
});

test('Strict env mode fails closed when required secret env vars are missing', () => {
  const prevRequire = process.env.VEXTON_REQUIRE_ENV;
  const prevAdminPwd = process.env.VEXTON_ADMIN_PASSWORD;
  const prevSecKey = process.env.VEXTON_SECURITY_KEY;
  const prevSessSecret = process.env.VEXTON_SESSION_SECRET;

  try {
    process.env.VEXTON_REQUIRE_ENV = 'true';
    delete process.env.VEXTON_ADMIN_PASSWORD;
    delete process.env.VEXTON_SECURITY_KEY;
    delete process.env.VEXTON_SESSION_SECRET;

    assert.equal(isStrictAuthEnvRequired(), true);
    assert.deepEqual(getMissingRequiredAuthEnvVars(), [
      'VEXTON_ADMIN_PASSWORD',
      'VEXTON_SECURITY_KEY',
      'VEXTON_SESSION_SECRET',
    ]);
    assert.equal(verifyAdminCredentials('admin', 'any-admin-candidate'), false);
    assert.equal(verifyBlockSecurityKey('any-block-candidate'), false);
    assert.throws(() => generateSessionToken('admin', 60_000));
    assert.equal(verifySignedSessionToken('abc.def'), null);
  } finally {
    if (prevRequire === undefined) delete process.env.VEXTON_REQUIRE_ENV;
    else process.env.VEXTON_REQUIRE_ENV = prevRequire;
    if (prevAdminPwd === undefined) delete process.env.VEXTON_ADMIN_PASSWORD;
    else process.env.VEXTON_ADMIN_PASSWORD = prevAdminPwd;
    if (prevSecKey === undefined) delete process.env.VEXTON_SECURITY_KEY;
    else process.env.VEXTON_SECURITY_KEY = prevSecKey;
    if (prevSessSecret === undefined) delete process.env.VEXTON_SESSION_SECRET;
    else process.env.VEXTON_SESSION_SECRET = prevSessSecret;
  }
});

test('VextonDatabase never deletes codes, working templates, or settings on logout or restart', () => {
  const dbPath = createTempDbPath();
  const db = new VextonDatabase(dbPath);

  db.upsertTemplate({
    id: 'tpl-persist-1',
    protocol: 'VLESS',
    countryScope: 'ALL',
    rawConfig: 'vless://11111111-1111-1111-1111-111111111111@vpn.example.org:443?security=tls#Node',
    updatedAt: '2026-11-16T00:00:00.000Z',
  });
  db.createCode({
    id: 'code-persist-1',
    name: 'Persist-Code',
    protocol: 'VLESS',
    country: 'Нидерланды',
    durationAmount: 30,
    durationUnit: 'days',
    durationLabel: '30 дн.',
    expiresAt: '2026-12-16T00:00:00.000Z',
    createdAt: '2026-11-16T00:00:00.000Z',
    rawConfig: 'vless://11111111-1111-1111-1111-111111111111@vpn.example.org:443?security=tls#NL',
    configSource: 'block_fix',
  });
  db.saveArchitecture({
    adapterMode: 'rest_api_ready',
    apiBaseUrl: '',
    authHeaderName: 'Authorization',
    autoPingOnCreate: true,
    syncEndpointPath: '/api/workspace',
    convertVlessToBase64: true,
  });

  db.createSession('hash-session-a', 'admin', 60_000);
  db.revokeSession('hash-session-a');
  db.close();

  const reopened = new VextonDatabase(dbPath);
  assert.equal(reopened.listCodes().length, 1);
  assert.equal(reopened.listCodes()[0].name, 'Persist-Code');
  assert.equal(reopened.listTemplates().length, 1);
  assert.equal(reopened.getArchitecture().convertVlessToBase64, true);
  reopened.close();
});
