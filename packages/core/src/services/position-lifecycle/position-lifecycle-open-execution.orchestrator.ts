import { ErrorHandler, RecoveryStrategy } from '../../errors';
import type { IExchange } from '../../interfaces/IExchange';
import { LoggerService, Position, PositionSide, Signal } from '../../types/legacy';
import {
  buildAdditionalTakeProfitSetLogPayload,
  buildAdditionalTakeProfitSetNonCriticalFailureLogPayload,
  buildAdditionalTakeProfitsStartLogPayload,
  buildAtomicOpenResultLogPayload,
  resolveExchangeSide,
  resolveTakeProfitOrderIds,
  resolveTakeProfitPrices,
} from './position-lifecycle-open.utils';
import { buildRetryLogPayload } from './position-lifecycle-preopen.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';

type ExecuteAtomicOpenPositionParams = {
  side: PositionSide;
  quantity: number;
  actualStopLoss: number;
  takeProfits: Signal['takeProfits'] | undefined;
  bybitService: IExchange;
  leverage: number;
  logger: LoggerService;
};

export async function executeAtomicOpenPositionOrchestrated(
  params: ExecuteAtomicOpenPositionParams,
): Promise<{
  openedPosition: Position;
  orderId: string | undefined;
  tpOrderIds: (string | undefined)[];
}> {
  const { side, quantity, actualStopLoss, takeProfits, bybitService, leverage, logger } = params;
  const exchangeSide = resolveExchangeSide(side);
  const tpPrices = resolveTakeProfitPrices(takeProfits);

  const openResult = await ErrorHandler.executeAsync(
    () => bybitService.openPosition({
      symbol: bybitService.getSymbol?.() || 'UNKNOWN',
      side: exchangeSide,
      quantity,
      leverage,
      stopLoss: actualStopLoss,
      takeProfits: tpPrices,
    }),
    {
      strategy: RecoveryStrategy.RETRY,
      retryConfig: {
        maxAttempts: 3,
        initialDelayMs: 500,
        backoffMultiplier: 2,
        maxDelayMs: 5000,
      },
      logger,
      context: 'PositionLifecycleService.openPosition',
      onRetry: (attempt, error, delayMs) => {
        const payload = buildRetryLogPayload(delayMs, error.message);
        logger.warn(`Retrying position open (attempt ${attempt}/3)`, payload);
      },
    }
  );

  if (!openResult.success || !openResult.value) {
    throw openResult.error || new Error('Failed to open position on exchange');
  }

  const openedPosition = openResult.value;
  const orderId = openedPosition.id;
  const resultPayload = buildAtomicOpenResultLogPayload(orderId, side, quantity, tpPrices.length > 0);
  logger.info('Position opened WITH atomic SL/TP protection', resultPayload);
  const tpOrderIds = resolveTakeProfitOrderIds(orderId, tpPrices.length > 0);

  return { openedPosition, orderId, tpOrderIds };
}

type ConfigureAdditionalTakeProfitsParams = {
  signal: Signal;
  quantity: number;
  bybitService: IExchange;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
};

export async function configureAdditionalTakeProfitsOrchestrated(
  params: ConfigureAdditionalTakeProfitsParams,
): Promise<void> {
  const { signal, quantity, bybitService, errorHandler, logger } = params;
  if (!signal.takeProfits || signal.takeProfits.length <= 1) {
    return;
  }

  const startPayload = buildAdditionalTakeProfitsStartLogPayload(signal.takeProfits.length - 1);
  logger.info('Setting additional TP levels', startPayload);

  for (let i = 1; i < signal.takeProfits.length; i++) {
    const tp = signal.takeProfits[i];
    const tpSize = quantity / signal.takeProfits.length;

    if (!bybitService.updateTakeProfitPartial) {
      continue;
    }

    if (errorHandler) {
      const updateTPFn = bybitService.updateTakeProfitPartial.bind(bybitService);
      const tpResult = await errorHandler.executeAsync(
        () => updateTPFn({
          price: tp.price,
          size: tpSize,
          index: i,
        }),
        {
          strategy: RecoveryStrategy.RETRY,
          retryConfig: { maxAttempts: 2, initialDelayMs: 200, backoffMultiplier: 2 },
          context: `PositionLifecycleService.openPosition.updateTakeProfitPartial[TP${i + 1}]`,
        }
      );

      if (tpResult.success) {
        const payload = buildAdditionalTakeProfitSetLogPayload(tp.price, tpSize);
        logger.debug(`TP${i + 1} set`, payload);
      } else {
        const payload = buildAdditionalTakeProfitSetNonCriticalFailureLogPayload(tpResult.error?.message);
        logger.warn(`Failed to set TP${i + 1} level (non-critical)`, payload);
      }
      continue;
    }

    try {
      await bybitService.updateTakeProfitPartial({
        price: tp.price,
        size: tpSize,
        index: i,
      });
      const payload = buildAdditionalTakeProfitSetLogPayload(tp.price, tpSize);
      logger.debug(`TP${i + 1} set`, payload);
    } catch (error) {
      logger.warn(`Failed to set TP${i + 1} level`, {
        error: toErrorMessage(error),
      });
    }
  }
}
