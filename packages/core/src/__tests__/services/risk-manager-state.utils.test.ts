import {
  buildRiskDetails,
  calculateBasePositionSize,
  calculateSizeMultiplier,
  constrainPositionSize,
  hasCrossedIntoNewUtcDay,
  sumExistingPositionExposure,
} from '../../services/risk-manager/risk-manager-state.utils';
import {
  createRiskManagerPosition,
  createRiskManagerSignal,
} from '../helpers/risk-manager-test.utils';

describe('risk-manager-state.utils', () => {
  it('computes sizing and constraints', () => {
    const signal = createRiskManagerSignal({ price: 100, confidence: 75 });
    const size = calculateBasePositionSize(signal, 1000, 1, 2);

    expect(size).toBeGreaterThan(0);
    expect(calculateSizeMultiplier(3)).toBe(0.5);
    expect(constrainPositionSize(size, 5, 50)).toBeLessThanOrEqual(50);
  });

  it('builds details, sums exposure, and detects utc day rollover', () => {
    const details = buildRiskDetails(10, 1, 2, 100);
    const exposure = sumExistingPositionExposure([
      createRiskManagerPosition({ quantity: 1, entryPrice: 100 }),
      createRiskManagerPosition({ quantity: 2, entryPrice: 50 }),
    ]);
    const previousDay = Date.UTC(2026, 4, 1, 23, 0, 0);
    const nextDay = Date.UTC(2026, 4, 2, 0, 1, 0);

    expect(details.totalExposurePercent).toBe(0);
    expect(exposure).toBe(200);
    expect(hasCrossedIntoNewUtcDay(nextDay, previousDay)).toBe(true);
  });
});
