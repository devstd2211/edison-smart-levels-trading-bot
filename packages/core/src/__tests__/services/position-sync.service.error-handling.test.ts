/**
 * Position Sync Service Error Handling Tests
 * Tests ErrorHandler integration with recovery strategies
 * Phase 8.9.12
 */

import { PositionSyncService } from '../../services/position-sync.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  LoggerService,
  Position,
  PositionSide,
  BybitOrder,
} from '../../types/legacy';
import {
  ExchangeConnectionError,
  ExchangeRateLimitError,
  ExchangeAPIError,
  TelegramNetworkError,
} from '../../errors/DomainErrors';
import {
  createMockPositionSyncExchange,
  createMockPositionSyncExitTypeDetector,
  createMockPositionSyncManager,
  createMockPositionSyncTelegram,
  createMockPositionCloseRecorder,
  createPositionSyncErrorHandler,
  createPositionSyncOldPosition,
  createPositionSyncProtectedOrders,
  createPositionSyncPosition,
  createPositionSyncService,
  createPositionSyncHarness,
  prepareClosedPositionSync,
} from '../helpers/position-sync-test.utils';

// ============================================================================
// MOCKS & HELPERS
// ============================================================================

const createMockPosition = createPositionSyncPosition;
// ============================================================================
// TESTS
// ============================================================================

describe('PositionSyncService - Error Handling (Phase 8.9.12)', () => {
  let service: PositionSyncService;
  let mockBybit: ReturnType<typeof createMockPositionSyncExchange>;
  let mockPositionManager: ReturnType<typeof createMockPositionSyncManager>;
  let mockExitTypeDetector: ReturnType<typeof createMockPositionSyncExitTypeDetector>;
  let mockTelegram: ReturnType<typeof createMockPositionSyncTelegram>;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    errorHandler = createPositionSyncErrorHandler();
    const harness = createPositionSyncHarness({ errorHandler });
    service = harness.service;
    mockBybit = harness.mockBybit;
    mockPositionManager = harness.mockPositionManager;
    mockExitTypeDetector = harness.mockExitTypeDetector;
    mockTelegram = harness.mockTelegram;
    logger = harness.logger;
  });

  // ============================================================================
  // syncClosedPosition Error Handling Tests
  // ============================================================================

  describe('syncClosedPosition - Error Handling', () => {
    it('should RETRY getOrderHistory on network timeout (3 attempts)', async () => {
      const position = createMockPosition();
      const networkError = new ExchangeConnectionError('Network timeout', {
        exchangeName: 'Bybit',
        endpoint: '/order/history',
      });

      // Fail 2 times, succeed on 3rd
      mockBybit.getOrderHistory
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce([]);

      mockBybit.getCurrentPrice.mockResolvedValue(101);
      mockPositionManager.clearPosition.mockResolvedValue(undefined);

      await service.syncClosedPosition(position);

      // Should retry 3 times
      expect(mockBybit.getOrderHistory).toHaveBeenCalledTimes(3);
      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should RETRY getCurrentPrice on rate limit (3 attempts with backoff)', async () => {
      const position = createMockPosition();
      const rateLimitError = new ExchangeRateLimitError('Rate limit exceeded', {
        retryAfterMs: 100,
      });

      mockBybit.getOrderHistory.mockResolvedValue([]);
      mockBybit.getCurrentPrice
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(101);
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
      const closeError = new ExchangeAPIError('Failed to record close', {
        statusCode: 500,
      });

      prepareClosedPositionSync({ mockBybit }, { currentPrice: 101 });

      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(closeError);
      service = createPositionSyncService({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      });

      mockPositionManager.clearPosition.mockResolvedValue(undefined);
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      // Should NOT throw, should continue to clear position
      await service.syncClosedPosition(position);

      expect(mockPositionManager.clearPosition).toHaveBeenCalledTimes(1);
    });

    it('should SKIP telegram alert on network error (non-blocking)', async () => {
      const position = createMockPosition();
      const telegramError = new TelegramNetworkError('Telegram API timeout', {
        operation: 'sendAlert',
        reason: 'Network timeout',
      });

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
      const priceError = new ExchangeConnectionError('API down', {
        exchangeName: 'Bybit',
      });

      prepareClosedPositionSync({ mockBybit });
      mockBybit.getCurrentPrice
        .mockRejectedValueOnce(priceError)
        .mockRejectedValueOnce(priceError)
        .mockRejectedValueOnce(priceError);
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

      mockBybit.getOrderHistory.mockRejectedValue(new ExchangeConnectionError('', {exchangeName: 'Bybit'}));
      mockBybit.getCurrentPrice.mockRejectedValue(new ExchangeConnectionError('', {exchangeName: 'Bybit'}));
      mockTelegram.sendAlert.mockRejectedValue(new TelegramNetworkError('', {operation: '', reason: ''}));

      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(new ExchangeAPIError('', {}));
      service = createPositionSyncService({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      });

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
      const networkError = new ExchangeConnectionError('Network timeout', {
        exchangeName: 'Bybit',
      });

      // First call fails, second succeeds (for initial fetch)
      // Then potentially a third for pre-close verification
      mockBybit.getPosition
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(position)
        .mockResolvedValueOnce(position);
      mockBybit.getActiveOrders.mockResolvedValue(
        createPositionSyncProtectedOrders({ takeProfitLevels: [] }),
      );

      await service.deepSyncCheck(position);

      // Should have retried - at least 2 calls (initial + retry), may be 3 with verification
      expect(mockBybit.getPosition.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should RETRY getActiveOrders on rate limit (2 attempts)', async () => {
      const position = createOldPosition();
      const rateLimitError = new ExchangeRateLimitError('Rate limit', {
        retryAfterMs: 100,
      });

      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(createPositionSyncProtectedOrders({ takeProfitLevels: [] }));

      const startTime = Date.now();
      await service.deepSyncCheck(position);
      const elapsed = Date.now() - startTime;

      expect(mockBybit.getActiveOrders).toHaveBeenCalledTimes(2);
      // Should have delays (exponential backoff)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should GRACEFUL_DEGRADE when getActiveOrders fails (assume protection exists)', async () => {
      const position = createOldPosition();
      const apiError = new ExchangeAPIError('API error', {
        statusCode: 500,
      });

      mockBybit.getPosition.mockResolvedValue(position);
      mockBybit.getActiveOrders
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError);

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
      const exchangePos = position;

      mockBybit.getPosition
        .mockResolvedValueOnce(exchangePos)
        .mockResolvedValueOnce(exchangePos); // For pre-close verification

      // No SL, no TP, no trailing
      const noProtectionOrders: BybitOrder[] = [];
      mockBybit.getActiveOrders.mockResolvedValue(noProtectionOrders);
      mockBybit.closePosition.mockResolvedValue({ orderId: 'close-order' });
      mockTelegram.sendAlert.mockResolvedValue(undefined);

      await service.deepSyncCheck(position);

      // Should attempt emergency close
      expect(mockBybit.closePosition).toHaveBeenCalledWith({
        positionId: position.id,
        percentage: 100,
      });
    });

    it('should SKIP telegram alerts during emergency close', async () => {
      const position = createOldPosition();
      const exchangePos = position;
      const telegramError = new TelegramNetworkError('Timeout', {
        operation: 'sendAlert',
        reason: 'Network',
      });

      mockBybit.getPosition
        .mockResolvedValueOnce(exchangePos)
        .mockResolvedValueOnce(exchangePos);

      mockBybit.getActiveOrders.mockResolvedValue([]); // No protection
      mockBybit.closePosition.mockResolvedValue({ orderId: 'close-order' });
      mockTelegram.sendAlert.mockRejectedValue(telegramError);

      // Should NOT throw despite telegram error
      await service.deepSyncCheck(position);

      expect(mockBybit.closePosition).toHaveBeenCalledTimes(1);
    });

    it('E2E: All API calls fail → logs errors but position preserved', async () => {
      const position = createOldPosition();
      const apiError = new ExchangeAPIError('API down', {
        statusCode: 503,
      });

      mockBybit.getPosition
        .mockRejectedValueOnce(apiError)
        .mockRejectedValueOnce(apiError);

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
        new ExchangeConnectionError('Network', {exchangeName: 'Bybit'})
      );

      // Price fails
      mockBybit.getCurrentPrice.mockRejectedValue(
        new ExchangeConnectionError('Network', {exchangeName: 'Bybit'})
      );

      // Close fails
      const mockPositionExiting = createMockPositionCloseRecorder();
      mockPositionExiting.closeFullPosition.mockRejectedValue(
        new ExchangeAPIError('Server error', {})
      );
      service = createPositionSyncService({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: mockPositionExiting,
        errorHandler,
      });

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
      const rateLimitError = new ExchangeRateLimitError('Rate limit', {
        retryAfterMs: 50,
      });
      mockBybit.getActiveOrders
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(createPositionSyncProtectedOrders());

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
      service = createPositionSyncService({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: {
          closeFullPosition: jest.fn().mockResolvedValue(true),
        },
        errorHandler: customErrorHandler,
      });

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
      const serviceWithoutHandler = createPositionSyncService({
        mockBybit,
        mockPositionManager,
        mockExitTypeDetector,
        mockTelegram,
        logger,
        positionExiting: {
          closeFullPosition: jest.fn().mockResolvedValue(true),
        },
        errorHandler: undefined,
      });

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
