import {
  AGGRESSIVE_ADJUSTMENT_MULTIPLIER,
  IMPACT_DECIMALS,
  MAX_ORDER_SPLITS,
  MAX_PARTIAL_FILL_RETRIES,
  MAX_PRICE_ADJUSTMENTS,
  MAX_VWAP_LOOKBACK,
  MIN_PARTIAL_FILL_PERCENT,
  MIN_PRICE_MOVEMENT_BPS,
  MIN_TWAP_INTERVAL_MS,
  MIN_VWAP_LOOKBACK,
  PARTIAL_FILL_CONTINUE_THRESHOLD,
  PASSIVE_ADJUSTMENT_MULTIPLIER,
  PRICE_DECIMALS,
  SIZE_DECIMALS,
  SLIPPAGE_DECIMALS,
  SUB_ORDER_ID_PREFIX,
} from '../../constants/phase-13-constants';
import type {
  ExecutionReport,
  OrderSide,
  PriceAdjustment,
  SmartOrderConfig,
  SmartOrderRequest,
  SubOrder,
} from './smart-order-execution.types';

type LogLevel = 'info' | 'warn' | 'error';

export interface SmartOrderExecutionWorkflowDeps {
  config: SmartOrderConfig;
  activeOrders: Map<string, ExecutionReport>;
  orderStartTimes: Map<string, number>;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
  estimateMarketImpact: (size: number, side: OrderSide) => number;
  calculateOptimalSplit: (totalSize: number, currentPrice: number) => number[];
  calculateFillPrice: (targetPrice: number, side: OrderSide, marketImpactBps: number) => number;
  calculateSlippage: (targetPrice: number, actualPrice: number) => number;
  buildReasoningMessage: (
    strategy: SmartOrderConfig['executionStrategy'],
    numberOfSplits: number,
    marketImpact: number,
    slippage: number,
    fullyFilled: boolean
  ) => string;
  roundToDecimals: (value: number, decimals: number) => number;
  simulateMarketPrice: (basePrice: number, side: OrderSide) => number;
  shouldAdjustPrice: (
    report: ExecutionReport,
    currentMarketPrice: number,
    priceMovementBps: number
  ) => boolean;
  generateVolumeProfile: (periods: number) => number[];
  distributeByVolume: (
    orderId: string,
    totalSize: number,
    targetPrice: number,
    volumeProfile: number[]
  ) => SubOrder[];
}

export async function executeSmartOrderWorkflow(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  orderId: string;
  order: SmartOrderRequest;
  startTime: number;
}): Promise<ExecutionReport> {
  const { deps, orderId, order, startTime } = params;
  const strategy = order.strategy || deps.config.executionStrategy;
  const targetPrice = order.price;
  const totalSize = order.size;

  const marketImpact = deps.estimateMarketImpact(totalSize, order.side);
  deps.safeLog('info', 'Market impact estimated', { orderId, marketImpact });

  const splits = deps.calculateOptimalSplit(totalSize, targetPrice);
  const numberOfSplits = splits.length;
  deps.safeLog('info', 'Order splits calculated', { orderId, numberOfSplits, splits });

  const subOrders: SubOrder[] = [];
  let subOrderCounter = 0;
  for (const splitSize of splits) {
    const subOrderId = `${SUB_ORDER_ID_PREFIX}${orderId}_${subOrderCounter++}`;
    subOrders.push({
      id: subOrderId,
      size: splitSize,
      price: targetPrice,
      status: 'pending',
      timestamp: Date.now(),
    });
  }

  const filledSubOrders: SubOrder[] = [];
  let totalFilled = 0;
  let totalFillValue = 0;
  for (const subOrder of subOrders) {
    const fillPrice = deps.calculateFillPrice(targetPrice, order.side, marketImpact);
    filledSubOrders.push({ ...subOrder, status: 'filled', fillPrice });
    totalFilled += subOrder.size;
    totalFillValue += subOrder.size * fillPrice;
  }

  const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
  const slippage = deps.calculateSlippage(targetPrice, averageFillPrice);
  const executionTime = Date.now() - startTime;

  const report: ExecutionReport = {
    orderId,
    status: totalFilled >= totalSize ? 'completed' : 'partial',
    symbol: order.symbol,
    side: order.side,
    requestedSize: totalSize,
    filledSize: deps.roundToDecimals(totalFilled, SIZE_DECIMALS),
    remainingSize: deps.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
    requestedPrice: deps.roundToDecimals(targetPrice, PRICE_DECIMALS),
    averageFillPrice: deps.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
    slippage: deps.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
    executionTime,
    numberOfSplits,
    marketImpact: deps.roundToDecimals(marketImpact, IMPACT_DECIMALS),
    subOrders: filledSubOrders,
    adjustments: [],
    reasoning: deps.buildReasoningMessage(
      strategy,
      numberOfSplits,
      marketImpact,
      slippage,
      totalFilled >= totalSize
    ),
  };

  deps.activeOrders.set(orderId, report);
  deps.orderStartTimes.set(orderId, startTime);
  deps.safeLog('info', 'Smart order execution completed', {
    orderId,
    status: report.status,
    filledSize: report.filledSize,
    averageFillPrice: report.averageFillPrice,
    slippage: report.slippage,
    executionTime: report.executionTime,
  });

  return report;
}

export async function monitorAndAdjustWorkflow(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  orderId: string;
}): Promise<ExecutionReport | null> {
  const { deps, orderId } = params;
  const currentReport = deps.activeOrders.get(orderId);
  if (!currentReport) {
    deps.safeLog('warn', 'Order not found in active orders', { orderId });
    return null;
  }

  if (currentReport.status === 'completed' || currentReport.status === 'failed') {
    deps.safeLog('info', 'Order already in terminal state', {
      orderId,
      status: currentReport.status,
    });
    return currentReport;
  }

  const startTime = deps.orderStartTimes.get(orderId) || Date.now();
  const elapsedTime = Date.now() - startTime;

  if (elapsedTime > deps.config.executionTimeout) {
    deps.safeLog('warn', 'Order execution timeout', {
      orderId,
      elapsedTime,
      timeout: deps.config.executionTimeout,
    });

    const updatedReport: ExecutionReport = {
      ...currentReport,
      status: 'failed',
      executionTime: elapsedTime,
      reasoning: `${currentReport.reasoning} Execution timeout after ${elapsedTime}ms.`,
    };

    deps.activeOrders.set(orderId, updatedReport);
    return updatedReport;
  }

  const currentMarketPrice = deps.simulateMarketPrice(
    currentReport.requestedPrice,
    currentReport.side
  );
  const priceMovementBps = deps.calculateSlippage(
    currentReport.requestedPrice,
    currentMarketPrice
  );

  if (priceMovementBps > MIN_PRICE_MOVEMENT_BPS) {
    deps.safeLog('info', 'Significant price movement detected', {
      orderId,
      requestedPrice: currentReport.requestedPrice,
      currentMarketPrice,
      movementBps: priceMovementBps,
    });

    if (currentReport.adjustments.length < MAX_PRICE_ADJUSTMENTS) {
      const shouldAdjust = deps.shouldAdjustPrice(
        currentReport,
        currentMarketPrice,
        priceMovementBps
      );

      if (shouldAdjust) {
        return adjustOrderPriceFromMarketMove({
          deps,
          currentReport,
          newMarketPrice: currentMarketPrice,
        });
      }
    } else {
      deps.safeLog('warn', 'Maximum price adjustments reached', {
        orderId,
        adjustments: currentReport.adjustments.length,
      });
    }
  }

  deps.safeLog('info', 'Order monitoring: no adjustment needed', {
    orderId,
    priceMovementBps,
  });
  return currentReport;
}

export async function handlePartialFillsWorkflow(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  orderId: string;
  filledSize: number;
}): Promise<'continue' | 'cancel' | 'adjust'> {
  const { deps, orderId, filledSize } = params;
  const currentReport = deps.activeOrders.get(orderId);
  if (!currentReport) {
    deps.safeLog('warn', 'Order not found in active orders (partial fill)', { orderId });
    return 'cancel';
  }

  const requestedSize = currentReport.requestedSize;
  const fillPercent = (filledSize / requestedSize) * 100;

  deps.safeLog('info', 'Processing partial fill', {
    orderId,
    filledSize,
    requestedSize,
    fillPercent: deps.roundToDecimals(fillPercent, 1),
  });

  if (fillPercent < MIN_PARTIAL_FILL_PERCENT) {
    deps.safeLog('warn', 'Partial fill too small, cancelling', {
      orderId,
      fillPercent,
      minPercent: MIN_PARTIAL_FILL_PERCENT,
    });

    const updatedReport: ExecutionReport = {
      ...currentReport,
      status: 'failed',
      filledSize,
      remainingSize: requestedSize - filledSize,
      reasoning: `${currentReport.reasoning} Partial fill too small (${fillPercent.toFixed(1)}%), cancelled.`,
    };

    deps.activeOrders.set(orderId, updatedReport);
    return 'cancel';
  }

  if (fillPercent >= PARTIAL_FILL_CONTINUE_THRESHOLD) {
    deps.safeLog('info', 'Good partial fill, continuing with remainder', {
      orderId,
      fillPercent,
    });

    const updatedReport: ExecutionReport = {
      ...currentReport,
      status: 'partial',
      filledSize,
      remainingSize: requestedSize - filledSize,
    };

    deps.activeOrders.set(orderId, updatedReport);
    return 'continue';
  }

  const adjustmentCount = currentReport.adjustments.length;
  if (adjustmentCount >= MAX_PARTIAL_FILL_RETRIES) {
    deps.safeLog('warn', 'Maximum partial fill retries reached, cancelling', {
      orderId,
      adjustmentCount,
      maxRetries: MAX_PARTIAL_FILL_RETRIES,
    });

    const updatedReport: ExecutionReport = {
      ...currentReport,
      status: 'partial',
      filledSize,
      remainingSize: requestedSize - filledSize,
      reasoning: `${currentReport.reasoning} Max retries reached, partial fill at ${fillPercent.toFixed(1)}%.`,
    };

    deps.activeOrders.set(orderId, updatedReport);
    return 'cancel';
  }

  deps.safeLog('info', 'Medium partial fill, adjusting price', {
    orderId,
    fillPercent,
    adjustmentCount,
  });

  const adjustment: PriceAdjustment = {
    timestamp: Date.now(),
    oldPrice: currentReport.requestedPrice,
    newPrice: currentReport.requestedPrice,
    reason: 'partial_fill',
  };

  const updatedReport: ExecutionReport = {
    ...currentReport,
    status: 'partial',
    filledSize,
    remainingSize: requestedSize - filledSize,
    adjustments: [...currentReport.adjustments, adjustment],
    reasoning: `${currentReport.reasoning} Partial fill at ${fillPercent.toFixed(1)}%, adjusting.`,
  };

  deps.activeOrders.set(orderId, updatedReport);
  return 'adjust';
}

export async function executeTwapWorkflow(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  orderId: string;
  order: SmartOrderRequest;
  startTime: number;
}): Promise<ExecutionReport> {
  const { deps, orderId, order, startTime } = params;
  const totalSize = order.size;
  const targetPrice = order.price;
  const interval = Math.max(deps.config.twapInterval, MIN_TWAP_INTERVAL_MS);
  const maxSlices = Math.min(deps.config.maxOrderSplits, MAX_ORDER_SPLITS);
  const sliceSize = deps.roundToDecimals(totalSize / maxSlices, SIZE_DECIMALS);

  deps.safeLog('info', 'TWAP: Creating time slices', {
    orderId,
    totalSize,
    slices: maxSlices,
    sliceSize,
    interval,
  });

  const subOrders: SubOrder[] = [];
  let subOrderCounter = 0;
  for (let i = 0; i < maxSlices; i++) {
    const subOrderId = `${SUB_ORDER_ID_PREFIX}${orderId}_twap_${subOrderCounter++}`;
    const scheduledTime = startTime + (i * interval);
    const size = i === maxSlices - 1
      ? deps.roundToDecimals(totalSize - (sliceSize * (maxSlices - 1)), SIZE_DECIMALS)
      : sliceSize;

    subOrders.push({
      id: subOrderId,
      size,
      price: targetPrice,
      status: 'pending',
      timestamp: scheduledTime,
    });
  }

  const filledSubOrders: SubOrder[] = [];
  let totalFilled = 0;
  let totalFillValue = 0;

  for (const subOrder of subOrders) {
    const now = Date.now();
    const waitTime = subOrder.timestamp - now;

    if (waitTime > 0) {
      deps.safeLog('info', 'TWAP: Waiting for next slice', {
        orderId,
        subOrderId: subOrder.id,
        waitTime,
      });
    }

    const currentMarketPrice = deps.simulateMarketPrice(targetPrice, order.side);
    const fillPrice = deps.calculateFillPrice(currentMarketPrice, order.side, 0);

    filledSubOrders.push({
      ...subOrder,
      status: 'filled',
      fillPrice,
    });

    totalFilled += subOrder.size;
    totalFillValue += subOrder.size * fillPrice;

    deps.safeLog('info', 'TWAP: Slice executed', {
      orderId,
      subOrderId: subOrder.id,
      size: subOrder.size,
      fillPrice,
    });
  }

  const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
  const slippage = deps.calculateSlippage(targetPrice, averageFillPrice);
  const executionTime = Date.now() - startTime;
  const marketImpact = deps.estimateMarketImpact(sliceSize, order.side);

  const report: ExecutionReport = {
    orderId,
    status: totalFilled >= totalSize ? 'completed' : 'partial',
    symbol: order.symbol,
    side: order.side,
    requestedSize: totalSize,
    filledSize: deps.roundToDecimals(totalFilled, SIZE_DECIMALS),
    remainingSize: deps.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
    requestedPrice: deps.roundToDecimals(targetPrice, PRICE_DECIMALS),
    averageFillPrice: deps.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
    slippage: deps.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
    executionTime,
    numberOfSplits: maxSlices,
    marketImpact: deps.roundToDecimals(marketImpact, IMPACT_DECIMALS),
    subOrders: filledSubOrders,
    adjustments: [],
    reasoning: `TWAP execution: ${maxSlices} slices over ${executionTime}ms intervals. ` +
      `Average fill price: ${averageFillPrice.toFixed(2)}, slippage: ${slippage.toFixed(1)} bps.`,
  };

  deps.activeOrders.set(orderId, report);
  deps.orderStartTimes.set(orderId, startTime);
  deps.safeLog('info', 'TWAP execution completed', {
    orderId,
    filledSize: report.filledSize,
    averageFillPrice: report.averageFillPrice,
    slippage: report.slippage,
  });

  return report;
}

export async function executeVwapWorkflow(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  orderId: string;
  order: SmartOrderRequest;
  startTime: number;
}): Promise<ExecutionReport> {
  const { deps, orderId, order, startTime } = params;
  const totalSize = order.size;
  const targetPrice = order.price;
  const lookback = Math.max(
    MIN_VWAP_LOOKBACK,
    Math.min(deps.config.vwapLookback, MAX_VWAP_LOOKBACK)
  );

  const volumeProfile = deps.generateVolumeProfile(lookback);
  deps.safeLog('info', 'VWAP: Generated volume profile', {
    orderId,
    lookback,
    totalVolume: volumeProfile.reduce((sum, volume) => sum + volume, 0),
  });

  const subOrders = deps.distributeByVolume(
    orderId,
    totalSize,
    targetPrice,
    volumeProfile
  );

  deps.safeLog('info', 'VWAP: Created volume-weighted slices', {
    orderId,
    totalSize,
    slices: subOrders.length,
  });

  const filledSubOrders: SubOrder[] = [];
  let totalFilled = 0;
  let totalFillValue = 0;

  for (const subOrder of subOrders) {
    const currentMarketPrice = deps.simulateMarketPrice(targetPrice, order.side);
    const fillPrice = deps.calculateFillPrice(currentMarketPrice, order.side, 0);

    filledSubOrders.push({
      ...subOrder,
      status: 'filled',
      fillPrice,
    });

    totalFilled += subOrder.size;
    totalFillValue += subOrder.size * fillPrice;

    deps.safeLog('info', 'VWAP: Slice executed', {
      orderId,
      subOrderId: subOrder.id,
      size: subOrder.size,
      fillPrice,
    });
  }

  const averageFillPrice = totalFilled > 0 ? totalFillValue / totalFilled : 0;
  const slippage = deps.calculateSlippage(targetPrice, averageFillPrice);
  const executionTime = Date.now() - startTime;
  const avgSliceSize = totalSize / subOrders.length;
  const marketImpact = deps.estimateMarketImpact(avgSliceSize, order.side);

  const report: ExecutionReport = {
    orderId,
    status: totalFilled >= totalSize ? 'completed' : 'partial',
    symbol: order.symbol,
    side: order.side,
    requestedSize: totalSize,
    filledSize: deps.roundToDecimals(totalFilled, SIZE_DECIMALS),
    remainingSize: deps.roundToDecimals(totalSize - totalFilled, SIZE_DECIMALS),
    requestedPrice: deps.roundToDecimals(targetPrice, PRICE_DECIMALS),
    averageFillPrice: deps.roundToDecimals(averageFillPrice, PRICE_DECIMALS),
    slippage: deps.roundToDecimals(slippage, SLIPPAGE_DECIMALS),
    executionTime,
    numberOfSplits: subOrders.length,
    marketImpact: deps.roundToDecimals(marketImpact, IMPACT_DECIMALS),
    subOrders: filledSubOrders,
    adjustments: [],
    reasoning: `VWAP execution: ${subOrders.length} slices matching ${lookback}-period volume profile. ` +
      `Average fill price: ${averageFillPrice.toFixed(2)}, slippage: ${slippage.toFixed(1)} bps.`,
  };

  deps.activeOrders.set(orderId, report);
  deps.orderStartTimes.set(orderId, startTime);
  deps.safeLog('info', 'VWAP execution completed', {
    orderId,
    filledSize: report.filledSize,
    averageFillPrice: report.averageFillPrice,
    slippage: report.slippage,
  });

  return report;
}

export function resolveAdjustedPrice(params: {
  strategy: SmartOrderConfig['executionStrategy'];
  requestedPrice: number;
  newMarketPrice: number;
  maxSlippagePercent: number;
  side: OrderSide;
  roundToDecimals: (value: number, decimals: number) => number;
}): number {
  const {
    strategy,
    requestedPrice,
    newMarketPrice,
    maxSlippagePercent,
    side,
    roundToDecimals: rounder,
  } = params;

  let adjustmentMultiplier = 1.0;
  if (strategy === 'aggressive') {
    adjustmentMultiplier = AGGRESSIVE_ADJUSTMENT_MULTIPLIER;
  } else if (strategy === 'passive') {
    adjustmentMultiplier = PASSIVE_ADJUSTMENT_MULTIPLIER;
  }

  const maxSlippageDecimal = (maxSlippagePercent / 100) * adjustmentMultiplier;
  const maxPriceChange = requestedPrice * maxSlippageDecimal;

  const newPrice = side === 'Buy'
    ? Math.min(newMarketPrice, requestedPrice + maxPriceChange)
    : Math.max(newMarketPrice, requestedPrice - maxPriceChange);

  return rounder(newPrice, PRICE_DECIMALS);
}

function adjustOrderPriceFromMarketMove(params: {
  deps: SmartOrderExecutionWorkflowDeps;
  currentReport: ExecutionReport;
  newMarketPrice: number;
}): ExecutionReport {
  const { deps, currentReport, newMarketPrice } = params;
  const strategy = deps.config.executionStrategy;

  const newPrice = resolveAdjustedPrice({
    strategy,
    requestedPrice: currentReport.requestedPrice,
    newMarketPrice,
    maxSlippagePercent: deps.config.maxSlippagePercent,
    side: currentReport.side,
    roundToDecimals: deps.roundToDecimals,
  });

  const adjustment: PriceAdjustment = {
    timestamp: Date.now(),
    oldPrice: currentReport.requestedPrice,
    newPrice,
    reason: 'market_moved',
  };

  deps.safeLog('info', 'Adjusting order price', {
    orderId: currentReport.orderId,
    oldPrice: adjustment.oldPrice,
    newPrice: adjustment.newPrice,
    strategy,
  });

  const updatedReport: ExecutionReport = {
    ...currentReport,
    requestedPrice: newPrice,
    adjustments: [...currentReport.adjustments, adjustment],
    reasoning: `${currentReport.reasoning} Price adjusted from ${adjustment.oldPrice} to ${adjustment.newPrice}.`,
  };

  deps.activeOrders.set(currentReport.orderId, updatedReport);
  return updatedReport;
}
