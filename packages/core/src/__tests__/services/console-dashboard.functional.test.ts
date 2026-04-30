import {
  createConsoleDashboardPosition,
  createManagedConsoleDashboardContext,
} from '../helpers/console-dashboard-test.utils';

describe('ConsoleDashboardService functional behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks metrics, market state, position state, and bounded events together', () => {
    const { service, cleanup } = createManagedConsoleDashboardContext();

    service.updateMetrics('5m', { trend: 'UPTREND', rsi: 61, ema20: 50000 });
    service.updatePrice(50100);
    service.updatePosition(createConsoleDashboardPosition());
    service.updatePnL(120, 1.5);
    service.setTakeProfits([{ price: 51000, percent: 10 }]);
    service.setStopLoss(49000);
    service.recordWin(120);
    service.recordLoss(-20);
    service.recordEvent('position-open', 'opened');

    const state = (service as unknown as { state: Record<string, unknown> }).state;
    expect(state.metrics).toBeInstanceOf(Map);
    expect((state.metrics as Map<string, unknown>).get('5m')).toEqual(
      expect.objectContaining({ trend: 'UPTREND', rsi: 61 }),
    );
    expect(state.currentPrice).toBe(50100);
    expect(state.entryPrice).toBe(50000);
    expect(state.currentPnL).toBe(120);
    expect(state.currentPnLPercent).toBe(1.5);
    expect(state.tpLevels).toEqual([
      { price: 51000, percent: 10, level: 1, reached: false },
    ]);
    expect(state.slLevel).toBe(49000);
    expect(state.dailyWins).toBe(1);
    expect(state.dailyLosses).toBe(1);
    expect(state.dailyPnL).toBe(100);
    expect((state.events as Array<{ type: string }>)[0].type).toBe('position-open');

    cleanup();
  });
});
