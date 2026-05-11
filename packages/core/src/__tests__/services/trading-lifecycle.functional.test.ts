import { ICONS } from '../../cli/cli-runtime';
import { PositionLifecycleState } from '../../types/legacy';
import {
  createManagedTradingLifecycleContext,
  createTrackedPositionFixture,
} from '../helpers/trading-lifecycle-test.utils';

describe('TradingLifecycleManager functional behavior', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('tracks and untracks positions through subscribed lifecycle events', () => {
    const { manager, eventBus, cleanup } = createManagedTradingLifecycleContext();

    manager.start();

    const openedHandler = eventBus.subscribe.mock.calls.find((call) => call[0] === 'position-opened')?.[1];
    const closedHandler = eventBus.subscribe.mock.calls.find((call) => call[0] === 'position-closed')?.[1];

    openedHandler?.({
      position: {
        id: 'pos-functional',
        symbol: 'BTCUSDT',
        side: 'LONG',
        entryPrice: 50000,
        openedAt: Date.now(),
        quantity: 1,
        marginUsed: 100,
      },
    });
    expect(manager.getTrackedPositionCount()).toBe(1);

    closedHandler?.({ positionId: 'pos-functional' });
    expect(manager.getTrackedPositionCount()).toBe(0);

    cleanup();
  });

  it('emits a warning only once while keeping the tracked position in WARNING state', async () => {
    const { manager, eventBus, logger, cleanup } = createManagedTradingLifecycleContext();
    manager.trackPosition(
      createTrackedPositionFixture({
        positionId: 'pos-warning',
        entryTime: Date.now() - 46 * 60_000,
        state: PositionLifecycleState.OPEN,
      }),
    );

    await manager.checkPositionTimeouts();
    await manager.checkPositionTimeouts();

    expect(eventBus.publishSync).toHaveBeenCalledTimes(1);
    expect(manager.getTrackedPosition('pos-warning')?.state).toBe(PositionLifecycleState.WARNING);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`${ICONS.warning} [TradingLifecycleManager] WARNING TIMEOUT:`),
    );

    cleanup();
  });
});
