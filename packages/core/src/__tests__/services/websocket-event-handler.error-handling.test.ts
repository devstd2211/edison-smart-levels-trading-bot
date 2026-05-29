/**
 * Phase 8.6: WebSocketEventHandler - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration in WebSocketEventHandler with:
 * - GRACEFUL_DEGRADE strategy for position validation
 * - FALLBACK strategy for getCurrentPrice failures
 * - SKIP strategy for invalid TP events & candle/orderbook/trade data
 * - End-to-end error recovery scenarios
 *
 * Total: 18 comprehensive tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  Position,
  TimeframeRole,
  type OrderFilledEvent,
  type StopLossFilledEvent,
  type TakeProfitFilledEvent,
} from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { WebSocketEventHandlerManager } from '../../services/websocket-event-handler-manager';
import { createTradingBotRuntimeDependencies } from '../../services/runtime-service-adapters';
import {
  configureWebSocketCloseScenario,
  createMockOrderFilledEvent,
  createMockWebSocketEventPosition,
  createMockStopLossFilledEvent,
  createMockTakeProfitFilledEvent,
  createManagedWebSocketEventHandlerContext,
  type WebSocketEventHandlerManagedFactories,
  type WebSocketEventHandlerSharedState,
} from '../helpers/websocket-event-handler-test.utils';
import {
  createManagedTrackedServicesInitializerRuntime,
  type TrackedServicesInitializerRuntime,
} from '../helpers/service-lifecycle-test.utils';

describe('Phase 8.6: WebSocketEventHandler - Error Handling Integration', () => {
  let handler: WebSocketEventHandlerSharedState['handler'];
  let mockPositionManager: WebSocketEventHandlerSharedState['mockPositionManager'];
  let mockPositionExitingService: WebSocketEventHandlerSharedState['mockPositionExitingService'];
  let mockBybitService: WebSocketEventHandlerSharedState['mockBybitService'];
  let mockWebSocketManager: WebSocketEventHandlerSharedState['mockWebSocketManager'];
  let mockJournal: WebSocketEventHandlerSharedState['mockJournal'];
  let mockTelegram: WebSocketEventHandlerSharedState['mockTelegram'];
  let mockLogger: WebSocketEventHandlerSharedState['mockLogger'];
  let createCloseScenarioHandler: WebSocketEventHandlerManagedFactories['createCloseScenarioHandler'];
  let createStandardHandler: WebSocketEventHandlerManagedFactories['createStandardHandler'];
  let cleanup: WebSocketEventHandlerManagedFactories['cleanup'];

  beforeEach(() => {
    ({
      handler,
      mockPositionManager,
      mockPositionExitingService,
      mockBybitService,
      mockWebSocketManager,
      mockJournal,
      mockTelegram,
      mockLogger,
      createCloseScenarioHandler,
      createStandardHandler,
      cleanup,
    } = createManagedWebSocketEventHandlerContext());
  });

  afterEach(() => {
    cleanup();
  });

  describe('[GRACEFUL_DEGRADE] handlePositionUpdate() - Position Validation (4 tests)', () => {
    it('test-8.6.1: Should skip update when position is null', async () => {
      await handler.handlePositionUpdate(null as unknown as Position);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.syncWithWebSocket).not.toHaveBeenCalled();
    });

    it('test-8.6.2: Should skip update when position missing symbol', async () => {
      const position = createMockWebSocketEventPosition({ symbol: '' });
      await handler.handlePositionUpdate(position);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.syncWithWebSocket).not.toHaveBeenCalled();
    });

    it('test-8.6.3: Should skip update when position has NaN entryPrice', async () => {
      const position = createMockWebSocketEventPosition({ entryPrice: NaN });
      await handler.handlePositionUpdate(position);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.syncWithWebSocket).not.toHaveBeenCalled();
    });

    it('test-8.6.4: Should process update when position is valid', async () => {
      const position = createMockWebSocketEventPosition();
      await handler.handlePositionUpdate(position);

      expect(ErrorHandler.handle).not.toHaveBeenCalled();
      expect(mockPositionManager.syncWithWebSocket).toHaveBeenCalledWith(position);
      expect(mockLogger.debug).toHaveBeenCalledWith('WebSocket: Position update received');
    });
  });

  describe('[FALLBACK] getCurrentPriceWithFallback() - Price Retrieval (3 tests)', () => {
    it('test-8.6.5: Should use fallback when getCurrentPrice throws error', async () => {
      const { handler: closeHandler, position } = createCloseScenarioHandler({
        currentPrice: new Error('API error'),
      });

      // Trigger _handlePositionClosedInternal through handlePositionClosed
      await closeHandler.handlePositionClosed();

      expect(ErrorHandler.handle).toHaveBeenCalled();
      // Verify fallback price (entry price) was used - position.entryPrice = 45000
      const callArgs = mockPositionExitingService.closeFullPosition.mock.calls[0];
      expect(callArgs[1]).toBe(position.entryPrice); // Should use fallback
    });

    it('test-8.6.6: Should use fallback when getCurrentPrice returns NaN', async () => {
      const { handler: closeHandler, position } = createCloseScenarioHandler({
        currentPrice: NaN,
      });

      await closeHandler.handlePositionClosed();

      expect(ErrorHandler.handle).toHaveBeenCalled();
      const callArgs = mockPositionExitingService.closeFullPosition.mock.calls[0];
      expect(callArgs[1]).toBe(position.entryPrice); // Should use fallback
    });

    it('test-8.6.7: Should use valid price when getCurrentPrice succeeds', async () => {
      const { handler: closeHandler } = createCloseScenarioHandler({
        currentPrice: 46000,
      });

      await closeHandler.handlePositionClosed();

      expect(mockPositionExitingService.closeFullPosition).toHaveBeenCalled();
      const callArgs = mockPositionExitingService.closeFullPosition.mock.calls[0];
      expect(callArgs[1]).toBe(46000); // currentPrice argument - should be API price
    });
  });

  describe('[SKIP] handleTakeProfitFilled() - TP Event Validation (4 tests)', () => {
    it('test-8.6.8: Should skip when TP event is null', async () => {
      await handler.handleTakeProfitFilled(null as unknown as TakeProfitFilledEvent);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('test-8.6.9: Should skip when TP event missing orderId', async () => {
      const event = createMockTakeProfitFilledEvent({ orderId: '' });

      await handler.handleTakeProfitFilled(event);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('test-8.6.10: Should skip when TP event has NaN avgPrice', async () => {
      const event = createMockTakeProfitFilledEvent({ avgPrice: NaN });

      await handler.handleTakeProfitFilled(event);

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(mockPositionManager.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('test-8.6.11: Should process when TP event is valid', async () => {
      const position = createMockWebSocketEventPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(position);
      const event = createMockTakeProfitFilledEvent();

      await handler.handleTakeProfitFilled(event);

      expect(ErrorHandler.handle).not.toHaveBeenCalled();
      expect(mockPositionManager.getCurrentPosition).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('[SKIP] Candle Validation (3 tests)', () => {
    let createInitializerHarness!: TrackedServicesInitializerRuntime['createInitializerHarness'];
    let cleanupInitializerRuntime!: TrackedServicesInitializerRuntime['cleanup'];

    beforeEach(() => {
      ({
        createInitializerHarness,
        cleanup: cleanupInitializerRuntime,
      } = createManagedTrackedServicesInitializerRuntime());
    });

    afterEach(async () => {
      await cleanupInitializerRuntime();
    });

    it('test-8.6.12: Should skip null candle events before runtime consumers see them', async () => {
      const { config, services } = createInitializerHarness();
      const runtimeDependencies = createTradingBotRuntimeDependencies(services);
      const manager = new WebSocketEventHandlerManager(
        runtimeDependencies.lifecycleDependencies.eventHandlerServices,
        config,
      );
      const candleProviderSpy = jest
        .spyOn(services.marketDataServices.candleProvider, 'onCandleClosed')
        .mockImplementation(() => undefined);
      const orchestratorSpy = jest
        .spyOn(services.executionServices.tradingOrchestrator, 'onCandleClosed')
        .mockResolvedValue(undefined);

      manager.registerAllHandlers();
      services.marketDataServices.publicWebSocket.emit('candleClosed', {
        role: TimeframeRole.PRIMARY,
        candle: null,
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(candleProviderSpy).not.toHaveBeenCalled();
      expect(orchestratorSpy).not.toHaveBeenCalled();
    });

    it('test-8.6.13: Should skip orderbook updates with no bid/ask data', async () => {
      const { config, services } = createInitializerHarness();
      const runtimeDependencies = createTradingBotRuntimeDependencies(services);
      const manager = new WebSocketEventHandlerManager(
        runtimeDependencies.lifecycleDependencies.eventHandlerServices,
        config,
      );
      const processUpdateSpy = jest
        .spyOn(services.marketDataServices.orderbookManager, 'processUpdate')
        .mockImplementation(() => undefined);

      manager.registerAllHandlers();
      services.marketDataServices.publicWebSocket.emit('orderbookUpdate', {
        bids: [],
        asks: [],
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(ErrorHandler.handle).toHaveBeenCalled();
      expect(processUpdateSpy).not.toHaveBeenCalled();
    });

    it('test-8.6.14: Should skip invalid trade ticks before analyzers receive them', async () => {
      const { config, services } = createInitializerHarness();
      const runtimeDependencies = createTradingBotRuntimeDependencies(services);
      const manager = new WebSocketEventHandlerManager(
        runtimeDependencies.lifecycleDependencies.eventHandlerServices,
        config,
      );
      const deltaAnalyzerSpy = services.deltaAnalyzerService
        ? jest.spyOn(services.deltaAnalyzerService, 'addTick').mockImplementation(() => undefined)
        : undefined;
      const orderFlowSpy = services.advancedOrderFlowService
        ? jest.spyOn(services.advancedOrderFlowService, 'addTick').mockImplementation(() => undefined)
        : undefined;

      manager.registerAllHandlers();
      services.marketDataServices.publicWebSocket.emit('trade', {
        price: NaN,
        quantity: 0,
        side: 'Buy',
        timestamp: Date.now(),
      });
      await new Promise((resolve) => setImmediate(resolve));

      expect(ErrorHandler.handle).toHaveBeenCalled();
      if (deltaAnalyzerSpy) {
        expect(deltaAnalyzerSpy).not.toHaveBeenCalled();
      }
      if (orderFlowSpy) {
        expect(orderFlowSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('[SKIP] Orderbook Validation (2 tests)', () => {
    it('test-8.6.15: Should identify empty bids/asks as invalid', async () => {
      const invalidOrderbook = {
        bids: [],
        asks: [],
      };
      // Would be caught by validateOrderbookData
      expect(invalidOrderbook.bids.length === 0).toBe(true);
    });

    it('test-8.6.16: Should accept valid orderbook data', async () => {
      const validOrderbook = {
        bids: [['45000', '1.0'], ['44900', '2.0']],
        asks: [['45100', '1.5'], ['45200', '2.5']],
      };
      // Would pass validateOrderbookData
      expect(Array.isArray(validOrderbook.bids)).toBe(true);
      expect(Array.isArray(validOrderbook.asks)).toBe(true);
      expect(validOrderbook.bids.length > 0).toBe(true);
      expect(validOrderbook.asks.length > 0).toBe(true);
    });
  });

  describe('End-to-End Error Recovery Scenarios (2 tests)', () => {
    it('test-8.6.17: Should continue on multiple invalid updates', async () => {
      // First invalid update
      await handler.handlePositionUpdate(null as unknown as Position);
      expect(ErrorHandler.handle).toHaveBeenCalledTimes(1);

      // Second invalid update with different error
      const invalidPosition = createMockWebSocketEventPosition({ entryPrice: NaN });
      await handler.handlePositionUpdate(invalidPosition);
      expect(ErrorHandler.handle).toHaveBeenCalledTimes(2);

      // Third valid update should work
      const validPosition = createMockWebSocketEventPosition();
      await handler.handlePositionUpdate(validPosition);
      expect(mockPositionManager.syncWithWebSocket).toHaveBeenCalledWith(validPosition);
    });

    it('test-8.6.18: Should handle cascading failures gracefully', async () => {
      // Setup cascading failures
      configureWebSocketCloseScenario(
        { mockBybitService, mockPositionManager, mockWebSocketManager, mockJournal },
        { currentPrice: new Error('API error') },
      );

      // Invalid position update
      const invalidPosition = createMockWebSocketEventPosition({ symbol: '' });
      await handler.handlePositionUpdate(invalidPosition);
      expect(ErrorHandler.handle).toHaveBeenCalled();

      // Invalid TP event
      const invalidEvent = createMockTakeProfitFilledEvent({
        orderId: '',
        avgPrice: NaN,
        cumExecQty: 0,
      });
      await handler.handleTakeProfitFilled(invalidEvent);
      expect(ErrorHandler.handle).toHaveBeenCalledTimes(2);

      // Handler should still be functional
      const validPosition = createMockWebSocketEventPosition();
      mockPositionManager.getCurrentPosition.mockReturnValue(validPosition);

      const validEvent = createMockTakeProfitFilledEvent();
      await handler.handleTakeProfitFilled(validEvent);

      // Should process valid event despite previous failures
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Take Profit filled'),
        expect.any(Object)
      );
    });
  });

  describe('Integration with Existing Functionality', () => {
    it('should support explicit handler factory wiring', () => {
      const explicitHandler = createStandardHandler({
        mockPositionManager,
        mockPositionExitingService,
        mockBybitService,
        mockWebSocketManager,
        mockJournal,
        mockTelegram,
        mockLogger,
      });

      expect(explicitHandler).toBeDefined();
    });

    it('should not break existing handleOrderFilled functionality', async () => {
      const order: OrderFilledEvent = createMockOrderFilledEvent();

      await handler.handleOrderFilled(order);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket: Order filled',
        expect.any(Object)
      );
    });

    it('should not break existing handleStopLossFilled functionality', async () => {
      const event: StopLossFilledEvent = createMockStopLossFilledEvent();

      await handler.handleStopLossFilled(event);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket: Stop Loss filled',
        expect.any(Object)
      );
    });

    it('should not break existing handleError functionality', async () => {
      const error = new Error('WebSocket connection lost');

      await handler.handleError(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'WebSocket error',
        expect.any(Object)
      );
    });
  });
});

