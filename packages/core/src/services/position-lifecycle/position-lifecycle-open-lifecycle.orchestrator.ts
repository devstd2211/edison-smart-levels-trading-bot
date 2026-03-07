import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../../constants';
import { Config, LoggerService, Position, PositionSide, SessionEntryCondition, Signal, TradingConfig, RiskManagementConfig } from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';
import { ErrorHandler } from '../../errors';
import { TradingJournalService } from '../trading-journal.service';
import { TelegramService } from '../telegram.service';
import { BotEventBus } from '../event-bus';
import { SessionStatsService } from '../session-stats.service';
import { CompoundInterestCalculatorService } from '../compound-interest-calculator.service';
import type { DynamicPositionSizerService } from '../dynamic-position-sizer.service';
import { TakeProfitManagerService } from '../take-profit-manager.service';
import { buildAtomicOpenRequestLogPayload, buildOpenedPosition, buildPositionOpenedSuccessLogPayload } from './position-lifecycle-open.utils';
import { buildPositionSizingCompletedLogPayload, buildStopLossCalculatedLogPayload } from './position-lifecycle-sizing.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';
import { calculatePositionSizeOrchestrated } from './position-lifecycle-sizing.orchestrator';
import { prepareOpenExecutionContextOrchestrated } from './position-lifecycle-preopen.orchestrator';
import { executeAtomicOpenPositionOrchestrated, configureAdditionalTakeProfitsOrchestrated } from './position-lifecycle-open-execution.orchestrator';
import { wireOpenedPositionStateOrchestrated } from './position-lifecycle-state.orchestrator';
import { notifyPositionOpenedWithResilienceOrchestrated } from './position-lifecycle-notification.orchestrator';
import { recordPositionOpenAnalytics } from './position-lifecycle-analytics.orchestrator';

type OpenPositionLifecycleParams = {
  signal: Signal;
  entrySnapshot?: SessionEntryCondition;
  bybitService: IExchange;
  tradingConfig: TradingConfig;
  riskConfig: RiskManagementConfig;
  logger: LoggerService;
  journal: TradingJournalService;
  sessionStats?: SessionStatsService;
  errorHandler?: ErrorHandler;
  strategyId?: string;
  eventBus: BotEventBus;
  telegram: TelegramService;
  fullConfig: Config;
  compoundInterestCalculator?: CompoundInterestCalculatorService;
  dynamicPositionSizer?: DynamicPositionSizerService;
  hasRepository: boolean;
  writeStoredPosition: (position: Position | null) => void;
};

export async function openPositionLifecycleOrchestrated(
  params: OpenPositionLifecycleParams,
): Promise<{ position: Position; takeProfitManager: TakeProfitManagerService }> {
  const {
    signal,
    entrySnapshot,
    bybitService,
    tradingConfig,
    riskConfig,
    logger,
    journal,
    sessionStats,
    errorHandler,
    strategyId,
    eventBus,
    telegram,
    fullConfig,
    compoundInterestCalculator,
    dynamicPositionSizer,
    hasRepository,
    writeStoredPosition,
  } = params;

  try {
    const sizingResult = await calculatePositionSizeOrchestrated({
      signal,
      bybitService,
      riskConfig,
      leverage: tradingConfig.leverage,
      fullConfig,
      logger,
      compoundInterestCalculator,
      dynamicPositionSizer,
    });
    const sizingPayload = buildPositionSizingCompletedLogPayload(sizingResult, DECIMAL_PLACES.PERCENT);
    logger.info('Position sizing completed', sizingPayload);

    const openContext = await prepareOpenExecutionContextOrchestrated({
      signal,
      bybitService,
      errorHandler,
      logger,
    });
    const { side, slDistance, currentPrice, actualStopLoss } = openContext;
    const stopLossPayload = buildStopLossCalculatedLogPayload(
      {
        signalPrice: signal.price,
        currentPrice,
        slDistance,
        actualStopLoss,
      },
      PERCENT_MULTIPLIER,
      DECIMAL_PLACES.PERCENT,
    );
    logger.info('Stop-loss calculated', stopLossPayload);

    const atomicOpenRequestPayload = buildAtomicOpenRequestLogPayload({
      side,
      quantity: sizingResult.quantity,
      entryPrice: signal.price,
      stopLoss: actualStopLoss,
      leverage: tradingConfig.leverage,
    });
    logger.info('Opening position on exchange with atomic SL/TP protection', atomicOpenRequestPayload);

    const atomicOpen = await executeAtomicOpenPositionOrchestrated({
      side,
      quantity: sizingResult.quantity,
      actualStopLoss,
      takeProfits: signal.takeProfits,
      bybitService,
      leverage: tradingConfig.leverage,
      logger,
    });
    const { openedPosition, orderId, tpOrderIds } = atomicOpen;

    await configureAdditionalTakeProfitsOrchestrated({
      signal,
      quantity: sizingResult.quantity,
      bybitService,
      errorHandler,
      logger,
    });

    const timestamp = Date.now();
    const symbol = bybitService.getSymbol?.() || 'UNKNOWN';
    const position = buildOpenedPosition({
      symbol,
      side,
      quantity: sizingResult.quantity,
      entryPrice: signal.price,
      leverage: tradingConfig.leverage,
      marginUsed: sizingResult.marginUsed,
      stopLossPrice: actualStopLoss,
      takeProfits: signal.takeProfits,
      tpOrderIds,
      orderId: orderId ?? openedPosition.id,
      timestamp,
    });
    const journalId = position.journalId || `${position.id}_${timestamp}`;

    const takeProfitManager = wireOpenedPositionStateOrchestrated({
      position,
      signal,
      leverage: tradingConfig.leverage,
      strategyId,
      logger,
      eventBus,
      errorHandler,
      hasRepository,
      writeStoredPosition,
    });

    await notifyPositionOpenedWithResilienceOrchestrated({
      position,
      telegram,
      logger,
    });
    await recordPositionOpenAnalytics({
      position,
      signal,
      side: side as PositionSide,
      quantity: sizingResult.quantity,
      journalId,
      timestamp,
      actualStopLoss,
      entrySnapshot,
      leverage: tradingConfig.leverage,
      journal,
      sessionStats,
      errorHandler,
      logger,
    });

    const openedPayload = buildPositionOpenedSuccessLogPayload(position, side as PositionSide);
    logger.info('Position opened successfully', openedPayload);

    return { position, takeProfitManager };
  } catch (error) {
    logger.error('Failed to open position', {
      error: toErrorMessage(error),
    });
    throw error;
  }
}
