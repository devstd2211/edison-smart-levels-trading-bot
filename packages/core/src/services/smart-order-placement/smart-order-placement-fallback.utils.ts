import {
  FillProbability,
  LiquidityLevel,
  OrderSplit,
  Orderbook,
  SmartOrderPlan,
} from '../../types/legacy';

export function buildConservativePlan(params: {
  orderbook: Orderbook;
  size: number;
  direction: 'buy' | 'sell';
  targetPrice?: number;
  executionTimeHorizon: number;
  maxSlippageBps: number;
}): SmartOrderPlan {
  const { orderbook, size, direction, targetPrice, executionTimeHorizon, maxSlippageBps } = params;
  const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
  const marketPrice =
    levels.length > 0 && Number.isFinite(levels[0].price)
      ? levels[0].price
      : targetPrice || 0;

  return {
    totalSize: size,
    targetPrice: targetPrice || null,
    direction,
    orders: [
      {
        price: targetPrice || marketPrice,
        size,
        priority: 'immediate',
        fillProbability: 50,
        estimatedFillTime: executionTimeHorizon,
      },
    ],
    expectedFill: 50,
    expectedSlippage: maxSlippageBps * 2,
    estimatedTime: executionTimeHorizon,
    strategy: 'single',
    risk: 'high',
  };
}

export function buildSingleOrderSplit(size: number): OrderSplit {
  return {
    originalSize: size,
    subOrderSizes: [size],
    reason: 'size',
    improvement: {
      slippageReduction: 0,
      fillProbabilityIncrease: 0,
      impactReduction: 0,
    },
  };
}

export function buildMarketPriceLevel(
  orderbook: Orderbook,
  direction: 'buy' | 'sell',
): LiquidityLevel {
  const levels = direction === 'buy' ? orderbook.asks : orderbook.bids;
  const marketPrice =
    levels.length > 0 && Number.isFinite(levels[0].price)
      ? levels[0].price
      : 0;
  const volume =
    levels.length > 0 && Number.isFinite(levels[0].volume)
      ? levels[0].volume
      : 0;

  return {
    price: marketPrice,
    volume,
    score: 50,
    distanceBps: 0,
    isOptimal: true,
  };
}

export function buildConservativeFillProbability(
  price: number,
  size: number,
  executionTimeHorizon: number,
): FillProbability {
  return {
    orderSize: size,
    price,
    probability: 50,
    factors: {
      liquidity: 50,
      aggressiveness: 50,
      volatility: 50,
      sizeImpact: 50,
    },
    expectedFillTime: executionTimeHorizon,
  };
}
