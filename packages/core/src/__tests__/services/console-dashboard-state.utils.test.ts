import {
  applyDashboardPosition,
  appendDashboardEventWithLimit,
  buildDashboardTakeProfitLevels,
  mergeDashboardMetrics,
  validateDashboardEventInput,
  validateDashboardFiniteNumber,
  validateDashboardMetricsInput,
  validateDashboardTakeProfitLevels,
} from '../../services/console-dashboard/console-dashboard-state.utils';

describe('console-dashboard state utils', () => {
  it('merges metrics into the timeframe snapshot', () => {
    const metrics = new Map<string, { timeframe: string; trend: string; rsi: number }>();

    mergeDashboardMetrics(metrics, '5m', { trend: 'UPTREND' });
    mergeDashboardMetrics(metrics, '5m', { rsi: 62 });

    expect(metrics.get('5m')).toEqual({
      timeframe: '5m',
      trend: 'UPTREND',
      rsi: 62,
    });
  });

  it('validates numeric and event inputs', () => {
    expect(() => validateDashboardMetricsInput('5m', { rsi: 50, trend: 'NEUTRAL' })).not.toThrow();
    expect(() => validateDashboardFiniteNumber(-1, 'Price')).toThrow('Price must be non-negative');
    expect(() => validateDashboardEventInput('', 'message')).toThrow('Event type must be a non-empty string');
  });

  it('validates take-profit levels and position updates', () => {
    expect(() => validateDashboardTakeProfitLevels([{ percent: 10, price: 100 }])).not.toThrow();
    expect(buildDashboardTakeProfitLevels([{ percent: 10, price: 100 }])[0]).toEqual({
      level: 1,
      percent: 10,
      price: 100,
      reached: false,
    });

    expect(applyDashboardPosition(undefined, { entryPrice: 100 })).toEqual({
      position: { entryPrice: 100 },
      entryPrice: 100,
    });
  });

  it('caps event history at the configured limit', () => {
    const events = [
      { timestamp: new Date('2024-01-01T00:00:00.000Z'), type: 'old', message: 'old' },
    ];

    appendDashboardEventWithLimit(
      events,
      { timestamp: new Date('2024-01-01T00:01:00.000Z'), type: 'new', message: 'new' },
      1,
    );

    expect(events).toEqual([
      { timestamp: new Date('2024-01-01T00:01:00.000Z'), type: 'new', message: 'new' },
    ]);
  });
});
