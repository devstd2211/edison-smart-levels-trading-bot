import {
  MULTIPLIER_VALUES,
  RATIO_MULTIPLIERS,
  RISK_MANAGER_LOSS_STREAK_MULTIPLIER_2_LOSSES,
  RISK_MANAGER_LOSS_STREAK_MULTIPLIER_3_LOSSES,
  RISK_MANAGER_LOSS_STREAK_MULTIPLIER_4_LOSSES,
  RISK_MANAGER_MIN_SL_DISTANCE_PERCENT,
} from '../../constants';
import type { Position, Signal } from '../../types/legacy';

export function calculateBasePositionSize(
  signal: Signal,
  accountBalance: number,
  riskPerTradePercent: number,
  maxLeverageMultiplier: number,
): number {
  const riskAmount = (accountBalance * riskPerTradePercent) / 100;
  const slDistancePercent = Math.max(
    RISK_MANAGER_MIN_SL_DISTANCE_PERCENT,
    MULTIPLIER_VALUES.TWO - signal.confidence / 100,
  );
  const slDistance = (signal.price * slDistancePercent) / 100;
  const baseSize = riskAmount / slDistance;
  const maxSizeByLeverage =
    (accountBalance * maxLeverageMultiplier) / signal.price;
  return Math.min(baseSize, maxSizeByLeverage);
}

export function calculateSizeMultiplier(consecutiveLosses: number): number {
  switch (consecutiveLosses) {
    case 0:
    case 1:
      return RATIO_MULTIPLIERS.FULL;
    case 2:
      return RISK_MANAGER_LOSS_STREAK_MULTIPLIER_2_LOSSES;
    case 3:
      return RISK_MANAGER_LOSS_STREAK_MULTIPLIER_3_LOSSES;
    default:
      return RISK_MANAGER_LOSS_STREAK_MULTIPLIER_4_LOSSES;
  }
}

export function constrainPositionSize(
  size: number,
  minPositionSizeUsdt: number,
  maxPositionSizeUsdt: number,
): number {
  return Math.max(minPositionSizeUsdt, Math.min(size, maxPositionSizeUsdt));
}

export function buildRiskDetails(
  dailyPnL: number,
  dailyPnLPercent: number,
  consecutiveLosses: number,
  totalExposure: number,
): {
  dailyPnL: number;
  dailyPnLPercent: number;
  consecutiveLosses: number;
  totalExposure: number;
  totalExposurePercent: number;
} {
  return {
    dailyPnL,
    dailyPnLPercent,
    consecutiveLosses,
    totalExposure,
    totalExposurePercent: 0,
  };
}

export function hasCrossedIntoNewUtcDay(
  nowTimestamp: number,
  lastResetTimestamp: number,
): boolean {
  const now = new Date(nowTimestamp);
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const lastResetUTC = new Date(lastResetTimestamp);
  const lastResetDate = new Date(
    Date.UTC(
      lastResetUTC.getUTCFullYear(),
      lastResetUTC.getUTCMonth(),
      lastResetUTC.getUTCDate(),
    ),
  );

  return todayUTC.getTime() > lastResetDate.getTime();
}

export function sumExistingPositionExposure(openPositions: Position[]): number {
  return openPositions.reduce(
    (total, position) => total + Math.abs(position.quantity * position.entryPrice),
    0,
  );
}
