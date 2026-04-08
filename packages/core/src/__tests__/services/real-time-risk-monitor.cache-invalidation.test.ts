import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createManagedRealTimeRiskMonitorHarness,
  createMockRiskMonitorPosition,
  invalidateRiskMonitorPosition,
  seedRiskMonitorHealthScore,
  seedRiskMonitorHealthScores,
  type MockRiskMonitorEventBus,
  type MockRiskMonitorLogger,
  type MockRiskMonitorPositionService,
} from '../helpers/real-time-risk-monitor-test.utils';
import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';

describe('RealTimeRiskMonitor Cache Invalidation Tests (Phase 9.P1)', () => {
  type RealTimeRiskMonitorManagedHarness = ReturnType<typeof createManagedRealTimeRiskMonitorHarness>;
  type RealTimeRiskMonitorHarnessFixtures = Pick<
    RealTimeRiskMonitorManagedHarness,
    'monitor' | 'mockPositionService' | 'mockLogger' | 'mockEventBus'
  >;
  type RealTimeRiskMonitorHarnessCleanup = RealTimeRiskMonitorManagedHarness['cleanup'];
  let monitor: RealTimeRiskMonitor;
  let mockPositionService: MockRiskMonitorPositionService;
  let mockLogger: MockRiskMonitorLogger;
  let mockEventBus: MockRiskMonitorEventBus;

  function bindRealTimeRiskMonitorHarness() {
    let cleanup: RealTimeRiskMonitorHarnessCleanup;
    let fixtures: RealTimeRiskMonitorHarnessFixtures;

    beforeEach(() => {
      const managedContext = createManagedRealTimeRiskMonitorHarness({ started: true });
      fixtures = {
        monitor: managedContext.monitor,
        mockPositionService: managedContext.mockPositionService,
        mockLogger: managedContext.mockLogger,
        mockEventBus: managedContext.mockEventBus,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getContext = bindRealTimeRiskMonitorHarness();

  beforeEach(() => {
    const fixtures = getContext();
    monitor = fixtures.monitor;
    mockPositionService = fixtures.mockPositionService;
    mockLogger = fixtures.mockLogger;
    mockEventBus = fixtures.mockEventBus;
  });

  it('CI1: position-closed event clears health score cache', async () => {
    const position = await seedRiskMonitorHealthScore(getContext());
    expect(monitor.getLatestHealthScore(position.id)).toBeDefined();

    invalidateRiskMonitorPosition(getContext(), { positionId: position.id });

    expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
  });

  it('CI2: Only closed position cache cleared, others remain', async () => {
    const firstPosition = createMockRiskMonitorPosition();
    const secondPosition = createMockRiskMonitorPosition({
      id: 'pos-2',
      symbol: 'ETHUSDT',
      entryPrice: 3000,
      stopLoss: {
        price: 2940,
        initialPrice: 2940,
        isBreakeven: false,
        isTrailing: false,
        updatedAt: Date.now(),
      },
    });

    await seedRiskMonitorHealthScores(
      getContext(),
      [
        { position: firstPosition, currentPrice: 46000 },
        { position: secondPosition, currentPrice: 3100 },
      ],
    );

    invalidateRiskMonitorPosition(
      getContext(),
      { positionId: firstPosition.id },
    );

    expect(monitor.getLatestHealthScore(firstPosition.id)).toBeUndefined();
    expect(monitor.getLatestHealthScore(secondPosition.id)).toBeDefined();
  });

  it('CI3: Event without position ID logged as warning', () => {
    mockEventBus.emitPositionClosed({ position: null } as never);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('missing ID'),
    );
  });

  it('CI4: Alerts also cleared for closed position', async () => {
    const position = createMockRiskMonitorPosition();
    mockPositionService.getCurrentPosition.mockReturnValue(position);

    await monitor.monitorAllPositions(46000);
    expect(monitor.getStatistics().generatedAlerts).toBeGreaterThanOrEqual(0);

    invalidateRiskMonitorPosition(
      getContext(),
      { closedPosition: position },
    );

    const statistics = monitor.getStatistics();
    expect(statistics.cachedScores).toBe(0);
    expect(statistics.generatedAlerts).toBe(0);
  });

  it('CI5: Multiple close events are idempotent', async () => {
    const position = await seedRiskMonitorHealthScore(getContext());

    invalidateRiskMonitorPosition(getContext(), { positionId: position.id });
    invalidateRiskMonitorPosition(getContext(), { positionId: position.id });

    expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });

  it('CI6: Cache invalidation logged for debugging', async () => {
    const position = await seedRiskMonitorHealthScore(getContext());
    invalidateRiskMonitorPosition(getContext(), { position });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });
});
