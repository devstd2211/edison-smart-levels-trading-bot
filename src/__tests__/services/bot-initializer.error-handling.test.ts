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

import { BotInitializer } from '../../services/bot-initializer';
import { ErrorHandler, RecoveryStrategy, ErrorHandlingResult } from '../../errors/ErrorHandler';
import {
  ExchangeConnectionError,
  ExchangeRateLimitError,
  WebSocketConnectionError,
  PositionMonitoringError,
  ConfigurationError,
} from '../../errors/DomainErrors';

// ============================================================================
// MOCK SETUP
// ============================================================================

const createMockLogger = (): any => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

const createMinimalConfig = (): any => ({
  exchange: {
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    testnet: true,
    symbol: 'APEXUSDT',
    name: 'bybit',
  },
  trading: {
    leverage: 10,
    positionSizeUsdt: 100,
    maxConcurrentPositions: 1,
  },
  riskManagement: {
    stopLossPercent: 2,
    maxDailyLossPercent: 5,
  },
  indicators: {
    atrPeriod: 14,
    fastEmaPeriod: 5,
    slowEmaPeriod: 20,
    rsiPeriod: 14,
    zigzagDepth: 5,
  },
  timeframes: {
    entry: { interval: '1', candleLimit: 100, enabled: true },
    primary: { interval: '5', candleLimit: 100, enabled: true },
    trend1: { interval: '15', candleLimit: 100, enabled: true },
    trend2: { interval: '60', candleLimit: 100, enabled: false },
    context: { interval: '240', candleLimit: 100, enabled: false },
  },
  logging: {
    level: 'info',
    logDir: './logs',
  },
  system: {
    timeSyncIntervalMs: 60000,
    timeSyncMaxFailures: 3,
  },
  atrFilter: { enabled: false, period: 14, minimumATR: 0.01, maximumATR: 100 },
  dataSubscriptions: {
    candles: { enabled: true, calculateIndicators: true },
    orderbook: { enabled: true, updateIntervalMs: 100 },
    ticks: { enabled: true, calculateDelta: true },
  },
  strategies: {} as any,
  entryConfirmation: {} as any,
  telegram: { enabled: false },
  analysisConfig: {},
  strategicWeights: {},
  tradeHistory: {},
  strategy: {} as any,
});

const createMockBotServices = (): any => ({
  logger: createMockLogger(),
  bybitService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    resyncTime: jest.fn().mockResolvedValue(undefined),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
    getOpenPositions: jest.fn().mockResolvedValue([]),
  },
  sessionStats: {
    startSession: jest.fn().mockReturnValue('session-123'),
    endSession: jest.fn(),
  },
  timeService: {
    syncWithExchange: jest.fn().mockResolvedValue(undefined),
    getSyncInfo: jest.fn().mockReturnValue({
      offset: 0,
      nextSyncIn: 60000,
    }),
  },
  candleProvider: {
    initialize: jest.fn().mockResolvedValue(undefined),
  },
  webSocketManager: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  publicWebSocket: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  positionMonitor: {
    start: jest.fn(),
    stop: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  positionManager: {
    getCurrentPosition: jest.fn().mockReturnValue(null),
    syncWithWebSocket: jest.fn(),
  },
  telegram: {
    notifyBotStopped: jest.fn().mockResolvedValue(undefined),
  },
});

const createMockErrorHandler = (): jest.Mocked<ErrorHandler> => {
  return {
    handle: jest.fn(async (operation, options) => {
      // Default mock - can be overridden per test
      return {
        success: true,
        recovered: false,
        attempts: 1,
        message: 'Handled',
        strategy: options.strategy || RecoveryStrategy.SKIP,
        error: undefined,
      } as ErrorHandlingResult;
    }),
    getLogger: jest.fn(() => createMockLogger()),
  } as unknown as jest.Mocked<ErrorHandler>;
};

// ============================================================================
// SECTION A: initialize() - RETRY and THROW (5 tests)
// ============================================================================

describe('BotInitializer Error Handling (Phase 8.9.7)', () => {
  let initializer: BotInitializer;
  let mockServices: any;
  let mockConfig: any;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    mockServices = createMockBotServices();
    mockConfig = createMinimalConfig();
    mockErrorHandler = createMockErrorHandler();
    initializer = new BotInitializer(mockServices, mockConfig, mockErrorHandler);

    jest.clearAllMocks();
  });

  describe('A: initialize() - Critical Operations with RETRY/GRACEFUL_DEGRADE', () => {
    test('A1: Bybit init fails with network error → retries 3x → throws', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      let callCount = 0;
      mockServices.bybitService.initialize.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(networkError);
        }
        return Promise.reject(networkError); // Fail all times
      });

      await expect(initializer.initialize()).rejects.toThrow(ExchangeConnectionError);

      // Verify retry attempts
      expect(mockServices.bybitService.initialize).toHaveBeenCalledTimes(3);
    }, 30000);

    test('A2: Session stats fails → gracefully degrades → continues', async () => {
      const sessionStatsError = new Error('Stats service unavailable');
      mockServices.sessionStats.startSession.mockImplementationOnce(() => {
        throw sessionStatsError;
      });

      // Should not throw, should continue
      await expect(initializer.initialize()).resolves.not.toThrow();

      // Verify other services still called
      expect(mockServices.bybitService.initialize).toHaveBeenCalled();
      expect(mockServices.timeService.syncWithExchange).toHaveBeenCalled();
    });

    test('A3: Successful initialization → all components called in order', async () => {
      const callOrder: string[] = [];

      mockServices.bybitService.initialize.mockImplementation(() => {
        callOrder.push('bybitService.initialize');
        return Promise.resolve();
      });
      mockServices.sessionStats.startSession.mockImplementation(() => {
        callOrder.push('sessionStats.startSession');
        return 'session-123';
      });
      mockServices.timeService.syncWithExchange.mockImplementation(() => {
        callOrder.push('timeService.syncWithExchange');
        return Promise.resolve();
      });
      mockServices.candleProvider.initialize.mockImplementation(() => {
        callOrder.push('candleProvider.initialize');
        return Promise.resolve();
      });

      await initializer.initialize();

      expect(callOrder).toEqual([
        'bybitService.initialize',
        'sessionStats.startSession',
        'timeService.syncWithExchange',
        'candleProvider.initialize',
      ]);
    });

    test('A4: Error classification - network errors → ExchangeConnectionError', async () => {
      const networkError = new Error('ECONNREFUSED: Connection refused');
      mockServices.bybitService.initialize.mockRejectedValue(networkError);

      try {
        await initializer.initialize();
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ExchangeConnectionError);
      }
    }, 30000);

    test('A5: Error classification - rate limit errors → ExchangeRateLimitError', async () => {
      mockServices.bybitService.initialize.mockResolvedValue(undefined);
      const rateLimitError = new Error('Rate limit exceeded: 429');
      mockServices.timeService.syncWithExchange.mockRejectedValue(rateLimitError);

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
      jest.spyOn(initializer as any, 'initializeTrendAnalysisAfterWebSocket')
        .mockResolvedValue(undefined);
    });

    test('B1: Private WS connection fails → retries 3x → throws', async () => {
      const wsError = new Error('ws:// connection failed');
      mockServices.webSocketManager.connect.mockImplementation(() => {
        throw wsError;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(WebSocketConnectionError);

      // Verify retry attempts for private WS
      expect(mockServices.webSocketManager.connect).toHaveBeenCalledTimes(3);
    }, 30000);

    test('B2: Public WS connection fails → retries 3x → throws', async () => {
      const wsError = new Error('ws:// connection failed');

      // First call succeeds (private WS)
      mockServices.webSocketManager.connect.mockImplementation(() => {
        // Success
      });

      // Second call fails (public WS)
      mockServices.publicWebSocket.connect.mockImplementation(() => {
        throw wsError;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(WebSocketConnectionError);

      // Verify retry attempts for public WS
      expect(mockServices.publicWebSocket.connect).toHaveBeenCalledTimes(3);
    }, 30000);

    test('B3: Both WS succeed on first attempt → trend analysis called', async () => {
      // Both succeed
      mockServices.webSocketManager.connect.mockImplementation(() => {
        // Success
      });
      mockServices.publicWebSocket.connect.mockImplementation(() => {
        // Success
      });

      const trendAnalysisSpy = jest
        .spyOn(initializer as any, 'initializeTrendAnalysisAfterWebSocket')
        .mockResolvedValue(undefined);

      await initializer.connectWebSockets();

      // Verify both WS called once
      expect(mockServices.webSocketManager.connect).toHaveBeenCalledTimes(1);
      expect(mockServices.publicWebSocket.connect).toHaveBeenCalledTimes(1);

      // Verify trend analysis was called
      expect(trendAnalysisSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION C: startMonitoring() - Position Monitor with RETRY (2 tests)
  // ============================================================================

  describe('C: startMonitoring() - Position Monitor with RETRY', () => {
    test('C1: Position monitor fails to start → retries 3x → throws', async () => {
      const monitorError = new Error('Monitor initialization failed');
      mockServices.positionMonitor.start.mockImplementation(() => {
        throw monitorError;
      });

      await expect(initializer.startMonitoring()).rejects.toThrow(PositionMonitoringError);

      // Verify retry attempts
      expect(mockServices.positionMonitor.start).toHaveBeenCalledTimes(3);
    }, 30000);

    test('C2: Monitor starts successfully on first attempt', async () => {
      mockServices.positionMonitor.start.mockImplementation(() => {
        // Success
      });

      await initializer.startMonitoring();

      // Verify called once
      expect(mockServices.positionMonitor.start).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // SECTION D: shutdown() - SKIP Strategy (2 tests)
  // ============================================================================

  describe('D: shutdown() - All Operations with SKIP Strategy', () => {
    test('D1: Multiple component failures during shutdown → all skipped → completes', async () => {
      // Make all shutdown operations fail
      mockServices.positionMonitor.stop.mockImplementationOnce(() => {
        throw new Error('Monitor stop failed');
      });
      mockServices.webSocketManager.disconnect.mockImplementationOnce(() => {
        throw new Error('WS disconnect failed');
      });
      mockServices.sessionStats.endSession.mockImplementationOnce(() => {
        throw new Error('Session end failed');
      });

      // Shutdown should complete despite all failures
      await expect(initializer.shutdown()).resolves.not.toThrow();

      // Verify all operations were attempted
      expect(mockServices.positionMonitor.stop).toHaveBeenCalled();
      expect(mockServices.webSocketManager.disconnect).toHaveBeenCalled();
      expect(mockServices.sessionStats.endSession).toHaveBeenCalled();
    });

    test('D2: Telegram notification fails → skipped → shutdown completes', async () => {
      mockServices.telegram.notifyBotStopped.mockRejectedValueOnce(
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
      mockServices.sessionStats.startSession.mockImplementationOnce(() => {
        throw new Error('Stats unavailable');
      });

      await initializer.initialize();

      // Verify continued despite stats error
      expect(mockServices.bybitService.initialize).toHaveBeenCalled();
      expect(mockServices.timeService.syncWithExchange).toHaveBeenCalled();
      expect(mockServices.candleProvider.initialize).toHaveBeenCalled();
    });

    test('E2: Full lifecycle with shutdown skipping errors', async () => {
      // All shutdown operations fail
      mockServices.positionMonitor.stop.mockImplementationOnce(() => {
        throw new Error('Monitor stop failed');
      });
      mockServices.webSocketManager.disconnect.mockImplementationOnce(() => {
        throw new Error('WS disconnect failed');
      });

      // Shutdown should still complete
      await expect(initializer.shutdown()).resolves.not.toThrow();

      // Verify all operations were attempted
      expect(mockServices.positionMonitor.stop).toHaveBeenCalled();
      expect(mockServices.webSocketManager.disconnect).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SECTION F: Backward Compatibility (1 test)
  // ============================================================================

  describe('F: Backward Compatibility (without ErrorHandler)', () => {
    test('F1: Service works without ErrorHandler → errors propagate as before', async () => {
      // Create initializer without error handler
      const initWithoutHandler = new BotInitializer(mockServices, mockConfig, undefined);

      // Make Bybit fail
      mockServices.bybitService.initialize.mockRejectedValueOnce(
        new Error('Initialization failed'),
      );

      // Should throw the error directly
      await expect(initWithoutHandler.initialize()).rejects.toThrow('Initialization failed');
    });
  });
});
