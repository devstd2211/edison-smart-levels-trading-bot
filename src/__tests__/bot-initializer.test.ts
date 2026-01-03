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
import { Config, LoggerService } from '../types';

// Mock logger
const createMockLogger = (): any => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

// Minimal valid config
const createMinimalConfig = (): any =>
  ({
    exchange: {
      apiKey: 'test-key',
      apiSecret: 'test-secret',
      testnet: true,
      symbol: 'APEXUSDT',
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
  } as any);

// Create mock BotServices
const createMockBotServices = (): any => ({
  logger: createMockLogger(),
  bybitService: {
    initialize: jest.fn().mockResolvedValue(undefined),
    resyncTime: jest.fn().mockResolvedValue(undefined),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
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
  },
  telegram: {
    notifyBotStopped: jest.fn().mockResolvedValue(undefined),
  },
});

describe('BotInitializer', () => {
  let initializer: BotInitializer;
  let mockServices: any;
  let mockConfig: any;

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

      expect(mockServices.logger.info).toHaveBeenCalledWith('🚀 Starting bot initialization sequence...');
      expect(mockServices.logger.info).toHaveBeenCalledWith(
        '✅ Bot initialization complete - ready to start trading',
      );
    });

    it('should skip candle provider when disabled', async () => {
      mockConfig.dataSubscriptions.candles.enabled = false;
      initializer = new BotInitializer(mockServices, mockConfig);

      await initializer.initialize();

      expect(mockServices.candleProvider.initialize).not.toHaveBeenCalled();
      expect(mockServices.logger.warn).toHaveBeenCalledWith(
        '⚠️ Candles disabled - strategies may not work correctly!',
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Bybit initialization failed');
      mockServices.bybitService.initialize.mockRejectedValue(error);

      await expect(initializer.initialize()).rejects.toThrow('Bybit initialization failed');
      expect(mockServices.logger.error).toHaveBeenCalledWith('Failed to initialize bot', {
        error: 'Bybit initialization failed',
      });
    });

    it('should sync time with exchange', async () => {
      await initializer.initialize();

      expect(mockServices.timeService.syncWithExchange).toHaveBeenCalled();
      expect(mockServices.logger.info).toHaveBeenCalledWith('Time synchronized', {
        offset: 0,
        nextSyncIn: '60s',
      });
    });
  });

  describe('connectWebSockets()', () => {
    it('should connect both private and public websockets', async () => {
      await initializer.connectWebSockets();

      expect(mockServices.webSocketManager.connect).toHaveBeenCalled();
      expect(mockServices.publicWebSocket.connect).toHaveBeenCalled();
    });

    it('should log connection status', async () => {
      await initializer.connectWebSockets();

      expect(mockServices.logger.info).toHaveBeenCalledWith('📡 Connecting WebSocket connections...');
      expect(mockServices.logger.info).toHaveBeenCalledWith('✅ WebSocket connections established');
    });

    it('should handle connection errors', async () => {
      const error = new Error('WebSocket connection failed');
      mockServices.webSocketManager.connect.mockImplementation(() => {
        throw error;
      });

      await expect(initializer.connectWebSockets()).rejects.toThrow(
        'WebSocket connection failed',
      );
      expect(mockServices.logger.error).toHaveBeenCalledWith('Failed to connect WebSockets', {
        error: 'WebSocket connection failed',
      });
    });
  });

  describe('startMonitoring()', () => {
    it('should start position monitor', async () => {
      await initializer.startMonitoring();

      expect(mockServices.positionMonitor.start).toHaveBeenCalled();
    });

    it('should setup periodic tasks', async () => {
      await initializer.startMonitoring();

      expect(mockServices.logger.info).toHaveBeenCalledWith(
        '✅ Position monitor and maintenance tasks started',
      );
      expect(mockServices.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Periodic tasks enabled'),
      );
    });

    it('should handle startup errors', async () => {
      const error = new Error('Monitor startup failed');
      mockServices.positionMonitor.start.mockImplementation(() => {
        throw error;
      });

      await expect(initializer.startMonitoring()).rejects.toThrow('Monitor startup failed');
      expect(mockServices.logger.error).toHaveBeenCalledWith('Failed to start monitoring', {
        error: 'Monitor startup failed',
      });
    });
  });

  describe('shutdown()', () => {
    it('should stop position monitor', async () => {
      await initializer.shutdown();

      expect(mockServices.positionMonitor.stop).toHaveBeenCalled();
    });

    it('should disconnect websockets', async () => {
      await initializer.shutdown();

      expect(mockServices.webSocketManager.disconnect).toHaveBeenCalled();
      expect(mockServices.publicWebSocket.disconnect).toHaveBeenCalled();
    });

    it('should cleanup event listeners', async () => {
      await initializer.shutdown();

      expect(mockServices.positionMonitor.removeAllListeners).toHaveBeenCalled();
      expect(mockServices.webSocketManager.removeAllListeners).toHaveBeenCalled();
      expect(mockServices.publicWebSocket.removeAllListeners).toHaveBeenCalled();
    });

    it('should end session', async () => {
      await initializer.shutdown();

      expect(mockServices.sessionStats.endSession).toHaveBeenCalled();
    });

    it('should send telegram notification', async () => {
      await initializer.shutdown();

      expect(mockServices.telegram.notifyBotStopped).toHaveBeenCalled();
    });

    it('should log shutdown completion', async () => {
      await initializer.shutdown();

      expect(mockServices.logger.info).toHaveBeenCalledWith('🛑 Starting graceful shutdown...');
      expect(mockServices.logger.info).toHaveBeenCalledWith('✅ Shutdown complete');
    });

    it('should handle shutdown errors gracefully', async () => {
      const error = new Error('Shutdown error');
      mockServices.positionMonitor.stop.mockImplementation(() => {
        throw error;
      });

      await expect(initializer.shutdown()).rejects.toThrow('Shutdown error');
      expect(mockServices.logger.error).toHaveBeenCalledWith('Error during shutdown', {
        error: 'Shutdown error',
      });
    });
  });

  describe('logDataSubscriptionStatus()', () => {
    it('should log data subscription status', () => {
      initializer.logDataSubscriptionStatus();

      expect(mockServices.logger.info).toHaveBeenCalledWith('📊 Data Subscriptions:', {
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

      expect(mockServices.logger.info).toHaveBeenCalledWith('📊 Data Subscriptions:', {
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
      expect(mockServices.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Periodic tasks enabled'),
      );
    });
  });
});
