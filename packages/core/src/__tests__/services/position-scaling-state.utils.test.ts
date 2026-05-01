import {
  calculatePositionProfitPercent,
  calculateScaledStopLoss,
  calculateScaleSizeValue,
} from '../../services/position-scaling/position-scaling-state.utils';
import { createPositionScalingPosition } from '../helpers/position-scaling-test.utils';

describe('position-scaling state utils', () => {
  it('calculates profit percent for long and short positions', () => {
    const longPosition = createPositionScalingPosition();
    const shortPosition = createPositionScalingPosition({
      currentPrice: 95,
      stopLoss: 105,
      profitTarget: 90,
      side: 'short',
    });

    expect(calculatePositionProfitPercent(longPosition)).toBeCloseTo(0.5, 5);
    expect(calculatePositionProfitPercent(shortPosition)).toBeCloseTo(0.5, 5);
  });

  it('calculates reduced scale size by scale count', () => {
    const size = calculateScaleSizeValue(
      { size: 100, scaleCount: 2 },
      0.5,
      10,
    );

    expect(size).toBeCloseTo(12.5, 5);
  });

  it('moves stop loss toward breakeven as profit increases', () => {
    const position = createPositionScalingPosition();
    expect(calculateScaledStopLoss(position, 0.5, 0.5)).toBe(100);
    expect(calculateScaledStopLoss(position, 0.25, 0.5)).toBe(97.5);
  });
});
