import { Position, PositionSide, Signal } from '../../types/legacy';

type BuildOpenedPositionInput = {
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  leverage: number;
  marginUsed: number;
  stopLossPrice: number;
  takeProfits: Signal['takeProfits'] | undefined;
  tpOrderIds: (string | undefined)[];
  orderId: string;
  timestamp: number;
};

export function buildOpenedPosition(input: BuildOpenedPositionInput): Position {
  const sideName = input.side === PositionSide.LONG ? 'Buy' : 'Sell';
  const exchangeId = `${input.symbol}_${sideName}`;
  const journalId = `${exchangeId}_${input.timestamp}`;

  return {
    id: exchangeId,
    journalId,
    symbol: input.symbol,
    side: input.side,
    quantity: input.quantity,
    entryPrice: input.entryPrice,
    leverage: input.leverage,
    marginUsed: input.marginUsed,
    stopLoss: {
      price: input.stopLossPrice,
      initialPrice: input.stopLossPrice,
      orderId: undefined,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: input.timestamp,
    },
    takeProfits: (input.takeProfits || []).map((tp, i) => ({
      ...tp,
      orderId: input.tpOrderIds[i] || undefined,
      hit: false,
    })),
    openedAt: input.timestamp,
    unrealizedPnL: 0,
    orderId: input.orderId,
    reason: 'Position opened',
    protectionVerifiedOnce: true,
    status: 'OPEN',
  };
}
