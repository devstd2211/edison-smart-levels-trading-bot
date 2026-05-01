export function calculateKellyPositionSize(params: {
  winProbability: number;
  riskRewardRatio: number;
  accountBalance: number;
  minimumRiskRewardRatio: number;
  maxKellyFraction: number;
}): number {
  const {
    winProbability,
    riskRewardRatio,
    accountBalance,
    minimumRiskRewardRatio,
    maxKellyFraction,
  } = params;

  const safeRiskRewardRatio = Math.max(riskRewardRatio, minimumRiskRewardRatio);
  const clampedWinProbability = Math.max(0, Math.min(1, winProbability));
  const lossProbability = 1 - clampedWinProbability;
  const kellyPercent =
    ((clampedWinProbability * safeRiskRewardRatio) - lossProbability)
    / safeRiskRewardRatio;

  return Math.max(0, accountBalance * Math.max(0, kellyPercent) * maxKellyFraction);
}

export function calculateConfidenceMultiplierValue(params: {
  confidence: number;
  increasedSizeConfidenceThreshold: number;
  reducedSizeConfidenceThreshold: number;
  minimumConfidenceThreshold: number;
  maxConfidenceMultiplier: number;
  minConfidenceMultiplier: number;
}): number {
  const {
    confidence,
    increasedSizeConfidenceThreshold,
    reducedSizeConfidenceThreshold,
    minimumConfidenceThreshold,
    maxConfidenceMultiplier,
    minConfidenceMultiplier,
  } = params;

  if (confidence >= increasedSizeConfidenceThreshold) {
    const range = 1 - increasedSizeConfidenceThreshold;
    const position = confidence - increasedSizeConfidenceThreshold;
    const multiplier =
      1 + ((position / range) * (maxConfidenceMultiplier - 1));
    return Math.min(multiplier, maxConfidenceMultiplier);
  }

  if (confidence < reducedSizeConfidenceThreshold) {
    const range = reducedSizeConfidenceThreshold - minimumConfidenceThreshold;
    const position = confidence - minimumConfidenceThreshold;
    const multiplier =
      minConfidenceMultiplier
      + ((position / range) * (1 - minConfidenceMultiplier));
    return Math.max(multiplier, minConfidenceMultiplier);
  }

  return 1;
}

export function calculateVolatilityAdjustmentValue(params: {
  currentATR: number;
  averageATR: number;
  minimumAtrValue: number;
  volatilityMultiplier: number;
  minVolatilityAdjustment: number;
  maxVolatilityAdjustment: number;
}): number {
  const {
    currentATR,
    averageATR,
    minimumAtrValue,
    volatilityMultiplier,
    minVolatilityAdjustment,
    maxVolatilityAdjustment,
  } = params;

  const safeCurrentATR = Math.max(currentATR, minimumAtrValue);
  const safeAverageATR = Math.max(averageATR, minimumAtrValue);
  const adjustment = (safeAverageATR / safeCurrentATR) * volatilityMultiplier;
  return Math.max(
    minVolatilityAdjustment,
    Math.min(maxVolatilityAdjustment, adjustment),
  );
}

export function calculateRiskAdjustedSize(params: {
  size: number;
  accountBalance: number;
  entryPrice: number;
  stopDistance: number;
  maxRiskPercent: number;
  absoluteMaxRiskPercent: number;
  maxPositionSize: number;
  maxPositionSizePercent: number;
  dustThreshold: number;
  minPositionSize: number;
}): number {
  const {
    size,
    accountBalance,
    entryPrice,
    stopDistance,
    maxRiskPercent,
    absoluteMaxRiskPercent,
    maxPositionSize,
    maxPositionSizePercent,
    dustThreshold,
    minPositionSize,
  } = params;

  let adjustedSize = size;
  const positionRisk = (size * stopDistance) / entryPrice;
  const maxRiskUsd = (accountBalance * maxRiskPercent) / 100;
  const maxRiskUsdAbsolute = (accountBalance * absoluteMaxRiskPercent) / 100;

  if (positionRisk > maxRiskUsd) {
    adjustedSize = (maxRiskUsd * entryPrice) / stopDistance;
  }

  if (positionRisk > maxRiskUsdAbsolute) {
    adjustedSize = (maxRiskUsdAbsolute * entryPrice) / stopDistance;
  }

  adjustedSize = Math.min(adjustedSize, maxPositionSize);
  adjustedSize = Math.min(adjustedSize, accountBalance * maxPositionSizePercent);

  if (adjustedSize < dustThreshold) {
    return 0;
  }

  return adjustedSize > 0 && adjustedSize < minPositionSize
    ? minPositionSize
    : adjustedSize;
}

export function roundPositionSizeValue(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}
