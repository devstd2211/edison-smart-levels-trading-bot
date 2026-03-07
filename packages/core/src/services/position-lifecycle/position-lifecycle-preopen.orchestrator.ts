import { ErrorHandler, RecoveryStrategy } from '../../errors';
import type { IExchange } from '../../interfaces/IExchange';
import { LoggerService, PositionSide, Signal, SignalDirection } from '../../types/legacy';
import {
  buildCurrentPriceFallbackLogPayload,
  buildHangingOrderCancellationFailedLogPayload,
  buildHangingOrderCancellationNonBlockingFailureLogPayload,
  buildHangingOrderCancellationSkippedLogPayload,
  buildHangingOrderCancellationStartLogMessage,
  buildRetryLogPayload,
  resolveCurrentPriceWithFallback,
  shouldLogHangingOrderCancellationSkipped,
} from './position-lifecycle-preopen.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';

type PrepareOpenExecutionContextParams = {
  signal: Signal;
  bybitService: IExchange;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
};

export async function prepareOpenExecutionContextOrchestrated(
  params: PrepareOpenExecutionContextParams,
): Promise<{
  side: PositionSide;
  slDistance: number;
  currentPrice: number;
  actualStopLoss: number;
}> {
  const { signal, bybitService, errorHandler, logger } = params;
  await cancelHangingOrdersBeforeOpenOrchestrated({ bybitService, errorHandler, logger });

  const isLong = signal.direction === SignalDirection.LONG;
  const side = isLong ? PositionSide.LONG : PositionSide.SHORT;
  const slDistance = Math.abs(signal.stopLoss - signal.price);
  const currentPrice = await resolveCurrentPriceForOpenOrchestrated({
    bybitService,
    errorHandler,
    logger,
    signalPrice: signal.price,
  });
  const actualStopLoss = isLong ? currentPrice - slDistance : currentPrice + slDistance;

  return { side, slDistance, currentPrice, actualStopLoss };
}

type CancelHangingOrdersBeforeOpenParams = {
  bybitService: IExchange;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
};

async function cancelHangingOrdersBeforeOpenOrchestrated(
  params: CancelHangingOrdersBeforeOpenParams,
): Promise<void> {
  const { bybitService, errorHandler, logger } = params;
  const message = buildHangingOrderCancellationStartLogMessage();
  logger.debug(message);

  if (errorHandler) {
    const cancelResult = await errorHandler.executeAsync(
      () => bybitService.cancelAllConditionalOrders(),
      {
        strategy: RecoveryStrategy.RETRY,
        retryConfig: { maxAttempts: 2, initialDelayMs: 100, backoffMultiplier: 2 },
        context: 'PositionLifecycleService.openPosition.cancelAllConditionalOrders',
        onFailure: () => {
          const payload = buildHangingOrderCancellationNonBlockingFailureLogPayload();
          logger.warn('Failed to cancel hanging orders (non-blocking)', payload);
        },
      }
    );

    if (shouldLogHangingOrderCancellationSkipped(cancelResult.success)) {
      const payload = buildHangingOrderCancellationSkippedLogPayload(cancelResult.error?.message);
      logger.warn('Hanging order cancellation skipped, proceeding with position open', payload);
    }
    return;
  }

  try {
    await bybitService.cancelAllConditionalOrders();
  } catch (error) {
    const payload = buildHangingOrderCancellationFailedLogPayload(toErrorMessage(error));
    logger.warn('Failed to cancel hanging orders', payload);
  }
}

type ResolveCurrentPriceForOpenParams = {
  bybitService: IExchange;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
  signalPrice: number;
};

async function resolveCurrentPriceForOpenOrchestrated(
  params: ResolveCurrentPriceForOpenParams,
): Promise<number> {
  const { bybitService, errorHandler, logger, signalPrice } = params;
  if (!errorHandler) {
    return bybitService.getCurrentPrice();
  }

  const priceResult = await errorHandler.executeAsync(
    () => bybitService.getCurrentPrice(),
    {
      strategy: RecoveryStrategy.RETRY,
      retryConfig: { maxAttempts: 3, initialDelayMs: 500, backoffMultiplier: 2 },
      context: 'PositionLifecycleService.openPosition.getCurrentPrice',
      onRetry: (attempt, error, delayMs) => {
        const payload = buildRetryLogPayload(delayMs, error.message);
        logger.warn(`Retrying price fetch (${attempt}/3)`, payload);
      },
      onFailure: () => {
        const payload = buildCurrentPriceFallbackLogPayload(signalPrice);
        logger.warn('Price fetch failed, falling back to signal price', payload);
      },
    }
  );

  return resolveCurrentPriceWithFallback(priceResult.success, priceResult.value, signalPrice);
}
