/**
 * BotInitializer Tests
 *
 * Tests for bot lifecycle management (initialization and shutdown).
 * Covers:
 * - Component initialization in correct order
 * - WebSocket connection setup
 * - Position monitoring and periodic tasks
 * - Graceful shutdown with cleanup
 * - Error handling
 */

import { BotInitializer } from '../services/bot-initializer';
import type { Config } from '../types/legacy';
import { OrderType, LogLevel } from '../types/legacy';
import type { IBotInitializerServices } from '../interfaces';
import type { LoggerService } from '../services/logger.service';

// Mock logger
type LoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error' | 'getLogFilePath'>;

const createMockLogger = (): LoggerLike => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

const asMock = (fn: unknown): jest.Mock => fn as jest.Mock;

// Minimal valid config
const createMinimalConfig = (): Config => ({
    exchange: {
      name: 'bybit',
      timeframe: '1',
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      demo: false,
      testnet: true,
      symbol: 'APEXUSDT',
    },
    trading: {
      leverage: 10,
      riskPercent: 1,
      maxPositions: 1,
      positionSizeUsdt: 100,
      tradingCycleIntervalMs: 1000,
      orderType: OrderType.MARKET,
      tradingFeeRate: 0.0002,
      favorableMovementThresholdPercent: 0.1,
    },
    riskManagement: {
      stopLossPercent: 2,
      minStopLossPercent: 1,
      breakevenOffsetPercent: 0.3,
      trailingStopEnabled: false,
      trailingStopPercent: 1,
      trailingStopActivationLevel: 2,
      positionSizeUsdt: 100,
      takeProfits: [
        { level: 1, percent: 0.5, sizePercent: 100 },
      ],
    },
    indicators: {
      atrPeriod: 14,
      fastEmaPeriod: 5,
      slowEmaPeriod: 20,
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      zigzagDepth: 5,
      zigzagDeviation: 5,
    },
    timeframes: {
      entry: { interval: '1', candleLimit: 100, enabled: true },
      primary: { interval: '5', candleLimit: 100, enabled: true },
      trend1: { interval: '15', candleLimit: 100, enabled: true },
      trend2: { interval: '60', candleLimit: 100, enabled: false },
      context: { interval: '240', candleLimit: 100, enabled: false },
    },
    logging: {
      level: LogLevel.INFO,
      logDir: './logs',
      logToFile: false,
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
    strategies: {} as Config['strategies'],
    entryConfirmation: {} as Config['entryConfirmation'],
    entryConfig: {
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      fastEmaPeriod: 5,
      slowEmaPeriod: 20,
      zigzagDepth: 5,
      divergenceDetector: {
        minStrength: 0.5,
        priceDiffPercent: 0.5,
      },
    },
    telegram: { enabled: false },
    analysisConfig: {} as Config['analysisConfig'],
    strategicWeights: {} as Config['strategicWeights'],
    tradeHistory: {} as Config['tradeHistory'],
    strategy: {} as Config['strategy'],
  } as Config);

// Create mock services bundle
const createMockBotServices = (): IBotInitializerServices => {
  const logger = createMockLogger();

  return {
    coreServices: {
      logger: logger as unknown as LoggerService,
      timeService: {
        syncWithExchange: jest.fn().mockResolvedValue(undefined),
        getSyncInfo: jest.fn().mockReturnValue({
          offset: 0,
          nextSyncIn: 60000,
        }),
      },
      telegram: {
        notifyBotStopped: jest.fn().mockResolvedValue(undefined),
      },
      eventBus: {
        emit: jest.fn(),
      },
    },
    publicWebSocket: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      removeAllListeners: jest.fn(),
    },
    marketDataServices: {
      bybitService: {
        initialize: jest.fn().mockResolvedValue(undefined),
        resyncTime: jest.fn().mockResolvedValue(undefined),
        cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
        getOpenPositions: jest.fn().mockResolvedValue([]),
        getCandles: jest.fn().mockResolvedValue([]),
      },
      candleProvider: {
        initialize: jest.fn().mockResolvedValue(undefined),
      },
      orderbookManager: {
        getSnapshot: jest.fn().mockReturnValue(null),
      } as unknown as IBotInitializerServices['marketDataServices']['orderbookManager'],
      webSocketManager: {
        connect: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
      },
      publicWebSocket: {
        connect: jest.fn(),
        disconnect: jest.fn(),
        removeAllListeners: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        setBtcCandlesStore: jest.fn(),
      },
    },
    positionManager: {
      syncWithWebSocket: jest.fn(),
      getCurrentPosition: jest.fn().mockReturnValue(null),
    },
    executionServices: {
      positionMonitor: {
        start: jest.fn(),
        stop: jest.fn(),
        removeAllListeners: jest.fn(),
      },
      positionManager: {
        getCurrentPosition: jest.fn().mockReturnValue(null),
        syncWithWebSocket: jest.fn(),
      },
      positionExitingService: {
        cancelAllOrders: jest.fn(),
      },
      tradingOrchestrator: {
        initializeTrendAnalysis: jest.fn().mockResolvedValue(undefined),
      },
    },
    sessionStats: {
      startSession: jest.fn().mockReturnValue('session-123'),
      endSession: jest.fn(),
    },
    candleProvider: {
      initialize: jest.fn().mockResolvedValue(undefined),
    },
    btcCandles1m: [],
  } as unknown as IBotInitializerServices;
};

describe('BotInitializer', () => {
  let initializer: BotInitializer;
  let mockServices: IBotInitializerServices;
  let mockConfig: Config;

  beforeEach(() => {
    mockServices = createMockBotServices();
    mockConfig = createMinimalConfig();
    initializer = new BotInitializer(mockServices, mockConfig);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should initialize all components in correct order', async () => {
      const callOrder: string[] = [];

      // Track call order
      asMock(mockServices.marketDataServices.bybitService.initialize).mockImplementation(() => {
        callOrder.push('bybitService.initialize');
        return Promise.resolve();
      });
      asMock(mockServices.sessionStats.startSession).mockImplementation(() => {
        callOrder.push('sessionStats.startSession');
        return 'session-123';
      });
      asMock(mockServices.coreServices.timeService.syncWithExchange).mockImplementation(() => {
        callOrder.push('timeService.syncWithExchange');
        return Promise.resolve();
      });
      asMock(mockServices.marketDataServices.candleProvider.initialize).mockImplementation(() => {
        callOrder.push('candleProvider.initialize');
        return Promise.resolve();
      });

      await initializer.initialize();

      // Verify order: Bybit → SessionStats → TimeService → CandleProvider
      expect(callOrder).toEqual([
        'bybitService.initialize',
        'sessionStats.startSession',
        'timeService.syncWithExchange',
        'candleProvider.initialize',
      ]);
    });

    it('should log initialization start and completion', async () => {
      await initializer.initialize();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('🚀 Starting bot initialization sequence...');
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        '✅ Bot initialization complete - ready to connect WebSockets',
      );
    });

    it('should skip candle provider when disabled', async () => {
      mockConfig.dataSubscriptions.candles.enabled = false;
      initializer = new BotInitializer(mockServices, mockConfig);

      await initializer.initialize();

      expect(mockServices.marketDataServices.candleProvider.initialize).not.toHaveBeenCalled();
      expect(mockServices.coreServices.logger.warn).toHaveBeenCalledWith(
        '⚠️ Candles disabled - strategies may not work correctly!',
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Bybit initialization failed');
      asMock(mockServices.marketDataServices.bybitService.initialize).mockRejectedValue(error);

      await expect(initializer.initialize()).rejects.toThrow('Bybit initialization failed');
      expect(mockServices.coreServices.logger.error).toHaveBeenCalledWith('Failed to initialize bot', {
        error: 'Bybit initialization failed',
      });
    });

    it('should sync time with exchange', async () => {
      await initializer.initialize();

      expect(mockServices.coreServices.timeService.syncWithExchange).toHaveBeenCalled();
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('Time synchronized', {
        offset: 0,
        nextSyncIn: '60s',
      });
    });
  });

  describe('connectWebSockets()', () => {
    it('should connect both private and public websockets', async () => {
      await initializer.connectWebSockets();

      expect(mockServices.marketDataServices.webSocketManager.connect).toHaveBeenCalled();
      expect(mockServices.marketDataServices.publicWebSocket.connect).toHaveBeenCalled();
    });

    it('should log connection status', async () => {
      await initializer.connectWebSockets();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('📡 Connecting WebSocket connections...');
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('✅ WebSocket connections established');
    });

    it('should handle connection errors', async () => {
      const error = new Error('WebSocket connection failed');
      asMock(mockServices.marketDataServices.webSocketManager.connect).mockImplementation(() => {
        throw error;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(
        'WebSocket connection failed',
      );
      expect(mockServices.coreServices.logger.error).toHaveBeenCalledWith('Failed to connect WebSockets', {
        error: 'WebSocket connection failed',
      });
    });
  });

  describe('startMonitoring()', () => {
    it('should start position monitor', async () => {
      await initializer.startMonitoring();

      expect(mockServices.executionServices.positionMonitor.start).toHaveBeenCalled();
    });

    it('should setup periodic tasks', async () => {
      await initializer.startMonitoring();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        '✅ Position monitor and maintenance tasks started',
      );
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Periodic tasks enabled'),
      );
    });

    it('should handle startup errors', async () => {
      const error = new Error('Monitor startup failed');
      asMock(mockServices.executionServices.positionMonitor.start).mockImplementation(() => {
        throw error;
      });

      await expect(initializer.startMonitoring()).rejects.toThrow('Monitor startup failed');
      expect(mockServices.coreServices.logger.error).toHaveBeenCalledWith('Failed to start monitoring', {
        error: 'Monitor startup failed',
      });
    });
  });

  describe('shutdown()', () => {
    it('should stop position monitor', async () => {
      await initializer.shutdown();

      expect(mockServices.executionServices.positionMonitor.stop).toHaveBeenCalled();
    });

    it('should disconnect websockets', async () => {
      await initializer.shutdown();

      expect(mockServices.marketDataServices.webSocketManager.disconnect).toHaveBeenCalled();
      expect(mockServices.marketDataServices.publicWebSocket.disconnect).toHaveBeenCalled();
    });

    it('should cleanup event listeners', async () => {
      await initializer.shutdown();

      expect(mockServices.executionServices.positionMonitor.removeAllListeners).toHaveBeenCalled();
      expect(mockServices.marketDataServices.webSocketManager.removeAllListeners).toHaveBeenCalled();
      expect(mockServices.marketDataServices.publicWebSocket.removeAllListeners).toHaveBeenCalled();
    });

    it('should end session', async () => {
      await initializer.shutdown();

      expect(mockServices.sessionStats.endSession).toHaveBeenCalled();
    });

    it('should send telegram notification', async () => {
      await initializer.shutdown();

      expect(mockServices.coreServices.telegram.notifyBotStopped).toHaveBeenCalled();
    });

    it('should log shutdown completion', async () => {
      await initializer.shutdown();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('🛑 Starting graceful shutdown...');
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('✅ Shutdown complete');
    });

    it('should handle shutdown errors gracefully', async () => {
      const error = new Error('Shutdown error');
      asMock(mockServices.executionServices.positionMonitor.stop).mockImplementation(() => {
        throw error;
      });

      await expect(initializer.shutdown()).rejects.toThrow('Shutdown error');
      expect(mockServices.coreServices.logger.error).toHaveBeenCalledWith('Error during shutdown', {
        error: 'Shutdown error',
      });
    });
  });

  describe('logDataSubscriptionStatus()', () => {
    it('should log data subscription status', () => {
      initializer.logDataSubscriptionStatus();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('📊 Data Subscriptions:', {
        candles: '✅',
        indicators: '✅',
        orderbook: '✅',
        ticks: '✅',
        delta: '✅',
      });
    });

    it('should show disabled subscriptions', () => {
      mockConfig.dataSubscriptions.candles.enabled = false;
      mockConfig.dataSubscriptions.candles.calculateIndicators = false;
      mockConfig.dataSubscriptions.orderbook.enabled = false;
      initializer = new BotInitializer(mockServices, mockConfig);

      initializer.logDataSubscriptionStatus();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith('📊 Data Subscriptions:', {
        candles: '❌',
        indicators: '❌',
        orderbook: '❌',
        ticks: '✅',
        delta: '✅',
      });
    });
  });

  describe('periodic tasks', () => {
    it('should setup periodic tasks without errors', async () => {
      // Verify that startMonitoring sets up periodic tasks without throwing
      await expect(initializer.startMonitoring()).resolves.not.toThrow();

      // Verify logger indicates periodic tasks were enabled
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Periodic tasks enabled'),
      );
    });
  });
});

