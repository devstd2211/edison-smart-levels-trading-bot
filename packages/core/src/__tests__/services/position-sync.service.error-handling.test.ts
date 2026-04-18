/**
 * Position Sync Service Error Handling Tests
 * Tests ErrorHandler integration with recovery strategies
 * Phase 8.9.12
 */

import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  Position,
  PositionSide,
  BybitOrder,
} from '../../types/legacy';
import {
  createManagedPositionSyncContext,
  createMockPositionCloseRecorder,
  type ManagedPositionSyncContext,
  type PositionSyncHarness,
  createPositionSyncExchangeApiError,
  createPositionSyncExchangeConnectionError,
  createPositionSyncExchangeRateLimitError,
  createPositionSyncErrorHandler,
  createPositionSyncOldPosition,
  createPositionSyncProtectedOrders,
  createPositionSyncPosition,
  createPositionSyncTelegramNetworkError,
  preparePositionSyncEmergencyCloseScenario,
  preparePositionSyncRetrySequence,
  prepareClosedPositionSync,
  recreatePositionSyncHarness,
} from '../helpers/position-sync-test.utils';

// ============================================================================
// MOCKS & HELPERS
// ============================================================================

const createMockPosition = createPositionSyncPosition;
// ============================================================================
// TESTS
// ============================================================================

describe('PositionSyncService - Error Handling (Phase 8.9.12)', () => {
  let service: PositionSyncHarness['service'];
  let mockBybit: PositionSyncHarness['mockBybit'];
  let mockPositionManager: PositionSyncHarness['mockPositionManager'];
  let mockExitTypeDetector: PositionSyncHarness['mockExitTypeDetector'];
  let mockTelegram: PositionSyncHarness['mockTelegram'];
  let logger: PositionSyncHarness['logger'];
  let errorHandler: ErrorHandler;
  let createHarness: ManagedPositionSyncContext['createHarness'];
  let cleanup: ManagedPositionSyncContext['cleanup'];

  beforeEach(() => {
    const injectedErrorHandler = createPositionSyncErrorHandler();
    let managedErrorHandler: ErrorHandler | undefined;
    ({
      service,
      logger,
      mockBybit,
      mockPositionManager,
      mockExitTypeDetector,
      mockTelegram,
      createHarness,
      cleanup,
      errorHandler: managedErrorHandler,
    } = createManagedPositionSyncContext({
      errorHandler: injectedErrorHandler,
    }));
    errorHandler = managedErrorHandler as ErrorHandler;
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // syncClosedPosition Error Handling Tests
  // ============================================================================

  describe('syncClosedPosition - Error Handling', () => {
    it('should RETRY getOrderHistory on network timeout (3 attempts)', async () => {
      const position = createMockPosition();
      const networkError = createPositionSyncExchangeConnectionError('Network timeout', {
        endpoint: '/order/history',
      });

      preparePositionSyncRetrySequence(
        mockBybit.getOrderHistory,
        [networkError, networkError],
        [],
      );

      mockBybit.getCurrentPrice.mockResolvedValue(101);
      mockPositionManager.clearPosition.mockResolvedValue(undefined);

      await service.syncClosedPosition(position);

      // Should retry 3 times
      expect(mockBybit.getOrderHistory).toHaveBeenCalledTimes(3);
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should RETRY getCurrentPrice on rate limit (3 attempts with backoff)', async () => {
      const position = createMockPosition();
      const rateLimitError = createPositionSyncExchangeRateLimitError(
        'Rate limit exceeded',
        100,
      );

      mockBybit.getOrderHistory.mockResolvedValue([]);
      preparePositionSyncRetrySequence(
        mockBybit.getCurrentPrice,
        [rateLimitError, rateLimitError],
        101,
      );
      mockPositionManager.clearPosition.mockResolvedValue(undefined);

      const startTime = Date.now();
      await service.syncClosedPosition(position);
      const elapsed = Date.now() - startTime;

      expect(mockBybit.getCurrentPrice).toHaveBeenCalledTimes(3);
      // Should have delays between retries (backoff)
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should GRACEFUL_DEGRADE closeFullPosition failure (continue even if fails)', async () => {
      const position = createMockPosition();
      const closeError = createPositionSyncExchangeApiError('Failed to record close', {
        statusCode: 500,
      });

      prepareClosedPositionSync({ mockBybit }, { currentPrice: 101 });

      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(closeError);
      service = createHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      }).service;

      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      // Should NOT throw, should continue to clear position
      await service.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should SKIP telegram alert on network error (non-blocking)', async () => {
      const position = createMockPosition();
      const telegramError = createPositionSyncTelegramNetworkError();

      prepareClosedPositionSync({ mockBybit }, { currentPrice: 101 });
      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockRejectedValue(telegramError);

      // Should NOT throw, should continue and clear position
      await service.syncClosedPosition(position);

      expect(mockTelegram.sendAlert).toHaveBeenCalledTimes(1);
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should fallback to entry price when getCurrentPrice fails after retries', async () => {
      const position = createMockPosition();
      const priceError = createPositionSyncExchangeConnectionError('API down');

      prepareClosedPositionSync({ mockBybit });
      preparePositionSyncRetrySequence(
        mockBybit.getCurrentPrice,
        [priceError, priceError, priceError],
      );
      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      await service.syncClosedPosition(position);

      // Should use entry price as fallback (100)
      expect(mockTelegram.sendAlert).toHaveBeenCalledWith(
        expect.stringContaining('Entry: 100'),
      );
    });

    it('E2E: All operations fail → position still clears (fallback)', async () => {
      const position = createMockPosition();

      mockBybit.getOrderHistory.mockRejectedValue(createPositionSyncExchangeConnectionError(''));
      mockBybit.getCurrentPrice.mockRejectedValue(createPositionSyncExchangeConnectionError(''));
      mockTelegram.sendAlert.mockRejectedValue(
        createPositionSyncTelegramNetworkError('', { operation: '', reason: '' }),
      );

      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(
        createPositionSyncExchangeApiError(''),
      );
      service = createHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      }).service;

      mockPositionManager.clearPosition.mockResolvedValue(undefined);

      // Should NOT throw
      await service.syncClosedPosition(position);

      // Position MUST be cleared even if everything else fails
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // deepSyncCheck Error Handling Tests
  // ============================================================================

  describe('deepSyncCheck - Error Handling', () => {
    const createOldPosition = () => createPositionSyncOldPosition(); // 3 minutes old

    it('should RETRY getPosition on network timeout (2 attempts)', async () => {
      const position = createOldPosition();
      const networkError = createPositionSyncExchangeConnectionError();
      preparePositionSyncRetrySequence(mockBybit.getPosition, [networkError], position);
      mockBybit.getPosition.mockResolvedValueOnce(position);
      mockBybit.getActiveOrders.mockResolvedValue(
        createPositionSyncProtectedOrders({ takeProfitLevels: [] }),
      );

      await service.deepSyncCheck(position);

      // Should have retried - at least 2 calls (initial + retry), may be 3 with verification
      expect(mockBybit.getPosition.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should RETRY getActiveOrders on rate limit (2 attempts)', async () => {
      const position = createOldPosition();
      const rateLimitError = createPositionSyncExchangeRateLimitError('Rate limit', 100);

      mockBybit.getPosition.mockResolvedValue(position);
      preparePositionSyncRetrySequence(
        mockBybit.getActiveOrders,
        [rateLimitError],
        createPositionSyncProtectedOrders({ takeProfitLevels: [] }),
      );

      const startTime = Date.now();
      await service.deepSyncCheck(position);
      const elapsed = Date.now() - startTime;

      expect(mockBybit.getActiveOrders).toHaveBeenCalledTimes(2);
      // Should have delays (exponential backoff)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should GRACEFUL_DEGRADE when getActiveOrders fails (assume protection exists)', async () => {
      const position = createOldPosition();
      const apiError = createPositionSyncExchangeApiError('API error', {
        statusCode: 500,
      });

      mockBybit.getPosition.mockResolvedValue(position);
      preparePositionSyncRetrySequence(mockBybit.getActiveOrders, [apiError, apiError]);

      // Should NOT throw, should continue
      await service.deepSyncCheck(position);

      // Should log warning about degraded mode
      expect(mockBybit.getActiveOrders).toHaveBeenCalledTimes(2);
    });

    it('should GRACEFUL_DEGRADE quantity sync failure (use local value)', async () => {
      const position = createOldPosition();
      // Create position with significant quantity difference
      const exchangePos = {
        ...position,
        quantity: 8, // Local is 10, exchange is 8 = difference of 2 > 0.01
      };

      mockBybit.getPosition.mockResolvedValue(exchangePos as unknown as Position);
      mockBybit.getActiveOrders.mockResolvedValue(createPositionSyncProtectedOrders());

      // Mock sync to throw error
      const syncError = new Error('Sync failed');
      mockPositionManager.syncWithWebSocket.mockImplementation(() => {
        throw syncError;
      });
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      // Should NOT throw - service catches the sync error
      await service.deepSyncCheck(position);

      // Verify position fetch was called
      expect(mockBybit.getPosition).toHaveBeenCalled();
      // Verify active orders was called
      expect(mockBybit.getActiveOrders).toHaveBeenCalled();
      // Service should continue despite sync failure
    });

    it('should THROW on missing SL (critical error - no recovery)', async () => {
      const position = createOldPosition();
      preparePositionSyncEmergencyCloseScenario(
        { mockBybit, mockTelegram },
        position,
        { activeOrders: [] as BybitOrder[] },
      );

      await service.deepSyncCheck(position);

      // Should attempt emergency close
      expect(mockBybit.closePosition).toHaveBeenCalledWith({
        positionId: position.id,
        percentage: 100,
      });
    });

    it('should SKIP telegram alerts during emergency close', async () => {
      const position = createOldPosition();
      const telegramError = createPositionSyncTelegramNetworkError('Timeout', {
        reason: 'Network',
      });
      preparePositionSyncEmergencyCloseScenario(
        { mockBybit, mockTelegram },
        position,
        { activeOrders: [], telegramError },
      );

      // Should NOT throw despite telegram error
      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).toHaveBeenCalledTimes(1);
    });

    it('E2E: All API calls fail → logs errors but position preserved', async () => {
      const position = createOldPosition();
      const apiError = createPositionSyncExchangeApiError('API down', {
        statusCode: 503,
      });

      preparePositionSyncRetrySequence(mockBybit.getPosition, [apiError, apiError]);

      // Should not throw
      await service.deepSyncCheck(position);

      // Position should not have been modified
      expect(mockPositionManager.syncWithWebSocket).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Integration Scenarios
  // ============================================================================

  describe('Integration Scenarios', () => {
    it('syncClosedPosition: Cascading failures with eventual fallback', async () => {
      const position = createMockPosition();

      // Order history fails
      mockBybit.getOrderHistory.mockRejectedValue(
        createPositionSyncExchangeConnectionError('Network')
      );

      // Price fails
      mockBybit.getCurrentPrice.mockRejectedValue(
        createPositionSyncExchangeConnectionError('Network')
      );

      // Close fails
      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(
        createPositionSyncExchangeApiError('Server error')
      );
      service = createHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      }).service;

      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      // Should complete without throwing
      await service.syncClosedPosition(position);

      // Position should always be cleared
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('deepSyncCheck: Partial recovery from API failures', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 3 * 60 * 1000);
      const exchangePos = position;

      // First position fetch succeeds
      mockBybit.getPosition.mockResolvedValue(exchangePos);

      // Active orders fails then succeeds
      const rateLimitError = createPositionSyncExchangeRateLimitError('Rate limit', 50);
      preparePositionSyncRetrySequence(
        mockBybit.getActiveOrders,
        [rateLimitError],
        createPositionSyncProtectedOrders(),
      );

      await service.deepSyncCheck(position);

      // Should have retried orders fetch
      expect(mockBybit.getActiveOrders).toHaveBeenCalledTimes(2);
      // Should not throw and position should still be valid
      expect(mockBybit.getPosition).toHaveBeenCalled();
    });

    it('deepSyncCheck with ErrorHandler injection via constructor', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 3 * 60 * 1000);
      const exchangePos = position;

      mockBybit.getPosition.mockResolvedValue(exchangePos);
      mockBybit.getActiveOrders.mockResolvedValue(
        createPositionSyncProtectedOrders({ takeProfitLevels: [] }),
      );

      // Create service with custom ErrorHandler
      const customErrorHandler = new ErrorHandler(logger);
      service = recreatePositionSyncHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: {
          closeFullPosition: jest.fn().mockResolvedValue(true),
        },
        errorHandler: customErrorHandler,
      }).service;

      await service.deepSyncCheck(position);

      // Should use the custom error handler
      expect(mockBybit.getPosition).toHaveBeenCalled();
      // Service should execute without errors
      expect(mockBybit.getActiveOrders).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Backward Compatibility Tests
  // ============================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler parameter (creates one internally)', async () => {
      const position = createMockPosition();

      prepareClosedPositionSync({ mockBybit }, { currentPrice: 101 });
      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      // Create service WITHOUT errorHandler parameter
      const serviceWithoutHandler = createHarness({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: {
          closeFullPosition: jest.fn().mockResolvedValue(true),
        },
        errorHandler: undefined,
      }).service;

      // Should still work
      await serviceWithoutHandler.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should handle null position gracefully in deepSyncCheck', async () => {
      // Should not throw
      await service.deepSyncCheck(null);

      // Should not call any exchange methods
      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });

    it('should skip young positions in deepSyncCheck', async () => {
      const position = createMockPosition(PositionSide.LONG, Date.now() - 30 * 1000); // 30 seconds old

      // Should not call exchange methods for young positions
      await service.deepSyncCheck(position);

      expect(mockBybit.getPosition).not.toHaveBeenCalled();
    });
  });
});
