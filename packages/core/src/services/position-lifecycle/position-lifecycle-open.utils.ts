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

type AtomicOpenRequestLogPayload = {
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry: number;
  sl: number;
  leverage: number;
};

type AtomicOpenResultLogPayload = {
  orderId: string | undefined;
  side: 'LONG' | 'SHORT';
  quantity: number;
  slSet: boolean;
  tpSet: boolean;
};

type PositionOpenedSuccessLogPayload = {
  positionId: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  quantity: number;
};

type PositionIdLogPayload = {
  positionId: string;
};

type AdditionalTakeProfitsStartLogPayload = {
  additionalLevels: number;
};

type AdditionalTakeProfitSetLogPayload = {
  price: number;
  size: number;
};

type AdditionalTakeProfitSetNonCriticalFailureLogPayload = {
  error?: string;
};

type PositionLifecycleEventPayload = {
  position: Position;
  strategyId?: string;
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

export function resolveExchangeSide(side: PositionSide): 'Buy' | 'Sell' {
  return side === PositionSide.LONG ? 'Buy' : 'Sell';
}

export function resolveTakeProfitPrices(
  takeProfits: Signal['takeProfits'] | undefined,
): number[] {
  return takeProfits && takeProfits.length > 0
    ? takeProfits.map(tp => tp.price)
    : [];
}

export function resolveTakeProfitOrderIds(
  orderId: string | undefined,
  hasTakeProfits: boolean,
): (string | undefined)[] {
  const tpOrderIds: (string | undefined)[] = [];
  if (hasTakeProfits) {
    tpOrderIds.push(orderId);
  }
  return tpOrderIds;
}

export function formatPositionSideForLog(side: PositionSide): 'LONG' | 'SHORT' {
  return side === PositionSide.LONG ? 'LONG' : 'SHORT';
}

export function buildAtomicOpenRequestLogPayload(params: {
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  leverage: number;
}): AtomicOpenRequestLogPayload {
  const { side, quantity, entryPrice, stopLoss, leverage } = params;
  return {
    side: formatPositionSideForLog(side),
    quantity,
    entry: entryPrice,
    sl: stopLoss,
    leverage,
  };
}

export function buildAtomicOpenResultLogPayload(
  orderId: string | undefined,
  side: PositionSide,
  quantity: number,
  tpConfigured: boolean,
): AtomicOpenResultLogPayload {
  return {
    orderId,
    side: formatPositionSideForLog(side),
    quantity,
    slSet: true,
    tpSet: tpConfigured,
  };
}

export function buildPositionOpenedSuccessLogPayload(
  position: Position,
  side: PositionSide,
): PositionOpenedSuccessLogPayload {
  return {
    positionId: position.id,
    side: formatPositionSideForLog(side),
    entry: position.entryPrice,
    quantity: position.quantity,
  };
}

export function buildPositionIdLogPayload(positionId: string): PositionIdLogPayload {
  return { positionId };
}

export function buildAdditionalTakeProfitsStartLogPayload(
  additionalLevels: number,
): AdditionalTakeProfitsStartLogPayload {
  return { additionalLevels };
}

export function buildAdditionalTakeProfitSetLogPayload(
  price: number,
  size: number,
): AdditionalTakeProfitSetLogPayload {
  return { price, size };
}

export function buildAdditionalTakeProfitSetNonCriticalFailureLogPayload(
  errorMessage?: string,
): AdditionalTakeProfitSetNonCriticalFailureLogPayload {
  return { error: errorMessage };
}

export function buildTelegramNotificationSkippedLogMessage(): string {
  return 'Telegram notification skipped due to error';
}

export function buildPositionLifecycleEventPayload(
  position: Position,
  strategyId?: string,
): PositionLifecycleEventPayload {
  return {
    position,
    strategyId,
  };
}
