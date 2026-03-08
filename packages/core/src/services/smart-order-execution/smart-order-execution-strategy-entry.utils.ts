import type { ErrorHandler } from '../../errors';
import { executeWithGracefulDegrade } from './smart-order-execution-resilience.utils';
import { createSmartOrderExecutionId } from './smart-order-execution-report.utils';
import { validateSmartOrderRequest } from './smart-order-execution-validation.utils';
import type {
  ExecutionReport,
  SmartOrderConfig,
  SmartOrderRequest,
} from './smart-order-execution.types';

type LogLevel = 'info' | 'warn' | 'error';
type StrategyMethodName = 'executeTWAP' | 'executeVWAP';
type StrategyIdPrefix = 'twap' | 'vwap';

export async function executeNamedStrategyWithFallback(params: {
  order: SmartOrderRequest;
  strategy: StrategyIdPrefix;
  twapInterval: SmartOrderConfig['twapInterval'];
  vwapLookback: SmartOrderConfig['vwapLookback'];
  operation: (orderId: string, startTime: number) => Promise<ExecutionReport>;
  executeSmartOrderFallback: () => Promise<ExecutionReport>;
  errorHandler?: ErrorHandler;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): Promise<ExecutionReport> {
  const {
    order,
    strategy,
    twapInterval,
    vwapLookback,
    operation,
    executeSmartOrderFallback,
    errorHandler,
    safeLog,
  } = params;

  const isTwap = strategy === 'twap';
  const methodName: StrategyMethodName = isTwap ? 'executeTWAP' : 'executeVWAP';
  const startLogMessage = isTwap
    ? 'Executing TWAP strategy'
    : 'Executing VWAP strategy';
  const failureLogMessage = isTwap
    ? 'TWAP execution failed, falling back to regular execution'
    : 'VWAP execution failed, falling back to regular execution';
  const directFailureLogMessage = isTwap
    ? 'TWAP execution failed (no ErrorHandler), falling back to regular execution'
    : 'VWAP execution failed (no ErrorHandler), falling back to regular execution';

  return executeStrategyWithFallback({
    order,
    methodName,
    orderIdPrefix: strategy,
    startLogMessage,
    startLogMetadata: id => ({
      orderId: id,
      symbol: order.symbol,
      size: order.size,
      ...(isTwap ? { interval: twapInterval } : { lookback: vwapLookback }),
    }),
    operation,
    failureLogMessage,
    directFailureLogMessage,
    executeSmartOrderFallback,
    errorHandler,
    safeLog,
  });
}

export async function executeStrategyWithFallback(params: {
  order: SmartOrderRequest;
  methodName: StrategyMethodName;
  orderIdPrefix: StrategyIdPrefix;
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
