import {
  calculateConfidenceMultiplierValue,
  calculateKellyPositionSize,
  calculateRiskAdjustedSize,
  calculateVolatilityAdjustmentValue,
  roundPositionSizeValue,
} from '../../services/dynamic-position-sizer/dynamic-position-sizer-state.utils';

describe('dynamic-position-sizer state utils', () => {
  it('calculates a bounded Kelly-derived base size', () => {
    expect(calculateKellyPositionSize({
      winProbability: 0.7,
      riskRewardRatio: 2,
      accountBalance: 10000,
      minimumRiskRewardRatio: 1,
      maxKellyFraction: 0.25,
    })).toBeGreaterThan(0);
  });

  it('adjusts size for confidence and volatility', () => {
    expect(calculateConfidenceMultiplierValue({
      confidence: 0.9,
      increasedSizeConfidenceThreshold: 0.8,
      reducedSizeConfidenceThreshold: 0.6,
      minimumConfidenceThreshold: 0.4,
      maxConfidenceMultiplier: 1.5,
      minConfidenceMultiplier: 0.5,
    })).toBeGreaterThan(1);

    expect(calculateVolatilityAdjustmentValue({
      currentATR: 2,
      averageATR: 1,
      minimumAtrValue: 0.0001,
      volatilityMultiplier: 1,
      minVolatilityAdjustment: 0.5,
      maxVolatilityAdjustment: 2,
    })).toBeLessThan(1);
  });

  it('caps size by risk limits and rounds output', () => {
    const adjusted = calculateRiskAdjustedSize({
      size: 10000,
      accountBalance: 10000,
      entryPrice: 100,
      stopDistance: 5,
      maxRiskPercent: 3,
      absoluteMaxRiskPercent: 5,
      maxPositionSize: 1000,
      maxPositionSizePercent: 0.8,
      dustThreshold: 1,
      minPositionSize: 10,
    });

    expect(adjusted).toBeLessThanOrEqual(1000);
    expect(roundPositionSizeValue(123.4567, 2)).toBe(123.46);
  });
});
