/**
 * Limit Order Executor Service Tests (Phase 2)
 *
 * Tests for limit order execution with fallback to market orders
 */

import { LimitOrderExecutorService } from '../../services/limit-order-executor.service';
import { BybitService } from '../../services/bybit/bybit.service';
import { LoggerService } from '../../services/logger.service';
import {
  LogLevel,
  SignalDirection,
  PositionSide,
  LimitOrderExecutorConfig,
} from '../../types';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('LimitOrderExecutorService', () => {
  let service: LimitOrderExecutorService;
  let bybitService: BybitService;
  let logger: LoggerService;
  let config: LimitOrderExecutorConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    config = {
      enabled: true,
      timeoutMs: 5000,
      slippagePercent: 0.02,
      fallbackToMarket: true,
      maxRetries: 1,
    };

    // Mock BybitService
    bybitService = {
      setLeverage: jest.fn().mockResolvedValue(undefined),
      roundQuantity: jest.fn((qty) => qty.toFixed(0)),
      roundPrice: jest.fn((price) => price.toFixed(2)),
      getSymbol: jest.fn().mockReturnValue('APEXUSDT'),
      getRestClient: jest.fn().mockReturnValue({
        submitOrder: jest.fn(),
        getActiveOrders: jest.fn(),
        getHistoricOrders: jest.fn(),
        cancelOrder: jest.fn(),
      }),
      openPosition: jest.fn(),
    } as any;

    service = new LimitOrderExecutorService(config, bybitService, logger);
  });

  // ==========================================================================
  // CALCULATE LIMIT PRICE
  // ==========================================================================

  describe('calculateLimitPrice', () => {
    it('should calculate limit price for LONG (below current price)', () => {
      const currentPrice = 100;
      const slippage = 0.02; // 0.02%

      const limitPrice = service.calculateLimitPrice(
        SignalDirection.LONG,
        currentPrice,
        slippage,
      );

      // LONG: price * (1 - 0.02/100) = 100 * 0.9998 = 99.98
      expect(limitPrice).toBeCloseTo(99.98, 2);
    });

    it('should calculate limit price for SHORT (above current price)', () => {
      const currentPrice = 100;
      const slippage = 0.02; // 0.02%

      const limitPrice = service.calculateLimitPrice(
        SignalDirection.SHORT,
        currentPrice,
        slippage,
      );

      // SHORT: price * (1 + 0.02/100) = 100 * 1.0002 = 100.02
      expect(limitPrice).toBeCloseTo(100.02, 2);
    });

    it('should handle different slippage values', () => {
      const currentPrice = 100;
      const slippage = 0.05; // 0.05%

      const limitPriceLong = service.calculateLimitPrice(
        SignalDirection.LONG,
        currentPrice,
        slippage,
      );

      const limitPriceShort = service.calculateLimitPrice(
        SignalDirection.SHORT,
        currentPrice,
        slippage,
      );

      expect(limitPriceLong).toBeCloseTo(99.95, 2);
      expect(limitPriceShort).toBeCloseTo(100.05, 2);
    });
  });

  // ==========================================================================
  // PLACE LIMIT ORDER
  // ==========================================================================

  describe('placeLimitOrder', () => {
    it('should place limit order successfully (LONG)', async () => {
      const mockOrderId = 'order-123';
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10, // quantity
        99.98, // limitPrice
        5, // leverage
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.filled).toBe(false);
      expect(result.feePaid).toBe(0);
      expect(mockSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'linear',
          symbol: 'APEXUSDT',
          side: 'Buy',
          orderType: 'Limit',
          qty: '10',
          price: '99.98',
          timeInForce: 'GTC',
        }),
      );
    });

    it('should place limit order successfully (SHORT)', async () => {
      const mockOrderId = 'order-456';
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      const result = await service.placeLimitOrder(
        SignalDirection.SHORT,
        10,
        100.02,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(mockSubmitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'Sell',
        }),
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockOrderId = 'order-retry-success';
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

      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(mockSubmitOrder).toHaveBeenCalledTimes(2); // First failed, second succeeded
    });

    it('should throw error after max retries exceeded', async () => {
      const mockSubmitOrder = jest.fn().mockRejectedValue(new Error('Persistent error'));

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      await expect(
        service.placeLimitOrder(SignalDirection.LONG, 10, 99.98, 5),
      ).rejects.toThrow('Failed to place limit order after');

      // maxRetries = 1, so total attempts = 2
      expect(mockSubmitOrder).toHaveBeenCalledTimes(2);
    });

    it('should throw error if API returns error code', async () => {
      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 10001,
        retMsg: 'Insufficient balance',
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
      });

      await expect(
        service.placeLimitOrder(SignalDirection.LONG, 10, 99.98, 5),
      ).rejects.toThrow('Insufficient balance');
    });
  });

  // ==========================================================================
  // WAIT FOR FILL
  // ==========================================================================

  describe('waitForFill', () => {
    it('should return true when order is filled', async () => {
      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [] }, // Empty = not active anymore
      });

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [
            {
              orderId: 'order-123',
              orderStatus: 'Filled',
              avgPrice: '99.98',
            },
          ],
        },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
      });

      const filled = await service.waitForFill('order-123', 5000);

      expect(filled).toBe(true);
      expect(mockGetActiveOrders).toHaveBeenCalled();
      expect(mockGetHistoricOrders).toHaveBeenCalled();
    });

    it('should return false on timeout (order still active)', async () => {
      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [
            {
              orderId: 'order-123',
              orderStatus: 'New',
            },
          ],
        }, // Still active
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
      });

      // Short timeout to avoid test delay
      const filled = await service.waitForFill('order-123', 500);

      expect(filled).toBe(false);
    });

    it('should return false if order was cancelled', async () => {
      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [] },
      });

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [
            {
              orderId: 'order-123',
              orderStatus: 'Cancelled',
            },
          ],
        },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
      });

      const filled = await service.waitForFill('order-123', 5000);

      expect(filled).toBe(false);
    });
  });

  // ==========================================================================
  // CANCEL ORDER
  // ==========================================================================

  describe('cancelOrder', () => {
    it('should cancel order successfully', async () => {
      const mockCancelOrder = jest.fn().mockResolvedValue({
        retCode: 0,
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        cancelOrder: mockCancelOrder,
      });

      const result = await service.cancelOrder('order-123');

      expect(result).toBe(true);
      expect(mockCancelOrder).toHaveBeenCalledWith({
        category: 'linear',
        symbol: 'APEXUSDT',
        orderId: 'order-123',
      });
    });

    it('should handle "order not exists" gracefully', async () => {
      const mockCancelOrder = jest.fn().mockResolvedValue({
        retCode: 110001,
        retMsg: 'order not exists or too late to cancel',
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        cancelOrder: mockCancelOrder,
      });

      const result = await service.cancelOrder('order-123');

      expect(result).toBe(false); // Not an error, just already filled/cancelled
    });

    it('should return false on error', async () => {
      const mockCancelOrder = jest.fn().mockRejectedValue(new Error('Network error'));

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        cancelOrder: mockCancelOrder,
      });

      const result = await service.cancelOrder('order-123');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // FALLBACK TO MARKET
  // ==========================================================================

  describe('fallbackToMarket', () => {
    it('should execute market order successfully', async () => {
      const mockOrderId = 'market-order-123';
      const mockOpenPosition = jest.fn().mockResolvedValue(mockOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [
            {
              orderId: mockOrderId,
              avgPrice: '99.95',
            },
          ],
        },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.fallbackToMarket(SignalDirection.LONG, 10, 5);

      expect(result.orderId).toBe(mockOrderId);
      expect(result.fillPrice).toBe(99.95);
      expect(result.feePaid).toBeGreaterThan(0); // Taker fee 0.06%
      expect(mockOpenPosition).toHaveBeenCalledWith({
        side: PositionSide.LONG,
        quantity: 10,
        leverage: 5,
      });
    });

    it('should throw error on failure', async () => {
      const mockOpenPosition = jest.fn().mockRejectedValue(new Error('Order failed'));
      (bybitService.openPosition as jest.Mock) = mockOpenPosition;

      await expect(
        service.fallbackToMarket(SignalDirection.SHORT, 10, 5),
      ).rejects.toThrow('Order failed');
    });
  });

  // ==========================================================================
  // EXECUTE ENTRY (INTEGRATION)
  // ==========================================================================

  describe('executeEntry', () => {
    it('should execute limit order and wait for fill (success path)', async () => {
      const mockOrderId = 'limit-success';

      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { list: [] },
      });

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [
            {
              orderId: mockOrderId,
              orderStatus: 'Filled',
              avgPrice: '99.98',
            },
          ],
        },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
        getActiveOrders: mockGetActiveOrders,
        getHistoricOrders: mockGetHistoricOrders,
      });

      const result = await service.executeEntry(
        SignalDirection.LONG,
        10, // quantity
        100, // currentPrice
        5, // leverage
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.filled).toBe(true);
      expect(result.fillPrice).toBeCloseTo(99.98, 2);
      // Maker fee = 10 * 99.98 * 0.01% = 0.09998
      expect(result.feePaid).toBeCloseTo(0.09998, 4);
    });

    it('should fallback to market order on timeout', async () => {
      const mockLimitOrderId = 'limit-timeout';
      const mockMarketOrderId = 'market-fallback';

      const mockSubmitOrder = jest.fn().mockResolvedValue({
        retCode: 0,
        result: { orderId: mockLimitOrderId },
      });

      // Order stays active (not filled)
      const mockGetActiveOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [{ orderId: mockLimitOrderId, orderStatus: 'New' }],
        },
      });

      const mockCancelOrder = jest.fn().mockResolvedValue({ retCode: 0 });

      const mockOpenPosition = jest.fn().mockResolvedValue(mockMarketOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [{ orderId: mockMarketOrderId, avgPrice: '99.95' }],
        },
      });

      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        submitOrder: mockSubmitOrder,
        getActiveOrders: mockGetActiveOrders,
        cancelOrder: mockCancelOrder,
        getHistoricOrders: mockGetHistoricOrders,
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;

      // Short timeout to test fallback
      service = new LimitOrderExecutorService(
        { ...config, timeoutMs: 500 },
        bybitService,
        logger,
      );

      const result = await service.executeEntry(SignalDirection.LONG, 10, 100, 5);

      expect(result.orderId).toBe(mockMarketOrderId);
      expect(mockCancelOrder).toHaveBeenCalled();
      expect(mockOpenPosition).toHaveBeenCalled();
    });

    it('should use market order when limit execution is disabled', async () => {
      const mockMarketOrderId = 'market-direct';
      const mockOpenPosition = jest.fn().mockResolvedValue(mockMarketOrderId);

      const mockGetHistoricOrders = jest.fn().mockResolvedValue({
        retCode: 0,
        result: {
          list: [{ orderId: mockMarketOrderId, avgPrice: '100.00' }],
        },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;
      (bybitService.getRestClient as jest.Mock).mockReturnValue({
        getHistoricOrders: mockGetHistoricOrders,
      });

      // Disable limit order execution
      service = new LimitOrderExecutorService(
        { ...config, enabled: false },
        bybitService,
        logger,
      );

      const result = await service.executeEntry(SignalDirection.LONG, 10, 100, 5);

      expect(result.orderId).toBe(mockMarketOrderId);
      expect(mockOpenPosition).toHaveBeenCalled();
    });
  });
});
