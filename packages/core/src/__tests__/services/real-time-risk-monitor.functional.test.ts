import {
  attachRiskMonitorCurrentPosition,
  createManagedRealTimeRiskMonitorContext,
} from '../helpers/real-time-risk-monitor-test.utils';

describe('RealTimeRiskMonitor functional', () => {
  it('monitors a live position and invalidates cache after close event', async () => {
    const {
      monitor,
      mockPositionService,
      mockEventBus,
      cleanup,
    } = createManagedRealTimeRiskMonitorContext({ started: true });

    try {
      const position = attachRiskMonitorCurrentPosition({ mockPositionService });
      const report = await monitor.monitorAllPositions(46000);
      expect(report.totalPositions).toBe(1);

      mockEventBus.emitPositionClosed({ positionId: position.id });
      expect(monitor.getLatestHealthScore(position.id)).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
