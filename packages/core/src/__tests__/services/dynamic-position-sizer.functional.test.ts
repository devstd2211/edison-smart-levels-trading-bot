import {
  calculateDynamicSizeScenario,
  createManagedDynamicPositionSizerContext,
} from '../helpers/dynamic-position-sizer-test.utils';

describe('DynamicPositionSizerService functional behavior', () => {
  it('sizes up for strong signals and down for volatility-aware risk limits', async () => {
    const { service, cleanup } = createManagedDynamicPositionSizerContext();

    const result = await calculateDynamicSizeScenario(service, {
      confidence: 0.9,
      currentATR: 0.8,
      averageATR: 1.2,
      riskRewardRatio: 2,
    });

    expect(result.baseSize).toBeGreaterThan(0);
    expect(result.adjustedSize).toBeGreaterThan(0);
    expect(result.recommendation).toBe('increase');
    expect(result.volatilityAdjustment).toBeGreaterThan(1);

    cleanup();
  });
});
