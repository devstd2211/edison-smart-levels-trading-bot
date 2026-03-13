/**
 * Phase 9.1: GracefulShutdownManager Unit Tests
 *
 * Test Coverage:
 * - Signal handler registration (SIGINT/SIGTERM)
 * - Shutdown sequence and orchestration
 * - Position closure via ActionQueue
 * - Order cancellation via IExchange
 * - State persistence to disk
 * - State recovery from disk
 * - Timeout protection
 * - Error handling and edge cases
 *
 * Total: 16 tests
 */

import { GracefulShutdownManager } from '../../services/graceful-shutdown.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { ActionQueueService } from '../../services/action-queue.service';
import { BotEventBus } from '../../services/event-bus';
import { LoggerService } from '../../types/legacy';
import { IExchange } from '../../interfaces/IExchange';
import {
  GracefulShutdownConfig,
  EmergencyCloseReason,
  LiveTradingEventType,
} from '../../types/legacy';
import { ActionType } from '../../types/legacy';
import * as fs from 'fs';
import {
  createGracefulShutdownManager,
  createGracefulShutdownMocks,
  createMockShutdownPosition,
  defaultGracefulShutdownConfig,
  setupGracefulShutdownFsMocks,
} from '../helpers/graceful-shutdown-test.utils';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args) => args.join('/')),
}));

// Mock process.exit - throw error to prevent further execution
const mockExit = jest.fn(() => {
  throw new Error('Process exit called');
});
jest.spyOn(process, 'exit').mockImplementation(
  mockExit as unknown as (code?: string | number | null | undefined) => never
);

describe('GracefulShutdownManager', () => {
  let shutdownManager: GracefulShutdownManager;
  let mockPositionLifecycleService: jest.Mocked<PositionLifecycleService>;
  let mockActionQueue: jest.Mocked<ActionQueueService>;
  let mockExchange: jest.Mocked<IExchange>;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockEventBus: jest.Mocked<BotEventBus>;
  const asInternals = (manager: GracefulShutdownManager): { cancelAllPendingOrders: () => Promise<number> } =>
    manager as unknown as { cancelAllPendingOrders: () => Promise<number> };

  const mockConfig: GracefulShutdownConfig = defaultGracefulShutdownConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = createGracefulShutdownMocks();
    mockPositionLifecycleService = mocks.positionLifecycleService;
    mockActionQueue = mocks.actionQueue;
    mockExchange = mocks.exchange;
    mockLogger = mocks.logger;
    mockEventBus = mocks.eventBus;
    setupGracefulShutdownFsMocks();
    shutdownManager = createGracefulShutdownManager(mocks);
  });

  describe('Signal Handler Registration', () => {
    it('should register SIGINT and SIGTERM handlers', () => {
      const spy = jest.spyOn(process, 'on');

      shutdownManager.registerShutdownHandlers();

      expect(spy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(spy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[GracefulShutdownManager] Signal handlers registered'
      );

      spy.mockRestore();
    });

    it('should handle SIGINT signal', async () => {
      const spy = jest.spyOn(process, 'on');
      shutdownManager.registerShutdownHandlers();

      const sigintHandler = spy.mock.calls.find((call) => call[0] === 'SIGINT')![1];
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await sigintHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[GracefulShutdownManager] Received SIGINT')
      );

      spy.mockRestore();
    });

    it('should handle SIGTERM signal', async () => {
      const spy = jest.spyOn(process, 'on');
      shutdownManager.registerShutdownHandlers();

      const sigtermHandler = spy.mock.calls.find((call) => call[0] === 'SIGTERM')![1] as Function;
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await sigtermHandler();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[GracefulShutdownManager] Received SIGTERM')
      );

      spy.mockRestore();
    });
  });

  describe('Shutdown Sequence', () => {
    beforeEach(() => {
      // Mock process.exit to not actually exit in tests
      (mockExit as jest.Mock).mockImplementation(() => {
        // Don't throw, just mock it
      });
    });

    it('should prevent multiple simultaneous shutdowns', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      // Make waitEmpty never resolve to keep shutdown in progress
      mockActionQueue.waitEmpty.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      // Create a new manager
      const manager1 = createGracefulShutdownManager({
        positionLifecycleService: mockPositionLifecycleService,
        actionQueue: mockActionQueue,
        exchange: mockExchange,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      // Start first shutdown (won't complete due to mocked waitEmpty)
      const promise1 = manager1.initiateShutdown('First');

      // Immediately try second shutdown - this should return early
      const result2 = await manager1.initiateShutdown('Second');

      // Second shutdown should fail immediately
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Shutdown already in progress');

      // Clean up: reset the mock
      mockActionQueue.waitEmpty.mockResolvedValue(undefined);
    });

    it('should emit shutdown-started event with reason', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      // Use a separate manager instance for this test
      const manager = createGracefulShutdownManager({
        positionLifecycleService: mockPositionLifecycleService,
        actionQueue: mockActionQueue,
        exchange: mockExchange,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      try {
        await manager.initiateShutdown('User interrupt');
      } catch {
        // Ignore any errors
      }

      const startedEvent = mockEventBus.publishSync.mock.calls.find(
        (call) => call[0].type === LiveTradingEventType.SHUTDOWN_STARTED
      );

      expect(startedEvent).toBeDefined();
      const startedData = startedEvent?.[0].data as { reason?: string } | undefined;
      expect(startedData?.reason).toBe('User interrupt');
    });

    it('should wait for action queue to empty', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      const manager = createGracefulShutdownManager({
        positionLifecycleService: mockPositionLifecycleService,
        actionQueue: mockActionQueue,
        exchange: mockExchange,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      try {
        await manager.initiateShutdown('Queue test');
      } catch {
        // Ignore
      }

      expect(mockActionQueue.waitEmpty).toHaveBeenCalled();
    });

    it('should emit shutdown-completed event before exit', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      const manager = createGracefulShutdownManager({
        positionLifecycleService: mockPositionLifecycleService,
        actionQueue: mockActionQueue,
        exchange: mockExchange,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      try {
        await manager.initiateShutdown('Test');
      } catch {
        // Ignore
      }

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LiveTradingEventType.SHUTDOWN_COMPLETED,
        })
      );
    });
  });

  describe('Order Cancellation', () => {
    it('should cancel all orders when position exists', async () => {
      const result = await asInternals(shutdownManager).cancelAllPendingOrders();

      expect(mockExchange.cancelAllOrders).toHaveBeenCalledWith('BTCUSDT');
      expect(mockExchange.cancelAllConditionalOrders).toHaveBeenCalled();
      expect(result).toBe(2); // Count of cancel attempts
    });

    it('should return 0 when no position exists', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      const result = await asInternals(shutdownManager).cancelAllPendingOrders();

      expect(mockExchange.cancelAllOrders).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should handle error when cancelling hanging orders', async () => {
      mockExchange.cancelAllOrders.mockRejectedValue(new Error('API Error'));

      const result = await asInternals(shutdownManager).cancelAllPendingOrders();

      // Should still try conditional orders
      expect(mockExchange.cancelAllConditionalOrders).toHaveBeenCalled();
      // With ErrorHandler RETRY strategy, we degrade gracefully on failure
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      const hasWarning = warnCalls.some(msg => msg && msg.includes('Could not cancel hanging orders'));
      expect(hasWarning).toBe(true);
      expect(result).toBe(1); // Only conditional orders counted
    });

    it('should handle error when cancelling conditional orders', async () => {
      mockExchange.cancelAllConditionalOrders.mockRejectedValue(new Error('API Error'));

      const result = await asInternals(shutdownManager).cancelAllPendingOrders();

      // Should still try hanging orders
      expect(mockExchange.cancelAllOrders).toHaveBeenCalled();
      // With ErrorHandler RETRY strategy, we degrade gracefully on failure
      const warnCalls = mockLogger.warn.mock.calls.map(call => call[0]);
      const hasWarning = warnCalls.some(msg => msg && msg.includes('Could not cancel conditional orders'));
      expect(hasWarning).toBe(true);
      expect(result).toBe(1); // Only hanging orders counted
    });

    it('should always cancel orders on shutdown', async () => {
      // Orders are always cancelled on shutdown for safety (Phase 9.2)
      // No config flag for this - it's a required safety measure
      await shutdownManager.initiateShutdown('Always cancel orders');

      // Verify orders are cancelled
      expect(mockExchange.cancelAllOrders).toHaveBeenCalled();
      expect(mockExchange.cancelAllConditionalOrders).toHaveBeenCalled();
    });
  });

  describe('Position Closure', () => {
    it('should close positions via action queue', async () => {
      const position = createMockShutdownPosition();
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(position);

      await shutdownManager.closeAllPositions(EmergencyCloseReason.BOT_SHUTDOWN);

      expect(mockActionQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ActionType.CLOSE_PERCENT,
          positionId: 'pos-123',
          percent: 100,
          reason: EmergencyCloseReason.BOT_SHUTDOWN,
        })
      );
    });

    it('should skip closure if no position', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await shutdownManager.closeAllPositions(EmergencyCloseReason.BOT_SHUTDOWN);

      expect(mockActionQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should skip closure if disabled in config', async () => {
      const noCloseConfig = { ...mockConfig, closeAllPositions: false };
      const noCloseManager = createGracefulShutdownManager(
        {
          positionLifecycleService: mockPositionLifecycleService,
          actionQueue: mockActionQueue,
          exchange: mockExchange,
          logger: mockLogger,
          eventBus: mockEventBus,
        },
        { config: noCloseConfig },
      );

      const position = createMockShutdownPosition();
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(position);

      await noCloseManager.initiateShutdown('No close test');

      expect(mockActionQueue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe('State Persistence', () => {
    it('should persist bot state to disk', async () => {
      const position = createMockShutdownPosition();
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(position);

      await shutdownManager.persistState();

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      expect(writeCall[0]).toContain('bot-state.json');

      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.positions).toHaveLength(1);
      expect(savedData.positions[0].symbol).toBe('BTCUSDT');
    });

    it('should save empty positions when no position', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await shutdownManager.persistState();

      const writeCall = (fs.writeFileSync as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.positions).toHaveLength(0);
    });

    it('should emit state-persisted event', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await shutdownManager.persistState();

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LiveTradingEventType.STATE_PERSISTED,
        })
      );
    });

    it('should skip persistence if disabled in config', async () => {
      const noPersistConfig = { ...mockConfig, persistState: false };
      const noPersistManager = createGracefulShutdownManager(
        {
          positionLifecycleService: mockPositionLifecycleService,
          actionQueue: mockActionQueue,
          exchange: mockExchange,
          logger: mockLogger,
          eventBus: mockEventBus,
        },
        { config: noPersistConfig },
      );

      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);

      await noPersistManager.initiateShutdown('No persist');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('State Recovery', () => {
    it('should recover state from disk', async () => {
      const savedState = {
        snapshotTime: Date.now(),
        positions: [
          {
            positionId: 'pos-1',
            symbol: 'BTCUSDT',
            direction: 'LONG',
            quantity: 1,
            entryPrice: 45000,
            entryTime: Date.now(),
            currentPnL: 1000,
            openOrders: [],
            state: 'OPEN',
          },
        ],
        sessionMetrics: { totalTrades: 5, totalPnL: 2500, startTime: Date.now() },
        riskMetrics: { dailyPnL: 2500, consecutiveLosses: 0, totalExposure: 45000 },
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(savedState));

      const metadata = await shutdownManager.recoverState();

      expect(metadata).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recovering state from')
      );
    });

    it('should return null when no saved state exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const metadata = await shutdownManager.recoverState();

      expect(metadata).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('No saved state found')
      );
    });

    it('should emit state-recovered event', async () => {
      const savedState = {
        snapshotTime: Date.now(),
        positions: [],
        sessionMetrics: { totalTrades: 0, totalPnL: 0, startTime: Date.now() },
        riskMetrics: { dailyPnL: 0, consecutiveLosses: 0, totalExposure: 0 },
      };

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(savedState));

      await shutdownManager.recoverState();

      expect(mockEventBus.publishSync).toHaveBeenCalledWith(
        expect.objectContaining({
          type: LiveTradingEventType.STATE_RECOVERED,
        })
      );
    });

    it('should handle invalid saved state gracefully', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid json');

      const metadata = await shutdownManager.recoverState();

      expect(metadata).toBeNull();
      // With ErrorHandler FALLBACK strategy, we log warn instead of error
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('State recovery failed'),
        expect.any(Object)
      );
    });
  });

  describe('Shutdown Status and Utilities', () => {
    it('should return shutdown in progress flag', () => {
      expect(shutdownManager.isShutdownInProgress()).toBe(false);
    });

    it('should return state directory path', () => {
      const dir = shutdownManager.getStateDirectory();
      expect(dir).toBe('./test-shutdown-state');
    });

    it('should check if saved state exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      expect(shutdownManager.hasSavedState()).toBe(true);

      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(shutdownManager.hasSavedState()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle state persistence errors', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Disk write failed');
      });

      let errorThrown = false;
      try {
        await shutdownManager.persistState();
      } catch (error) {
        errorThrown = true;
      }

      // With ErrorHandler GRACEFUL_DEGRADE strategy, should NOT throw
      expect(errorThrown).toBe(false);
      // Should log the error but continue shutdown
      const allLogs = [
        ...mockLogger.error.mock.calls.map(call => call[0]),
        ...mockLogger.warn.mock.calls.map(call => call[0])
      ];
      const hasLog = allLogs.some(msg => msg && msg.includes('persist'));
      expect(hasLog).toBe(true);
    });

    it('should handle action queue timeout gracefully', async () => {
      mockPositionLifecycleService.getCurrentPosition.mockReturnValue(null);
      mockActionQueue.waitEmpty.mockRejectedValue(new Error('Queue timeout'));

      const manager = createGracefulShutdownManager({
        positionLifecycleService: mockPositionLifecycleService,
        actionQueue: mockActionQueue,
        exchange: mockExchange,
        logger: mockLogger,
        eventBus: mockEventBus,
      });

      try {
        await manager.initiateShutdown('Queue timeout');
      } catch {
        // Ignore exit error
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Action queue did not empty')
      );
    });
  });
});

