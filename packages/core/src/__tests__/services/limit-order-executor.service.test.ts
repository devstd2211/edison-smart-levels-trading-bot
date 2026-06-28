import { LimitOrderExecutorService } from '../../services/limit-order-executor.service';
import { BybitService } from '../../services/bybit/bybit.service';
import { LoggerService } from '../../services/logger.service';
import {
  SignalDirection,
  PositionSide,
  LimitOrderExecutorConfig,
} from '../../types/legacy';
import {
  attachLimitOrderRestClient,
  createLimitOrderStatusRecord,
  createLimitOrderExecutorConfig,
  createLimitOrderExecutorLogger,
  createManagedLimitOrderExecutorContext,
  createMockLimitOrderBybitService,
  MockLimitOrderRestClient,
  type LimitOrderExecutorState,
} from '../helpers/limit-order-executor-test.utils';

// ============================================================================
// TEST SETUP
// ============================================================================

describe('LimitOrderExecutorService', () => {
  let service: LimitOrderExecutorService;
  let bybitService: BybitService;
  let config!: LimitOrderExecutorState['config'];
  let restClient: MockLimitOrderRestClient;
  let createService!: LimitOrderExecutorState['createService'];
  let cleanup!: LimitOrderExecutorState['cleanup'];

  beforeEach(() => {
    ({
      config,
      bybitService,
      service,
      createService,
      cleanup,
    } = createManagedLimitOrderExecutorContext({
      config: createLimitOrderExecutorConfig({ maxRetries: 1 }),
      bybitService: createMockLimitOrderBybitService(),
      logger: createLimitOrderExecutorLogger(),
      withErrorHandler: false,
    }));
    restClient = attachLimitOrderRestClient(bybitService);
  });

  afterEach(() => {
    cleanup();
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
      restClient.submitOrder.mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
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
      expect(restClient.submitOrder).toHaveBeenCalledWith(
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
      restClient.submitOrder.mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      const result = await service.placeLimitOrder(
        SignalDirection.SHORT,
        10,
        100.02,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(restClient.submitOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          side: 'Sell',
        }),
      );
    });

    it('should retry on failure and succeed on second attempt', async () => {
      const mockOrderId = 'order-retry-success';
      restClient.submitOrder
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          retCode: 0,
          result: { orderId: mockOrderId },
        });

      const result = await service.placeLimitOrder(
        SignalDirection.LONG,
        10,
        99.98,
        5,
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(restClient.submitOrder).toHaveBeenCalledTimes(2); // First failed, second succeeded
    });

    it('should throw error after max retries exceeded', async () => {
      restClient.submitOrder.mockRejectedValue(new Error('Persistent error'));

      await expect(
        service.placeLimitOrder(SignalDirection.LONG, 10, 99.98, 5),
      ).rejects.toThrow('Failed to place limit order after');

      // maxRetries = 1, so total attempts = 2
      expect(restClient.submitOrder).toHaveBeenCalledTimes(2);
    });

    it('should throw error if API returns error code', async () => {
      restClient.submitOrder.mockResolvedValue({
        retCode: 10001,
        retMsg: 'Insufficient balance',
      });

      await expect(
        service.placeLimitOrder(SignalDirection.LONG, 10, 99.98, 5),
      ).rejects.toThrow(); // Will throw LimitOrderPlacementError

      expect(restClient.submitOrder).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // WAIT FOR FILL
  // ==========================================================================

  describe('waitForFill', () => {
    it('should return true when order is filled', async () => {
      restClient.getActiveOrders.mockResolvedValue({
        retCode: 0,
        result: { list: [] }, // Empty = not active anymore
      });

      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord()],
        },
      });

      const filled = await service.waitForFill('order-123', 5000);

      expect(filled).toBe(true);
      expect(restClient.getActiveOrders).toHaveBeenCalled();
      expect(restClient.getHistoricOrders).toHaveBeenCalled();
    });

    it('should throw LimitOrderFillTimeoutError on timeout (order still active)', async () => {
      restClient.getActiveOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderStatus: 'New' })],
        }, // Still active
      });

      // Short timeout to avoid test delay
      await expect(service.waitForFill('order-123', 500)).rejects.toThrow();

      expect(restClient.getActiveOrders).toHaveBeenCalled();
    });

    it('should return false if order was cancelled', async () => {
      restClient.getActiveOrders.mockResolvedValue({
        retCode: 0,
        result: { list: [] },
      });

      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderStatus: 'Cancelled' })],
        },
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
      restClient.cancelOrder.mockResolvedValue({
        retCode: 0,
      });

      const result = await service.cancelOrder('order-123');

      expect(result).toBe(true);
      expect(restClient.cancelOrder).toHaveBeenCalledWith({
        category: 'linear',
        symbol: 'APEXUSDT',
        orderId: 'order-123',
      });
    });

    it('should handle "order not exists" gracefully', async () => {
      restClient.cancelOrder.mockResolvedValue({
        retCode: 110001,
        retMsg: 'order not exists or too late to cancel',
      });

      const result = await service.cancelOrder('order-123');

      expect(result).toBe(false); // Not an error, just already filled/cancelled
    });

    it('should return false on error', async () => {
      restClient.cancelOrder.mockRejectedValue(new Error('Network error'));

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

      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderId: mockOrderId, avgPrice: '99.95' })],
        },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;

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
      ).rejects.toThrow(); // Will throw MarketOrderFallbackError

      expect(mockOpenPosition).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // EXECUTE ENTRY (INTEGRATION)
  // ==========================================================================

  describe('executeEntry', () => {
    it('should execute limit order and wait for fill (success path)', async () => {
      const mockOrderId = 'limit-success';

      restClient.submitOrder.mockResolvedValue({
        retCode: 0,
        result: { orderId: mockOrderId },
      });

      restClient.getActiveOrders.mockResolvedValue({
        retCode: 0,
        result: { list: [] },
      });

      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderId: mockOrderId })],
        },
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

      restClient.submitOrder.mockResolvedValue({
        retCode: 0,
        result: { orderId: mockLimitOrderId },
      });

      // Order stays active (not filled)
      restClient.getActiveOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderId: mockLimitOrderId, orderStatus: 'New' })],
        },
      });

      const mockOpenPosition = jest.fn().mockResolvedValue(mockMarketOrderId);

      restClient.cancelOrder.mockResolvedValue({ retCode: 0 });
      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderId: mockMarketOrderId, avgPrice: '99.95' })],
        },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;

      // Short timeout to test fallback
      service = createService({ config: { ...config, timeoutMs: 500 } });

      const result = await service.executeEntry(SignalDirection.LONG, 10, 100, 5);

      expect(result.orderId).toBe(mockMarketOrderId);
      expect(restClient.cancelOrder).toHaveBeenCalled();
      expect(mockOpenPosition).toHaveBeenCalled();
    });

    it('should use market order when limit execution is disabled', async () => {
      const mockMarketOrderId = 'market-direct';
      const mockOpenPosition = jest.fn().mockResolvedValue(mockMarketOrderId);

      restClient.getHistoricOrders.mockResolvedValue({
        retCode: 0,
        result: {
          list: [createLimitOrderStatusRecord({ orderId: mockMarketOrderId, avgPrice: '100.00' })],
        },
      });

      (bybitService.openPosition as jest.Mock) = mockOpenPosition;

      // Disable limit order execution
      service = createService({ config: { ...config, enabled: false } });

      const result = await service.executeEntry(SignalDirection.LONG, 10, 100, 5);

      expect(result.orderId).toBe(mockMarketOrderId);
      expect(mockOpenPosition).toHaveBeenCalled();
    });
  });
});
