import { SMART_ORDER_PLACEMENT_TECHNICAL } from '../../constants/phase-10-constants';

type PriceVolumeLevel = { price: number; volume: number };

export function calculateAvailableLiquidity(levels: PriceVolumeLevel[]): number {
  return levels.reduce(
    (sum, level) => sum + (Number.isFinite(level.volume) ? level.volume : 0),
    0,
  );
}

export function calculateWeightedSplits(
  totalSize: number,
  numSplits: number,
  levels: PriceVolumeLevel[],
): number[] {
  if (numSplits <= 1) return [totalSize];

  const sizes: number[] = [];
  const topLevels = levels.slice(0, numSplits);
  const totalLiquidity = topLevels.reduce(
    (sum, level) => sum + (Number.isFinite(level.volume) ? level.volume : 0),
    0,
  );

  if (totalLiquidity === 0) {
    const equalSize = totalSize / numSplits;
    return Array(numSplits).fill(equalSize);
  }

  let remaining = totalSize;
  for (let i = 0; i < numSplits - 1; i++) {
    const volume = Number.isFinite(topLevels[i].volume)
      ? topLevels[i].volume
      : 0;
    const weight = volume / totalLiquidity;
    const size = Math.min(totalSize * weight, remaining);
    sizes.push(size);
    remaining -= size;
  }

  sizes.push(Math.max(0, remaining));
  return sizes;
}

export function estimateSplitImprovement(
  originalSize: number,
  subOrderSizes: number[],
): {
  slippageReduction: number;
  fillProbabilityIncrease: number;
  impactReduction: number;
} {
  const avgSubOrderSize =
    subOrderSizes.reduce((sum, size) => sum + size, 0) / subOrderSizes.length;
  const sizeRatio = avgSubOrderSize / originalSize;

  const slippageReduction =
    (1 - sizeRatio) *
    SMART_ORDER_PLACEMENT_TECHNICAL.IMPROVEMENT.MAX_SLIPPAGE_REDUCTION_BPS;
  const fillProbabilityIncrease =
    (1 - sizeRatio) *
    SMART_ORDER_PLACEMENT_TECHNICAL.IMPROVEMENT.MAX_FILL_PROBABILITY_INCREASE;
  const impactReduction =
    (1 - sizeRatio) *
    SMART_ORDER_PLACEMENT_TECHNICAL.IMPROVEMENT.MAX_IMPACT_REDUCTION;

  return {
    slippageReduction: Math.max(0, slippageReduction),
    fillProbabilityIncrease: Math.max(0, fillProbabilityIncrease),
    impactReduction: Math.max(0, impactReduction),
  };
}

export function calculateLiquidityScore(
  level: PriceVolumeLevel,
  allLevels: PriceVolumeLevel[],
  index: number,
): number {
  const totalVolume = calculateAvailableLiquidity(allLevels);
  if (totalVolume === 0) return 0;

  const volumeScore = (level.volume / totalVolume) * 100;
  const depthPenalty =
    index * SMART_ORDER_PLACEMENT_TECHNICAL.LIQUIDITY.DEPTH_PENALTY_PER_LEVEL;

  const finalScore = Math.max(0, volumeScore - depthPenalty);
  return Number.isFinite(finalScore) ? Math.min(100, finalScore) : 0;
}

export function calculateLiquidityFactor(
  levels: PriceVolumeLevel[],
  targetPrice: number,
  orderSize: number,
): number {
  let availableVolume = 0;
  for (const level of levels) {
    if (level.price <= targetPrice) {
      availableVolume += Number.isFinite(level.volume) ? level.volume : 0;
    }
  }

  if (orderSize === 0) return 100;
  const ratio = availableVolume / orderSize;
  return Math.min(100, ratio * 100);
}

export function calculateAggressivenessFactor(
  orderPrice: number,
  marketPrice: number,
  direction: 'buy' | 'sell',
): number {
  if (marketPrice === 0) return 50;

  const priceDiff =
    direction === 'buy'
      ? orderPrice - marketPrice
      : marketPrice - orderPrice;

  const diffBps = (priceDiff / marketPrice) * 10000;
  const score = Math.min(100, Math.max(0, diffBps / 5));
  return Number.isFinite(score) ? score : 50;
}

export function estimateVolatility(orderbook: {
  bids: PriceVolumeLevel[];
  asks: PriceVolumeLevel[];
}): number {
  const bestBid =
    orderbook.bids.length > 0 ? orderbook.bids[0].price : 0;
  const bestAsk =
    orderbook.asks.length > 0 ? orderbook.asks[0].price : 0;
  const midPrice = (bestBid + bestAsk) / 2;

  if (midPrice === 0) return 50;

  const spreadBps = ((bestAsk - bestBid) / midPrice) * 10000;
  const volatility = Math.min(100, 20 + spreadBps / 2);

  return Number.isFinite(volatility) ? volatility : 50;
}

export function calculateSizeImpactFactor(
  orderSize: number,
  levels: PriceVolumeLevel[],
): number {
  const availableLiquidity = calculateAvailableLiquidity(levels);

  if (availableLiquidity === 0) return 0;

  const ratio = orderSize / availableLiquidity;
  const score = Math.max(0, 100 - ratio * 100);
  return Number.isFinite(score) ? score : 50;
}

export function combineProbabilityFactors(
  liquidity: number,
  aggressiveness: number,
  volatility: number,
  sizeImpact: number,
): number {
  const weights = SMART_ORDER_PLACEMENT_TECHNICAL.FILL_PROBABILITY_WEIGHTS;
  const volatilityScore = 100 - volatility;

  const probability =
    liquidity * weights.LIQUIDITY +
    aggressiveness * weights.AGGRESSIVENESS +
    volatilityScore * weights.VOLATILITY +
    sizeImpact * weights.SIZE_IMPACT;

  return Number.isFinite(probability)
    ? Math.min(100, Math.max(0, probability))
    : 50;
}

export function estimateFillTime(
  probability: number,
  size: number,
  levels: PriceVolumeLevel[],
  baseTime: number,
): number {
  const probabilityFactor = 100 / Math.max(1, probability);
  const totalLiquidity = calculateAvailableLiquidity(levels);
  const sizeFactor = totalLiquidity > 0 ? size / totalLiquidity : 1;

  const estimatedTime = baseTime * probabilityFactor * (1 + sizeFactor);
  return Number.isFinite(estimatedTime)
    ? Math.min(estimatedTime, baseTime * 10)
    : baseTime;
}
