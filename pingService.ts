import type { PingErrorCode, PingResult, VpnProtocol } from '../types/vpn';
import { parseEndpointFromConfig } from '../utils/vpnParser';
import { apiFetch } from './syncClient';

export interface PingProbeParams {
  protocol: VpnProtocol;
  rawConfig: string;
}

export interface VpnServerAdapter {
  readonly id: string;
  probeEndpoint(params: PingProbeParams): Promise<PingResult>;
}

export type SecurityVerifyErrorCode =
  | 'EMPTY'
  | 'INVALID_KEY'
  | 'SERVER_ERROR'
  | 'SERVER_CONFIG_ERROR';

export async function verifySecurityKeyOnServer(key: string): Promise<{
  valid: boolean;
  errorCode?: SecurityVerifyErrorCode;
}> {
  const trimmed = key.trim();
  if (!trimmed) {
    return { valid: false, errorCode: 'EMPTY' };
  }

  try {
    const response = await apiFetch('/api/security/verify', {
      method: 'POST',
      body: JSON.stringify({ key: trimmed }),
    });

    const data = (await response.json()) as {
      valid?: boolean;
      errorCode?: SecurityVerifyErrorCode;
    };

    if (response.ok && data.valid === true) {
      return { valid: true };
    }

    return {
      valid: false,
      errorCode: data.errorCode ?? 'INVALID_KEY',
    };
  } catch {
    return { valid: false, errorCode: 'SERVER_ERROR' };
  }
}

export class LocalBackendServerAdapter implements VpnServerAdapter {
  readonly id = 'local-backend-tcp';

  async probeEndpoint(params: PingProbeParams): Promise<PingResult> {
    const parsed = parseEndpointFromConfig(params.protocol, params.rawConfig);
    const checkedAt = new Date().toISOString();

    if (!parsed) {
      return {
        reachable: false,
        latencyMs: null,
        host: null,
        port: null,
        method: 'none',
        checkedAt,
        errorCode: 'NO_ENDPOINT',
      };
    }

    try {
      const response = await apiFetch('/api/ping', {
        method: 'POST',
        body: JSON.stringify({ host: parsed.host, port: parsed.port }),
      });

      const data = (await response.json()) as {
        reachable?: boolean;
        latencyMs?: number | null;
        errorCode?: PingErrorCode;
        error?: string;
      };

      if (!response.ok && typeof data.reachable !== 'boolean') {
        return {
          reachable: false,
          latencyMs: null,
          host: parsed.host,
          port: parsed.port,
          method: 'tcp',
          checkedAt,
          errorCode: 'INVALID_RESPONSE',
          error: data.error,
        };
      }

      return {
        reachable: Boolean(data.reachable),
        latencyMs: typeof data.latencyMs === 'number' ? data.latencyMs : null,
        host: parsed.host,
        port: parsed.port,
        method: 'tcp',
        checkedAt,
        errorCode: data.errorCode,
        error: data.error,
      };
    } catch {
      return {
        reachable: false,
        latencyMs: null,
        host: parsed.host,
        port: parsed.port,
        method: 'tcp',
        checkedAt,
        errorCode: 'LOCAL_SERVER_ERROR',
      };
    }
  }
}

export const vextonServerAdapter: VpnServerAdapter = new LocalBackendServerAdapter();
