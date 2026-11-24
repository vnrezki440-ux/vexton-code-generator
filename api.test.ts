import assert from 'node:assert/strict';
import test from 'node:test';
import { SESSION_COOKIE_NAME } from '../../server/auth.ts';
import netlifyDefaultHandler, { createNetlifyApiHandler } from '../functions/api.ts';
import {
  isServerlessProductionRuntime,
  MemoryWorkspaceStore,
  PersistentStorageUnavailableError,
  resolveNetlifyWorkspaceStore,
} from '../lib/store.ts';

function extractCookiePair(setCookieHeader: string | null): string {
  assert.ok(setCookieHeader, 'Expected Set-Cookie header');
  const firstPart = setCookieHeader.split(';')[0]?.trim();
  assert.ok(firstPart && firstPart.startsWith(`${SESSION_COOKIE_NAME}=`), 'Expected session cookie');
  assert.ok(/HttpOnly/i.test(setCookieHeader), 'Expected HttpOnly attribute on cookie');
  return firstPart;
}

test('Netlify API handler separates admin auth and block fix key and persists across devices', async () => {
  const prevAdminPwd = process.env.VEXTON_ADMIN_PASSWORD;
  const prevSecKey = process.env.VEXTON_SECURITY_KEY;
  const prevSessSecret = process.env.VEXTON_SESSION_SECRET;
  process.env.VEXTON_ADMIN_PASSWORD = 'netlify-admin-test-pass';
  process.env.VEXTON_SECURITY_KEY = 'netlify-block-test-key';
  process.env.VEXTON_SESSION_SECRET = 'netlify-session-test-secret-32-bytes';

  try {
    const store = new MemoryWorkspaceStore();
    const handle = createNetlifyApiHandler(store);

    // 1. Health endpoint reports polling transport for Netlify serverless
    const healthRes = await handle(new Request('https://vexton.netlify.app/api/health'));
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as {
      ok: boolean;
      realtime: string;
      database: string;
      authConfigured: boolean;
    };
    assert.equal(healthBody.ok, true);
    assert.equal(healthBody.realtime, 'polling');
    assert.equal(healthBody.database, 'memory');
    assert.equal(healthBody.authConfigured, true);

    // 2. Unauthenticated workspace request fails with 401
    const unauthWorkspace = await handle(
      new Request('https://vexton.netlify.app/api/workspace')
    );
    assert.equal(unauthWorkspace.status, 401);

    // 3. Secondary block-fix key must NOT log into admin panel
    const wrongAdminLogin = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'netlify-block-test-key' }),
      })
    );
    assert.equal(wrongAdminLogin.status, 401);

    // 4. Device 1 logs in and receives persistent HttpOnly cookie
    const device1Login = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'netlify-admin-test-pass' }),
      })
    );
    assert.equal(device1Login.status, 200);
    const setCookie1 = device1Login.headers.get('set-cookie');
    assert.ok(setCookie1 && /Secure/i.test(setCookie1), 'HTTPS Netlify cookie must set Secure');
    const cookie1 = extractCookiePair(setCookie1);
    const loginBodyText = await device1Login.text();
    assert.equal(loginBodyText.includes('netlify-admin-test-pass'), false);
    assert.equal(loginBodyText.includes('netlify-block-test-key'), false);

    // 5. Device 1 verifies session via /api/auth/me
    const meRes = await handle(
      new Request('https://vexton.netlify.app/api/auth/me', {
        headers: { Cookie: cookie1 },
      })
    );
    assert.equal(meRes.status, 200);
    const meBody = (await meRes.json()) as { authenticated: boolean; username: string };
    assert.equal(meBody.authenticated, true);
    assert.equal(meBody.username, 'admin');

    // 6. Security verification rejects admin password and accepts block key
    const verifyWrong = await handle(
      new Request('https://vexton.netlify.app/api/security/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ key: 'netlify-admin-test-pass' }),
      })
    );
    assert.equal(verifyWrong.status, 401);

    const verifyOk = await handle(
      new Request('https://vexton.netlify.app/api/security/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({ key: 'netlify-block-test-key' }),
      })
    );
    assert.equal(verifyOk.status, 200);
    assert.equal(((await verifyOk.json()) as { valid: boolean }).valid, true);

    // 7. Device 1 creates template and VPN code (using rewritten /.netlify/functions/api path too)
    const tplRes = await handle(
      new Request('https://vexton.netlify.app/.netlify/functions/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({
          id: 'tpl-vless-tm',
          protocol: 'VLESS',
          countryScope: 'Туркменистан',
          rawConfig: 'vless://11111111-1111-1111-1111-111111111111@example.org:443?security=tls#base',
        }),
      })
    );
    assert.equal(tplRes.status, 200);

    const createCodeRes = await handle(
      new Request('https://vexton.netlify.app/.netlify/functions/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie1 },
        body: JSON.stringify({
          id: 'code-tm-1',
          name: 'Ashgabat-Test',
          protocol: 'VLESS',
          country: 'Туркменистан',
          durationAmount: 30,
          durationUnit: 'days',
          durationLabel: '30 дн.',
          expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
          createdAt: new Date().toISOString(),
          rawConfig:
            'vless://11111111-1111-1111-1111-111111111111@example.org:443?security=tls#%F0%9F%87%B9%F0%9F%87%B2%20Ashgabat-Test',
          configSource: 'block_fix',
        }),
      })
    );
    assert.equal(createCodeRes.status, 201);

    // 8. Second device / user logs in independently and immediately sees Device 1's saved VPN code & template
    const device2Login = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'netlify-admin-test-pass' }),
      })
    );
    assert.equal(device2Login.status, 200);
    const cookie2 = extractCookiePair(device2Login.headers.get('set-cookie'));

    const wsDevice2 = await handle(
      new Request('https://vexton.netlify.app/api/workspace', {
        headers: { Cookie: cookie2 },
      })
    );
    assert.equal(wsDevice2.status, 200);
    const wsDevice2Body = (await wsDevice2.json()) as {
      revision: number;
      codes: Array<{ id: string; name: string; country: string }>;
      blockTemplates: Array<{ id: string }>;
    };
    assert.ok(wsDevice2Body.revision >= 4, 'Expected monotonic workspace revision');
    assert.equal(wsDevice2Body.codes.length, 1);
    assert.equal(wsDevice2Body.codes[0]?.name, 'Ashgabat-Test');
    assert.equal(wsDevice2Body.codes[0]?.country, 'Туркменистан');
    assert.equal(wsDevice2Body.blockTemplates.length, 1);

    // 9. Logout on Device 1 revokes Device 1 session, while Device 2 stays signed in and keeps data
    const logout1 = await handle(
      new Request('https://vexton.netlify.app/api/auth/logout', {
        method: 'POST',
        headers: { Cookie: cookie1 },
      })
    );
    assert.equal(logout1.status, 200);
    const logoutSetCookie = logout1.headers.get('set-cookie');
    assert.ok(logoutSetCookie && /Max-Age=0/i.test(logoutSetCookie));

    const me1AfterLogout = await handle(
      new Request('https://vexton.netlify.app/api/auth/me', {
        headers: { Cookie: cookie1 },
      })
    );
    assert.equal(((await me1AfterLogout.json()) as { authenticated: boolean }).authenticated, false);

    // Re-login after logout must still return all persisted codes and working templates
    const reloginDevice1 = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'netlify-admin-test-pass' }),
      })
    );
    assert.equal(reloginDevice1.status, 200);
    const reloginCookie1 = extractCookiePair(reloginDevice1.headers.get('set-cookie'));

    const wsAfterRelogin = await handle(
      new Request('https://vexton.netlify.app/api/workspace', {
        headers: { Cookie: reloginCookie1 },
      })
    );
    assert.equal(wsAfterRelogin.status, 200);
    const wsAfterReloginBody = (await wsAfterRelogin.json()) as {
      revision: number;
      codes: Array<{ id: string; name: string; country: string }>;
      blockTemplates: Array<{ id: string }>;
    };
    assert.equal(wsAfterReloginBody.codes.length, 1);
    assert.equal(wsAfterReloginBody.blockTemplates.length, 1);
    assert.ok(wsAfterReloginBody.revision > wsDevice2Body.revision);

    // Edit and explicit single-item delete persist and bump revision cleanly
    const editRes = await handle(
      new Request('https://vexton.netlify.app/api/codes/code-tm-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: reloginCookie1 },
        body: JSON.stringify({ name: 'Ashgabat-Edited', country: 'Нидерланды' }),
      })
    );
    assert.equal(editRes.status, 200);

    const wsDevice2StillValid = await handle(
      new Request('https://vexton.netlify.app/api/workspace', {
        headers: { Cookie: cookie2 },
      })
    );
    assert.equal(wsDevice2StillValid.status, 200);
    const wsAfterEditBody = (await wsDevice2StillValid.json()) as {
      revision: number;
      codes: Array<{ id: string; name: string; country: string }>;
      blockTemplates: Array<{ id: string }>;
    };
    assert.equal(wsAfterEditBody.codes[0]?.name, 'Ashgabat-Edited');
    assert.equal(wsAfterEditBody.codes[0]?.country, 'Нидерланды');
    assert.ok(wsAfterEditBody.revision > wsAfterReloginBody.revision);

    const delCodeRes = await handle(
      new Request('https://vexton.netlify.app/api/codes/code-tm-1', {
        method: 'DELETE',
        headers: { Cookie: reloginCookie1 },
      })
    );
    assert.equal(delCodeRes.status, 200);

    const wsAfterDel = await handle(
      new Request('https://vexton.netlify.app/api/workspace', {
        headers: { Cookie: cookie2 },
      })
    );
    const wsAfterDelBody = (await wsAfterDel.json()) as {
      codes: Array<{ id: string }>;
      blockTemplates: Array<{ id: string }>;
    };
    assert.equal(wsAfterDelBody.codes.length, 0);
    assert.equal(wsAfterDelBody.blockTemplates.length, 1);
  } finally {
    if (prevAdminPwd === undefined) delete process.env.VEXTON_ADMIN_PASSWORD;
    else process.env.VEXTON_ADMIN_PASSWORD = prevAdminPwd;
    if (prevSecKey === undefined) delete process.env.VEXTON_SECURITY_KEY;
    else process.env.VEXTON_SECURITY_KEY = prevSecKey;
    if (prevSessSecret === undefined) delete process.env.VEXTON_SESSION_SECRET;
    else process.env.VEXTON_SESSION_SECRET = prevSessSecret;
  }
});

test('Netlify API handler enforces mandatory secret env vars under NETLIFY=true', async () => {
  const prevNetlify = process.env.NETLIFY;
  const prevAdminPwd = process.env.VEXTON_ADMIN_PASSWORD;
  const prevSecKey = process.env.VEXTON_SECURITY_KEY;
  const prevSessSecret = process.env.VEXTON_SESSION_SECRET;

  try {
    process.env.NETLIFY = 'true';
    delete process.env.VEXTON_ADMIN_PASSWORD;
    delete process.env.VEXTON_SECURITY_KEY;
    delete process.env.VEXTON_SESSION_SECRET;

    const store = new MemoryWorkspaceStore();
    const handle = createNetlifyApiHandler(store);

    const healthRes = await handle(new Request('https://vexton.netlify.app/api/health'));
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as {
      ok: boolean;
      authConfigured: boolean;
      missingAuthEnvVars?: string[];
    };
    assert.equal(healthBody.authConfigured, false);
    assert.deepEqual(healthBody.missingAuthEnvVars, [
      'VEXTON_ADMIN_PASSWORD',
      'VEXTON_SECURITY_KEY',
      'VEXTON_SESSION_SECRET',
    ]);

    const loginRes = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'any-admin-candidate' }),
      })
    );
    assert.equal(loginRes.status, 503);
    const loginBody = (await loginRes.json()) as {
      authenticated: boolean;
      errorCode: string;
      missingEnvVars?: string[];
    };
    assert.equal(loginBody.authenticated, false);
    assert.equal(loginBody.errorCode, 'SERVER_CONFIG_ERROR');
    assert.equal(loginBody.missingEnvVars?.length, 3);

    // Log in with all vars present, then remove VEXTON_SECURITY_KEY to verify /api/security/verify returns 503
    process.env.VEXTON_ADMIN_PASSWORD = 'netlify-admin-test-pass';
    process.env.VEXTON_SECURITY_KEY = 'netlify-block-test-key';
    process.env.VEXTON_SESSION_SECRET = 'netlify-session-test-secret-32-bytes';

    const okLogin = await handle(
      new Request('https://vexton.netlify.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'netlify-admin-test-pass' }),
      })
    );
    assert.equal(okLogin.status, 200);
    const cookie = extractCookiePair(okLogin.headers.get('set-cookie'));

    delete process.env.VEXTON_SECURITY_KEY;
    const secVerifyRes = await handle(
      new Request('https://vexton.netlify.app/api/security/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ key: 'netlify-block-test-key' }),
      })
    );
    assert.equal(secVerifyRes.status, 503);
    const secBody = (await secVerifyRes.json()) as {
      valid: boolean;
      errorCode: string;
      missingEnvVars?: string[];
    };
    assert.equal(secBody.valid, false);
    assert.equal(secBody.errorCode, 'SERVER_CONFIG_ERROR');
    assert.deepEqual(secBody.missingEnvVars, ['VEXTON_SECURITY_KEY']);
  } finally {
    if (prevNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = prevNetlify;
    if (prevAdminPwd === undefined) delete process.env.VEXTON_ADMIN_PASSWORD;
    else process.env.VEXTON_ADMIN_PASSWORD = prevAdminPwd;
    if (prevSecKey === undefined) delete process.env.VEXTON_SECURITY_KEY;
    else process.env.VEXTON_SECURITY_KEY = prevSecKey;
    if (prevSessSecret === undefined) delete process.env.VEXTON_SESSION_SECRET;
    else process.env.VEXTON_SESSION_SECRET = prevSessSecret;
  }
});

test('Serverless runtime refuses ephemeral /tmp fallback and returns 503 STORAGE_ERROR when persistent storage is missing', async () => {
  const prevNetlify = process.env.NETLIFY;
  const prevLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const prevBlobsCtxEnv = process.env.NETLIFY_BLOBS_CONTEXT;
  const prevSiteId = process.env.NETLIFY_SITE_ID;
  const prevAuthToken = process.env.NETLIFY_AUTH_TOKEN;
  const prevUpstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const prevUpstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const prevGlobalBlobs = (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext;

  try {
    process.env.NETLIFY = 'true';
    process.env.AWS_LAMBDA_FUNCTION_NAME = 'vexton-api-fn';
    delete process.env.NETLIFY_BLOBS_CONTEXT;
    delete process.env.NETLIFY_SITE_ID;
    delete process.env.NETLIFY_AUTH_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext;

    assert.equal(isServerlessProductionRuntime(), true);
    assert.throws(
      () => resolveNetlifyWorkspaceStore(),
      (err) => err instanceof PersistentStorageUnavailableError
    );

    const res = await netlifyDefaultHandler(
      new Request('https://vexton.netlify.app/api/health')
    );
    assert.equal(res.status, 503);
    const body = (await res.json()) as { errorCode?: string; error?: string };
    assert.equal(body.errorCode, 'STORAGE_ERROR');
    assert.ok(body.error && body.error.length > 0);
  } finally {
    if (prevNetlify === undefined) delete process.env.NETLIFY;
    else process.env.NETLIFY = prevNetlify;
    if (prevLambda === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    else process.env.AWS_LAMBDA_FUNCTION_NAME = prevLambda;
    if (prevBlobsCtxEnv === undefined) delete process.env.NETLIFY_BLOBS_CONTEXT;
    else process.env.NETLIFY_BLOBS_CONTEXT = prevBlobsCtxEnv;
    if (prevSiteId === undefined) delete process.env.NETLIFY_SITE_ID;
    else process.env.NETLIFY_SITE_ID = prevSiteId;
    if (prevAuthToken === undefined) delete process.env.NETLIFY_AUTH_TOKEN;
    else process.env.NETLIFY_AUTH_TOKEN = prevAuthToken;
    if (prevUpstashUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = prevUpstashUrl;
    if (prevUpstashToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = prevUpstashToken;
    if (prevGlobalBlobs === undefined) {
      delete (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext;
    } else {
      (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext = prevGlobalBlobs;
    }
  }
});
