import { FALLBACK_EXECUTION_REPORT } from '../../constants/phase-13-constants';
import type { ExecutionReport, SmartOrderRequest } from './smart-order-execution.types';

export function createSmartOrderExecutionId(prefix: 'order' | 'twap' | 'vwap'): string {
  const now = Date.now();
  return `${prefix}_${now}_${Math.random().toString(36).substr(2, 9)}`;
}

export function buildSmartOrderFailureReport(params: {
  orderId: string;
  order: SmartOrderRequest;
  executionTime: number;
  error: unknown;
}): ExecutionReport {
  const { orderId, order, executionTime, error } = params;

  return {
    ...FALLBACK_EXECUTION_REPORT,
    orderId,
    symbol: order.symbol,
    side: order.side,
    requestedSize: order.size,
    remainingSize: order.size,
    requestedPrice: order.price,
    executionTime,
    reasoning: `Execution failed: ${(error as Error)?.message || 'Unknown error'}`,
  };
}
