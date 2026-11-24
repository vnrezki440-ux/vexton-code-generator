import type {
  AppLanguage,
  CountryScope,
  ProtocolConfigTemplate,
  TimeUnit,
  VpnCountry,
  VpnProtocol,
} from '../types/vpn';

export const VPN_PROTOCOLS: readonly VpnProtocol[] = [
  'Hysteria',
  'ShadowSocks',
  'VLESS',
  'VMess',
  'Trojan',
] as const;

export const VPN_COUNTRIES: readonly VpnCountry[] = [
  'Туркменистан',
  'Россия',
  'Нидерланды',
  'Германия',
  'Британия',
  'Швеция',
] as const;

export const PROTOCOL_META: Record<
  VpnProtocol,
  { subtitle: string; uriHint: string }
> = {
  Hysteria: {
    subtitle: 'Быстрый транспорт на базе QUIC',
    uriHint: 'hysteria2://... или hysteria://...',
  },
  ShadowSocks: {
    subtitle: 'Лёгкий шифрованный SOCKS5-туннель',
    uriHint: 'ss://...',
  },
  VLESS: {
    subtitle: 'Современный Xray-протокол без лишнего оверхеда',
    uriHint: 'vless://...',
  },
  VMess: {
    subtitle: 'Конфигурация V2Ray с JSON-параметрами',
    uriHint: 'vmess://...',
  },
  Trojan: {
    subtitle: 'Маскировка трафика под HTTPS/TLS',
    uriHint: 'trojan://...',
  },
};

export const COUNTRY_META: Record<
  VpnCountry,
  { flag: string; code: string; region: string }
> = {
  Туркменистан: { flag: '🇹🇲', code: 'TM', region: 'Центральная Азия' },
  Россия: { flag: '🇷🇺', code: 'RU', region: 'Восточная Европа' },
  Нидерланды: { flag: '🇳🇱', code: 'NL', region: 'Западная Европа' },
  Германия: { flag: '🇩🇪', code: 'DE', region: 'Центральная Европа' },
  Британия: { flag: '🇬🇧', code: 'GB', region: 'Северная Европа' },
  Швеция: { flag: '🇸🇪', code: 'SE', region: 'Скандинавия' },
};

const COUNTRY_ALIASES: Record<string, VpnCountry> = {
  туркменистан: 'Туркменистан',
  turkmenistan: 'Туркменистан',
  türkmenistan: 'Туркменистан',
  tm: 'Туркменистан',
  россия: 'Россия',
  russia: 'Россия',
  russiýa: 'Россия',
  ru: 'Россия',
  нидерланды: 'Нидерланды',
  netherlands: 'Нидерланды',
  niderlandlar: 'Нидерланды',
  nl: 'Нидерланды',
  германия: 'Германия',
  germany: 'Германия',
  germaniýa: 'Германия',
  de: 'Германия',
  британия: 'Британия',
  britain: 'Британия',
  'united kingdom': 'Британия',
  'beýik britaniýa': 'Британия',
  britaniýa: 'Британия',
  gb: 'Британия',
  uk: 'Британия',
  швеция: 'Швеция',
  sweden: 'Швеция',
  şwesiýa: 'Швеция',
  se: 'Швеция',
};

export function normalizeVpnCountry(value: unknown): VpnCountry {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (VPN_COUNTRIES.includes(trimmed as VpnCountry)) {
      return trimmed as VpnCountry;
    }
    const mapped = COUNTRY_ALIASES[trimmed.toLowerCase()];
    if (mapped) return mapped;
  }
  return 'Нидерланды';
}

export function getSafeCountryMeta(country: unknown): {
  country: VpnCountry;
  flag: string;
  code: string;
  region: string;
} {
  const normalized = normalizeVpnCountry(country);
  return {
    country: normalized,
    ...COUNTRY_META[normalized],
  };
}

/**
 * Formats a real VPN configuration link with `#<flag>%20<encoded-name>` for
 * VLESS, Trojan, Hysteria, and ShadowSocks without altering any other config parameters.
 * For VMess, returns the original Base64 link untouched (never decodes, re-encodes, or adds #).
 */
export function formatVpnConfigLink(params: {
  protocol: VpnProtocol;
  rawConfig: string;
  country: VpnCountry | string;
  name: string;
}): string {
  const trimmed = params.rawConfig.trim();
  if (!trimmed) return '';

  // Special rule for VMess: never alter Base64, never decode/re-encode, never add name/flag/#
  if (params.protocol === 'VMess' || trimmed.toLowerCase().startsWith('vmess://')) {
    return trimmed;
  }

  // If a VLESS subscription Base64 string was passed in (e.g. during edit), unwrap it once first
  const workingRaw =
    params.protocol === 'VLESS' ? (decodeBase64Vless(trimmed) ?? trimmed) : trimmed;

  // Only format URI-style configs (leave raw JSON configs intact)
  const schemeMatch = /^([a-zA-Z0-9+.-]+):\/\/(.+)$/.exec(workingRaw);
  if (!schemeMatch) {
    return workingRaw;
  }

  const afterSchemeIdx = schemeMatch[1].length + 3;
  const atIdx = workingRaw.indexOf('@', afterSchemeIdx);
  const fragmentSearchStart = atIdx !== -1 ? atIdx + 1 : afterSchemeIdx;
  const hashIdx = workingRaw.indexOf('#', fragmentSearchStart);
  const baseUri = hashIdx !== -1 ? workingRaw.slice(0, hashIdx) : workingRaw;

  const { flag } = getSafeCountryMeta(params.country);
  const cleanName = params.name.trim();
  const fragment = cleanName
    ? `${flag}%20${encodeURIComponent(cleanName)}`
    : flag;

  if (!fragment) {
    return baseUri;
  }

  return `${baseUri}#${fragment}`;
}

export function encodeUtf8ToBase64(input: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64');
  }
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a standard/URL-safe Base64 string only if it decodes cleanly to a single `vless://` URI.
 * Used both to prevent double Base64 encoding and to allow TCP Ping parsing / editing.
 */
export function decodeBase64Vless(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9+.-]+:\/\//.test(trimmed)) return null;
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(trimmed) || trimmed.length % 4 === 1) {
    return null;
  }
  const decoded = decodeBase64Flexible(trimmed);
  if (!decoded) return null;
  const normalized = decoded.trim();
  if (!normalized.toLowerCase().startsWith('vless://')) {
    return null;
  }
  return normalized;
}

export function isBase64EncodedVless(input: string): boolean {
  return decodeBase64Vless(input) !== null;
}

/**
 * Encodes a ready VLESS URI into standard UTF-8 Base64 compatible with VPN subscriptions.
 * Guarantees idempotency so double Base64 encoding never happens.
 */
export function encodeVlessToBase64(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const unwrapped = decodeBase64Vless(trimmed);
  const plainVless = unwrapped ?? trimmed;
  if (!plainVless.toLowerCase().startsWith('vless://')) {
    return trimmed;
  }
  return encodeUtf8ToBase64(plainVless);
}

/**
 * Applies or strips Base64 subscription encoding for VLESS configs based on the toggle state.
 * Never alters non-VLESS protocols and never double-encodes Base64.
 */
export function applyVlessBase64Setting(params: {
  protocol: VpnProtocol;
  formattedConfig: string;
  convertToBase64: boolean;
}): string {
  const trimmed = params.formattedConfig.trim();
  if (!trimmed) return '';
  if (params.protocol !== 'VLESS') {
    return trimmed;
  }
  const plain = decodeBase64Vless(trimmed) ?? trimmed;
  if (!plain.toLowerCase().startsWith('vless://')) {
    return trimmed;
  }
  return params.convertToBase64 ? encodeUtf8ToBase64(plain) : plain;
}

export interface ParsedEndpoint {
  host: string;
  port: number;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function decodeBase64Flexible(input: string): string | null {
  try {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/').trim();
    const padLen = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLen);
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export function parseHostPortString(value: string): ParsedEndpoint | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Handle bracketed IPv6 like [2001:db8::1]:443
  const ipv6Match = /^\[([^\]]+)\]:(\d{1,5})$/.exec(trimmed);
  if (ipv6Match) {
    const host = ipv6Match[1].trim();
    const port = Number(ipv6Match[2]);
    if (host && isValidPort(port)) {
      return { host, port };
    }
    return null;
  }

  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const host = trimmed.slice(0, lastColon).trim();
  const port = Number(trimmed.slice(lastColon + 1).trim());
  if (!host || /\s/.test(host) || !isValidPort(port)) return null;
  return { host, port };
}

export function parseEndpointFromConfig(
  protocol: VpnProtocol,
  rawConfig: string,
  explicitPingEndpoint?: string
): ParsedEndpoint | null {
  if (explicitPingEndpoint) {
    const parsedExplicit = parseHostPortString(explicitPingEndpoint);
    if (parsedExplicit) return parsedExplicit;
  }

  const rawTrimmed = rawConfig.trim();
  if (!rawTrimmed) return null;

  const trimmed =
    protocol === 'VLESS' ? (decodeBase64Vless(rawTrimmed) ?? rawTrimmed) : rawTrimmed;

  if (protocol === 'VMess' || trimmed.startsWith('vmess://')) {
    const payload = trimmed.startsWith('vmess://') ? trimmed.slice(8).split('#')[0] : trimmed;
    const decoded = decodeBase64Flexible(payload);
    if (decoded) {
      try {
        const parsed = JSON.parse(decoded) as { add?: unknown; port?: unknown };
        const host = typeof parsed.add === 'string' ? parsed.add.trim() : '';
        const port = Number(parsed.port);
        if (host && isValidPort(port)) {
          return { host, port };
        }
      } catch {
        // Fall through to URL parsing
      }
    }
  }

  if (trimmed.startsWith('ss://')) {
    const body = trimmed.slice(5).split('#')[0].split('?')[0];
    const atIndex = body.lastIndexOf('@');
    if (atIndex !== -1) {
      const hostPart = body.slice(atIndex + 1);
      const parsed = parseHostPortString(hostPart);
      if (parsed) return parsed;
    } else {
      const decoded = decodeBase64Flexible(body);
      if (decoded) {
        const decodedAt = decoded.lastIndexOf('@');
        if (decodedAt !== -1) {
          const parsed = parseHostPortString(decoded.slice(decodedAt + 1));
          if (parsed) return parsed;
        }
      }
    }
  }

  // Standard URI formats: vless://, trojan://, hysteria://, hysteria2://, hy2://
  const schemeMatch = /^[a-zA-Z0-9+.-]+:\/\/(.+)$/.exec(trimmed);
  if (schemeMatch) {
    const withoutFragment = schemeMatch[1].split('#')[0].split('?')[0];
    const withoutPath = withoutFragment.split('/')[0];
    const atIndex = withoutPath.lastIndexOf('@');
    const authority = atIndex !== -1 ? withoutPath.slice(atIndex + 1) : withoutPath;
    const parsed = parseHostPortString(authority);
    if (parsed) return parsed;
  }

  // Raw JSON config (e.g., Hysteria/Xray JSON)
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as { server?: unknown; address?: unknown; port?: unknown };
      if (typeof json.server === 'string') {
        const parsed = parseHostPortString(json.server);
        if (parsed) return parsed;
      }
      if (typeof json.address === 'string' && json.port !== undefined) {
        const port = Number(json.port);
        if (isValidPort(port)) return { host: json.address.trim(), port };
      }
    } catch {
      return null;
    }
  }

  return null;
}

export function pluralizeRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export function formatDurationLabel(
  amount: number,
  unit: TimeUnit,
  lang: AppLanguage = 'ru'
): string {
  const safeAmount = Math.max(1, Math.floor(amount));
  if (lang === 'en') {
    if (unit === 'minutes') return `${safeAmount} ${safeAmount === 1 ? 'minute' : 'minutes'}`;
    if (unit === 'hours') return `${safeAmount} ${safeAmount === 1 ? 'hour' : 'hours'}`;
    return `${safeAmount} ${safeAmount === 1 ? 'day' : 'days'}`;
  }
  if (lang === 'tk') {
    if (unit === 'minutes') return `${safeAmount} minut`;
    if (unit === 'hours') return `${safeAmount} sagat`;
    return `${safeAmount} gün`;
  }
  if (unit === 'minutes') {
    return `${safeAmount} ${pluralizeRu(safeAmount, 'минута', 'минуты', 'минут')}`;
  }
  if (unit === 'hours') {
    return `${safeAmount} ${pluralizeRu(safeAmount, 'час', 'часа', 'часов')}`;
  }
  return `${safeAmount} ${pluralizeRu(safeAmount, 'день', 'дня', 'дней')}`;
}

export function calculateRemainingSeconds(amount: number, unit: TimeUnit): number {
  const safeAmount = Math.max(1, Math.floor(amount));
  if (unit === 'minutes') return safeAmount * 60;
  if (unit === 'hours') return safeAmount * 3600;
  return safeAmount * 86400;
}

export function formatRemainingCountdown(
  expiresAtIso: string,
  nowMs: number = Date.now(),
  lang: AppLanguage = 'ru'
): {
  expired: boolean;
  label: string;
} {
  const targetMs = new Date(expiresAtIso).getTime();
  if (Number.isNaN(targetMs)) {
    return {
      expired: false,
      label: lang === 'en' ? 'Not set' : lang === 'tk' ? 'Görkezilmedik' : 'Не указано',
    };
  }
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) {
    return {
      expired: true,
      label: lang === 'en' ? 'Expired' : lang === 'tk' ? 'Möhleti gutardy' : 'Истёк',
    };
  }
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) {
    if (lang === 'en') {
      return { expired: false, label: `${totalMinutes}m left` };
    }
    if (lang === 'tk') {
      return { expired: false, label: `${totalMinutes} min galdy` };
    }
    return {
      expired: false,
      label: `Осталось ${totalMinutes} ${pluralizeRu(totalMinutes, 'мин.', 'мин.', 'мин.')}`,
    };
  }
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 48) {
    const remMin = totalMinutes % 60;
    if (lang === 'en') {
      return {
        expired: false,
        label: remMin > 0 ? `${totalHours}h ${remMin}m left` : `${totalHours}h left`,
      };
    }
    if (lang === 'tk') {
      return {
        expired: false,
        label:
          remMin > 0
            ? `${totalHours} sag ${remMin} min galdy`
            : `${totalHours} sagat galdy`,
      };
    }
    return {
      expired: false,
      label:
        remMin > 0
          ? `Осталось ${totalHours} ч ${remMin} мин`
          : `Осталось ${totalHours} ${pluralizeRu(totalHours, 'час', 'часа', 'часов')}`,
    };
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  if (lang === 'en') {
    return {
      expired: false,
      label:
        remHours > 0
          ? `${days}d ${remHours}h left`
          : `${days} ${days === 1 ? 'day' : 'days'} left`,
    };
  }
  if (lang === 'tk') {
    return {
      expired: false,
      label: remHours > 0 ? `${days} gün ${remHours} sag galdy` : `${days} gün galdy`,
    };
  }
  return {
    expired: false,
    label:
      remHours > 0
        ? `Осталось ${days} дн. ${remHours} ч`
        : `Осталось ${days} ${pluralizeRu(days, 'день', 'дня', 'дней')}`,
  };
}

export function resolveProtocolConfig(
  templates: readonly ProtocolConfigTemplate[],
  protocol: VpnProtocol,
  country: VpnCountry
): ProtocolConfigTemplate | null {
  const exactMatch = templates.find(
    (item) =>
      item.protocol === protocol &&
      item.countryScope === country &&
      item.rawConfig.trim().length > 0
  );
  if (exactMatch) return exactMatch;

  const fallbackMatch = templates.find(
    (item) =>
      item.protocol === protocol &&
      item.countryScope === 'ALL' &&
      item.rawConfig.trim().length > 0
  );
  return fallbackMatch ?? null;
}

export function getScopeLabel(scope: CountryScope): string {
  return scope === 'ALL' ? 'Все страны (по умолчанию)' : scope;
}

/**
 * Pure deterministic SHA-256 hash (no browser-only WebCrypto dependency)
 * so security key hashing works uniformly in browser, HTTP contexts, and Node tests.
 */
export function hashSecurityKeySync(secret: string): string {
  const utf8 = encodeUtf8Bytes(secret);
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const bitLen = utf8.length * 8;
  const paddedLen = Math.ceil((utf8.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(utf8);
  padded[utf8.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);
  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getUint32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + k[t] + w[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return h.map((v) => v.toString(16).padStart(8, '0')).join('');
}

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function encodeUtf8Bytes(text: string): Uint8Array {
  return new TextEncoder().encode(`vexton-salt:${text}`);
}
