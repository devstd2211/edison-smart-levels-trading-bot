import WebSocket from 'ws';
import { TIMING_CONSTANTS } from '../../constants/technical.constants';
import type { ExchangeConfig } from '../../types/legacy';

const WS_BASE_URL = 'wss://stream.bybit.com/v5/private';
const WS_TESTNET_URL = 'wss://stream-testnet.bybit.com/v5/private';
const WS_DEMO_URL = 'wss://stream-demo.bybit.com/v5/private';

export const PRIVATE_WS_CONNECTION_TIMEOUT_MS = 10000;

export const PRIVATE_WS_CONNECTION_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 5000,
} as const;

export const PRIVATE_WS_AUTH_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 200,
  backoffMultiplier: 2,
  maxDelayMs: 2000,
} as const;

export const PRIVATE_WS_SUBSCRIPTION_TOPICS = [
  'position',
  'execution',
  'order',
] as const;

export type PrivateWebSocketMode = 'DEMO' | 'TESTNET' | 'MAINNET';

export type PrivateWebSocketTarget = {
  url: string;
  mode: PrivateWebSocketMode;
};

export function resolvePrivateWebSocketTarget(
  config: Pick<ExchangeConfig, 'testnet' | 'demo'>,
): PrivateWebSocketTarget {
  if (config.demo) {
    return {
      url: WS_DEMO_URL,
      mode: 'DEMO',
    };
  }

  if (config.testnet) {
    return {
      url: WS_TESTNET_URL,
      mode: 'TESTNET',
    };
  }

  return {
    url: WS_BASE_URL,
    mode: 'MAINNET',
  };
}

export function resolvePrivateWebSocketUrl(config: Pick<ExchangeConfig, 'testnet' | 'demo'>): string {
  return resolvePrivateWebSocketTarget(config).url;
}

export function resolvePrivateWebSocketMode(
  config: Pick<ExchangeConfig, 'testnet' | 'demo'>,
): PrivateWebSocketMode {
  return resolvePrivateWebSocketTarget(config).mode;
}

export function calculateWebSocketBackoffDelay(
  attempt: number,
  retryConfig: {
    baseDelayMs: number;
    backoffMultiplier: number;
    maxDelayMs: number;
  },
): number {
  return Math.min(
    retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
    retryConfig.maxDelayMs,
  );
}

export function decodePrivateWebSocketMessage(data: WebSocket.Data): string | null {
  if (typeof data === 'string') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf-8');
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf-8');
  }

  return null;
}

export function buildPrivateWebSocketSubscriptionMessage(): {
  op: 'subscribe';
  args: readonly ['position', 'execution', 'order'];
} {
  return {
    op: 'subscribe',
    args: PRIVATE_WS_SUBSCRIPTION_TOPICS,
  };
}

export function getReconnectDelayMs(): number {
  return TIMING_CONSTANTS.RECONNECT_DELAY_MS;
}

export function getMaxReconnectAttempts(): number {
  return TIMING_CONSTANTS.MAX_RECONNECT_ATTEMPTS;
}
