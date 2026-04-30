import {
  createManagedOrderbookManagerContext,
  createOrderbookDeltaFixture,
  createOrderbookSnapshotFixture,
  setOrderbookLastSnapshotTime,
  type ManagedOrderbookManagerContext,
} from '../helpers/orderbook-manager-test.utils';

describe('OrderbookManagerService functional behavior', () => {
  let context: ManagedOrderbookManagerContext;

  beforeEach(() => {
    context = createManagedOrderbookManagerContext();
  });

  afterEach(() => {
    context.cleanup();
  });

  it('processes snapshot, delta, stale reads, and reset as one lifecycle', () => {
    context.service.processUpdate(
      createOrderbookSnapshotFixture({
        bids: [['100', '10'], ['99', '5']],
        asks: [['101', '8'], ['102', '3']],
        updateId: 1,
      }),
    );

    context.service.processUpdate(
      createOrderbookDeltaFixture({
        bids: [['100', '15'], ['98', '2']],
        asks: [['102', '0'], ['103', '6']],
        updateId: 2,
      }),
    );

    const updatedSnapshot = context.service.getSnapshot();
    expect(updatedSnapshot).toEqual({
      bids: [
        { price: 100, size: 15 },
        { price: 99, size: 5 },
        { price: 98, size: 2 },
      ],
      asks: [
        { price: 101, size: 8 },
        { price: 103, size: 6 },
      ],
      timestamp: expect.any(Number),
      updateId: 2,
    });

    setOrderbookLastSnapshotTime(context.service, Date.now() - 61000);
    const staleSnapshot = context.service.getSnapshot();
    expect(staleSnapshot?.updateId).toBe(2);
    expect(context.mockLogger.warn).toHaveBeenCalledWith(
      'Serving stale orderbook data (degraded mode)',
      expect.objectContaining({ symbol: 'BTCUSDT', ageMs: expect.any(Number) }),
    );

    context.service.reset();
    expect(context.service.isReady()).toBe(false);
    expect(context.service.getSnapshot()).toBeNull();
  });

  it('notifies wall tracker for level upserts and removals while preserving orderbook state', () => {
    context.service.processUpdate(
      createOrderbookSnapshotFixture({
        bids: [['100', '10']],
        asks: [['101', '8']],
      }),
    );

    context.service.processUpdate(
      createOrderbookDeltaFixture({
        bids: [['100', '0'], ['99', '4']],
        asks: [['102', '7']],
        updateId: 2,
      }),
    );

    expect(context.mockWallTracker.detectWall).toHaveBeenCalledWith(100, 10, 'BID');
    expect(context.mockWallTracker.detectWall).toHaveBeenCalledWith(101, 8, 'ASK');
    expect(context.mockWallTracker.removeWall).toHaveBeenCalledWith(100, 'BID');
    expect(context.mockWallTracker.detectWall).toHaveBeenCalledWith(99, 4, 'BID');
    expect(context.mockWallTracker.detectWall).toHaveBeenCalledWith(102, 7, 'ASK');

    expect(context.service.getSnapshot()).toEqual({
      bids: [{ price: 99, size: 4 }],
      asks: [
        { price: 101, size: 8 },
        { price: 102, size: 7 },
      ],
      timestamp: expect.any(Number),
      updateId: 2,
    });
  });
});
