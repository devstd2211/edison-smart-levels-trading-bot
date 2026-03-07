export type SmartOrderExecutionSide = 'Buy' | 'Sell';

export type SmartOrderExecutionStrategy =
  | 'aggressive'
  | 'passive'
  | 'adaptive'
  | 'twap'
  | 'vwap';

export interface DistributedVolumeSubOrder {
  id: string;
  size: number;
  price: number;
  status: 'pending';
  timestamp: number;
}

export function roundToDecimals(value: number, decimals: number): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

export function calculateFillPriceFromImpact(
  targetPrice: number,
  side: SmartOrderExecutionSide,
  marketImpactBps: number,
  priceDecimals: number
): number {
  const impactDecimal = marketImpactBps / 10000;
  const priceAdjustment = side === 'Buy'
    ? targetPrice * impactDecimal
    : -targetPrice * impactDecimal;
  return roundToDecimals(targetPrice + priceAdjustment, priceDecimals);
}

export function calculateSlippageBps(
  targetPrice: number,
  actualPrice: number
): number {
  if (targetPrice === 0) {
    return 0;
  }

  const slippageDecimal = Math.abs((actualPrice - targetPrice) / targetPrice);
  return slippageDecimal * 10000;
}

export function buildExecutionReasoningMessage(
  strategy: SmartOrderExecutionStrategy,
  numberOfSplits: number,
  marketImpact: number,
  slippage: number,
  fullyFilled: boolean
): string {
  const parts: string[] = [];

  parts.push(`Executed using ${strategy} strategy.`);

  if (numberOfSplits > 1) {
    parts.push(`Split into ${numberOfSplits} sub-orders to minimize market impact.`);
  } else {
    parts.push('No split required (low market impact).');
  }

  parts.push(`Estimated market impact: ${marketImpact.toFixed(1)} bps.`);
  parts.push(`Actual slippage: ${slippage.toFixed(1)} bps.`);
  parts.push(fullyFilled ? 'Order fully filled.' : 'Order partially filled.');

  return parts.join(' ');
}

export function generateSimulatedVolumeProfile(periods: number): number[] {
  const profile: number[] = [];

  for (let i = 0; i < periods; i++) {
    const periodRatio = i / (periods - 1);
    const distanceFromMiddle = Math.abs(periodRatio - 0.5) * 2;
    const baseVolume = 0.5 + (distanceFromMiddle * 0.5);
    const randomFactor = 0.8 + (Math.random() * 0.4);
    profile.push(baseVolume * randomFactor);
  }

  return profile;
}

export function distributeSizeByVolumeProfile(params: {
  orderId: string;
  totalSize: number;
  targetPrice: number;
  volumeProfile: number[];
  sizeDecimals: number;
  minSizeDifference: number;
  subOrderIdPrefix: string;
}): DistributedVolumeSubOrder[] {
  const {
    orderId,
    totalSize,
    targetPrice,
    volumeProfile,
    sizeDecimals,
    minSizeDifference,
    subOrderIdPrefix,
  } = params;

  const totalVolume = volumeProfile.reduce((sum, volume) => sum + volume, 0);
  const subOrders: DistributedVolumeSubOrder[] = [];
  let allocatedSize = 0;

  for (let i = 0; i < volumeProfile.length; i++) {
    const volumeRatio = volumeProfile[i] / totalVolume;
    const rawSliceSize = i === volumeProfile.length - 1
      ? totalSize - allocatedSize
      : totalSize * volumeRatio;

    const sliceSize = roundToDecimals(rawSliceSize, sizeDecimals);
    if (sliceSize < minSizeDifference) {
      continue;
    }

    subOrders.push({
      id: `${subOrderIdPrefix}${orderId}_vwap_${i}`,
      size: sliceSize,
      price: targetPrice,
      status: 'pending',
      timestamp: Date.now() + (i * 1000),
    });

    allocatedSize += sliceSize;
  }

  return subOrders;
}
