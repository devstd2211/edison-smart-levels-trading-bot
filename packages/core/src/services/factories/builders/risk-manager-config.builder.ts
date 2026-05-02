import type { RiskManagerConfig } from '../../../types/legacy';

export const createRiskManagerConfig = (): RiskManagerConfig => ({
  dailyLimits: {
    maxDailyLossPercent: 5.0,
    maxDailyProfitPercent: undefined,
    emergencyStopOnLimit: true,
  },
  lossStreak: {
    stopAfterLosses: 4,
    reductions: {
      after2Losses: 0.75,
      after3Losses: 0.5,
      after4Losses: 0.25,
    },
  },
  concurrentRisk: {
    enabled: false,
    maxPositions: 1,
    maxRiskPerPosition: 2.0,
    maxTotalExposurePercent: 5.0,
  },
  positionSizing: {
    riskPerTradePercent: 1.0,
    minPositionSizeUsdt: 5.0,
    maxPositionSizeUsdt: 100.0,
    maxLeverageMultiplier: 2.0,
  },
});
