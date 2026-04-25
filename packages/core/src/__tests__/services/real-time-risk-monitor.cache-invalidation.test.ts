import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
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

type RealTimeRiskMonitorCacheInvalidationContext =
  ReturnType<typeof createManagedRealTimeRiskMonitorHarness>;

describe('RealTimeRiskMonitor Cache Invalidation Tests (Phase 9.P1)', () => {
  let monitor: RealTimeRiskMonitorCacheInvalidationContext['monitor'];
  let mockPositionService: MockRiskMonitorPositionService;
  let mockLogger: MockRiskMonitorLogger;
  let mockEventBus: MockRiskMonitorEventBus;
  let cleanup: RealTimeRiskMonitorCacheInvalidationContext['cleanup'];

  beforeEach(() => {
    ({ monitor, mockPositionService, mockLogger, mockEventBus, cleanup } =
      createManagedRealTimeRiskMonitorHarness({ started: true }));
  });

  afterEach(() => {
    cleanup();
  });

  it('CI1: position-closed event clears health score cache', async () => {
    const position = await seedRiskMonitorHealthScore({
      monitor,
      mockPositionService,
      mockLogger,
      mockEventBus,
    });
    expect(monitor.getLatestHealthScore(position.id)).toBeDefined();

    invalidateRiskMonitorPosition({ monitor, mockPositionService, mockLogger, mockEventBus }, { positionId: position.id });

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
      { monitor, mockPositionService, mockLogger, mockEventBus },
      [
        { position: firstPosition, currentPrice: 46000 },
        { position: secondPosition, currentPrice: 3100 },
      ],
    );

    invalidateRiskMonitorPosition(
      { monitor, mockPositionService, mockLogger, mockEventBus },
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
      { monitor, mockPositionService, mockLogger, mockEventBus },
      { closedPosition: position },
    );

    const statistics = monitor.getStatistics();
    expect(statistics.cachedScores).toBe(0);
    expect(statistics.generatedAlerts).toBe(0);
  });

  it('CI5: Multiple close events are idempotent', async () => {
    const position = await seedRiskMonitorHealthScore({
      monitor,
      mockPositionService,
      mockLogger,
      mockEventBus,
    });

    invalidateRiskMonitorPosition({ monitor, mockPositionService, mockLogger, mockEventBus }, { positionId: position.id });
    invalidateRiskMonitorPosition({ monitor, mockPositionService, mockLogger, mockEventBus }, { positionId: position.id });

    expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });

  it('CI6: Cache invalidation logged for debugging', async () => {
    const position = await seedRiskMonitorHealthScore({
      monitor,
      mockPositionService,
      mockLogger,
      mockEventBus,
    });
    invalidateRiskMonitorPosition({ monitor, mockPositionService, mockLogger, mockEventBus }, { position });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });
});
