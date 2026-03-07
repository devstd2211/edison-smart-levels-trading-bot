import { LoggerService, Position } from '../../types/legacy';
import { toErrorMessage } from './position-lifecycle-error.utils';
import { syncWithWebSocketPosition } from './position-lifecycle-sync.orchestrator';
import {
  buildWebSocketEntryPriceUpdateLogPayload,
  buildWebSocketRestoreJournalLookupFailureLogPayload,
  buildWebSocketRestoreWithJournalLogPayload,
  buildWebSocketRestoreWithoutJournalLogPayload,
  shouldLogWebSocketEntryPriceUpdate,
} from './position-lifecycle-sync.utils';

type OpenTradeRef = {
  id: string;
};

type SyncWithWebSocketLifecycleParams = {
  currentPosition: Position | null;
  wsPosition: Position;
  getOpenTradeBySymbol: (symbol: string) => OpenTradeRef | null | undefined;
  logger: LoggerService;
};

export function syncWithWebSocketLifecycleOrchestrated(
  params: SyncWithWebSocketLifecycleParams,
): Position {
  const { currentPosition, wsPosition, getOpenTradeBySymbol, logger } = params;
  const result = syncWithWebSocketPosition({
    currentPosition,
    wsPosition,
    getOpenTradeBySymbol,
  });

  if (result.route === 'restored_with_journal') {
    const payload = buildWebSocketRestoreWithJournalLogPayload(result.position);
    logger.info('Position restored from WebSocket with journal ID', payload);
    return result.position;
  }

  if (result.route === 'restored_without_journal') {
    const payload = buildWebSocketRestoreWithoutJournalLogPayload(result.position);
    logger.warn('Position restored from WebSocket but not found in journal - IGNORING from statistics', payload);
    if (result.journalLookupError) {
      const failurePayload = buildWebSocketRestoreJournalLookupFailureLogPayload(
        toErrorMessage(result.journalLookupError),
        result.position.id,
      );
      logger.warn('Journal lookup failed during position restoration - proceeding without journalId', failurePayload);
    }
    return result.position;
  }

  if (shouldLogWebSocketEntryPriceUpdate(result.entryPriceUpdated)) {
    const payload = buildWebSocketEntryPriceUpdateLogPayload(result.position.id, wsPosition.entryPrice);
    logger.info('Entry price updated from WebSocket', payload);
  }

  return result.position;
}
