import { Position } from '../../types/legacy';
import {
  applyWebSocketPositionUpdate,
  resolveWebSocketSyncRoute,
  restoreWebSocketPosition,
} from './position-lifecycle-sync.utils';

type OpenTradeRef = {
  id: string;
};

type SyncRouteResult =
  | {
      route: 'restored_with_journal';
      position: Position;
    }
  | {
      route: 'restored_without_journal';
      position: Position;
      journalLookupError?: unknown;
    }
  | {
      route: 'updated';
      position: Position;
      entryPriceUpdated: boolean;
    };

type SyncWithWebSocketInput = {
  currentPosition: Position | null;
  wsPosition: Position;
  getOpenTradeBySymbol: (symbol: string) => OpenTradeRef | null | undefined;
};

export function syncWithWebSocketPosition(input: SyncWithWebSocketInput): SyncRouteResult {
  const { currentPosition, wsPosition, getOpenTradeBySymbol } = input;
  const route = resolveWebSocketSyncRoute(currentPosition);

  if (route === 'restore' || currentPosition === null) {
    try {
      const openTrade = getOpenTradeBySymbol(wsPosition.symbol);
      if (openTrade) {
        return {
          route: 'restored_with_journal',
          position: restoreWebSocketPosition(wsPosition, openTrade.id),
        };
      }

      return {
        route: 'restored_without_journal',
        position: restoreWebSocketPosition(wsPosition, undefined),
      };
    } catch (journalLookupError) {
      return {
        route: 'restored_without_journal',
        position: restoreWebSocketPosition(wsPosition, undefined),
        journalLookupError,
      };
    }
  }

  const { position, entryPriceUpdated } = applyWebSocketPositionUpdate(currentPosition, wsPosition);
  return {
    route: 'updated',
    position,
    entryPriceUpdated,
  };
}
