import { getBoundedMagnitudePercent, getMetricDirection, getRatioPercent, getSignedValuePrefix } from '../../utils/metric-direction';

describe('metric-direction utils', () => {
  test('treats zero as a neutral direction with no explicit positive prefix', () => {
    expect(getMetricDirection(0)).toBe('neutral');
    expect(getSignedValuePrefix(getMetricDirection(0))).toBe('');
    expect(getSignedValuePrefix(getMetricDirection(4.2))).toBe('+');
  });

  test('keeps zero-valued bar calculations at zero instead of dividing by zero or leaking fallback widths', () => {
    expect(getBoundedMagnitudePercent(0, 10)).toBe(0);
    expect(getRatioPercent(0, 50)).toBe(0);
    expect(getRatioPercent(50, 0)).toBe(0);
  });
});
