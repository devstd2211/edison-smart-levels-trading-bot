/**
 * BotInitializer Error Handling Tests (Phase 8.9.7)
 *
 * Comprehensive test suite for BotInitializerService error handling:
 * - Critical initialization with RETRY strategy (Bybit, TimeSync, CandleProvider)
 * - Non-critical operations with GRACEFUL_DEGRADE (SessionStats)
 * - WebSocket connections with RETRY strategy
 * - Position monitoring with RETRY strategy
 * - Shutdown operations with SKIP strategy
 * - E2E scenarios with cascading failures
 * - Backward compatibility (without ErrorHandler)
 */

import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  ExchangeConnectionError,
  ExchangeRateLimitError,
  WebSocketConnectionError,
  PositionMonitoringError,
} from '../../errors/DomainErrors';
import {
  asBotInitializerMock,
  type BotInitializerErrorHandlingState,
  createBotInitializerMockErrorHandler,
  createManagedBotInitializerTestContext,
} from '../helpers/bot-initializer-test.utils';
import type { IBotInitializerServices } from '../../interfaces';

// ============================================================================
// MOCK SETUP
// ============================================================================

type MockInitializerServices = IBotInitializerServices;
type BotInitializerInternals = {
  initializeTrendAnalysisAfterWebSocket: () => Promise<void>;
};
// ============================================================================
// SECTION A: initialize() - RETRY and THROW (5 tests)
// ============================================================================

describe('BotInitializer Error Handling (Phase 8.9.7)', () => {
  let initializer: ReturnType<BotInitializerErrorHandlingState['rebuild']>;
  let mockServices: MockInitializerServices;
  let config: BotInitializerErrorHandlingState['config'];
  let errorHandler: BotInitializerErrorHandlingState['errorHandler'];
  let rebuild: BotInitializerErrorHandlingState['rebuild'];
  let createWithoutHandler: BotInitializerErrorHandlingState['createWithoutHandler'];
  let cleanup: BotInitializerErrorHandlingState['cleanup'];

  beforeEach(() => {
    ({
      services: mockServices,
      config,
      errorHandler,
      rebuild,
      createWithoutHandler,
      cleanup,
    } = createManagedBotInitializerTestContext({
      errorHandler: createBotInitializerMockErrorHandler(),
    }));
    initializer = rebuild({
      services: mockServices,
      config,
      errorHandler: errorHandler as jest.Mocked<ErrorHandler>,
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('A: initialize() - Critical Operations with RETRY/GRACEFUL_DEGRADE', () => {
    test('A1: Bybit init fails with network error -> retries 3x -> throws', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      let callCount = 0;
      asBotInitializerMock(mockServices.exchangeRuntime.current.initialize).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(networkError);
        }
        return Promise.reject(networkError); // Fail all times
      });

      await expect(initializer.initialize()).rejects.toThrow(ExchangeConnectionError);

      // Verify retry attempts
      expect(mockServices.exchangeRuntime.current.initialize).toHaveBeenCalledTimes(3);
    }, 30000);

    test('A2: Session stats fails -> gracefully degrades -> continues', async () => {
      const sessionStatsError = new Error('Stats service unavailable');
      asBotInitializerMock(mockServices.sessionStats.startSession).mockImplementationOnce(() => {
        throw sessionStatsError;
      });

      // Should not throw, should continue
      await expect(initializer.initialize()).resolves.not.toThrow();

      // Verify other services still called
      expect(mockServices.exchangeRuntime.current.initialize).toHaveBeenCalled();
      expect(mockServices.coreServices.timeService.syncWithExchange).toHaveBeenCalled();
    });

    test('A3: Successful initialization -> all components called in order', async () => {
      const callOrder: string[] = [];

      asBotInitializerMock(mockServices.exchangeRuntime.current.initialize).mockImplementation(() => {
        callOrder.push('bybitService.initialize');
        return Promise.resolve();
      });
      asBotInitializerMock(mockServices.journal.start).mockImplementation(() => {
        callOrder.push('journal.start');
      });
      asBotInitializerMock(mockServices.sessionStats.start).mockImplementation(() => {
        callOrder.push('sessionStats.start');
      });
      asBotInitializerMock(mockServices.sessionStats.startSession).mockImplementation(() => {
        callOrder.push('sessionStats.startSession');
        return 'session-123';
      });
      asBotInitializerMock(mockServices.coreServices.timeService.syncWithExchange).mockImplementation(() => {
        callOrder.push('timeService.syncWithExchange');
        return Promise.resolve();
      });
      asBotInitializerMock(mockServices.marketDataServices.candleProvider.initialize).mockImplementation(() => {
        callOrder.push('candleProvider.initialize');
        return Promise.resolve();
      });
      asBotInitializerMock(mockServices.executionServices.tradingOrchestrator.start).mockImplementation(() => {
        callOrder.push('tradingOrchestrator.start');
        return Promise.resolve();
      });

      await initializer.initialize();

      expect(callOrder).toEqual([
        'bybitService.initialize',
        'journal.start',
        'sessionStats.start',
        'sessionStats.startSession',
        'timeService.syncWithExchange',
        'candleProvider.initialize',
        'tradingOrchestrator.start',
      ]);
    });

    test('A4: Error classification - network errors -> ExchangeConnectionError', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      asBotInitializerMock(mockServices.exchangeRuntime.current.initialize).mockRejectedValue(networkError);

      try {
        await initializer.initialize();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExchangeConnectionError);
      }
    }, 30000);

    test('A5: Error classification - rate limit errors -> ExchangeRateLimitError', async () => {
      asBotInitializerMock(mockServices.exchangeRuntime.current.initialize).mockResolvedValue(undefined);
      const rateLimitError = new Error('Rate limit exceeded: 429');
      asBotInitializerMock(mockServices.coreServices.timeService.syncWithExchange).mockRejectedValue(rateLimitError);

      try {
        await initializer.initialize();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExchangeRateLimitError);
      }
    }, 30000);
  });

  // ============================================================================
  // SECTION B: connectWebSockets() - RETRY (3 tests)
  // ============================================================================

  describe('B: connectWebSockets() - WebSocket Connection with RETRY', () => {
    beforeEach(() => {
      jest.spyOn(initializer as unknown as BotInitializerInternals, 'initializeTrendAnalysisAfterWebSocket')
        .mockResolvedValue(undefined);
    });

    test('B1: Private WS connection fails -> retries 3x -> throws', async () => {
      const wsError = new Error('ws:// connection failed');
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.start).mockImplementation(() => {
        throw wsError;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(WebSocketConnectionError);

      // Verify retry attempts for private WS
      expect(mockServices.marketDataServices.webSocketManager.start).toHaveBeenCalledTimes(3);
    }, 30000);

    test('B2: Public WS connection fails -> retries 3x -> throws', async () => {
      const wsError = new Error('ws:// connection failed');

      // First call succeeds (private WS)
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.start).mockImplementation(() => {
        // Success
      });

      // Second call fails (public WS)
      asBotInitializerMock(mockServices.marketDataServices.publicWebSocket.start).mockImplementation(() => {
        throw wsError;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(WebSocketConnectionError);

      // Verify retry attempts for public WS
      expect(mockServices.marketDataServices.publicWebSocket.start).toHaveBeenCalledTimes(3);
    }, 30000);

    test('B3: Both WS succeed on first attempt -> trend analysis called', async () => {
      // Both succeed
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.start).mockImplementation(() => {
        // Success
      });
      asBotInitializerMock(mockServices.marketDataServices.publicWebSocket.start).mockImplementation(() => {
        // Success
      });

      const trendAnalysisSpy = jest
        .spyOn(initializer as unknown as BotInitializerInternals, 'initializeTrendAnalysisAfterWebSocket')
        .mockResolvedValue(undefined);

      await initializer.connectWebSockets();

      // Verify both WS called once
      expect(mockServices.marketDataServices.webSocketManager.start).toHaveBeenCalledTimes(1);
      expect(mockServices.marketDataServices.publicWebSocket.start).toHaveBeenCalledTimes(1);

      // Verify trend analysis was called
      expect(trendAnalysisSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION C: startMonitoring() - Position Monitor with RETRY (2 tests)
  // ============================================================================

  describe('C: startMonitoring() - Position Monitor with RETRY', () => {
    test('C1: Position monitor fails to start -> retries 3x -> throws', async () => {
      const monitorError = new Error('Monitor initialization failed');
      asBotInitializerMock(mockServices.executionServices.positionMonitor.start).mockImplementation(() => {
        throw monitorError;
      });

      await expect(initializer.startMonitoring()).rejects.toThrow(PositionMonitoringError);

      // Verify retry attempts
      expect(mockServices.executionServices.positionMonitor.start).toHaveBeenCalledTimes(3);
    }, 30000);

    test('C2: Monitor starts successfully on first attempt', async () => {
      asBotInitializerMock(mockServices.executionServices.positionMonitor.start).mockImplementation(() => {
        // Success
      });

      await initializer.startMonitoring();

      // Verify called once
      expect(mockServices.executionServices.positionMonitor.start).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // SECTION D: shutdown() - SKIP Strategy (2 tests)
  // ============================================================================

  describe('D: shutdown() - All Operations with SKIP Strategy', () => {
    test('D1: Multiple component failures during shutdown -> all skipped -> completes', async () => {
      // Make all shutdown operations fail
      asBotInitializerMock(mockServices.executionServices.positionMonitor.stop).mockImplementationOnce(() => {
        throw new Error('Monitor stop failed');
      });
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.stop).mockImplementationOnce(() => {
        throw new Error('WS disconnect failed');
      });
      asBotInitializerMock(mockServices.sessionStats.endSession).mockImplementationOnce(() => {
        throw new Error('Session end failed');
      });

      // Shutdown should complete despite all failures
      await expect(initializer.shutdown()).resolves.not.toThrow();

      // Verify all operations were attempted
      expect(mockServices.executionServices.positionMonitor.stop).toHaveBeenCalled();
      expect(mockServices.marketDataServices.webSocketManager.stop).toHaveBeenCalled();
      expect(mockServices.sessionStats.endSession).toHaveBeenCalled();
    });

    test('D2: Telegram notification fails -> skipped -> shutdown completes', async () => {
      asBotInitializerMock(mockServices.coreServices.telegram.notifyBotStopped).mockRejectedValueOnce(
        new Error('Telegram API error'),
      );

      // Shutdown should complete despite telegram failure
      await expect(initializer.shutdown()).resolves.not.toThrow();

      // Verify shutdown continued after telegram error
      expect(mockServices.sessionStats.endSession).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION E: E2E Recovery Scenarios (2 tests)
  // ============================================================================

  describe('E: E2E Recovery Scenarios', () => {
    test('E1: Initialization with graceful degradation', async () => {
      // Session stats fails but continues
      asBotInitializerMock(mockServices.sessionStats.startSession).mockImplementationOnce(() => {
        throw new Error('Stats unavailable');
      });

      await initializer.initialize();

      // Verify continued despite stats error
      expect(mockServices.exchangeRuntime.current.initialize).toHaveBeenCalled();
      expect(mockServices.coreServices.timeService.syncWithExchange).toHaveBeenCalled();
      expect(mockServices.marketDataServices.candleProvider.initialize).toHaveBeenCalled();
    });

    test('E2: Full lifecycle with shutdown skipping errors', async () => {
      // All shutdown operations fail
      asBotInitializerMock(mockServices.executionServices.positionMonitor.stop).mockImplementationOnce(() => {
        throw new Error('Monitor stop failed');
      });
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.stop).mockImplementationOnce(() => {
        throw new Error('WS disconnect failed');
      });

      // Shutdown should still complete
      await expect(initializer.shutdown()).resolves.not.toThrow();

      // Verify all operations were attempted
      expect(mockServices.executionServices.positionMonitor.stop).toHaveBeenCalled();
      expect(mockServices.marketDataServices.webSocketManager.stop).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION F: Backward Compatibility (1 test)
  // ============================================================================

  describe('F: Backward Compatibility (without ErrorHandler)', () => {
    test('F1: Service works without ErrorHandler -> errors propagate as before', async () => {
      const initWithoutHandler = createWithoutHandler();

      // Make Bybit fail
      asBotInitializerMock(mockServices.exchangeRuntime.current.initialize).mockRejectedValueOnce(
        new Error('Initialization failed'),
      );

      // Should throw the error directly
      await expect(initWithoutHandler.initialize()).rejects.toThrow('Initialization failed');
    });
  });
});


