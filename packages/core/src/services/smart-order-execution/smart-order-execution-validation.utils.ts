import type {
  SmartOrderConfig,
  SmartOrderRequest,
} from './smart-order-execution.types';

export function validateSmartOrderConfig(config: SmartOrderConfig | undefined): void {
  if (!config) {
    throw new Error('SmartOrderExecutionService: config is required');
  }
  if (config.maxSlippagePercent == null || config.maxSlippagePercent < 0) {
    throw new Error('SmartOrderExecutionService: maxSlippagePercent must be >= 0');
  }
  if (config.maxOrderSplits == null || config.maxOrderSplits < 1) {
    throw new Error('SmartOrderExecutionService: maxOrderSplits must be >= 1');
  }
  if (
    config.minFillProbability == null ||
    config.minFillProbability < 0 ||
    config.minFillProbability > 1
  ) {
    throw new Error('SmartOrderExecutionService: minFillProbability must be between 0 and 1');
  }
  if (config.executionTimeout == null || config.executionTimeout <= 0) {
    throw new Error('SmartOrderExecutionService: executionTimeout must be > 0');
  }
  if (config.twapInterval == null || config.twapInterval <= 0) {
    throw new Error('SmartOrderExecutionService: twapInterval must be > 0');
  }
  if (config.vwapLookback == null || config.vwapLookback <= 0) {
    throw new Error('SmartOrderExecutionService: vwapLookback must be > 0');
  }
  if (!config.executionStrategy) {
    throw new Error('SmartOrderExecutionService: executionStrategy is required');
  }
}

export function validateSmartOrderRequest(
  order: SmartOrderRequest,
  methodName: string
): void {
  if (!order) {
    throw new Error(`SmartOrderExecutionService.${methodName}: order is required`);
  }
  if (!order.symbol) {
    throw new Error(`SmartOrderExecutionService.${methodName}: symbol is required`);
  }
  if (!order.side || (order.side !== 'Buy' && order.side !== 'Sell')) {
    throw new Error(`SmartOrderExecutionService.${methodName}: valid side is required`);
  }
  if (order.size == null || order.size <= 0 || isNaN(order.size)) {
    throw new Error(`SmartOrderExecutionService.${methodName}: size must be > 0`);
  }
  if (order.price == null || order.price <= 0 || isNaN(order.price)) {
    throw new Error(`SmartOrderExecutionService.${methodName}: price must be > 0`);
  }
}
