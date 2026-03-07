import { MIN_PRICE_MOVEMENT_BPS, PRICE_DECIMALS } from '../../constants/phase-13-constants';
import type {
  ExecutionReport,
  OrderSide,
  SmartOrderConfig,
} from './smart-order-execution.types';
import type { SmartOrderExecutionWorkflowDeps } from './smart-order-execution-workflows.orchestrator';

export function shouldAdjustPriceByStrategy(
  strategy: SmartOrderConfig['executionStrategy'],
  report: ExecutionReport,
  priceMovementBps: number
): boolean {
  if (strategy === 'aggressive') {
    return priceMovementBps > MIN_PRICE_MOVEMENT_BPS;
  }
  if (strategy === 'passive') {
    return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 2;
  }
  if (strategy === 'adaptive') {
    if (report.filledSize === 0) {
      return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 1.5;
    }
    return priceMovementBps > MIN_PRICE_MOVEMENT_BPS * 2;
  }

  return false;
}

export function simulateMarketPriceFromBase(
  basePrice: number,
  roundToDecimals: (value: number, decimals: number) => number
): number {
  const randomMovement = (Math.random() - 0.5) * 0.002;
  const newPrice = basePrice * (1 + randomMovement);
  return roundToDecimals(newPrice, PRICE_DECIMALS);
}

export function buildWorkflowDeps(params: {
  config: SmartOrderConfig;
  activeOrders: Map<string, ExecutionReport>;
  orderStartTimes: Map<string, number>;
  safeLog: SmartOrderExecutionWorkflowDeps['safeLog'];
  estimateMarketImpact: SmartOrderExecutionWorkflowDeps['estimateMarketImpact'];
  calculateOptimalSplit: SmartOrderExecutionWorkflowDeps['calculateOptimalSplit'];
  calculateFillPrice: SmartOrderExecutionWorkflowDeps['calculateFillPrice'];
  calculateSlippage: SmartOrderExecutionWorkflowDeps['calculateSlippage'];
  buildReasoningMessage: SmartOrderExecutionWorkflowDeps['buildReasoningMessage'];
  roundToDecimals: SmartOrderExecutionWorkflowDeps['roundToDecimals'];
  simulateMarketPrice: SmartOrderExecutionWorkflowDeps['simulateMarketPrice'];
  shouldAdjustPrice: SmartOrderExecutionWorkflowDeps['shouldAdjustPrice'];
  generateVolumeProfile: SmartOrderExecutionWorkflowDeps['generateVolumeProfile'];
  distributeByVolume: SmartOrderExecutionWorkflowDeps['distributeByVolume'];
}): SmartOrderExecutionWorkflowDeps {
  return {
    config: params.config,
    activeOrders: params.activeOrders,
    orderStartTimes: params.orderStartTimes,
    safeLog: params.safeLog,
    estimateMarketImpact: params.estimateMarketImpact,
    calculateOptimalSplit: params.calculateOptimalSplit,
    calculateFillPrice: params.calculateFillPrice,
    calculateSlippage: params.calculateSlippage,
    buildReasoningMessage: params.buildReasoningMessage,
    roundToDecimals: params.roundToDecimals,
    simulateMarketPrice: params.simulateMarketPrice,
    shouldAdjustPrice: params.shouldAdjustPrice,
    generateVolumeProfile: params.generateVolumeProfile,
    distributeByVolume: params.distributeByVolume,
  };
}
