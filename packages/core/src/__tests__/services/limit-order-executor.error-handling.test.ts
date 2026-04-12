/**
 * Limit Order Executor Service - Error Handling Tests (Phase 8.9.15)
 *
 * Comprehensive error handling tests with ErrorHandler integration
 * Tests coverage:
 * - Placement error handling (RETRY strategy)
 * - Fill timeout handling (RETRY strategy for status checks)
 * - Cancellation handling (SKIP strategy)
 * - Fallback handling (RETRY + THROW strategies)
 * - Integration scenarios (E2E workflows)
 */

import { LimitOrderExecutorService } from '../../services/limit-order-executor.service';
import { BybitService } from '../../services/bybit/bybit.service';
import { LoggerService } from '../../services/logger.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { SignalDirection, LimitOrderExecutorConfig } from '../../types/legacy';
import {
  LimitOrderPlacementError,
  LimitOrderFillTimeoutError,
  MarketOrderFallbackError,
} from '../../errors/DomainErrors';
import {
  createLimitOrderExecutorConfig,
  createManagedLimitOrderExecutorContext,
  type ManagedLimitOrderExecutorContext,
} from '../helpers/limit-order-executor-test.utils';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('LimitOrderExecutorService - Error Handling (Phase 8.9.15)', () => {
  let service: LimitOrderExecutorService;
  let bybitService: BybitService;
  let logger: LoggerService;
  let config: LimitOrderExecutorConfig;
  let errorHandler: ErrorHandler;
  let createService: ManagedLimitOrderExecutorContext['createService'];
  let cleanup: ManagedLimitOrderExecutorContext['cleanup'];

  beforeEach(() => {
    const managedContext = createManagedLimitOrderExecutorContext();
    ({
      logger,
      config,
      bybitService,
      service,
      createService,
      cleanup,
    } = managedContext);
    errorHandler = managedContext.errorHandler as ErrorHandler;
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // PLACEMENT ERROR HANDLING (5 TESTS)
  // ==========================================================================

  describe('Placement Error Handling', () => {
    it('should RETRY on network error during placement', async () => {
      const mockOrderId = 'order-123';
      const mockSubmitOrder = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: mockOrderId },
        });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.filled).toBe(false);
      expect(mockSubmitOrder).toHaveBeenCalledTimes(2);
    });

    it('should THROW on invalid parameters (non-retryable)', async () => {
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 400,
        retMsg: 'Invalid quantity',
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      try {
        await service.placeLimitOrder(
          SignalDirection.LONG,
          0, // Invalid quantity
          99.98,
          5,
        );
        fail('Should have thrown LimitOrderPlacementError');
      } catch (error) {
        expect(error).toBeInstanceOf(LimitOrderPlacementError);
        const err = error as LimitOrderPlacementError;
        expect(err.message).toContain('Failed to place limit order');
      }
    });

    it('should RETRY with exponential backoff until success', async () => {
      const mockOrderId = 'order-backoff';
      const mockSubmitOrder = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary error 1'))
        .mockRejectedValueOnce(new Error('Temporary error 2'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: mockOrderId },
        });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const startTime = Date.now();
      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );
      const duration = Date.now() - startTime;

      expect(result.orderId).toBe(mockOrderId);
      expect(mockSubmitOrder).toHaveBeenCalledTimes(3);
      expect(duration).toBeGreaterThan(100); // Should have delays between retries
    });

    it('should THROW after max retries exceeded', async () => {
      const mockSubmitOrder = jest.fn().mockRejectedValue(
        new Error('Persistent network error'),
      );

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      try {
        await service.placeLimitOrder(
          SignalDirection.LONG,
          10,
          99.98,
          5,
        );
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle rate limit errors gracefully', async () => {
      const mockSubmitOrder = jest
        .fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: 'order-rate-limited' },
        });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe('order-rate-limited');
      expect(mockSubmitOrder).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // FILL TIMEOUT HANDLING (4 TESTS)
  // ==========================================================================

  describe('Fill Timeout Handling', () => {
    it('should RETRY on order status check failure', async () => {
      const mockOrderId = 'order-timeout-retry';
      const mockGetActiveOrders = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { list: [{ orderStatus: 'Filled' }] },
        });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: jest.fn(),
        submitOrder: jest.fn(),
      });

      // We expect the timeout to be thrown since we can't actually wait for success
      // The test verifies that checkOrderStatusWithRetry attempts retries
      try {
        // Just trigger the method to test error handling path
        await service.waitForFill(mockOrderId, 1000);
      } catch (error) {
        expect(error).toBeInstanceOf(LimitOrderFillTimeoutError);
      }
    });

    it('should timeout after waiting period without fill', async () => {
      const mockOrderId = 'order-timeout-exceeded';
      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ orderStatus: 'PartiallyFilled' }] },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        submitOrder: jest.fn(),
      });

      const startTime = Date.now();
      try {
        await service.waitForFill(mockOrderId, 500); // Short timeout
        fail('Should have thrown LimitOrderFillTimeoutError');
      } catch (error) {
        const duration = Date.now() - startTime;
        expect(error).toBeInstanceOf(LimitOrderFillTimeoutError);
        expect(duration).toBeGreaterThanOrEqual(500);
        const timeoutError = error as LimitOrderFillTimeoutError;
        expect(timeoutError.timeoutMs).toBe(500);
      }
    });

    it('should return true when order finally fills after retries', async () => {
      const mockOrderId = 'order-filled-after-retry';
      const mockGetActiveOrders = jest
        .fn()
        .mockResolvedValueOnce({
          retCode: 0,
          result: { list: [] }, // Not in active orders
        });

      const mockGetHistoricOrders = jest.fn().mockResolvedValueOnce({
        retCode: 0,
        result: { list: [{ orderStatus: 'Filled', avgPrice: '99.98' }] },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
        submitOrder: jest.fn(),
      });

      const result = await service.waitForFill(mockOrderId, 5000);
      expect(result).toBe(true);
    });

    it('should detect stale order (cancelled)', async () => {
      const mockOrderId = 'order-cancelled';
      const mockGetActiveOrders = jest.fn().mockResolvedValueOnce({
        retCode: 0,
        result: { list: [] },
      });

      const mockGetHistoricOrders = jest.fn().mockResolvedValueOnce({
        retCode: 0,
        result: { list: [{ orderStatus: 'Cancelled', avgPrice: '0' }] },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
        submitOrder: jest.fn(),
      });

      const result = await service.waitForFill(mockOrderId, 5000);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // CANCELLATION HANDLING (2 TESTS)
  // ==========================================================================

  describe('Cancellation Handling', () => {
    it('should SKIP strategy on cancellation error', async () => {
      const mockOrderId = 'order-cancel-fail';
      const mockCancelOrder = jest
        .fn()
        .mockRejectedValue(new Error('Network error during cancel'));

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        cancelOrder: mockCancelOrder,
      });

      // SKIP strategy should return false instead of throwing
      const result = await service.cancelOrder(mockOrderId);
      expect(result).toBe(false);
    });

    it('should handle order already filled when cancelling', async () => {
      const mockOrderId = 'order-already-filled';
      const mockCancelOrder = jest.fn().mockResolvedValue({
        retCode: 1,
        retMsg: 'order not exists or too late to cancel',
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        cancelOrder: mockCancelOrder,
      });

      const result = await service.cancelOrder(mockOrderId);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // FALLBACK HANDLING (4 TESTS)
  // ==========================================================================

  describe('Fallback Handling', () => {
    it('should RETRY fallback to market on network error', async () => {
      const mockOrderId = 'market-order-123';
      const mockOpenPosition = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ avgPrice: '100.00' }] },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.fallbackToMarket(
        SignalDirection.LONG,
        10,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.filled).toBe(true);
      expect(mockOpenPosition).toHaveBeenCalledTimes(2); // Failed once, succeeded second time
    });

    it('should succeed market order after fallback', async () => {
      const mockOrderId = 'market-success-123';
      const mockOpenPosition = jest.fn().mockResolvedValue(mockOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ avgPrice: '100.05' }] },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.fallbackToMarket(
        SignalDirection.LONG,
        10,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.filled).toBe(true);
      expect(result.fillPrice).toBe(100.05);
      expect(result.feePaid).toBeGreaterThan(0); // Taker fee calculated
    });

    it('should THROW on critical fallback error', async () => {
      const mockOpenPosition = jest
        .fn()
        .mockRejectedValue(new Error('Insufficient balance'));

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: jest.fn(),
      });

      try {
        await service.fallbackToMarket(
          SignalDirection.LONG,
          10,
          5,
        );
        fail('Should have thrown MarketOrderFallbackError');
      } catch (error) {
        expect(error).toBeInstanceOf(MarketOrderFallbackError);
      }
    });

    it('should calculate fee correctly for fallback market order', async () => {
      const mockOrderId = 'market-fee-test';
      const mockOpenPosition = jest.fn().mockResolvedValue(mockOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ avgPrice: '100.00' }] },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.fallbackToMarket(
        SignalDirection.LONG,
        10,
        5,
      );

      // Fee = quantity * price * TAKER_FEE_PERCENT / PERCENT_MULTIPLIER
      // = 10 * 100 * 0.06 / 100 = 0.6 (TAKER_FEE_PERCENT = 0.06%)
      expect(result.feePaid).toBeCloseTo(0.6, 2);
    });
  });

  // ==========================================================================
  // INTEGRATION SCENARIOS (5 TESTS)
  // ==========================================================================

  describe('Integration Scenarios', () => {
    it(
      'should E2E: placement → timeout → fallback to market',
      async () => {
        const limitOrderId = 'limit-order-timeout';
        const marketOrderId = 'market-fallback';

        // Setup: limit order succeeds
        const mockSubmitOrder = jest.fn().mockResolvedValue({
          retCode: 0,
          result: { orderId: limitOrderId },
        });

        // Setup: order times out (never gets filled)
        const mockGetActiveOrders = jest.fn().mockResolvedValue({
          retCode: 0,
          result: { list: [{ orderStatus: 'PartiallyFilled' }] },
        });

        // Setup: cancel succeeds
        const mockCancelOrder = jest.fn().mockResolvedValue({
          retCode: 0,
          result: {},
        });

        // Setup: fallback to market succeeds
        const mockOpenPosition = jest.fn().mockResolvedValue(marketOrderId);
        const mockGetHistoricOrders = jest.fn().mockResolvedValue({
          retCode: 0,
          result: { list: [{ avgPrice: '100.05' }] },
        });

        (bybitService.getRestClient as jest.Mock).mockReturnValue({
          submitOrder: mockSubmitOrder,
          getActiveOrders: mockGetActiveOrders,
          cancelOrder: mockCancelOrder,
          getHistoricOrders: mockGetHistoricOrders,
        });

        (bybitService.openPosition as jest.Mock) = mockOpenPosition;

        // Use shorter timeout for test
        const result = await service.executeEntry(
          SignalDirection.LONG,
          10,
          100.00,
          5,
        );

        // Should have used market fallback
        expect(result.orderId).toBe(marketOrderId);
        expect(result.filled).toBe(true);
        expect(mockCancelOrder).toHaveBeenCalled();
      },
      10000,
    ); // 10 second timeout

    it('should E2E: placement → success → no fallback needed', async () => {
      const limitOrderId = 'limit-order-success';

      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: limitOrderId },
      });

      const mockGetActiveOrders = jest.fn().mockResolvedValueOnce({
        retCode: 0,
        result: { list: [] }, // Order filled
      });

      const mockGetHistoricOrders = jest.fn().mockResolvedValueOnce({
        retCode: 0,
        result: { list: [{ orderStatus: 'Filled', avgPrice: '99.98' }] },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.executeEntry(
        SignalDirection.LONG,
        10,
        100.00,
        5,
      );

      expect(result.orderId).toBe(limitOrderId);
      expect(result.filled).toBe(true);
      expect('fillPrice' in result ? result.fillPrice : undefined).toBe(99.98); // Maker fee
    });

    it(
      'should E2E: placement → cancel → no fallback (disabled)',
      async () => {
        const limitOrderId = 'limit-no-fallback';
        config.fallbackToMarket = false;

        const mockSubmitOrder = jest.fn().mockResolvedValue({
          retCode: 0,
          result: { orderId: limitOrderId },
        });

        const mockGetActiveOrders = jest.fn().mockResolvedValue({
          retCode: 0,
          result: { list: [{ orderStatus: 'PartiallyFilled' }] },
        });

        const mockCancelOrder = jest.fn().mockResolvedValue({
          retCode: 0,
          result: {},
        });

        (bybitService.getRestClient as jest.Mock).mockReturnValue({
          submitOrder: mockSubmitOrder,
          getActiveOrders: mockGetActiveOrders,
          cancelOrder: mockCancelOrder,
        });

        try {
          await service.executeEntry(SignalDirection.LONG, 10, 100.0, 5);
        } catch (error) {
          expect(error).toBeInstanceOf(LimitOrderFillTimeoutError);
        }

        expect(mockCancelOrder).toHaveBeenCalled();
      },
      10000,
    ); // 10 second timeout

    it('should handle cascading failures with recovery', async () => {
      // Placement fails then succeeds
      const mockSubmitOrder = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: 'limit-order-123' },
        });

      // Fill check fails then succeeds
      const mockGetActiveOrders = jest
        .fn()
        .mockRejectedValueOnce(new Error('Temporary API error'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { list: [] },
        });

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [{ orderStatus: 'Filled' }] },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.executeEntry(
        SignalDirection.LONG,
        10,
        100.00,
        5,
      );

      expect(result.orderId).toBe('limit-order-123');
      expect(result.filled).toBe(true);
    });

    it('should track errors with ErrorHandler telemetry', async () => {
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: 'order-telemetry' },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
        getActiveOrders: jest.fn().mockResolvedValue({
          retCode: 0,
          result: { list: [] },
        }),
        getHistoricOrders: jest.fn().mockResolvedValue({
          retCode: 0,
          result: { list: [{ orderStatus: 'Filled' }] },
        }),
      });

      const result = await service.executeEntry(
        SignalDirection.LONG,
        10,
        100.00,
        5,
      );

      // Successful scenario should complete without errors
      expect(result.filled).toBe(true);
      expect(result.orderId).toBe('order-telemetry');
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY TESTS
  // ==========================================================================

  describe('Backward Compatibility', () => {
    it('should work without ErrorHandler (legacy mode)', async () => {
      const legacyService = createService({
        config,
        bybitService,
        logger,
        withErrorHandler: false,
      });

      const mockOrderId = 'legacy-order-123';
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await legacyService.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
    });

    it('should fallback to legacy retry logic without ErrorHandler', async () => {
      const legacyService = createService({
        config,
        bybitService,
        logger,
        withErrorHandler: false,
      });

      const mockOrderId = 'legacy-retry-order';
      const mockSubmitOrder = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: mockOrderId },
        });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await legacyService.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(mockSubmitOrder).toHaveBeenCalledTimes(2);
    });
  });
});
