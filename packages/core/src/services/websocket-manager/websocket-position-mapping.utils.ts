import { PositionSide } from '../../types/enums';
import type { PositionData } from '../../types/events/websocket.types';
import type { Position } from '../../types/position/types';

export type WebSocketPositionMappingInput = Pick<
  PositionData,
  'avgPrice' | 'entryPrice' | 'leverage' | 'positionIM' | 'side' | 'size' | 'unrealisedPnl'
>;

export function parseWebSocketPositionNumber(
  value: string | undefined,
  fallback: number = 0,
): number {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function parseEntryPriceFromPositionData(
  posData: Pick<WebSocketPositionMappingInput, 'avgPrice' | 'entryPrice'>,
): number {
  return parseWebSocketPositionNumber(
    posData.entryPrice,
    parseWebSocketPositionNumber(posData.avgPrice),
  );
}

function resolveWebSocketPositionSide(side: string | undefined): PositionSide {
  return side === 'Buy' ? PositionSide.LONG : PositionSide.SHORT;
}

function createDefaultPositionStopLoss(now: number): Position['stopLoss'] {
  return {
    price: 0,
    initialPrice: 0,
    isBreakeven: false,
    isTrailing: false,
    updatedAt: now,
  };
}

export function mapPositionFromWebSocketData(
  symbol: string,
  posData: WebSocketPositionMappingInput,
  now: number = Date.now(),
): Position {
  return {
    id: `${symbol}_${posData.side ?? 'unknown'}`,
    symbol,
    side: resolveWebSocketPositionSide(posData.side),
    quantity: parseWebSocketPositionNumber(posData.size),
    entryPrice: parseEntryPriceFromPositionData(posData),
    leverage: parseWebSocketPositionNumber(posData.leverage, 1),
    marginUsed: parseWebSocketPositionNumber(posData.positionIM),
    stopLoss: createDefaultPositionStopLoss(now),
    takeProfits: [],
    openedAt: now,
    unrealizedPnL: parseWebSocketPositionNumber(posData.unrealisedPnl),
    orderId: '',
    reason: 'WebSocket position update',
    status: 'OPEN',
  };
}
