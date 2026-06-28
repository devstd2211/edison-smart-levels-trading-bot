import { RealTimeRiskMonitor } from '../../services/real-time-risk-monitor.service';
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

  it('start() is idempotent — subscribes only once on repeated calls', () => {
    const { monitor, mockEventBus, cleanup } = createManagedRealTimeRiskMonitorContext();

    try {
      monitor.start();
      monitor.start();

      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('stop() unsubscribes the position-closed handler', () => {
    const unsubscribeSpy = jest.fn();
    const { monitor, mockEventBus, cleanup } = createManagedRealTimeRiskMonitorContext();

    try {
      mockEventBus.subscribe.mockReturnValueOnce(unsubscribeSpy);
      monitor.start();
      monitor.stop();

      expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('stop() before start() is a no-op', () => {
    const { monitor, mockEventBus, cleanup } = createManagedRealTimeRiskMonitorContext();

    try {
      expect(() => monitor.stop()).not.toThrow();
      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
    } finally {
      cleanup();
    }
  });

  describe('export boundary', () => {
    it('RealTimeRiskMonitor is a constructible class', () => {
      expect(typeof RealTimeRiskMonitor).toBe('function');
    });
  });
});
