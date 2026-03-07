import { Signal } from '../../types/legacy';

export type PositionExposure = {
  quantity: number;
  marginUsed: number;
  notionalValue: number;
};

type PositionSizingCompletedLogPayload = {
  quantity: number;
  marginUsed: string;
  notionalValue: string;
  sizingChain: string;
};

type StopLossCalculatedLogPayload = {
  signalPrice: number;
  currentPrice: number;
  slDistancePercent: string;
  actualStopLoss: string;
};

type CompoundSizingSuccessLogPayload = {
  currentBalance: number;
  totalProfit: number;
  positionSize: number;
};

type KellySizingSuccessLogPayload = {
  baseSize: number;
  adjustedSize: number;
  riskPercent: number;
  confidence: number;
  volatilityAdj: number;
  recommendation: string;
};

type SizingFallbackLogPayload = {
  error: string;
};

export function resolveFirstTakeProfitPrice(signal: Signal): number {
  if (signal.takeProfits && signal.takeProfits[0]) {
    const directionMultiplier = signal.direction === 'LONG' ? 1 : -1;
    return signal.price * (1 + signal.takeProfits[0].percent / 100 * directionMultiplier);
  }
  return signal.price * 1.01;
}

export function calculateRiskRewardRatio(
  entryPrice: number,
  stopLoss: number,
  firstTakeProfitPrice: number,
): number {
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const tpDistance = Math.abs(firstTakeProfitPrice - entryPrice);
  return stopDistance > 0 ? tpDistance / stopDistance : 1.5;
}

export function calculatePositionExposure(
  positionSizeUsdt: number,
  leverage: number,
  signalPrice: number,
): PositionExposure {
  const rawQuantity = (positionSizeUsdt * leverage) / signalPrice;
  const quantity = Math.floor(rawQuantity * 100) / 100;
  const marginUsed = positionSizeUsdt;
  const notionalValue = quantity * signalPrice;

  return { quantity, marginUsed, notionalValue };
}

export function buildPositionSizingCompletedLogPayload(
  result: {
    quantity: number;
    marginUsed: number;
    notionalValue: number;
    sizingChain: string[];
  },
  percentDecimals: number,
): PositionSizingCompletedLogPayload {
  return {
    quantity: result.quantity,
    marginUsed: result.marginUsed.toFixed(percentDecimals),
    notionalValue: result.notionalValue.toFixed(percentDecimals),
    sizingChain: result.sizingChain.join(' -> '),
  };
}

export function buildStopLossCalculatedLogPayload(
  params: {
    signalPrice: number;
    currentPrice: number;
    slDistance: number;
    actualStopLoss: number;
  },
  percentMultiplier: number,
  percentDecimals: number,
): StopLossCalculatedLogPayload {
  const { signalPrice, currentPrice, slDistance, actualStopLoss } = params;
  return {
    signalPrice,
    currentPrice,
    slDistancePercent: (slDistance / currentPrice * percentMultiplier).toFixed(2) + '%',
    actualStopLoss: actualStopLoss.toFixed(percentDecimals),
  };
}

export function resolveSignalConfidence(
  confidence: number | undefined,
  defaultConfidence: number = 0.7,
): number {
  return confidence ?? defaultConfidence;
}

export function buildKellySizingChainEntries(
  confidence: number,
  riskPercent: number,
  currentATR: number | undefined,
  averageATR: number | undefined,
  volatilityAdjustment: number,
): string[] {
  const entries = [
    'KELLY_CRITERION',
    `CONF_${confidence * 100}%`,
    `RISK_${riskPercent.toFixed(2)}%`,
  ];

  if (currentATR && averageATR) {
    entries.push(`ATR_${volatilityAdjustment.toFixed(2)}x`);
  }

  return entries;
}

export function buildCompoundSizingSuccessLogPayload(
  currentBalance: number,
  totalProfit: number,
  positionSize: number,
): CompoundSizingSuccessLogPayload {
  return {
    currentBalance,
    totalProfit,
    positionSize,
  };
}

export function buildKellySizingSuccessLogPayload(params: {
  baseSize: number;
  adjustedSize: number;
  riskPercent: number;
  confidence: number;
  volatilityAdj: number;
  recommendation: string;
}): KellySizingSuccessLogPayload {
  return {
    baseSize: params.baseSize,
    adjustedSize: params.adjustedSize,
    riskPercent: params.riskPercent,
    confidence: params.confidence,
    volatilityAdj: params.volatilityAdj,
    recommendation: params.recommendation,
  };
}

export function buildSizingFallbackLogPayload(errorMessage: string): SizingFallbackLogPayload {
  return { error: errorMessage };
}
