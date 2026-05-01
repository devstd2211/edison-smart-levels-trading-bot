import type { OrderBook, Tick } from '../../types/advanced-order-flow';

export function calculateOrderFlowVolumes(
  tickBuffer: Tick[],
): { buyVol: number; sellVol: number } {
  let buyVol = 0;
  let sellVol = 0;

  for (const tick of tickBuffer) {
    const volume = tick.price * tick.size;
    if (tick.side === 'BUY') {
      buyVol += volume;
    } else {
      sellVol += volume;
    }
  }

  return { buyVol, sellVol };
}

export function calculateOrderFlowVolumeUsdt(tickBuffer: Tick[]): number {
  return tickBuffer.reduce((total, tick) => total + (tick.price * tick.size), 0);
}

export function cleanupOrderFlowTicks(params: {
  tickBuffer: Tick[];
  currentTime: number;
  tickWindowMs: number;
  maxTickBufferSize: number;
}): Tick[] {
  const { tickBuffer, currentTime, tickWindowMs, maxTickBufferSize } = params;
  const cutoff = currentTime - tickWindowMs;
  const filteredTicks = tickBuffer.filter((tick) => tick.timestamp >= cutoff);

  return filteredTicks.length > maxTickBufferSize
    ? filteredTicks.slice(-maxTickBufferSize)
    : filteredTicks;
}

export function calculateOrderBookSideVolume(
  levels: [number, number][],
  depth: number,
): number {
  return levels.slice(0, depth).reduce((sum, [, quantity]) => sum + quantity, 0);
}

export function getRecentOrderBooks(
  orderbookHistory: OrderBook[],
): { previous: OrderBook | null; current: OrderBook | null } {
  if (orderbookHistory.length < 2) {
    return { previous: null, current: null };
  }

  return {
    previous: orderbookHistory[orderbookHistory.length - 2] ?? null,
    current: orderbookHistory[orderbookHistory.length - 1] ?? null,
  };
}
