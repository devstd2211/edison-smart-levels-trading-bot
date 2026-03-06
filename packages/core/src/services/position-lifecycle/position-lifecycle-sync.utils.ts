import { Position } from '../../types/legacy';

export type WebSocketMergeResult = {
  position: Position;
  entryPriceUpdated: boolean;
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
