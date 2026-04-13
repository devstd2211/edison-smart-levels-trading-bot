import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createManagedRealTimeRiskMonitorHarness,
  createMockRiskMonitorPosition,
  invalidateRiskMonitorPosition,
  seedRiskMonitorHealthScore,
  seedRiskMonitorHealthScores,
  type ManagedRealTimeRiskMonitorHarness,
  type MockRiskMonitorEventBus,
  type MockRiskMonitorLogger,
  type MockRiskMonitorPositionService,
} from '../helpers/real-time-risk-monitor-test.utils';
import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';

describe('RealTimeRiskMonitor Cache Invalidation Tests (Phase 9.P1)', () => {
  let managedHarness: ManagedRealTimeRiskMonitorHarness;
  type RealTimeRiskMonitorHarnessRuntime = Pick<ManagedRealTimeRiskMonitorHarness, 'monitor'>;
  type RealTimeRiskMonitorHarnessMocks = Pick<
    ManagedRealTimeRiskMonitorHarness,
    'mockPositionService' | 'mockLogger' | 'mockEventBus'
  >;
  type RealTimeRiskMonitorHarnessView =
    RealTimeRiskMonitorHarnessRuntime & RealTimeRiskMonitorHarnessMocks;
  type RealTimeRiskMonitorHarnessCleanup = ManagedRealTimeRiskMonitorHarness['cleanup'];
  let monitor: RealTimeRiskMonitor;
  let mockPositionService: MockRiskMonitorPositionService;
  let mockLogger: MockRiskMonitorLogger;
  let mockEventBus: MockRiskMonitorEventBus;
  let harness: RealTimeRiskMonitorHarnessView;

  beforeEach(() => {
    managedHarness = createManagedRealTimeRiskMonitorHarness({ started: true });
    monitor = managedHarness.monitor;
    mockPositionService = managedHarness.mockPositionService;
    mockLogger = managedHarness.mockLogger;
    mockEventBus = managedHarness.mockEventBus;
    harness = {
      monitor,
      mockPositionService,
      mockLogger,
      mockEventBus,
    };
  });

  afterEach(() => {
    managedHarness.cleanup();
  });

  it('CI1: position-closed event clears health score cache', async () => {
    const position = await seedRiskMonitorHealthScore(harness);
    expect(monitor.getLatestHealthScore(position.id)).toBeDefined();

    invalidateRiskMonitorPosition(harness, { positionId: position.id });

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
      harness,
      [
        { position: firstPosition, currentPrice: 46000 },
        { position: secondPosition, currentPrice: 3100 },
      ],
    );

    invalidateRiskMonitorPosition(
      harness,
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
      harness,
      { closedPosition: position },
    );

    const statistics = monitor.getStatistics();
    expect(statistics.cachedScores).toBe(0);
    expect(statistics.generatedAlerts).toBe(0);
  });

  it('CI5: Multiple close events are idempotent', async () => {
    const position = await seedRiskMonitorHealthScore(harness);

    invalidateRiskMonitorPosition(harness, { positionId: position.id });
    invalidateRiskMonitorPosition(harness, { positionId: position.id });

    expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });

  it('CI6: Cache invalidation logged for debugging', async () => {
    const position = await seedRiskMonitorHealthScore(harness);
    invalidateRiskMonitorPosition(harness, { position });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });
});
