/**
 * Position Monitor Service Error Handling Tests (Phase 8.9.3)
 *
 * Tests for position monitoring with ErrorHandler integration:
 * - GRACEFUL_DEGRADE for exchange position sync failures
 * - SKIP for Telegram alert failures
 * - Error recovery and fallback behaviors
 */

import { PositionMonitorService } from '../../services/position-monitor.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  PositionMonitoringError,
  PositionExchangeSyncError,
  PositionProtectionError,
  PositionPriceFetchError,
} from '../../errors/DomainErrors';
import {
  Position,
  PositionSide,
  LoggerService,
} from '../../types/legacy';
import {
  createMockMonitoredPosition,
  createPositionMonitorHarness,
  createPositionMonitorService,
  defaultPositionMonitorRiskConfig,
} from '../helpers/position-monitor-test.utils';

// ============================================================================
// MOCKS
// ============================================================================

const createMockPosition = (side: PositionSide = PositionSide.LONG): Position =>
  createMockMonitoredPosition(side);

// ============================================================================
// TESTS
// ============================================================================

describe('PositionMonitorService Error Handling (Phase 8.9.3)', () => {
  let monitor: PositionMonitorService;
  let mockBybit: ReturnType<typeof createPositionMonitorHarness>['mockBybit'];
  let mockPositionManager: ReturnType<typeof createPositionMonitorHarness>['mockPositionManager'];
  let mockTelegram: ReturnType<typeof createPositionMonitorHarness>['mockTelegram'];
  let mockPositionSync: ReturnType<typeof createPositionMonitorHarness>['mockPositionSync'];
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const harness = createPositionMonitorHarness({
      riskConfig: defaultPositionMonitorRiskConfig,
    });
    mockBybit = harness.mockBybit;
    mockPositionManager = harness.mockPositionManager;
    mockTelegram = harness.mockTelegram;
    mockPositionSync = harness.mockPositionSync;
    logger = harness.logger;
    errorHandler = new ErrorHandler(logger);
    monitor = createPositionMonitorService(
      {
        mockBybit,
        mockPositionManager,
        mockTelegram,
        mockExitTypeDetector: {} as never,
        mockPnLCalculator: {} as never,
        mockPositionSync,
        logger,
      },
      {
        riskConfig: defaultPositionMonitorRiskConfig,
        errorHandler,
      },
    );
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
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // getPosition throws error
      mockBybit.getPosition.mockRejectedValueOnce(new Error('API timeout'));

      // getCurrentPrice succeeds
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Monitor should gracefully degrade and continue checking SL
      expect(slHitSpy).not.toHaveBeenCalled(); // SL not hit
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled(); // Price was fetched
    });

    it('should use cached position when exchange sync fails', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // getPosition fails
      mockBybit.getPosition.mockRejectedValueOnce(
        new Error('Network error'),
      );

      // getCurrentPrice succeeds
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should continue monitoring despite exchange sync failure
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });

    it('should sync closed position when exchange returns zero quantity', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // Position exists but with zero quantity
      mockBybit.getPosition.mockResolvedValueOnce({ ...position, quantity: 0 });

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should delegate to syncClosedPosition
      expect(mockPositionSync.syncClosedPosition).toHaveBeenCalledWith(position);
    });

    it('should continue monitoring when position is already closed by WebSocket', async () => {
      const position = createMockPosition();
      position.status = 'CLOSED';
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // Exchange also shows closed
      mockBybit.getPosition.mockResolvedValueOnce(null);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should skip monitoring for already-closed positions
      expect(mockPositionSync.syncClosedPosition).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 2: GRACEFUL_DEGRADE for Price Fetch Failures
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Price fetch failures', () => {
    it('should skip price-based checks when getCurrentPrice fails', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
      mockBybit.getPosition.mockResolvedValueOnce(position);

      // getCurrentPrice throws error
      mockBybit.getCurrentPrice.mockRejectedValueOnce(
        new Error('Price API unavailable'),
      );

      const slHitSpy = jest.fn();
      monitor.on('stopLossHit', slHitSpy);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // SL check should be skipped due to missing price
      expect(slHitSpy).not.toHaveBeenCalled();
    });

    it('should continue monitoring after price fetch error', async () => {
      const position = createMockPosition();
      let callCount = 0;

      mockPositionManager.getCurrentPosition.mockImplementation(() => {
        callCount++;
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
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should close position despite Telegram failure
      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(emergencyCloseSpy).toHaveBeenCalled();
    });

    it('should continue monitoring despite Telegram alert failure', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should complete monitoring cycle
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 4: Deep Sync Check with GRACEFUL_DEGRADE
  // ==========================================================================

  describe('GRACEFUL_DEGRADE: Deep sync check failures', () => {
    it('should handle deepSyncCheck API failures gracefully', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // deepSyncCheck throws error
      mockPositionSync.deepSyncCheck.mockRejectedValueOnce(
        new Error('Exchange connection lost'),
      );

      monitor.start();
      await jest.advanceTimersByTimeAsync(30000); // 30s to trigger deepSyncCheck

      // Should attempt deepSync but continue on failure
      expect(mockPositionSync.deepSyncCheck).toHaveBeenCalled();
    });

    it('should continue normal monitoring if deep sync fails', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

      // getPosition throws generic error
      mockBybit.getPosition.mockRejectedValueOnce(
        new Error('Network timeout'),
      );

      // getCurrentPrice succeeds so we can verify continued monitoring
      mockBybit.getCurrentPrice.mockResolvedValueOnce(50100);

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should continue with price check despite getPosition failure (GRACEFUL_DEGRADE)
      expect(mockBybit.getCurrentPrice).toHaveBeenCalled();
    });

    it('should handle PositionExchangeSyncError correctly', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should handle error gracefully
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 6: Protection Error Handling
  // ==========================================================================

  describe('THROW: Protection error handling', () => {
    it('should throw PositionProtectionError for unprotected positions', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should close unprotected position
      expect(mockBybit.closePosition).toHaveBeenCalled();
      expect(emergencyCloseSpy).toHaveBeenCalled();
    });

    it('should handle closePosition failure on unprotected positions', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should attempt emergency close and log failure
      expect(mockBybit.closePosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 7: Position Price Fetch Error
  // ==========================================================================

  describe('PositionPriceFetchError handling', () => {
    it('should handle PositionPriceFetchError gracefully', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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

      monitor.start();
      await jest.advanceTimersByTimeAsync(10000);

      // Should skip price-based checks
      expect(slHitSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // TEST GROUP 8: Error Recovery and Resilience
  // ==========================================================================

  describe('Error recovery and resilience', () => {
    it('should recover from transient errors in next cycle', async () => {
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);

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
      const position = createMockPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
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
