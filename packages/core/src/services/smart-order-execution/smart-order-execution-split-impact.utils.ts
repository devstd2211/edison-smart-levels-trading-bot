import {
  IMPACT_DECIMALS,
  LARGE_ORDER_THRESHOLD_PERCENT,
  MARKET_IMPACT_COEFFICIENT,
  MAX_ACCEPTABLE_IMPACT_BPS,
  MAX_ORDER_SPLITS,
  MIN_DAILY_VOLUME_USD,
  MIN_SIZE_DIFFERENCE,
  MIN_SUB_ORDER_SIZE_USD,
  SIGNIFICANT_ORDER_THRESHOLD_PERCENT,
  SIZE_DECIMALS,
} from '../../constants/phase-13-constants';

type LogLevel = 'info' | 'warn' | 'error';
type OrderSide = 'Buy' | 'Sell';

export function calculateOptimalSplitInternal(params: {
  totalSize: number;
  currentPrice: number;
  maxOrderSplits: number;
  estimateMarketImpact: (size: number, side: OrderSide) => number;
  roundToDecimals: (value: number, decimals: number) => number;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): number[] {
  const {
    totalSize,
    currentPrice,
    maxOrderSplits,
    estimateMarketImpact,
    roundToDecimals,
    safeLog,
  } = params;

  const totalValueUSD = totalSize * currentPrice;
  const minSubOrderValueUSD = MIN_SUB_ORDER_SIZE_USD;

  if (totalValueUSD < minSubOrderValueUSD * 2) {
    safeLog('info', 'Order too small to split', { totalValueUSD, minSubOrderValueUSD });
    return [totalSize];
  }

  const maxSplitsByValue = Math.floor(totalValueUSD / minSubOrderValueUSD);
  const maxSplits = Math.min(maxOrderSplits, maxSplitsByValue, MAX_ORDER_SPLITS);

  if (maxSplits <= 1) {
    safeLog('info', 'Cannot split order (maxSplits <= 1)', { maxSplits });
    return [totalSize];
  }

  const estimatedImpact = estimateMarketImpact(totalSize, 'Buy');
  let numberOfSplits = 1;

  if (estimatedImpact > MAX_ACCEPTABLE_IMPACT_BPS) {
    numberOfSplits = maxSplits;
    safeLog('info', 'High market impact detected, splitting into max splits', {
      estimatedImpact,
      numberOfSplits,
    });
  } else if (estimatedImpact > MAX_ACCEPTABLE_IMPACT_BPS / 2) {
    numberOfSplits = Math.max(2, Math.floor(maxSplits / 2));
    safeLog('info', 'Medium market impact detected, splitting order', {
      estimatedImpact,
      numberOfSplits,
    });
  } else {
    safeLog('info', 'Low market impact, no split needed', { estimatedImpact });
    return [totalSize];
  }

  const subOrderSize = roundToDecimals(totalSize / numberOfSplits, SIZE_DECIMALS);
  const splits = Array.from({ length: numberOfSplits }, () => subOrderSize);

  const totalAllocated = subOrderSize * numberOfSplits;
  const remainder = totalSize - totalAllocated;
  if (Math.abs(remainder) > MIN_SIZE_DIFFERENCE) {
    splits[splits.length - 1] = roundToDecimals(
      splits[splits.length - 1] + remainder,
      SIZE_DECIMALS
    );
  }

  safeLog('info', 'Order split calculated', {
    totalSize,
    numberOfSplits: splits.length,
    splits,
  });

  return splits;
}

export function estimateMarketImpactInternal(params: {
  size: number;
  side: OrderSide;
  roundToDecimals: (value: number, decimals: number) => number;
  safeLog: (level: LogLevel, message: string, metadata?: Record<string, unknown>) => void;
}): number {
  const { size, side, roundToDecimals, safeLog } = params;
  const assumedDailyVolume = MIN_DAILY_VOLUME_USD * 10;
  const orderAsPercentOfVolume = (size / assumedDailyVolume) * 100;
  const rawImpact =
    Math.sqrt(orderAsPercentOfVolume / 100) * MARKET_IMPACT_COEFFICIENT * 10000;

  let impactMultiplier = 1.0;
  if (orderAsPercentOfVolume > LARGE_ORDER_THRESHOLD_PERCENT) {
    impactMultiplier = 2.0;
  } else if (orderAsPercentOfVolume > SIGNIFICANT_ORDER_THRESHOLD_PERCENT) {
    impactMultiplier = 1.5;
  }

  const finalImpact = rawImpact * impactMultiplier;
  const roundedImpact = roundToDecimals(finalImpact, IMPACT_DECIMALS);

  safeLog('info', 'Market impact estimated', {
    size,
    side,
    orderAsPercentOfVolume: roundToDecimals(orderAsPercentOfVolume, 2),
    rawImpact: roundToDecimals(rawImpact, IMPACT_DECIMALS),
    impactMultiplier,
    finalImpact: roundedImpact,
  });

  return roundedImpact;
}
