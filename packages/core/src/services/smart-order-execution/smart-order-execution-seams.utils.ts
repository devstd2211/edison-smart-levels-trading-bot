import {
  MIN_PRICE_MOVEMENT_BPS,
  MIN_SIZE_DIFFERENCE,
  PRICE_DECIMALS,
  SIZE_DECIMALS,
  SUB_ORDER_ID_PREFIX,
} from '../../constants/phase-13-constants';
import {
  buildExecutionReasoningMessage,
  calculateFillPriceFromImpact,
  distributeSizeByVolumeProfile,
  generateSimulatedVolumeProfile,
} from './smart-order-execution-calculations.utils';
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

export function buildFacadeWorkflowDeps(params: {
  config: SmartOrderConfig;
  activeOrders: Map<string, ExecutionReport>;
  orderStartTimes: Map<string, number>;
  safeLog: SmartOrderExecutionWorkflowDeps['safeLog'];
  estimateMarketImpact: SmartOrderExecutionWorkflowDeps['estimateMarketImpact'];
  calculateOptimalSplit: SmartOrderExecutionWorkflowDeps['calculateOptimalSplit'];
  calculateSlippage: SmartOrderExecutionWorkflowDeps['calculateSlippage'];
  roundToDecimals: SmartOrderExecutionWorkflowDeps['roundToDecimals'];
  simulateMarketPrice: SmartOrderExecutionWorkflowDeps['simulateMarketPrice'];
  shouldAdjustPrice: SmartOrderExecutionWorkflowDeps['shouldAdjustPrice'];
}): SmartOrderExecutionWorkflowDeps {
  return buildWorkflowDeps({
    config: params.config,
    activeOrders: params.activeOrders,
    orderStartTimes: params.orderStartTimes,
    safeLog: params.safeLog,
    estimateMarketImpact: params.estimateMarketImpact,
    calculateOptimalSplit: params.calculateOptimalSplit,
    calculateFillPrice: (targetPrice, side, marketImpactBps) =>
      calculateFillPriceFromImpact(targetPrice, side, marketImpactBps, PRICE_DECIMALS),
    calculateSlippage: params.calculateSlippage,
    buildReasoningMessage: (
      strategy,
      numberOfSplits,
      marketImpact,
      slippage,
      fullyFilled
    ) => buildExecutionReasoningMessage(
      strategy,
      numberOfSplits,
      marketImpact,
      slippage,
      fullyFilled
    ),
    roundToDecimals: params.roundToDecimals,
    simulateMarketPrice: params.simulateMarketPrice,
    shouldAdjustPrice: params.shouldAdjustPrice,
    generateVolumeProfile: generateSimulatedVolumeProfile,
    distributeByVolume: (orderId, totalSize, targetPrice, volumeProfile) =>
      distributeSizeByVolumeProfile({
        orderId,
        totalSize,
        targetPrice,
        volumeProfile,
        sizeDecimals: SIZE_DECIMALS,
        minSizeDifference: MIN_SIZE_DIFFERENCE,
        subOrderIdPrefix: SUB_ORDER_ID_PREFIX,
      }),
  });
}
