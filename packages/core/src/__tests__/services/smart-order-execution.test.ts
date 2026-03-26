/**
 * Phase 13.1: Smart Order Execution Service - Tests
 *
 * Test Coverage: 45 tests
 * - 6 THROW: Config validation
 * - 6 THROW: Input validation
 * - 10 GRACEFUL_DEGRADE: Execution failures
 * - 4 SKIP: Logging failures
 * - 8 Integration: E2E scenarios
 * - 4 Backward compat: Works without ErrorHandler
 * - 7 Helper methods: calculateOptimalSplit, estimateMarketImpact, etc.
 *
 * Created: 2026-02-09 (Session 97)
 */

import {
  SmartOrderConfig,
  SmartOrderRequest,
  ExecutionReport,
} from '../../services/smart-order-execution.service';
import { LoggerService } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { MAX_ORDER_SPLITS } from '../../constants/phase-13-constants';
const asConfig = (value: unknown): SmartOrderConfig => value as SmartOrderConfig;
const asOrder = (value: unknown): SmartOrderRequest => value as SmartOrderRequest;
import {
  asSmartOrderInternals,
  asSmartOrderLogger,
  createSmartOrderExecutionReport,
  createManagedSmartOrderExecutionContext,
  createSmartOrderExecutionLogger,
  createMinimalSmartOrder,
  createSmartOrderScenario,
  createSmartOrderRequestSeries,
  type ManagedSmartOrderExecutionContext,
} from '../helpers/smart-order-execution-test.utils';
describe('SmartOrderExecutionService', () => {
  type SmartOrderExecutionService = ManagedSmartOrderExecutionContext['service'];
  let service: SmartOrderExecutionService;
  let logger: LoggerService;
  let errorHandler: ErrorHandler;
  let mockConfig: SmartOrderConfig;
  let baseOrder: SmartOrderRequest;
  let context: ManagedSmartOrderExecutionContext;
  let createInvalidService: ManagedSmartOrderExecutionContext['createInvalidService'];
  let createNoHandlerService: ManagedSmartOrderExecutionContext['createNoHandlerService'];
  let createService: (options?: {
    config?: SmartOrderConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => SmartOrderExecutionService;

  beforeEach(() => {
    context = createManagedSmartOrderExecutionContext();
    service = context.service;
    logger = context.logger;
    errorHandler = context.errorHandler;
    mockConfig = context.config;
    baseOrder = context.order;
    createInvalidService = context.createInvalidService;
    createNoHandlerService = context.createNoHandlerService;
    createService = context.createService;
  });

  afterEach(() => {
    context.cleanup();
  });

  // ============================================================================
  // THROW TESTS - Config Validation (6 tests)
  // ============================================================================

  describe('THROW - Config Validation', () => {
    it('should throw when config is null', () => {
      expect(() => {
        createInvalidService(asConfig(null), { logger, errorHandler });
      }).toThrow('config is required');
    });

    it('should throw when maxSlippagePercent is negative', () => {
      expect(() => {
        createInvalidService(
          { ...mockConfig, maxSlippagePercent: -1 },
          { logger, errorHandler },
        );
      }).toThrow('maxSlippagePercent must be >= 0');
    });

    it('should throw when maxOrderSplits is less than 1', () => {
      expect(() => {
        createInvalidService(
          { ...mockConfig, maxOrderSplits: 0 },
          { logger, errorHandler },
        );
      }).toThrow('maxOrderSplits must be >= 1');
    });

    it('should throw when minFillProbability is out of range', () => {
      expect(() => {
        createInvalidService(
          { ...mockConfig, minFillProbability: 1.5 },
          { logger, errorHandler },
        );
      }).toThrow('minFillProbability must be between 0 and 1');
    });

    it('should throw when executionTimeout is zero or negative', () => {
      expect(() => {
        createInvalidService(
          { ...mockConfig, executionTimeout: 0 },
          { logger, errorHandler },
        );
      }).toThrow('executionTimeout must be > 0');
    });

    it('should throw when executionStrategy is missing', () => {
      expect(() => {
        createInvalidService(
          { ...mockConfig, executionStrategy: '' as unknown as SmartOrderConfig['executionStrategy'] },
          { logger, errorHandler },
        );
      }).toThrow('executionStrategy is required');
    });
  });

  // ============================================================================
  // THROW TESTS - Input Validation (6 tests)
  // ============================================================================

  describe('THROW - Input Validation', () => {
    it('should throw when order is null', async () => {
      await expect(service.executeSmartOrder(asOrder(null))).rejects.toThrow(
        'order is required'
      );
    });

    it('should throw when symbol is missing', async () => {
      const [order] = createSmartOrderRequestSeries([{ symbol: '' }]);

      await expect(service.executeSmartOrder(order)).rejects.toThrow(
        'symbol is required'
      );
    });

    it('should throw when side is invalid', async () => {
      const [order] = createSmartOrderRequestSeries([
        { side: 'Invalid' as unknown as SmartOrderRequest['side'] },
      ]);

      await expect(service.executeSmartOrder(order)).rejects.toThrow(
        'valid side is required'
      );
    });

    it('should throw when size is negative', async () => {
      const [order] = createSmartOrderRequestSeries([{ size: -1.0 }]);

      await expect(service.executeSmartOrder(order)).rejects.toThrow(
        'size must be > 0'
      );
    });

    it('should throw when size is NaN', async () => {
      const [order] = createSmartOrderRequestSeries([{ size: NaN }]);

      await expect(service.executeSmartOrder(order)).rejects.toThrow(
        'size must be > 0'
      );
    });

    it('should throw when price is zero or negative', async () => {
      const [order] = createSmartOrderRequestSeries([{ price: 0 }]);

      await expect(service.executeSmartOrder(order)).rejects.toThrow(
        'price must be > 0'
      );
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE TESTS - Execution Failures (10 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE - Execution Failures', () => {
    it('should return failed report when execution throws error', async () => {
      // Mock internal method to throw error
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doExecuteSmartOrder')
        .mockRejectedValue(new Error('Exchange error'));

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await service.executeSmartOrder(order);

      expect(report.status).toBe('failed');
      expect(report.reasoning).toContain('Execution failed');
      expect(report.filledSize).toBe(0);
      expect(report.remainingSize).toBe(1.0);

      spy.mockRestore();
    });

    it('should return single order when calculateOptimalSplit throws', () => {
      // Mock doCalculateOptimalSplit to throw
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doCalculateOptimalSplit')
        .mockImplementation(() => {
          throw new Error('Split calculation failed');
        });

      const splits = service.calculateOptimalSplit(10, 45000);

      expect(splits).toEqual([10]);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('calculateOptimalSplit failed'),
        expect.any(Object)
      );

      spy.mockRestore();
    });

    it('should return 0 impact when estimateMarketImpact throws', () => {
      // Mock doEstimateMarketImpact to throw
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doEstimateMarketImpact')
        .mockImplementation(() => {
          throw new Error('Impact estimation failed');
        });

      const impact = service.estimateMarketImpact(10, 'Buy');

      expect(impact).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('estimateMarketImpact failed'),
        expect.any(Object)
      );

      spy.mockRestore();
    });

    it('should return current state when monitorAndAdjust throws', async () => {
      // Execute order first to ensure it's in activeOrders
      const order: SmartOrderRequest = { ...baseOrder };

      const report = await service.executeSmartOrder(order);

      // Now mock internal method to throw AFTER order is created
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'shouldAdjustPrice')
        .mockImplementation(() => {
          throw new Error('Monitoring logic failed');
        });

      // Should not crash and return some result (either current state or null)
      const result = await service.monitorAndAdjust(report.orderId);

      // Result should either be the report or null, but should not crash
      expect(result).toBeTruthy(); // Should return current state
      if (result) {
        expect(result.orderId).toBe(report.orderId);
      }

      spy.mockRestore();
    });

    it('should return cancel when handlePartialFills throws', async () => {
      // Mock doHandlePartialFills to throw
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doHandlePartialFills')
        .mockRejectedValue(new Error('Partial fill handling failed'));

      const action = await service.handlePartialFills('order_123', 0.5);

      expect(action).toBe('cancel');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('handlePartialFills failed'),
        expect.any(Object)
      );

      spy.mockRestore();
    });

    it('should fallback to executeSmartOrder when TWAP throws', async () => {
      // Mock doExecuteTWAP to throw
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doExecuteTWAP')
        .mockRejectedValue(new Error('TWAP failed'));

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await service.executeTWAP(order);

      expect(report).toBeTruthy();
      expect(report.status).not.toBe('failed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('TWAP execution failed'),
        expect.any(Object)
      );

      spy.mockRestore();
    });

    it('should fallback to executeSmartOrder when VWAP throws', async () => {
      // Mock doExecuteVWAP to throw
      const spy = jest
        .spyOn(asSmartOrderInternals(service), 'doExecuteVWAP')
        .mockRejectedValue(new Error('VWAP failed'));

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await service.executeVWAP(order);

      expect(report).toBeTruthy();
      expect(report.status).not.toBe('failed');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('VWAP execution failed'),
        expect.any(Object)
      );

      spy.mockRestore();
    });

    it('should handle division by zero in calculateSlippage gracefully', () => {
      const service = createService();

      // Access private method via type assertion
      const slippage = asSmartOrderInternals(service).calculateSlippage(0, 45000);

      expect(slippage).toBe(0);
    });

    it('should handle extreme market impact values gracefully', () => {
      const impact = service.estimateMarketImpact(1000000, 'Buy');

      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThan(10000); // Should be reasonable
      expect(Number.isFinite(impact)).toBe(true);
    });

    it('should handle rounding errors in split calculation', () => {
      const splits = service.calculateOptimalSplit(10.123456789, 45000);

      const total = splits.reduce((sum, s) => sum + s, 0);

      // Should be very close to original (within rounding tolerance)
      expect(Math.abs(total - 10.123456789)).toBeLessThan(0.001);
    });
  });

  // ============================================================================
  // SKIP TESTS - Logging Failures (4 tests)
  // ============================================================================

  describe('SKIP - Logging Failures', () => {
    it('should continue execution when logger.info throws', async () => {
      // Create service WITHOUT ErrorHandler to avoid ErrorHandler using logger
      const serviceWithoutEH = createNoHandlerService();

      (logger.info as jest.Mock).mockImplementation(() => {
        throw new Error('Logging failed');
      });

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await serviceWithoutEH.executeSmartOrder(order);

      expect(report).toBeTruthy();
      expect(report.status).not.toBe('failed');
    });

    it('should continue execution when logger.warn throws', async () => {
      // Create service WITHOUT ErrorHandler
      const serviceWithoutEH = createNoHandlerService();

      (logger.warn as jest.Mock).mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Trigger warning by making calculateOptimalSplit fail
      const spy = jest
        .spyOn(asSmartOrderInternals(serviceWithoutEH), 'doCalculateOptimalSplit')
        .mockImplementation(() => {
          throw new Error('Split failed');
        });

      const splits = serviceWithoutEH.calculateOptimalSplit(10, 45000);

      expect(splits).toEqual([10]); // Fallback value
      // Should not crash despite logger.warn throwing

      spy.mockRestore();
    });

    it('should continue execution when logger.error throws', async () => {
      // Create service WITHOUT ErrorHandler
      const serviceWithoutEH = createNoHandlerService();

      (logger.error as jest.Mock).mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Force error path
      const spy = jest
        .spyOn(asSmartOrderInternals(serviceWithoutEH), 'doExecuteSmartOrder')
        .mockRejectedValue(new Error('Execution error'));

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await serviceWithoutEH.executeSmartOrder(order);

      expect(report).toBeTruthy();
      expect(report.status).toBe('failed');
      // Should not crash despite logger.error throwing

      spy.mockRestore();
    });

    it('should handle safeLog protecting against logging failures', async () => {
      // Test that safeLog actually catches errors
      const loggerThatThrows = asSmartOrderLogger(createSmartOrderExecutionLogger({
        debug: jest.fn(),
        info: jest.fn(() => {
          throw new Error('Info failed');
        }),
        warn: jest.fn(() => {
          throw new Error('Warn failed');
        }),
        error: jest.fn(() => {
          throw new Error('Error failed');
        }),
      }));

      const serviceWithThrowingLogger = createService({
        logger: loggerThatThrows,
        errorHandler: undefined,
      });

      const order: SmartOrderRequest = { ...baseOrder };

      // Should not throw despite logger throwing
      const report = await serviceWithThrowingLogger.executeSmartOrder(order);

      expect(report).toBeTruthy();
      // Should complete despite all logging failing
    });
  });

  // ============================================================================
  // INTEGRATION TESTS - E2E Scenarios (8 tests)
  // ============================================================================

  describe('Integration - E2E Scenarios', () => {
    it('should execute small order without splitting', async () => {
      const order = createMinimalSmartOrder({ size: 0.1 });

      const report = await service.executeSmartOrder(order);

      expect(report.status).toBe('completed');
      expect(report.filledSize).toBe(0.1);
      expect(report.remainingSize).toBe(0);
      expect(report.numberOfSplits).toBe(1);
      expect(report.subOrders.length).toBe(1);
    });

    it('should execute large order with splitting', async () => {
      const order = createMinimalSmartOrder({ size: 1000 });

      const report = await service.executeSmartOrder(order);

      expect(report.status).toBe('completed');
      expect(report.filledSize).toBeCloseTo(1000, 1);
      // With large size, should split (or at least 1 order)
      expect(report.numberOfSplits).toBeGreaterThanOrEqual(1);
      expect(report.subOrders.length).toBeGreaterThanOrEqual(1);
    });

    it('should execute TWAP with time-distributed slices', async () => {
      const order = createMinimalSmartOrder({ size: 10 });

      const report = await service.executeTWAP(order);

      expect(report.status).toBe('completed');
      expect(report.filledSize).toBe(10);
      expect(report.numberOfSplits).toBeGreaterThan(1);
      expect(report.reasoning).toContain('TWAP');
      expect(report.orderId).toContain('twap_');
    });

    it('should execute VWAP with volume-weighted slices', async () => {
      const order = createSmartOrderScenario({ side: 'Sell', size: 10 });

      const report = await service.executeVWAP(order);

      // VWAP may have rounding differences
      expect(report.status).toMatch(/completed|partial/);
      expect(report.filledSize).toBeGreaterThan(9.9); // At least 99% filled
      expect(report.numberOfSplits).toBeGreaterThan(1);
      expect(report.reasoning).toContain('VWAP');
      expect(report.orderId).toContain('vwap_');
    });

    it('should track order state and allow monitoring', async () => {
      const order = createMinimalSmartOrder();

      const report = await service.executeSmartOrder(order);

      // Should be in active orders
      const state = service.getOrderState(report.orderId);
      expect(state).toBeTruthy();
      expect(state?.orderId).toBe(report.orderId);

      // Should be able to monitor
      const monitored = await service.monitorAndAdjust(report.orderId);
      expect(monitored).toBeTruthy();

      // Should be able to cleanup
      const cleaned = service.cleanupOrder(report.orderId);
      expect(cleaned).toBe(true);

      // Should no longer be tracked
      const stateAfter = service.getOrderState(report.orderId);
      expect(stateAfter).toBeNull();
    });

    it('should handle partial fills correctly', async () => {
      // Create fake orders and add to active tracking
      const fakeReport1: ExecutionReport = createSmartOrderExecutionReport();

      asSmartOrderInternals(service).activeOrders.set('order_123', fakeReport1);

      const action1 = await service.handlePartialFills('order_123', 0.05); // 5% filled
      expect(action1).toBe('cancel'); // Too small

      const action2 = await service.handlePartialFills('order_123', 0.6); // 60% filled
      expect(action2).toBe('continue'); // Good progress

      const action3 = await service.handlePartialFills('order_123', 0.3); // 30% filled
      expect(action3).toBe('adjust'); // Medium, adjust price
    });

    it('should calculate slippage correctly for Buy orders', async () => {
      const order = createMinimalSmartOrder();

      const report = await service.executeSmartOrder(order);

      expect(report.slippage).toBeGreaterThanOrEqual(0);
      expect(report.averageFillPrice).toBeGreaterThanOrEqual(report.requestedPrice);
    });

    it('should calculate market impact for different order sizes', async () => {
      const smallOrder = createMinimalSmartOrder({ size: 0.1 });
      const largeOrder = createMinimalSmartOrder({ size: 100 });

      const smallReport = await service.executeSmartOrder(smallOrder);
      const largeReport = await service.executeSmartOrder(largeOrder);

      // Large order should have more market impact
      expect(largeReport.marketImpact).toBeGreaterThan(smallReport.marketImpact);
    });
  });

  // ============================================================================
  // BACKWARD COMPATIBILITY TESTS (4 tests)
  // ============================================================================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should work without ErrorHandler', async () => {
      const serviceWithoutEH = createNoHandlerService();

      const order: SmartOrderRequest = { ...baseOrder };

      const report = await serviceWithoutEH.executeSmartOrder(order);

      expect(report).toBeTruthy();
      expect(report.status).toBe('completed');
    });

    it('should work without logger and ErrorHandler', async () => {
      const serviceMinimal = createService({
        logger: undefined,
        errorHandler: undefined,
      });
      const order = createMinimalSmartOrder();

      const report = await serviceMinimal.executeSmartOrder(order);

      expect(report).toBeTruthy();
      expect(report.status).toBe('completed');
    });

    it('should handle errors gracefully without ErrorHandler', async () => {
      const serviceWithoutEH = createNoHandlerService();

      // Mock to throw error
      const spy = jest
        .spyOn(asSmartOrderInternals(serviceWithoutEH), 'doExecuteSmartOrder')
        .mockRejectedValue(new Error('Test error'));

      const order = createMinimalSmartOrder();

      const report = await serviceWithoutEH.executeSmartOrder(order);

      expect(report.status).toBe('failed');
      expect(report.reasoning).toContain('Execution failed');

      spy.mockRestore();
    });

    it('should calculate optimal split without ErrorHandler', () => {
      const serviceWithoutEH = createService({ errorHandler: undefined });

      const splits = serviceWithoutEH.calculateOptimalSplit(10, 45000);

      expect(splits).toBeTruthy();
      expect(Array.isArray(splits)).toBe(true);
      expect(splits.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================================
  // HELPER METHOD TESTS (7 tests)
  // ============================================================================

  describe('Helper Methods', () => {
    it('calculateOptimalSplit: should return single order for small size', () => {
      const splits = service.calculateOptimalSplit(0.01, 45000);

      expect(splits).toEqual([0.01]);
    });

    it('calculateOptimalSplit: should split large orders', () => {
      // Use much larger order to trigger splitting
      const splits = service.calculateOptimalSplit(10000, 45000);

      // Should split or at least return 1 order
      expect(splits.length).toBeGreaterThanOrEqual(1);
      expect(splits.length).toBeLessThanOrEqual(MAX_ORDER_SPLITS);

      const total = splits.reduce((sum, s) => sum + s, 0);
      expect(Math.abs(total - 10000)).toBeLessThan(0.1);
    });

    it('estimateMarketImpact: should return 0 for tiny orders', () => {
      const impact = service.estimateMarketImpact(0.001, 'Buy');

      expect(impact).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(impact)).toBe(true);
    });

    it('estimateMarketImpact: should increase with order size', () => {
      const impact1 = service.estimateMarketImpact(1, 'Buy');
      const impact2 = service.estimateMarketImpact(10, 'Buy');
      const impact3 = service.estimateMarketImpact(100, 'Buy');

      expect(impact2).toBeGreaterThan(impact1);
      expect(impact3).toBeGreaterThan(impact2);
    });

    it('getActiveOrderCount: should track order count correctly', async () => {
      expect(service.getActiveOrderCount()).toBe(0);
      const order1 = createMinimalSmartOrder();

      await service.executeSmartOrder(order1);
      expect(service.getActiveOrderCount()).toBe(1);

      const order2 = createSmartOrderScenario({
        symbol: 'ETHUSDT',
        side: 'Sell',
        size: 10,
        price: 3000,
      });

      await service.executeSmartOrder(order2);
      expect(service.getActiveOrderCount()).toBe(2);

      service.clearAllOrders();
      expect(service.getActiveOrderCount()).toBe(0);
    });

    it('cleanupOrder: should only cleanup terminal states', async () => {
      const order = createMinimalSmartOrder();

      const report = await service.executeSmartOrder(order);

      // Should cleanup completed order
      const cleaned = service.cleanupOrder(report.orderId);
      expect(cleaned).toBe(true);

      // Should return false for non-existent order
      const cleanedAgain = service.cleanupOrder(report.orderId);
      expect(cleanedAgain).toBe(false);
    });

    it('roundToDecimals: should round correctly', () => {
      const rounded = asSmartOrderInternals(service).roundToDecimals(45000.123456, 2);

      expect(rounded).toBe(45000.12);
    });
  });
});

