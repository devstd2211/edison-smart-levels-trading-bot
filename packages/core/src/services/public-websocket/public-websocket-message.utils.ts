import { Candle, KlineData, OrderbookData } from '../../types/legacy';

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
