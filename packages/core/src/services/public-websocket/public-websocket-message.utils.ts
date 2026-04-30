import { Candle, KlineData, OrderbookData, TimeframeRole, TradeData } from '../../types/legacy';
import type { PublicWebSocketBtcConfirmationConfig } from './public-websocket-connection.utils';

export function extractSymbolFromKlineTopic(topic?: string): string {
  if (!topic) {
    return '';
  }

  const parts = topic.split('.');
  if (parts.length >= 3) {
    return parts[2];
  }

  return '';
}

export function mapClosedCandleFromKline(klineData: KlineData): Candle | null {
  if (klineData.confirm !== true) {
    return null;
  }

  return {
    timestamp: parseInt(klineData.start ?? '0'),
    open: parseFloat(klineData.open ?? '0'),
    high: parseFloat(klineData.high ?? '0'),
    low: parseFloat(klineData.low ?? '0'),
    close: parseFloat(klineData.close ?? '0'),
    volume: parseFloat(klineData.volume ?? '0'),
  };
}

export function isBtcKlineTopic(
  topicSymbol: string,
  btcConfirmation?: Pick<PublicWebSocketBtcConfirmationConfig, 'enabled' | 'symbol'>,
): boolean {
  if (!btcConfirmation?.enabled) {
    return false;
  }

  return topicSymbol === (btcConfirmation.symbol || 'BTCUSDT');
}

export function appendBtcCandle(
  candles: Candle[],
  candle: Candle,
  maxCandles: number,
): number {
  candles.push(candle);

  if (candles.length > maxCandles) {
    candles.shift();
  }

  return candles.length;
}

export function findTimeframeRoleByInterval(
  interval: string,
  timeframes: Map<TimeframeRole, { interval: string }>,
): TimeframeRole | null {
  for (const [role, config] of timeframes) {
    if (config.interval === interval) {
      return role;
    }
  }

  return null;
}

export function detectOrderbookSnapshot(
  orderbookData: OrderbookData,
  lastIncompleteWarning: number,
): boolean {
  const bidLevels = orderbookData.b?.length ?? 0;
  const askLevels = orderbookData.a?.length ?? 0;

  return (
    orderbookData.type === 'snapshot' ||
    orderbookData.u === 1 ||
    (!lastIncompleteWarning && bidLevels > 40 && askLevels > 40)
  );
}

export function isOrderbookDataComplete(
  orderbookData: OrderbookData,
): orderbookData is OrderbookData & {
  b: [string, string][];
  a: [string, string][];
} {
  return Array.isArray(orderbookData.b) && Array.isArray(orderbookData.a);
}

export function mapOrderbookUpdateEvent(
  orderbookData: OrderbookData,
  fallbackSymbol: string,
  isSnapshot: boolean,
): {
  type: 'snapshot' | 'delta';
  symbol: string;
  bids: OrderbookData['b'];
  asks: OrderbookData['a'];
  updateId: number;
  timestamp: number;
} {
  return {
    type: isSnapshot ? 'snapshot' : 'delta',
    symbol: orderbookData.s ?? fallbackSymbol,
    bids: orderbookData.b,
    asks: orderbookData.a,
    updateId: orderbookData.u ?? 0,
    timestamp: Date.now(),
  };
}

export function isTradeDataComplete(
  tradeData: TradeData,
): tradeData is TradeData & {
  T: number;
  S: 'Buy' | 'Sell';
  v: string;
  p: string;
} {
  return !!tradeData.T && !!tradeData.S && !!tradeData.v && !!tradeData.p;
}

export function mapTradeEvent(
  tradeData: TradeData & {
    T: number;
    S: 'Buy' | 'Sell';
    v: string;
    p: string;
  },
): {
  timestamp: number;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
} {
  return {
    timestamp: tradeData.T,
    price: parseFloat(tradeData.p),
    quantity: parseFloat(tradeData.v),
    side: tradeData.S === 'Buy' ? 'BUY' : 'SELL',
  };
}
