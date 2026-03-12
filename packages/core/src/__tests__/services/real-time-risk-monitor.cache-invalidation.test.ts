import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockRiskMonitorPosition,
  createRealTimeRiskMonitorHarness,
  type MockRiskMonitorEventBus,
  type MockRiskMonitorLogger,
  type MockRiskMonitorPositionService,
} from '../helpers/real-time-risk-monitor-test.utils';
import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';

describe('RealTimeRiskMonitor Cache Invalidation Tests (Phase 9.P1)', () => {
  let monitor: RealTimeRiskMonitor;
  let mockPositionService: MockRiskMonitorPositionService;
  let mockLogger: MockRiskMonitorLogger;
  let mockEventBus: MockRiskMonitorEventBus;

  beforeEach(() => {
    jest.clearAllMocks();

    const harness = createRealTimeRiskMonitorHarness();
    monitor = harness.monitor;
    mockPositionService = harness.mockPositionService;
    mockLogger = harness.mockLogger;
    mockEventBus = harness.mockEventBus;
  });

  afterEach(() => {
    monitor.stop();
  });

  it('CI1: position-closed event clears health score cache', async () => {
    const position = createMockRiskMonitorPosition();
    mockPositionService.getCurrentPosition.mockReturnValue(position);

    await monitor.calculatePositionHealth(position.id, 46000);
    expect(monitor.getLatestHealthScore(position.id)).toBeDefined();

    mockEventBus.emitPositionClosed({ positionId: position.id });

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

    mockPositionService.getCurrentPosition
      .mockReturnValueOnce(firstPosition)
      .mockReturnValueOnce(secondPosition);

    await monitor.calculatePositionHealth(firstPosition.id, 46000);
    await monitor.calculatePositionHealth(secondPosition.id, 3100);

    mockEventBus.emitPositionClosed({ positionId: firstPosition.id });

    expect(monitor.getLatestHealthScore(firstPosition.id)).toBeUndefined();
    expect(monitor.getLatestHealthScore(secondPosition.id)).toBeDefined();
  });

  it('CI3: Event without position ID logged as warning', () => {
    monitor.start();

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

    mockEventBus.emitPositionClosed({ closedPosition: position });

    const statistics = monitor.getStatistics();
    expect(statistics.cachedScores).toBe(0);
    expect(statistics.generatedAlerts).toBe(0);
  });

  it('CI5: Multiple close events are idempotent', async () => {
    const position = createMockRiskMonitorPosition();
    mockPositionService.getCurrentPosition.mockReturnValue(position);

    await monitor.calculatePositionHealth(position.id, 46000);

    mockEventBus.emitPositionClosed({ positionId: position.id });
    mockEventBus.emitPositionClosed({ positionId: position.id });

    expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });

  it('CI6: Cache invalidation logged for debugging', async () => {
    const position = createMockRiskMonitorPosition();
    mockPositionService.getCurrentPosition.mockReturnValue(position);

    await monitor.calculatePositionHealth(position.id, 46000);
    mockEventBus.emitPositionClosed({ position: position });

    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('invalidated'),
      expect.objectContaining({ positionId: position.id }),
    );
  });
});
