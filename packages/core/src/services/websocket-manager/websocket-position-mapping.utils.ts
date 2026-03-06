import { Position, PositionData, PositionSide } from '../../types/legacy';

export function parseEntryPriceFromPositionData(posData: PositionData): number {
  if (posData.entryPrice && posData.entryPrice.trim()) {
    const price = parseFloat(posData.entryPrice);
    if (!isNaN(price)) {
      return price;
    }
  }

  if (posData.avgPrice && posData.avgPrice.trim()) {
    const price = parseFloat(posData.avgPrice);
    if (!isNaN(price)) {
      return price;
    }
  }

  return 0;
}

export function mapPositionFromWebSocketData(
  symbol: string,
  posData: PositionData,
  now: number = Date.now(),
): Position {
  const quantity = parseFloat(posData.size ?? '0');

  return {
    id: `${symbol}_${posData.side ?? 'unknown'}`,
    symbol,
    side: posData.side === 'Buy' ? PositionSide.LONG : PositionSide.SHORT,
    quantity,
    entryPrice: parseEntryPriceFromPositionData(posData),
    leverage: parseFloat(posData.leverage ?? '1'),
    marginUsed: parseFloat(posData.positionIM ?? '0'),
    stopLoss: {
      price: 0,
      initialPrice: 0,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: now,
    },
    takeProfits: [],
    openedAt: now,
    unrealizedPnL: parseFloat(posData.unrealisedPnl ?? '0'),
    orderId: '',
    reason: 'WebSocket position update',
    status: 'OPEN',
  };
}
