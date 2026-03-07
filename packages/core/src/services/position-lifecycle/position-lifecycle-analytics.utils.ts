import {
  ExitType,
  PositionSide,
  SessionEntryCondition,
  SessionTradeRecord,
  Signal,
} from '../../types/legacy';

export type TradeOpenPayload = {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  leverage: number;
  entryCondition: {
    signal: Signal;
  };
};

export type ResilienceExecutionResult = {
  success: boolean;
  errorMessage?: string;
};

type BuildTradeOpenPayloadInput = {
  journalId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  signal: Signal;
  leverage: number;
};

type BuildSessionTradeRecordForOpenInput = {
  journalId: string;
  timestamp: number;
  signal: Signal;
  quantity: number;
  actualStopLoss: number;
  entrySnapshot: SessionEntryCondition;
};

export function buildTradeOpenPayload(input: BuildTradeOpenPayloadInput): TradeOpenPayload {
  const { journalId, symbol, side, entryPrice, quantity, signal, leverage } = input;
  return {
    id: journalId,
    symbol,
    side,
    entryPrice,
    quantity,
    leverage,
    entryCondition: {
      signal,
    },
  };
}

export function buildSessionTradeRecordForOpen(
  input: BuildSessionTradeRecordForOpenInput,
): SessionTradeRecord {
  const { journalId, timestamp, signal, quantity, actualStopLoss, entrySnapshot } = input;

  return {
    tradeId: journalId,
    timestamp: new Date(timestamp).toISOString(),
    direction: signal.direction,
    entryPrice: signal.price,
    exitPrice: 0,
    quantity,
    pnl: 0,
    pnlPercent: 0,
    exitType: ExitType.MANUAL,
    tpHitLevels: [],
    holdingTimeMs: 0,
    entryCondition: entrySnapshot,
    stopLoss: {
      initial: actualStopLoss,
      final: actualStopLoss,
      movedToBreakeven: false,
      trailingActivated: false,
    },
  };
}

export function toResilienceExecutionResult(result: {
  success: boolean;
  error?: { message?: string };
}): ResilienceExecutionResult {
  return {
    success: result.success,
    errorMessage: result.error?.message,
  };
}

export function buildJournalTradeOpenFailureLogPayload(
  positionId: string,
  errorMessage?: string,
): { positionId: string; error?: string; note: string } {
  return {
    positionId,
    error: errorMessage,
    note: 'Position will be managed but not recorded in journal',
  };
}

export function buildJournalTradeRecordedLogPayload(
  journalId: string,
): { journalId: string } {
  return { journalId };
}

export function buildSessionStatsTradeRecordedLogPayload(
  tradeId: string,
): { tradeId: string } {
  return { tradeId };
}

export function buildSessionStatsTradeRecordFailureLogPayload(
  errorMessage?: string,
): { error?: string } {
  return { error: errorMessage };
}
