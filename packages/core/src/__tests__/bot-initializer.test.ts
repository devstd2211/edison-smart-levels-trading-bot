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
import { ICONS } from '../cli/cli-runtime';
import type { Config } from '../types/legacy';
import type { IBotInitializerServices } from '../interfaces';
import {
  asBotInitializerMock,
  createBotInitializerTestContext,
} from './helpers/bot-initializer-test.utils';

describe('BotInitializer', () => {
  let context: ReturnType<typeof createBotInitializerTestContext>;
  let initializer: BotInitializer;
  let mockServices: IBotInitializerServices;
  let mockConfig: Config;

  const rebuildInitializer = (): void => {
    initializer = context.rebuild();
  };

  beforeEach(() => {
    context = createBotInitializerTestContext();
    mockServices = context.services;
    mockConfig = context.config;
    initializer = context.initializer;

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await context.shutdown();
  });

  describe('initialize()', () => {
    it('should initialize all components in correct order', async () => {
      const callOrder: string[] = [];

      // Track call order
      asBotInitializerMock(mockServices.marketDataServices.bybitService.initialize).mockImplementation(() => {
        callOrder.push('bybitService.initialize');
        return Promise.resolve();
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

      // Verify order: Bybit → SessionStats → TimeService → CandleProvider
      expect(callOrder).toEqual([
        'bybitService.initialize',
        'sessionStats.startSession',
        'timeService.syncWithExchange',
        'candleProvider.initialize',
        'tradingOrchestrator.start',
      ]);
    });

    it('should log initialization start and completion', async () => {
      await initializer.initialize();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.robot} Starting bot initialization sequence...`,
      );
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Bot initialization complete - ready to connect WebSockets`,
      );
    });

    it('should skip candle provider when disabled', async () => {
      mockConfig.dataSubscriptions.candles.enabled = false;
      rebuildInitializer();

      await initializer.initialize();

      expect(mockServices.marketDataServices.candleProvider.initialize).not.toHaveBeenCalled();
      expect(mockServices.coreServices.logger.warn).toHaveBeenCalledWith(
        `${ICONS.warning} Candles disabled - strategies may not work correctly!`,
      );
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Bybit initialization failed');
      asBotInitializerMock(mockServices.marketDataServices.bybitService.initialize).mockRejectedValue(error);

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

      expect(mockServices.marketDataServices.webSocketManager.start).toHaveBeenCalled();
      expect(mockServices.marketDataServices.publicWebSocket.start).toHaveBeenCalled();
    });

    it('should log connection status', async () => {
      await initializer.connectWebSockets();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.plug} Connecting WebSocket connections...`,
      );
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.success} WebSocket connections established`,
      );
    });

    it('should handle connection errors', async () => {
      const error = new Error('WebSocket connection failed');
      asBotInitializerMock(mockServices.marketDataServices.webSocketManager.start).mockImplementation(() => {
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

  describe('bootstrap()', () => {
    it('should execute startup lifecycle in order', async () => {
      const callOrder: string[] = [];

      jest.spyOn(initializer, 'initialize').mockImplementation(async () => {
        callOrder.push('initialize');
      });
      jest.spyOn(initializer, 'logDataSubscriptionStatus').mockImplementation(() => {
        callOrder.push('logDataSubscriptionStatus');
      });
      jest.spyOn(initializer, 'connectWebSockets').mockImplementation(async () => {
        callOrder.push('connectWebSockets');
      });
      jest.spyOn(initializer, 'startMonitoring').mockImplementation(async () => {
        callOrder.push('startMonitoring');
      });

      await initializer.bootstrap({
        beforeMonitoring: async () => {
          callOrder.push('beforeMonitoring');
        },
      });

      expect(callOrder).toEqual([
        'initialize',
        'logDataSubscriptionStatus',
        'connectWebSockets',
        'beforeMonitoring',
        'startMonitoring',
      ]);
    });

    it('should stop before monitoring when hook fails', async () => {
      const startMonitoringSpy = jest
        .spyOn(initializer, 'startMonitoring')
        .mockResolvedValue(undefined);

      await expect(
        initializer.bootstrap({
          beforeMonitoring: async () => {
            throw new Error('hook failed');
          },
        }),
      ).rejects.toThrow('hook failed');

      expect(startMonitoringSpy).not.toHaveBeenCalled();
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
        `${ICONS.success} Position monitor and maintenance tasks started`,
      );
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Periodic tasks enabled'),
      );
    });

    it('should handle startup errors', async () => {
      const error = new Error('Monitor startup failed');
      asBotInitializerMock(mockServices.executionServices.positionMonitor.start).mockImplementation(() => {
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

    it('should stop websockets', async () => {
      await initializer.shutdown();

      expect(mockServices.marketDataServices.webSocketManager.stop).toHaveBeenCalled();
      expect(mockServices.marketDataServices.publicWebSocket.stop).toHaveBeenCalled();
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

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.warning} Starting graceful shutdown...`,
      );
      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Shutdown complete`,
      );
    });

    it('should handle shutdown errors gracefully', async () => {
      const error = new Error('Shutdown error');
      asBotInitializerMock(mockServices.executionServices.positionMonitor.stop).mockImplementation(() => {
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

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(`${ICONS.chart} Data Subscriptions:`, {
        candles: ICONS.success,
        indicators: ICONS.success,
        orderbook: ICONS.success,
        ticks: ICONS.success,
        delta: ICONS.success,
      });
    });

    it('should show disabled subscriptions', () => {
      mockConfig.dataSubscriptions.candles.enabled = false;
      mockConfig.dataSubscriptions.candles.calculateIndicators = false;
      mockConfig.dataSubscriptions.orderbook.enabled = false;
      rebuildInitializer();

      initializer.logDataSubscriptionStatus();

      expect(mockServices.coreServices.logger.info).toHaveBeenCalledWith(`${ICONS.chart} Data Subscriptions:`, {
        candles: '❌',
        indicators: '❌',
        orderbook: '❌',
        ticks: ICONS.success,
        delta: ICONS.success,
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

