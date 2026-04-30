import WebSocket from 'ws';
import type { TimeframeRole } from '../../types/legacy';

export const WS_PUBLIC_URL = 'wss://stream.bybit.com/v5/public/linear';

export type PublicWebSocketBtcConfirmationConfig = {
  enabled?: boolean;
  timeframe?: string;
  symbol?: string;
  lookbackCandles?: number;
};

export type PublicWebSocketTimeframeConfig = {
  interval: string;
};

export function decodePublicWebSocketMessage(data: WebSocket.Data): string | null {
  if (typeof data === 'string') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf-8');
  }

  return null;
}

export function buildPublicWebSocketTopics(options: {
  symbol: string;
  timeframes: Map<TimeframeRole, PublicWebSocketTimeframeConfig>;
  btcConfirmation?: PublicWebSocketBtcConfirmationConfig;
}): string[] {
  const { symbol, timeframes, btcConfirmation } = options;
  const topics = Array.from(timeframes.values(), (config) => `kline.${config.interval}.${symbol}`);

  topics.push(`orderbook.50.${symbol}`);
  topics.push(`publicTrade.${symbol}`);

  if (btcConfirmation?.enabled) {
    topics.push(
      `kline.${btcConfirmation.timeframe || '1'}.${btcConfirmation.symbol || 'BTCUSDT'}`,
    );
  }

  return topics;
}

export function buildPublicWebSocketSubscriptionMessage(topics: string[]): {
  op: 'subscribe';
  args: string[];
} {
  return {
    op: 'subscribe',
    args: topics,
  };
}
