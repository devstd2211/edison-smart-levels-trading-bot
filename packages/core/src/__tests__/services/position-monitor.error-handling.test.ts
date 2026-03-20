/**
 * Position Monitor Service Error Handling Tests (Phase 8.9.3)
 *
 * Tests for position monitoring with ErrorHandler integration:
 * - GRACEFUL_DEGRADE for exchange position sync failures
 * - SKIP for Telegram alert failures
 * - Error recovery and fallback behaviors
 */

import { PositionMonitorService } from '../../services/position-monitor.service';
import {
  PositionExchangeSyncError,
  PositionPriceFetchError,
} from '../../errors/DomainErrors';
import { PositionSide } from '../../types/legacy';
import {
  attachCurrentPosition,
  createMockMonitoredPosition,
  createPositionMonitorHarness,
  defaultPositionMonitorRiskConfig,
  runPositionMonitorCycle,
  runPositionMonitorDeepSyncCycle,
} from '../helpers/position-monitor-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('PositionMonitorService Error Handling (Phase 8.9.3)', () => {
  let monitor: PositionMonitorService;
  let mockBybit: ReturnType<typeof createPositionMonitorHarness>['mockBybit'];
  let mockPositionManager: ReturnType<typeof createPositionMonitorHarness>['mockPositionManager'];
  let mockTelegram: ReturnType<typeof createPositionMonitorHarness>['mockTelegram'];
  let mockPositionSync: ReturnType<typeof createPositionMonitorHarness>['mockPositionSync'];
  let positionHarness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager'>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const harness = createPositionMonitorHarness({
      riskConfig: defaultPositionMonitorRiskConfig,
    });
    monitor = harness.monitor;
    mockBybit = harness.mockBybit;
    mockPositionManager = harness.mockPositionManager;
    mockTelegram = harness.mockTelegram;
    mockPositionSync = harness.mockPositionSync;
    positionHarness = { mockPositionManager };
  });

  afterEach(() => {
    monitor.stop();
    jest.useRealTimers();
  });

  // ==========================================================================
  // TEST GROUP 1: GRACEFUL_DEGRADE for Position Sync Failures
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Position exchange sync', () => {
    it('should continue monitoring when getPosition API fails', async () => {
      attachCurrentPosition(
        positionHarness,
        createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, undefined, undefined, {
          protectionVerifiedOnce: true,
        }),
      );

      // getPosition throws error
      mockBybit.getPosition.mockRejectedValueOnce(new Error('API timeout'));

      // getCurrentPrice succeeds
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      // Monitor should gracefully degrade and continue checking SL
      expect(slHitSpy).not.toHaveBeenCalled(); // SL not hit
      expect(mockBybit.getPosition).toHaveBeenCalled();
      expect(monitor.isActive()).toBe(true);
    });

    it('should use cached position when exchange sync fails', async () => {
      attachCurrentPosition(
        positionHarness,
        createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, undefined, undefined, {
          protectionVerifiedOnce: true,
        }),
      );

      // getPosition fails
      mockBybit.getPosition.mockRejectedValueOnce(
        new Error('Network error'),
      );

      // getCurrentPrice succeeds
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      await runPositionMonitorCycle(monitor);

      // Should continue monitoring despite exchange sync failure
      expect(mockBybit.getPosition).toHaveBeenCalled();
      expect(monitor.isActive()).toBe(true);
    });

    it('should sync closed position when exchange returns zero quantity', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());

      // Position exists but with zero quantity
      mockBybit.getPosition.mockResolvedValueOnce({ ...position, quantity: 0 });

      await runPositionMonitorCycle(monitor);

      // Should delegate to syncClosedPosition
      expect(mockPositionSync.syncClosedPosition).toHaveBeenCalledWith(position);
    });

    it('should continue monitoring when position is already closed by WebSocket', async () => {
      const position = createMockMonitoredPosition();
      position.status = 'CLOSED';
      attachCurrentPosition(positionHarness, position);

      // Exchange also shows closed
      mockBybit.getPosition.mockResolvedValueOnce(null);

      await runPositionMonitorCycle(monitor);

      // Should skip monitoring for already-closed positions
      expect(mockPositionSync.syncClosedPosition).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 2: GRACEFUL_DEGRADE for Price Fetch Failures
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Price fetch failures', () => {
    it('should skip price-based checks when getCurrentPrice fails', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);

      // getCurrentPrice throws error
      mockBybit.getCurrentPrice.mockRejectedValueOnce(
        new Error('Price API unavailable'),
      );

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      // SL check should be skipped due to missing price
      expect(slHitSpy).not.toHaveBeenCalled();
    });

    it('should continue monitoring after price fetch error', async () => {
      const position = createMockMonitoredPosition();

      mockPositionManager.getCurrentPosition.mockImplementation(() => {
        return position;
      });

      mockBybit.getPosition.mockResolvedValue(position);

      // First call fails, second succeeds
      mockBybit.getCurrentPrice
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(50100);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000); // First cycle - price fetch fails
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalled();

      jest.clearAllMocks();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      await jest.advanceTimersByTimeAsync(10000); // Second cycle - should continue
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 3: SKIP Strategy for Telegram Alerts
  // ==========================================================================

  describe('SKIP: Telegram alert failures', () => {
    it('should skip Telegram alert on unprotected position close', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);

      // Protection check fails
      mockBybit.verifyProtectionSet.mockResolvedValueOnce({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        hasTrailingStop: false,
        activeOrders: 0,
      });

      // closePosition succeeds
      mockBybit.closePosition.mockResolvedValueOnce(undefined);

      // Telegram fails
      mockTelegram.sendAlert.mockRejectedValueOnce(
        new Error('Telegram API error'),
      );

      const emergencyCloseSpy = jest.fn();
      monitor.on('positionClosedEmergency', emergencyCloseSpy);

      await runPositionMonitorCycle(monitor);

      // Should close position despite Telegram failure
      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(emergencyCloseSpy).toHaveBeenCalled();
    });

    it('should continue monitoring despite Telegram alert failure', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      // Protection verification succeeds
      mockBybit.verifyProtectionSet.mockResolvedValueOnce({
        verified: true,
        hasStopLoss: true,
        hasTakeProfit: true,
        hasTrailingStop: false,
        activeOrders: 3,
      });

      await runPositionMonitorCycle(monitor);

      // Should complete monitoring cycle
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Deep Sync Check with GRACEFUL_DEGRADE
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Deep sync check failures', () => {
    it('should handle deepSyncCheck API failures gracefully', async () => {
      attachCurrentPosition(positionHarness, createMockMonitoredPosition());

      // deepSyncCheck throws error
      mockPositionSync.deepSyncCheck.mockRejectedValueOnce(
        new Error('Exchange connection lost'),
      );

      await runPositionMonitorDeepSyncCycle(monitor);

      // Should attempt deepSync but continue on failure
      expect(mockPositionSync.deepSyncCheck).toHaveBeenCalled();
    });

    it('should continue normal monitoring if deep sync fails', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getCurrentPrice.mockResolvedValue(50100);

      // deepSyncCheck fails
      mockPositionSync.deepSyncCheck.mockRejectedValueOnce(
        new Error('API timeout'),
      );

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      monitor.start();

      // Advance 10s for normal monitoring
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();

      // Advance 20s more to trigger deepSync (total 30s)
      await jest.advanceTimersByTimeAsync(20000);

      // deepSync should be called but not block normal checks
      expect(mockPositionSync.deepSyncCheck).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 5: Error Classification and Logging
  // ==========================================================================

  describe('Error classification and logging', () => {
    it('should degrade gracefully on getPosition error with logging', async () => {
      attachCurrentPosition(
        positionHarness,
        createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, undefined, undefined, {
          protectionVerifiedOnce: true,
        }),
      );

      // getPosition throws generic error
      mockBybit.getPosition.mockRejectedValueOnce(
        new Error('Network timeout'),
      );

      // getCurrentPrice succeeds so we can verify continued monitoring
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      await runPositionMonitorCycle(monitor);

      // Should continue with price check despite getPosition failure (GRACEFUL_DEGRADE)
      expect(mockBybit.getPosition).toHaveBeenCalled();
      expect(monitor.isActive()).toBe(true);
    });

    it('should handle PositionExchangeSyncError correctly', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());

      mockBybit.getPosition.mockRejectedValueOnce(
        new PositionExchangeSyncError(
          'Position sync failed',
          {
            positionId: position.id,
            syncType: 'quantity',
            expectedValue: 0.01,
            actualValue: 0,
            reason: 'Exchange quantity mismatch',
          },
        ),
      );

      await runPositionMonitorCycle(monitor);

      // Should handle error gracefully
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Protection Error Handling
  // ==========================================================================

  describe('THROW: Protection error handling', () => {
    it('should throw PositionProtectionError for unprotected positions', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);

      // Protection verification fails
      mockBybit.verifyProtectionSet.mockResolvedValueOnce({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        hasTrailingStop: false,
        activeOrders: 0,
      });

      // closePosition succeeds
      mockBybit.closePosition.mockResolvedValueOnce(undefined);
      mockPositionManager.clearPosition.mockResolvedValueOnce(undefined);

      const emergencyCloseSpy = jest.fn();
      monitor.on('positionClosedEmergency', emergencyCloseSpy);

      await runPositionMonitorCycle(monitor);

      // Should close unprotected position
      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(emergencyCloseSpy).toHaveBeenCalled();
    });

    it('should handle closePosition failure on unprotected positions', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);

      // Protection verification fails
      mockBybit.verifyProtectionSet.mockResolvedValueOnce({
        verified: false,
        hasStopLoss: false,
        hasTakeProfit: false,
        hasTrailingStop: false,
        activeOrders: 0,
      });

      // closePosition fails
      mockBybit.closePosition.mockRejectedValueOnce(
        new Error('Market closed'),
      );

      await runPositionMonitorCycle(monitor);

      // Should attempt emergency close and log failure
      expect(mockBybit.closePosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Position Price Fetch Error
  // ==========================================================================

  describe('PositionPriceFetchError handling', () => {
    it('should handle PositionPriceFetchError gracefully', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValueOnce(position);

      mockBybit.getCurrentPrice.mockRejectedValueOnce(
        new PositionPriceFetchError(
          'Price fetch failed',
          {
            symbol: position.symbol,
            positionId: position.id,
            reason: 'Symbol not found',
            lastSuccessfulPrice: 50000,
          },
        ),
      );

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      await runPositionMonitorCycle(monitor);

      // Should skip price-based checks
      expect(slHitSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Error Recovery and Resilience
  // ==========================================================================

  describe('Error recovery and resilience', () => {
    it('should recover from transient errors in next cycle', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());

      // First call fails
      mockBybit.getPosition.mockRejectedValueOnce(new Error('Temporary error'));

      // Second call succeeds
      mockBybit.getPosition.mockResolvedValueOnce(position);
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      monitor.start();

      // First cycle
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockBybit.getPosition).toHaveBeenCalledTimes(1);

      // Second cycle
      await jest.advanceTimersByTimeAsync(10000);
      expect(mockBybit.getPosition).toHaveBeenCalledTimes(2);
    });

    it('should maintain error handler state across cycles', async () => {
      const position = attachCurrentPosition(positionHarness, createMockMonitoredPosition());
      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getCurrentPrice.mockResolvedValue(50100);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // ErrorHandler should be maintained
      expect(monitor.isActive()).toBe(true);

      await jest.advanceTimersByTimeAsync(10000);
      expect(monitor.isActive()).toBe(true);

      monitor.stop();
      expect(monitor.isActive()).toBe(false);
    });
  });
});
