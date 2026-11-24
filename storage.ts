import type {
  AppLanguage,
  ProtocolConfigTemplate,
  ServerArchitectureConfig,
  VpnCodeRecord,
} from '../types/vpn';

const LEGACY_STORAGE_KEYS = {
  codes: 'vexton_vpn_codes_v1',
  blockTemplates: 'vexton_block_configs_v1',
  architecture: 'vexton_server_architecture_v1',
} as const;

const LANGUAGE_STORAGE_KEY = 'vexton_app_language_v1';
const BASE64_PREF_STORAGE_KEY = 'vexton_convert_vless_base64_v1';

export const DEFAULT_ARCHITECTURE_CONFIG: ServerArchitectureConfig = {
  adapterMode: 'rest_api_ready',
  apiBaseUrl: '',
  authHeaderName: 'Authorization',
  autoPingOnCreate: true,
  syncEndpointPath: '/api/workspace',
  convertVlessToBase64: false,
};

function safeReadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Reads any legacy localStorage records created prior to server DB migration
 * so existing user records are preserved and uploaded once to the shared server.
 */
export function readLegacyWorkspaceForMigration(): {
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
} {
  const codes = safeReadJson<VpnCodeRecord[]>(LEGACY_STORAGE_KEYS.codes, []);
  const blockTemplates = safeReadJson<ProtocolConfigTemplate[]>(
    LEGACY_STORAGE_KEYS.blockTemplates,
    []
  );
  return {
    codes: Array.isArray(codes) ? codes : [],
    blockTemplates: Array.isArray(blockTemplates) ? blockTemplates : [],
  };
}

export function clearLegacySharedStorageKeys(): void {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEYS.codes);
    window.localStorage.removeItem(LEGACY_STORAGE_KEYS.blockTemplates);
    window.localStorage.removeItem(LEGACY_STORAGE_KEYS.architecture);
  } catch {
    // Ignore storage access errors
  }
}

export function loadLanguage(): AppLanguage {
  try {
    const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === 'ru' || raw === 'en' || raw === 'tk') {
      return raw;
    }
  } catch {
    // Fallback below
  }
  return 'ru';
}

export function saveLanguage(lang: AppLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // Ignore storage quota errors
  }
}

export function loadBase64Preference(): boolean {
  try {
    return window.localStorage.getItem(BASE64_PREF_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveBase64Preference(enabled: boolean): void {
  try {
    window.localStorage.setItem(BASE64_PREF_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export function exportWorkspaceJson(payload: {
  codes: VpnCodeRecord[];
  blockTemplates: ProtocolConfigTemplate[];
  architecture: ServerArchitectureConfig;
}): string {
  return JSON.stringify(
    {
      app: 'VEXTON VPN CODE GENERATOR',
      storage: 'shared-server-sqlite',
      exportedAt: new Date().toISOString(),
      codes: payload.codes,
      blockTemplates: payload.blockTemplates,
      architecture: payload.architecture,
    },
    null,
    2
  );
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below for iframe clipboard restrictions
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
