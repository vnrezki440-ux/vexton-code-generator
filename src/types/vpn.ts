export type VpnProtocol = 'Hysteria' | 'ShadowSocks' | 'VLESS' | 'VMess' | 'Trojan';

export type VpnCountry =
  | 'Туркменистан'
  | 'Россия'
  | 'Нидерланды'
  | 'Германия'
  | 'Британия'
  | 'Швеция';

export type TimeUnit = 'minutes' | 'hours' | 'days';

export type CountryScope = VpnCountry | 'ALL';

export interface ProtocolConfigTemplate {
  id: string;
  protocol: VpnProtocol;
  countryScope: CountryScope;
  rawConfig: string;
  pingEndpoint?: string;
  note?: string;
  updatedAt: string;
}

export type AppLanguage = 'ru' | 'en' | 'tk';

export type PingErrorCode =
  | 'NO_ENDPOINT'
  | 'TIMEOUT'
  | 'CONNREFUSED'
  | 'NOTFOUND'
  | 'UNREACHABLE'
  | 'NETWORK'
  | 'INVALID_RESPONSE'
  | 'LOCAL_SERVER_ERROR';

export interface PingResult {
  reachable: boolean;
  latencyMs: number | null;
  host: string | null;
  port: number | null;
  method: 'tcp' | 'none';
  checkedAt: string;
  errorCode?: PingErrorCode;
  error?: string;
}

export interface VpnCodeRecord {
  id: string;
  name: string;
  protocol: VpnProtocol;
  country: VpnCountry;
  durationAmount: number;
  durationUnit: TimeUnit;
  durationLabel: string;
  expiresAt: string;
  createdAt: string;
  updatedAt?: string;
  rawConfig: string;
  pingEndpoint?: string;
  configSource: 'block_fix' | 'manual' | 'pending';
  lastPing?: PingResult;
}

export interface ServerArchitectureConfig {
  adapterMode: 'local_only' | 'rest_api_ready';
  apiBaseUrl: string;
  authHeaderName: string;
  autoPingOnCreate: boolean;
  syncEndpointPath: string;
  convertVlessToBase64?: boolean;
}

export type SyncSocketEvent =
  | { type: 'sync:connected'; connectedClients: number; serverTime: string }
  | { type: 'clients:count'; count: number }
  | { type: 'code:created'; record: VpnCodeRecord }
  | { type: 'code:updated'; record: VpnCodeRecord }
  | { type: 'code:deleted'; id: string }
  | { type: 'codes:cleared' }
  | { type: 'template:upserted'; template: ProtocolConfigTemplate }
  | { type: 'template:deleted'; id: string }
  | { type: 'architecture:updated'; architecture: ServerArchitectureConfig }
  | {
      type: 'workspace:sync';
      codes: VpnCodeRecord[];
      blockTemplates: ProtocolConfigTemplate[];
      architecture: ServerArchitectureConfig;
      revision?: number;
    };

export type AppScreen = 'dashboard' | 'create' | 'result' | 'settings' | 'security_block';
