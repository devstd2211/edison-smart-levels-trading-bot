import type { ExecutionReport } from './smart-order-execution.types';

type LogLevel = 'info' | 'warn' | 'error';

export function getTrackedOrderState(
  activeOrders: Map<string, ExecutionReport>,
  orderId: string
): ExecutionReport | null {
  return activeOrders.get(orderId) || null;
}

export function cleanupTrackedOrder(params: {
  activeOrders: Map<string, ExecutionReport>;
  orderStartTimes: Map<string, number>;
  orderId: string;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): boolean {
  const { activeOrders, orderStartTimes, orderId, safeLog } = params;
  const report = activeOrders.get(orderId);
  if (!report) {
    return false;
  }

  if (report.status === 'completed' || report.status === 'failed') {
    activeOrders.delete(orderId);
    orderStartTimes.delete(orderId);
    safeLog('info', 'Order cleaned up from active tracking', {
      orderId,
      status: report.status,
    });
    return true;
  }

  return false;
}

export function clearTrackedOrders(params: {
  activeOrders: Map<string, ExecutionReport>;
  orderStartTimes: Map<string, number>;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): void {
  const { activeOrders, orderStartTimes, safeLog } = params;
  const count = activeOrders.size;
  activeOrders.clear();
  orderStartTimes.clear();
  safeLog('info', 'All orders cleared from tracking', { count });
}
