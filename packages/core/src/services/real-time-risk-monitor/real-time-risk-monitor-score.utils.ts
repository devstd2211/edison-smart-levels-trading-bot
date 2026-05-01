import type {
  DangerLevel,
  HealthAnalysis,
  HealthScore,
  HealthScoreComponents,
  Position,
} from '../../types/legacy';
import { PositionSide } from '../../types/legacy';

export const DEFAULT_RISK_MONITOR_COMPONENT_WEIGHTS = {
  timeAtRisk: 0.2,
  drawdown: 0.3,
  volumeLiquidity: 0.2,
  volatility: 0.15,
  profitability: 0.15,
} as const;

export const DEFAULT_RISK_MONITOR_THRESHOLDS = {
  safe: 70,
  warning: 30,
} as const;

export function calculateTimeAtRiskScore(position: Position): number {
  const entryTime = position.openedAt || Date.now();
  const holdingTimeMs = Date.now() - entryTime;
  const holdingMinutes = holdingTimeMs / 1000 / 60;
  const maxMinutes = 240;
  const percentOfMax = Math.min(holdingMinutes / maxMinutes, 1.0);
  return Math.round(Math.max(0, 100 - percentOfMax * 100));
}

export function calculateUnrealizedPnL(
  position: Position,
  currentPrice: number,
): number {
  return position.side === PositionSide.LONG
    ? (currentPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - currentPrice) * position.quantity;
}

export function calculateDrawdownScore(
  position: Position,
  currentPrice: number,
): number {
  const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);
  const unrealizedPnLPercent =
    (unrealizedPnL / (position.quantity * position.entryPrice)) * 100;

  if (unrealizedPnLPercent >= 0) {
    return 100;
  }

  return Math.round(Math.max(0, 100 + unrealizedPnLPercent * 2));
}

export function calculateVolumeLiquidityScore(): number {
  return 80;
}

export function calculateVolatilityScore(): number {
  return 75;
}

export function calculateProfitabilityScore(
  position: Position,
  currentPrice: number,
): number {
  const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);
  const unrealizedPnLPercent =
    (unrealizedPnL / (position.quantity * position.entryPrice)) * 100;
  return Math.round(Math.max(0, Math.min(100, 100 + unrealizedPnLPercent * 2)));
}

export function buildHealthScoreComponents(
  position: Position,
  currentPrice: number,
): HealthScoreComponents {
  return {
    timeAtRiskScore: calculateTimeAtRiskScore(position),
    drawdownScore: calculateDrawdownScore(position, currentPrice),
    volumeLiquidityScore: calculateVolumeLiquidityScore(),
    volatilityScore: calculateVolatilityScore(),
    profitabilityScore: calculateProfitabilityScore(position, currentPrice),
  };
}

export function calculateOverallHealthScore(
  components: HealthScoreComponents,
  weights = DEFAULT_RISK_MONITOR_COMPONENT_WEIGHTS,
): number {
  return Math.round(
    components.timeAtRiskScore * weights.timeAtRisk +
      components.drawdownScore * weights.drawdown +
      components.volumeLiquidityScore * weights.volumeLiquidity +
      components.volatilityScore * weights.volatility +
      components.profitabilityScore * weights.profitability,
  );
}

export function determineDangerLevel(
  overallScore: number,
  thresholds = DEFAULT_RISK_MONITOR_THRESHOLDS,
): DangerLevel {
  if (overallScore < thresholds.warning) {
    return 'CRITICAL' as DangerLevel;
  }
  if (overallScore < thresholds.safe) {
    return 'WARNING' as DangerLevel;
  }
  return 'SAFE' as DangerLevel;
}

export function buildHealthAnalysis(
  position: Position,
  currentPrice: number,
): HealthAnalysis {
  const entryTime = position.openedAt || Date.now();
  const holdingTimeMs = Date.now() - entryTime;
  const holdingMinutes = holdingTimeMs / 1000 / 60;
  const unrealizedPnL = calculateUnrealizedPnL(position, currentPrice);
  const unrealizedPnLPercent =
    (unrealizedPnL / (position.quantity * position.entryPrice)) * 100;

  return {
    timeAtRisk: {
      minutesHeld: Math.round(holdingMinutes),
      maxMinutes: 240,
      percentOfMax: Math.round((holdingMinutes / 240) * 100),
    },
    currentDrawdown: {
      percent: Math.round(Math.abs(Math.min(0, unrealizedPnLPercent)) * 100) / 100,
      maxThreshold: 5.0,
    },
    volume: {
      lastCandleVolume: 0,
      averageVolume: 0,
      liquidity: 'HIGH',
    },
    volatility: {
      currentAtr: 0,
      averageAtr: 0,
      regimeChange: false,
    },
    profitability: {
      currentPnL: Math.round(unrealizedPnL * 100) / 100,
      currentPnLPercent: Math.round(unrealizedPnLPercent * 100) / 100,
      projectedPnL: unrealizedPnL,
    },
  };
}

export function createSafeDefaultHealthScore(positionId: string): HealthScore {
  return {
    positionId,
    symbol: 'UNKNOWN',
    overallScore: 70,
    components: {
      timeAtRiskScore: 70,
      drawdownScore: 70,
      volumeLiquidityScore: 70,
      volatilityScore: 70,
      profitabilityScore: 70,
    },
    status: 'SAFE' as DangerLevel,
    lastUpdate: Date.now(),
    analysis: {
      timeAtRisk: {
        minutesHeld: 0,
        maxMinutes: 240,
        percentOfMax: 0,
      },
      currentDrawdown: {
        percent: 0,
        maxThreshold: 5.0,
      },
      volume: {
        lastCandleVolume: 0,
        averageVolume: 0,
        liquidity: 'HIGH',
      },
      volatility: {
        currentAtr: 0,
        averageAtr: 0,
        regimeChange: false,
      },
      profitability: {
        currentPnL: 0,
        currentPnLPercent: 0,
        projectedPnL: 0,
      },
    },
  };
}
