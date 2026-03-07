import type { ErrorHandler } from '../../errors';
import { executeWithGracefulDegrade } from './smart-order-execution-resilience.utils';
import { createSmartOrderExecutionId } from './smart-order-execution-report.utils';
import { validateSmartOrderRequest } from './smart-order-execution-validation.utils';
import type { ExecutionReport, SmartOrderRequest } from './smart-order-execution.types';

type LogLevel = 'info' | 'warn' | 'error';

export async function executeStrategyWithFallback(params: {
  order: SmartOrderRequest;
  methodName: 'executeTWAP' | 'executeVWAP';
  orderIdPrefix: 'twap' | 'vwap';
  startLogMessage: string;
  startLogMetadata: (orderId: string) => Record<string, unknown>;
  operation: (orderId: string, startTime: number) => Promise<ExecutionReport>;
  failureLogMessage: string;
  directFailureLogMessage: string;
  executeSmartOrderFallback: () => Promise<ExecutionReport>;
  errorHandler?: ErrorHandler;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): Promise<ExecutionReport> {
  const {
    order,
    methodName,
    orderIdPrefix,
    startLogMessage,
    startLogMetadata,
    operation,
    failureLogMessage,
    directFailureLogMessage,
    executeSmartOrderFallback,
    errorHandler,
    safeLog,
  } = params;

  validateSmartOrderRequest(order, methodName);

  const startTime = Date.now();
  const orderId = createSmartOrderExecutionId(orderIdPrefix);
  safeLog('info', startLogMessage, startLogMetadata(orderId));

  return executeWithGracefulDegrade({
    errorHandler,
    operation: () => operation(orderId, startTime),
    safeLog,
    options: {
      requireValue: true,
      failureLogMessage,
      directFailureLogMessage,
      onFailure: executeSmartOrderFallback,
      failureMetadata: error => ({ orderId, error }),
    },
  });
}
