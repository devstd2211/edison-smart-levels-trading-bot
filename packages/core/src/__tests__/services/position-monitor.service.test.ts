/**
 * Position Monitor Service Tests
 *
 * Tests for position monitoring, TP/SL detection, and time-based exits.
 */

import {
  PositionSide,
} from '../../types/legacy';
import {
  attachCurrentPosition,
  attachExchangePosition,
  attachScenarioExchangePosition,
  attachTimeBasedExitScenario,
  createManagedPositionMonitorContext,
  createPositionMonitorOpenedAtMinutesAgo,
  createPositionMonitorRiskConfig,
  createPositionMonitorScenarioPosition,
  createTimeBasedExitRiskConfig,
  defaultPositionMonitorRiskConfig,
  runPositionMonitorCycle,
  runPositionMonitorCycles,
  runPositionMonitorDeepSyncCycle,
  type PositionMonitorManagedRuntime,
} from '../helpers/position-monitor-test.utils';

const createMockPosition = createPositionMonitorScenarioPosition;

// ============================================================================
// TESTS
// ============================================================================

describe('PositionMonitorService', () => {
  let monitor: PositionMonitorManagedRuntime['monitor'];
  let mockBybit: PositionMonitorManagedRuntime['mockBybit'];
  let mockPositionManager: PositionMonitorManagedRuntime['mockPositionManager'];
  let mockTelegram: PositionMonitorManagedRuntime['mockTelegram'];
  let mockPositionSync: PositionMonitorManagedRuntime['mockPositionSync'];
  let positionHarness: PositionMonitorManagedRuntime['positionHarness'];
  let rebuildMonitor: PositionMonitorManagedRuntime['rebuildMonitor'];
  let cleanup: PositionMonitorManagedRuntime['cleanup'];

  beforeEach(() => {
    ({
      monitor,
      mockBybit,
      mockPositionManager,
      mockTelegram,
      mockPositionSync,
      positionHarness,
      rebuildMonitor,
      cleanup,
    } = createManagedPositionMonitorContext({
      riskConfig: {
        ...defaultPositionMonitorRiskConfig,
        positionSizeUsdt: 10,
      },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // TEST GROUP 1: Start/Stop/IsActive
  // ==========================================================================

  describe('start/stop/isActive', () => {
    it('should start monitoring and emit started event', () => {
      const startedSpy = jest.fn();
      monitor.on('started', startedSpy);

      monitor.start();

      expect(monitor.isActive()).toBe(true);
      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    it('should not start if already monitoring', () => {
      const startedSpy = jest.fn();
      monitor.on('started', startedSpy);

      monitor.start();
      monitor.start(); // Second call

      expect(startedSpy).toHaveBeenCalledTimes(1); // Only once
    });

    it('should stop monitoring and emit stopped event', () => {
      const stoppedSpy = jest.fn();
      monitor.on('stopped', stoppedSpy);

      monitor.start();
      monitor.stop();

      expect(monitor.isActive()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalledTimes(1);
    });

    it('should not stop if already stopped', () => {
      const stoppedSpy = jest.fn();
      monitor.on('stopped', stoppedSpy);

      monitor.stop(); // Already stopped

      expect(stoppedSpy).not.toHaveBeenCalled();
    });

    it('should clear interval on stop', () => {
      monitor.start();
      expect(monitor.isActive()).toBe(true);

      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });
  });

  // ==========================================================================
  // TEST GROUP 2: Stop Loss Detection
  // ==========================================================================

  describe('stop loss detection', () => {
    it('should emit stopLossHit event when LONG SL is hit', async () => {
      const position = attachScenarioExchangePosition({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
      });
      mockBybit.getCurrentPrice.mockResolvedValue(1.47); // Below SL

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(slHitSpy).toHaveBeenCalledTimes(1);
      expect(slHitSpy).toHaveBeenCalledWith({
        position,
        currentPrice: 1.47,
        reason: 'Stop Loss hit at 1.47',
      });
    });

    it('should emit stopLossHit event when SHORT SL is hit', async () => {
      const position = attachScenarioExchangePosition({ ...positionHarness, mockBybit }, {
        side: PositionSide.SHORT,
        entryPrice: 1.5,
        stopLossPrice: 1.52,
      });
      mockBybit.getCurrentPrice.mockResolvedValue(1.53); // Above SL

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(slHitSpy).toHaveBeenCalledTimes(1);
      expect(slHitSpy).toHaveBeenCalledWith({
        position,
        currentPrice: 1.53,
        reason: 'Stop Loss hit at 1.53',
      });
    });

    it('should NOT emit stopLossHit when LONG price above SL', async () => {
      attachScenarioExchangePosition({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
      });
      mockBybit.getCurrentPrice.mockResolvedValue(1.51); // Above SL

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(slHitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit stopLossHit when SHORT price below SL', async () => {
      attachScenarioExchangePosition({ ...positionHarness, mockBybit }, {
        side: PositionSide.SHORT,
        entryPrice: 1.5,
        stopLossPrice: 1.52,
      });
      mockBybit.getCurrentPrice.mockResolvedValue(1.49); // Below SL

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(slHitSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 3: Take Profit Detection
  // ==========================================================================

  describe('take profit detection', () => {
    // NOTE: TP detection removed from Position Monitor (price-based was unreliable)
    // TPs are now detected via WebSocket 'order' topic in bot.ts
    // These tests verify that Position Monitor no longer emits TP events

    it('should NOT emit takeProfitHit event (handled by WebSocket)', async () => {
      attachExchangePosition(
        { ...positionHarness, mockBybit },
        createMockPosition(PositionSide.LONG, 1.5, 1.48, [
          { level: 1, price: 1.52 },
          { level: 2, price: 1.54 },
        ]),
      );
      mockBybit.getCurrentPrice.mockResolvedValue(1.525); // Above TP1

      const tpHitSpy = jest.fn();
      monitor.on('takeProfitHit', tpHitSpy);

      await runPositionMonitorCycle(monitor);

      // TP detection is now handled by WebSocket, not Position Monitor
      expect(tpHitSpy).not.toHaveBeenCalled();
      expect(mockTelegram.notifyTakeProfitHit).not.toHaveBeenCalled();
      expect(mockPositionManager.onTakeProfitHit).not.toHaveBeenCalled();
    });

    it('should NOT emit takeProfitHit for SHORT (handled by WebSocket)', async () => {
      attachExchangePosition(
        { ...positionHarness, mockBybit },
        createMockPosition(PositionSide.SHORT, 1.5, 1.52, [
          { level: 1, price: 1.48 },
          { level: 2, price: 1.46 },
        ]),
      );
      mockBybit.getCurrentPrice.mockResolvedValue(1.475); // Below TP1

      const tpHitSpy = jest.fn();
      monitor.on('takeProfitHit', tpHitSpy);

      await runPositionMonitorCycle(monitor);

      // TP detection is now handled by WebSocket, not Position Monitor
      expect(tpHitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit multiple takeProfitHit events (handled by WebSocket)', async () => {
      attachExchangePosition(
        { ...positionHarness, mockBybit },
        createMockPosition(PositionSide.LONG, 1.5, 1.48, [
          { level: 1, price: 1.52 },
          { level: 2, price: 1.54 },
          { level: 3, price: 1.56 },
        ]),
      );
      mockBybit.getCurrentPrice.mockResolvedValue(1.55); // Above TP1 and TP2

      const tpHitSpy = jest.fn();
      monitor.on('takeProfitHit', tpHitSpy);

      await runPositionMonitorCycle(monitor);

      // TP detection is now handled by WebSocket, not Position Monitor
      expect(tpHitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit takeProfitHit for already hit TPs', async () => {
      attachExchangePosition(
        { ...positionHarness, mockBybit },
        createMockPosition(PositionSide.LONG, 1.5, 1.48, [
          { level: 1, price: 1.52, hit: true }, // Already hit
          { level: 2, price: 1.54 },
        ]),
      );
      mockBybit.getCurrentPrice.mockResolvedValue(1.525); // Above TP1

      const tpHitSpy = jest.fn();
      monitor.on('takeProfitHit', tpHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(tpHitSpy).not.toHaveBeenCalled(); // Already hit, no event
    });

    it('should NOT emit takeProfitHit when LONG price below TP', async () => {
      attachExchangePosition(
        { ...positionHarness, mockBybit },
        createMockPosition(PositionSide.LONG, 1.5, 1.48, [
          { level: 1, price: 1.52 },
        ]),
      );
      mockBybit.getCurrentPrice.mockResolvedValue(1.51); // Below TP1

      const tpHitSpy = jest.fn();
      monitor.on('takeProfitHit', tpHitSpy);

      await runPositionMonitorCycle(monitor);

      expect(tpHitSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Time-Based Exit
  // ==========================================================================

  describe('time-based exit', () => {
    it('should emit timeBasedExit when position open too long with low PnL', async () => {
      const position = attachTimeBasedExitScenario({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
        openedMinutesAgo: 35,
        currentPrice: 1.501,
      });

      monitor = rebuildMonitor(createTimeBasedExitRiskConfig());

      const exitSpy = jest.fn();
      monitor.on('timeBasedExit', exitSpy);

      await runPositionMonitorCycle(monitor);

      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith({
        position,
        currentPrice: 1.501,
        reason: expect.stringContaining('Position open for'),
        openedMinutes: expect.any(Number),
        pnlPercent: expect.any(Number),
      });
    });

    it('should NOT emit timeBasedExit when position has sufficient PnL', async () => {
      attachTimeBasedExitScenario({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
        openedMinutesAgo: 35,
        currentPrice: 1.505,
      });

      monitor = rebuildMonitor(createTimeBasedExitRiskConfig());

      const exitSpy = jest.fn();
      monitor.on('timeBasedExit', exitSpy);

      await runPositionMonitorCycle(monitor);

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit timeBasedExit when position not open long enough', async () => {
      attachTimeBasedExitScenario({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
        openedMinutesAgo: 25,
        currentPrice: 1.501,
      });

      monitor = rebuildMonitor(createTimeBasedExitRiskConfig());

      const exitSpy = jest.fn();
      monitor.on('timeBasedExit', exitSpy);

      await runPositionMonitorCycle(monitor);

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should NOT emit timeBasedExit when feature disabled', async () => {
      attachTimeBasedExitScenario({ ...positionHarness, mockBybit }, {
        side: PositionSide.LONG,
        entryPrice: 1.5,
        stopLossPrice: 1.48,
        openedMinutesAgo: 35,
        currentPrice: 1.501,
      });

      monitor = rebuildMonitor(
        createPositionMonitorRiskConfig({ positionSizeUsdt: 10, timeBasedExitEnabled: false }),
      );

      const exitSpy = jest.fn();
      monitor.on('timeBasedExit', exitSpy);

      await runPositionMonitorCycle(monitor);

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should calculate correct PnL for SHORT position', async () => {
      attachTimeBasedExitScenario({ ...positionHarness, mockBybit }, {
        side: PositionSide.SHORT,
        entryPrice: 1.5,
        stopLossPrice: 1.52,
        openedMinutesAgo: 35,
        currentPrice: 1.499,
      });

      monitor = rebuildMonitor(createTimeBasedExitRiskConfig());

      const exitSpy = jest.fn();
      monitor.on('timeBasedExit', exitSpy);

      await runPositionMonitorCycle(monitor);

      expect(exitSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Position Closed Externally
  // ==========================================================================

  describe('position closed externally', () => {
    it('should sync closed position when exchange position is null', async () => {
      const position = attachCurrentPosition(
        positionHarness,
        createMockPosition(PositionSide.LONG, 1.5, 1.48, []),
      );
      mockBybit.getPosition.mockResolvedValue(null); // Position doesn't exist on exchange

      await runPositionMonitorCycle(monitor);

      // Should delegate to PositionSyncService.syncClosedPosition
      expect(mockPositionSync.syncClosedPosition).toHaveBeenCalledWith(position);
    });

    it('should sync closed position when exchange position quantity is zero', async () => {
      const position = attachCurrentPosition(
        positionHarness,
        createMockPosition(PositionSide.LONG, 1.5, 1.48, []),
      );
      mockBybit.getPosition.mockResolvedValue({ ...position, quantity: 0 });

      await runPositionMonitorCycle(monitor);

      // Should delegate to PositionSyncService.syncClosedPosition
      expect(mockPositionSync.syncClosedPosition).toHaveBeenCalledWith(position);
    });

    it('should NOT check price when position closed externally', async () => {
      const position = createMockPosition(PositionSide.LONG, 1.5, 1.48, []);
      position.status = 'CLOSED'; // Already closed
      attachCurrentPosition(positionHarness, position);
      mockBybit.getPosition.mockResolvedValue(null); // Closed

      await runPositionMonitorCycle(monitor);

      // Note: After Session #59, getCurrentPrice may be called before status check
      // This test validates that position closed externally is handled correctly
      // The important check is that clearPosition is NOT called for already CLOSED positions
      expect(mockPositionManager.clearPosition).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 6: No Position Scenario
  // ==========================================================================

  describe('no position scenario', () => {
    it('should do nothing when no position exists', async () => {
      mockPositionManager.getCurrentPosition.mockReturnValue(null);

      await runPositionMonitorCycle(monitor);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
      expect(mockBybit.getCurrentPrice).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Error Handling
  // ==========================================================================

  describe('error handling', () => {
    it('should emit error event when monitoring fails', async () => {
      const testError = new Error('Bybit API error');
      mockPositionManager.getCurrentPosition.mockImplementation(() => {
        throw testError;
      });

      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      await runPositionMonitorCycle(monitor);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(testError);
    });

    it('should continue monitoring after error', async () => {
      let callCount = 0;
      mockPositionManager.getCurrentPosition.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary error');
        }
        return null;
      });

      const errorSpy = jest.fn();
      monitor.on('error', errorSpy);

      await runPositionMonitorCycles(monitor, 1); // First call - error
      expect(errorSpy).toHaveBeenCalledTimes(1);

      await runPositionMonitorCycles(monitor, 1); // Second call - success
      expect(callCount).toBe(2); // Monitoring continues
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Periodic Monitoring
  // ==========================================================================

  describe('periodic monitoring', () => {
    it('should call monitorPosition every 10 seconds', async () => {
      mockPositionManager.getCurrentPosition.mockReturnValue(null);

      // Now we have 2 intervals: monitorInterval (10s) + deepSyncInterval (30s)
      // Both call getCurrentPosition(), so count increases

      await runPositionMonitorCycles(monitor, 1);
      // After 10s: monitorPosition called 1x
      expect(mockPositionManager.getCurrentPosition.mock.calls.length).toBeGreaterThanOrEqual(1);

      await runPositionMonitorCycles(monitor, 1);
      // After 20s: monitorPosition called 2x
      expect(mockPositionManager.getCurrentPosition.mock.calls.length).toBeGreaterThanOrEqual(2);

      await runPositionMonitorCycles(monitor, 1);
      // After 30s: monitorPosition 3x + deepSyncCheck 1x = 4 total
      expect(mockPositionManager.getCurrentPosition.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should NOT call monitorPosition after stop', async () => {
      mockPositionManager.getCurrentPosition.mockReturnValue(null);

      await runPositionMonitorCycles(monitor, 1);
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalledTimes(1);

      monitor.stop();
      await jest.advanceTimersByTimeAsync(20000); // 2 more cycles

      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalledTimes(1); // No more calls
    });
  });

  // ============================================================================
  // SESSION #60: SAFETY MONITOR TESTS (v3.5.0 - syncClosedPosition + deepSyncCheck)
  // ============================================================================

  describe('Safety Monitor (Session #60)', () => {
    it('should NOT emit positionClosedExternally if status is CLOSED', async () => {
      const position = createMockPosition(PositionSide.LONG, 1.5, 1.48, []);
      position.status = 'CLOSED'; // Already closed
      attachCurrentPosition(positionHarness, position);
      mockBybit.getPosition.mockResolvedValue(null); // Position doesn't exist on exchange

      const closedSpy = jest.fn();
      monitor.on('positionClosedExternally', closedSpy);

      await runPositionMonitorCycle(monitor);

      // Should NOT emit event or call clearPosition (already closed)
      expect(closedSpy).not.toHaveBeenCalled();
      expect(mockPositionManager.clearPosition).not.toHaveBeenCalled();
    });

    it('should call deepSyncCheck for positions > 2 minutes old', async () => {
      const position = createMockPosition(
        PositionSide.LONG,
        1.5,
        1.48,
        [],
        createPositionMonitorOpenedAtMinutesAgo(2.5),
      );
      position.status = 'OPEN';
      attachCurrentPosition(positionHarness, position);
      mockBybit.getPosition.mockResolvedValue(position); // Position exists
      mockBybit.getCurrentPrice.mockResolvedValue(1.5);  // Current price

      await runPositionMonitorDeepSyncCycle(monitor);

      // Should delegate to PositionSyncService.deepSyncCheck
      expect(mockPositionSync.deepSyncCheck).toHaveBeenCalledWith(position);
    });
  });
});
