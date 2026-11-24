import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVlessBase64Setting,
  calculateRemainingSeconds,
  COUNTRY_META,
  decodeBase64Vless,
  encodeVlessToBase64,
  formatDurationLabel,
  formatRemainingCountdown,
  formatVpnConfigLink,
  hashSecurityKeySync,
  isBase64EncodedVless,
  normalizeVpnCountry,
  parseEndpointFromConfig,
  resolveProtocolConfig,
  VPN_COUNTRIES,
} from './vpnParser';
import { LANGUAGE_OPTIONS, TRANSLATIONS } from '../i18n/translations';
import type { ProtocolConfigTemplate } from '../types/vpn';

test('parseEndpointFromConfig extracts host and port from real VLESS URI', () => {
  const endpoint = parseEndpointFromConfig(
    'VLESS',
    'vless://00000000-0000-0000-0000-000000000000@edge.example.net:443?type=ws&security=tls#NL'
  );
  assert.deepEqual(endpoint, { host: 'edge.example.net', port: 443 });
});

test('parseEndpointFromConfig extracts host and port from Trojan and Hysteria2 URIs', () => {
  const trojan = parseEndpointFromConfig(
    'Trojan',
    'trojan://secretpass@tr.example.org:8443?sni=tr.example.org#DE'
  );
  assert.deepEqual(trojan, { host: 'tr.example.org', port: 8443 });

  const hysteria = parseEndpointFromConfig(
    'Hysteria',
    'hysteria2://authkey@hy.example.com:3443/?insecure=0#SE'
  );
  assert.deepEqual(hysteria, { host: 'hy.example.com', port: 3443 });
});

test('parseEndpointFromConfig extracts host and port from base64 VMess URI', () => {
  const payload = Buffer.from(
    JSON.stringify({ v: '2', ps: 'GB-Node', add: '198.51.100.12', port: '443', id: 'abc' }),
    'utf8'
  ).toString('base64');
  const endpoint = parseEndpointFromConfig('VMess', `vmess://${payload}`);
  assert.deepEqual(endpoint, { host: '198.51.100.12', port: 443 });
});

test('parseEndpointFromConfig extracts host and port from ShadowSocks URI', () => {
  const endpoint = parseEndpointFromConfig(
    'ShadowSocks',
    'ss://YWVzLTI1Ni1nY206cGFzcw==@203.0.113.45:8388#RU'
  );
  assert.deepEqual(endpoint, { host: '203.0.113.45', port: 8388 });
});

test('parseEndpointFromConfig prefers explicit ping endpoint when provided', () => {
  const endpoint = parseEndpointFromConfig(
    'VLESS',
    'invalid-raw-string',
    '192.0.2.10:8080'
  );
  assert.deepEqual(endpoint, { host: '192.0.2.10', port: 8080 });
});

test('parseEndpointFromConfig returns null without inventing addresses on empty/invalid configs', () => {
  assert.equal(parseEndpointFromConfig('VLESS', ''), null);
  assert.equal(parseEndpointFromConfig('VMess', 'vmess://not-valid-base64!!!'), null);
});

test('Localized duration formatting works for ru, en, and tk', () => {
  assert.equal(formatDurationLabel(1, 'days', 'ru'), '1 день');
  assert.equal(formatDurationLabel(2, 'days', 'ru'), '2 дня');
  assert.equal(formatDurationLabel(5, 'days', 'ru'), '5 дней');
  assert.equal(formatDurationLabel(1, 'hours', 'en'), '1 hour');
  assert.equal(formatDurationLabel(12, 'hours', 'en'), '12 hours');
  assert.equal(formatDurationLabel(30, 'days', 'tk'), '30 gün');
  assert.equal(calculateRemainingSeconds(2, 'hours'), 7200);
  assert.equal(calculateRemainingSeconds(3, 'days'), 259200);
});

test('formatRemainingCountdown detects active vs expired timestamps across languages', () => {
  const now = 1_700_000_000_000;
  const futureIso = new Date(now + 3 * 3600 * 1000).toISOString();
  const pastIso = new Date(now - 5000).toISOString();
  assert.deepEqual(formatRemainingCountdown(futureIso, now, 'ru'), {
    expired: false,
    label: 'Осталось 3 часа',
  });
  assert.deepEqual(formatRemainingCountdown(futureIso, now, 'en'), {
    expired: false,
    label: '3h left',
  });
  assert.deepEqual(formatRemainingCountdown(futureIso, now, 'tk'), {
    expired: false,
    label: '3 sagat galdy',
  });
  assert.deepEqual(formatRemainingCountdown(pastIso, now, 'en'), {
    expired: true,
    label: 'Expired',
  });
});

test('VPN_COUNTRIES contains strictly the 6 required countries with flags and alias normalization', () => {
  assert.deepEqual([...VPN_COUNTRIES], [
    'Туркменистан',
    'Россия',
    'Нидерланды',
    'Германия',
    'Британия',
    'Швеция',
  ]);
  assert.equal(COUNTRY_META['Туркменистан'].flag, '🇹🇲');
  assert.equal(COUNTRY_META['Россия'].flag, '🇷🇺');
  assert.equal(COUNTRY_META['Нидерланды'].flag, '🇳🇱');
  assert.equal(COUNTRY_META['Германия'].flag, '🇩🇪');
  assert.equal(COUNTRY_META['Британия'].flag, '🇬🇧');
  assert.equal(COUNTRY_META['Швеция'].flag, '🇸🇪');

  assert.equal(normalizeVpnCountry('Turkmenistan'), 'Туркменистан');
  assert.equal(normalizeVpnCountry('Britain'), 'Британия');
  assert.equal(normalizeVpnCountry('Şwesiýa'), 'Швеция');
  assert.equal(normalizeVpnCountry('Germany'), 'Германия');
});

test('Translations dictionary has complete keys for ru, en, and tk', () => {
  assert.equal(LANGUAGE_OPTIONS.length, 3);
  const ruSections = Object.keys(TRANSLATIONS.ru) as Array<keyof typeof TRANSLATIONS.ru>;
  for (const lang of ['ru', 'en', 'tk'] as const) {
    assert.deepEqual(Object.keys(TRANSLATIONS[lang]).sort(), [...ruSections].sort());
    for (const section of ruSections) {
      assert.deepEqual(
        Object.keys(TRANSLATIONS[lang][section]).sort(),
        Object.keys(TRANSLATIONS.ru[section]).sort()
      );
    }
    assert.equal(VPN_COUNTRIES.every((c) => Boolean(TRANSLATIONS[lang].countries[c]?.name)), true);
  }
});

test('resolveProtocolConfig prioritizes country-specific match before ALL fallback', () => {
  const templates: ProtocolConfigTemplate[] = [
    {
      id: '1',
      protocol: 'VLESS',
      countryScope: 'ALL',
      rawConfig: 'vless://default@all.example:443',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      protocol: 'VLESS',
      countryScope: 'Нидерланды',
      rawConfig: 'vless://nl@nl.example:443',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];
  assert.equal(
    resolveProtocolConfig(templates, 'VLESS', 'Нидерланды')?.rawConfig,
    'vless://nl@nl.example:443'
  );
  assert.equal(
    resolveProtocolConfig(templates, 'VLESS', 'Германия')?.rawConfig,
    'vless://default@all.example:443'
  );
  assert.equal(resolveProtocolConfig(templates, 'Trojan', 'Германия'), null);
});

test('hashSecurityKeySync is deterministic and differentiates inputs', () => {
  const h1 = hashSecurityKeySync('vexton2026');
  const h2 = hashSecurityKeySync('vexton2026');
  const h3 = hashSecurityKeySync('otherkey');
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.equal(h1.length, 64);
});

test('formatVpnConfigLink appends #flag%20name for VLESS, Trojan, Hysteria, and ShadowSocks without altering params', () => {
  // VLESS without existing fragment
  const vless = formatVpnConfigLink({
    protocol: 'VLESS',
    rawConfig: 'vless://11111111-1111-1111-1111-111111111111@edge.example.com:443?type=ws&security=tls',
    country: 'Туркменистан',
    name: 'Turkmenistan',
  });
  assert.equal(
    vless,
    'vless://11111111-1111-1111-1111-111111111111@edge.example.com:443?type=ws&security=tls#🇹🇲%20Turkmenistan'
  );

  // Trojan replacing empty trailing # and preserving query params
  const trojan = formatVpnConfigLink({
    protocol: 'Trojan',
    rawConfig: 'trojan://secret@tr.example.org:8443?sni=tr.example.org&fp=chrome#',
    country: 'Германия',
    name: 'Client DE 01',
  });
  assert.equal(
    trojan,
    'trojan://secret@tr.example.org:8443?sni=tr.example.org&fp=chrome#🇩🇪%20Client%20DE%2001'
  );

  // Hysteria2 replacing existing fragment and preserving query params
  const hysteria = formatVpnConfigLink({
    protocol: 'Hysteria',
    rawConfig: 'hysteria2://authkey@hy.example.com:3443/?insecure=0&sni=hy.example.com#OldTag',
    country: 'Нидерланды',
    name: 'NL-Fast',
  });
  assert.equal(
    hysteria,
    'hysteria2://authkey@hy.example.com:3443/?insecure=0&sni=hy.example.com#🇳🇱%20NL-Fast'
  );

  // ShadowSocks preserving plugin params and encoding spaces/symbols
  const ss = formatVpnConfigLink({
    protocol: 'ShadowSocks',
    rawConfig: 'ss://YWVzLTI1Ni1nY206cGFzcw==@203.0.113.45:8388/?plugin=obfs-local#old',
    country: 'Россия',
    name: 'Москва #1',
  });
  assert.equal(
    ss,
    'ss://YWVzLTI1Ni1nY206cGFzcw==@203.0.113.45:8388/?plugin=obfs-local#🇷🇺%20%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0%20%231'
  );
  assert.equal(decodeURIComponent(ss.split('#')[1]), '🇷🇺 Москва #1');
});

test('formatVpnConfigLink never modifies, decodes, or adds # to VMess Base64 configs', () => {
  const originalVmess =
    'vmess://eyJ2IjoiMiIsInBzIjoiIiwiYWRkIjoiMTk4LjUxLjEwMC4xMiIsInBvcnQiOiI0NDMiLCJpZCI6ImFiYyJ9';
  const result = formatVpnConfigLink({
    protocol: 'VMess',
    rawConfig: `  ${originalVmess}  `,
    country: 'Туркменистан',
    name: 'Turkmenistan',
  });
  assert.equal(result, originalVmess);
  assert.equal(result.includes('#'), false);
});

test('encodeVlessToBase64 produces valid UTF-8 Base64 VPN subscription and prevents double encoding', () => {
  const formattedVless = formatVpnConfigLink({
    protocol: 'VLESS',
    rawConfig:
      'vless://11111111-1111-1111-1111-111111111111@nl.vexton.example:443?type=ws&security=tls&sni=nl.vexton.example',
    country: 'Туркменистан',
    name: 'VIP Client 01',
  });

  const encodedOnce = encodeVlessToBase64(formattedVless);
  assert.equal(encodedOnce.startsWith('vless://'), false);
  assert.equal(isBase64EncodedVless(encodedOnce), true);
  assert.equal(Buffer.from(encodedOnce, 'base64').toString('utf8'), formattedVless);
  assert.equal(decodeBase64Vless(encodedOnce), formattedVless);

  // Idempotent guard: re-encoding already Base64 VLESS must return identical Base64
  const encodedTwice = encodeVlessToBase64(encodedOnce);
  assert.equal(encodedTwice, encodedOnce);

  // Re-formatting a Base64-encoded VLESS (e.g. during edit) preserves params and updates fragment cleanly
  const edited = formatVpnConfigLink({
    protocol: 'VLESS',
    rawConfig: encodedOnce,
    country: 'Германия',
    name: 'VIP Client DE',
  });
  assert.equal(
    edited,
    'vless://11111111-1111-1111-1111-111111111111@nl.vexton.example:443?type=ws&security=tls&sni=nl.vexton.example#🇩🇪%20VIP%20Client%20DE'
  );
});

test('applyVlessBase64Setting toggles Base64 cleanly and parseEndpointFromConfig supports Base64 VLESS', () => {
  const plain =
    'vless://22222222-2222-2222-2222-222222222222@de.node.example:8443?security=reality#🇩🇪%20User';

  const asBase64 = applyVlessBase64Setting({
    protocol: 'VLESS',
    formattedConfig: plain,
    convertToBase64: true,
  });
  assert.equal(Buffer.from(asBase64, 'base64').toString('utf8'), plain);
  assert.deepEqual(parseEndpointFromConfig('VLESS', asBase64), {
    host: 'de.node.example',
    port: 8443,
  });

  // Turning toggle OFF unwraps cleanly back to plain VLESS URI
  const restoredPlain = applyVlessBase64Setting({
    protocol: 'VLESS',
    formattedConfig: asBase64,
    convertToBase64: false,
  });
  assert.equal(restoredPlain, plain);

  // Non-VLESS protocols stay untouched regardless of toggle
  const trojan = 'trojan://pass@tr.example.org:443#🇳🇱%20Node';
  assert.equal(
    applyVlessBase64Setting({
      protocol: 'Trojan',
      formattedConfig: trojan,
      convertToBase64: true,
    }),
    trojan
  );
});
