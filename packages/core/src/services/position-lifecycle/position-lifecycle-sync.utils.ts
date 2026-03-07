import { Position } from '../../types/legacy';

export type WebSocketMergeResult = {
  position: Position;
  entryPriceUpdated: boolean;
};

export type WebSocketSyncRoute = 'restore' | 'update';

export type WebSocketRestoreWithJournalLogPayload = {
  exchangeId: string;
  journalId?: string;
  symbol: string;
};

export type WebSocketRestoreWithoutJournalLogPayload = {
  exchangeId: string;
  symbol: string;
  entryPrice: number;
  quantity: number;
  note: string;
};

export type WebSocketEntryPriceUpdateLogPayload = {
  positionId: string;
  entryPrice: number;
};

export type WebSocketRestoreJournalLookupFailureLogPayload = {
  error: string;
  positionId: string;
};

export function applyWebSocketPositionUpdate(
  currentPosition: Position,
  wsPosition: Position,
): WebSocketMergeResult {
  currentPosition.quantity = wsPosition.quantity;
  currentPosition.unrealizedPnL = wsPosition.unrealizedPnL;

  if (wsPosition.entryPrice > 0 && currentPosition.entryPrice === 0) {
    currentPosition.entryPrice = wsPosition.entryPrice;
    return { position: currentPosition, entryPriceUpdated: true };
  }

  return { position: currentPosition, entryPriceUpdated: false };
}

export function restoreWebSocketPosition(
  position: Position,
  journalId?: string,
): Position {
  position.journalId = journalId;

  if (!position.status) {
    position.status = 'OPEN';
  }

  return position;
}

export function clonePositionSnapshot(position: Position): Position {
  return JSON.parse(JSON.stringify(position)) as Position;
}

export function buildWebSocketRestoreWithJournalLogPayload(
  position: Position,
): WebSocketRestoreWithJournalLogPayload {
  return {
    exchangeId: position.id,
    journalId: position.journalId,
    symbol: position.symbol,
  };
}

export function buildWebSocketRestoreWithoutJournalLogPayload(
  position: Position,
): WebSocketRestoreWithoutJournalLogPayload {
  return {
    exchangeId: position.id,
    symbol: position.symbol,
    entryPrice: position.entryPrice,
    quantity: position.quantity,
    note: 'This position will be managed (TP/SL) but NOT recorded in journal.',
  };
}

export function buildWebSocketEntryPriceUpdateLogPayload(
  positionId: string,
  entryPrice: number,
): WebSocketEntryPriceUpdateLogPayload {
  return {
    positionId,
    entryPrice,
  };
}

export function buildWebSocketRestoreJournalLookupFailureLogPayload(
  errorMessage: string,
  positionId: string,
): WebSocketRestoreJournalLookupFailureLogPayload {
  return {
    error: errorMessage,
    positionId,
  };
}

export function resolveWebSocketSyncRoute(
  currentPosition: Position | null,
): WebSocketSyncRoute {
  return currentPosition === null ? 'restore' : 'update';
}

export function shouldLogWebSocketEntryPriceUpdate(entryPriceUpdated: boolean): boolean {
  return entryPriceUpdated;
}
