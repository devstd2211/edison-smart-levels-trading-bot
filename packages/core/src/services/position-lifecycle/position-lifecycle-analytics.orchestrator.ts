import { RecoveryStrategy, ErrorHandler } from '../../errors';
import {
  LoggerService,
  Position,
  PositionSide,
  SessionEntryCondition,
  SessionTradeRecord,
  Signal,
} from '../../types/legacy';
import {
  buildJournalTradeOpenFailureLogPayload,
  buildJournalTradeRecordedLogPayload,
  buildSessionTradeRecordForOpen,
  buildSessionStatsTradeRecordedLogPayload,
  buildSessionStatsTradeRecordFailureLogPayload,
  buildTradeOpenPayload,
  toResilienceExecutionResult,
} from './position-lifecycle-analytics.utils';

type JournalLike = {
  recordTradeOpen: (payload: ReturnType<typeof buildTradeOpenPayload>) => void;
};

type SessionStatsLike = {
  recordTradeEntry: (sessionTrade: SessionTradeRecord) => void;
};

type RecordPositionOpenAnalyticsParams = {
  position: Position;
  signal: Signal;
  side: PositionSide;
  quantity: number;
  journalId: string;
  timestamp: number;
  actualStopLoss: number;
  entrySnapshot?: SessionEntryCondition;
  leverage: number;
  journal: JournalLike;
  sessionStats?: SessionStatsLike;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
};

export async function recordPositionOpenAnalytics(
  params: RecordPositionOpenAnalyticsParams,
): Promise<void> {
  const {
    position,
    signal,
    side,
    quantity,
    journalId,
    timestamp,
    actualStopLoss,
    entrySnapshot,
    leverage,
    journal,
    sessionStats,
    errorHandler,
    logger,
  } = params;

  const tradeOpenPayload = buildTradeOpenPayload({
    journalId,
    symbol: position.symbol,
    side,
    entryPrice: signal.price,
    quantity,
    signal,
    leverage,
  });

  if (errorHandler) {
    const journalResult = await errorHandler.executeAsync(
      async () => {
        journal.recordTradeOpen(tradeOpenPayload);
      },
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
        context: 'PositionLifecycleService.openPosition.recordTradeOpen',
        onFailure: () => {
          logger.warn('Trade opened without journal recording (degraded mode)');
        },
      }
    );

    const retryResult = toResilienceExecutionResult(journalResult);
    if (retryResult.success) {
      const payload = buildJournalTradeRecordedLogPayload(journalId);
      logger.info('Trade recorded in journal', payload);
    } else {
      const payload = buildJournalTradeOpenFailureLogPayload(position.id, retryResult.errorMessage);
      logger.warn('Position opened but journal recording failed', payload);
    }
  } else {
    journal.recordTradeOpen(tradeOpenPayload);
    const payload = buildJournalTradeRecordedLogPayload(journalId);
    logger.info('Trade recorded in journal', payload);
  }

  if (!sessionStats || !entrySnapshot) {
    return;
  }

  const sessionTrade = buildSessionTradeRecordForOpen({
    journalId,
    timestamp,
    signal,
    quantity,
    actualStopLoss,
    entrySnapshot,
  });

  if (errorHandler) {
    const statsResult = await errorHandler.executeAsync(
      async () => {
        sessionStats.recordTradeEntry(sessionTrade);
      },
      {
        strategy: RecoveryStrategy.SKIP,
        context: 'PositionLifecycleService.openPosition.recordTradeEntry',
      }
    );

    const skipResult = toResilienceExecutionResult(statsResult);
    if (skipResult.success) {
      const payload = buildSessionStatsTradeRecordedLogPayload(journalId);
      logger.debug('Trade recorded in session stats', payload);
    } else {
      const payload = buildSessionStatsTradeRecordFailureLogPayload(skipResult.errorMessage);
      logger.warn('Failed to record session stats (non-critical)', payload);
    }
    return;
  }

  sessionStats.recordTradeEntry(sessionTrade);
  const payload = buildSessionStatsTradeRecordedLogPayload(journalId);
  logger.debug('Trade recorded in session stats', payload);
}
