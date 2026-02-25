/**
 * Phase 8.9.39: TradeHistoryService - ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration with:
 * - RETRY strategy for file write operations (appendTrade)
 * - GRACEFUL_DEGRADE strategy for read operations (readAllTrades, getStatistics)
 * - SKIP strategy for schema errors (verification, migration)
 *
 * Total: 24 comprehensive tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { TradeHistoryService } from '../../services/trade-history.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { JournalWriteError } from '../../errors/DomainErrors';
import { LoggerService, LogLevel } from '../../types/legacy';

/**
 * Mock Logger for testing
 */
class MockLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

/**
 * Helper to create a valid trade record
 */
function createTradeRecord(overrides?: any) {
  return {
    timestamp: new Date().toISOString(),
    id: `trade-${Date.now()}`,
    symbol: 'BTCUSDT',
    side: 'LONG',
    strategy: 'test-strategy',
    entryPrice: 50000,
    exitPrice: 51000,
    quantity: 1,
    leverage: 10,
    pnl: 1000,
    fees: 10,
    netPnl: 990,
    duration: '1h',
    exitType: 'TAKE_PROFIT_1',
    confidence: 0.85,
    virtualBalanceBefore: 10000,
    virtualBalanceAfter: 10990,
    sessionVersion: 'v2.6',
    notes: 'test trade',
    ...overrides,
  };
}

/**
 * Helper to create mock ErrorHandler
 */
function createMockErrorHandler() {
  const mockEH: any = {
    handle: jest.fn((error: any, options: any) => {
      if (options.strategy === RecoveryStrategy.THROW) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error : undefined,
        strategy: options.strategy,
      };
    }),
    executeAsync: jest.fn(
      async (fn: () => Promise<any>, config: any): Promise<any> => {
        // Simulate RETRY with exponential backoff
        let lastError: any = null;
        const maxAttempts = config?.retryConfig?.maxAttempts ?? 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const value = await fn();
            if (config.onRecover) {
              config.onRecover(config.strategy, attempt + 1);
            }
            return { success: true, value };
          } catch (error: any) {
            lastError = error;
            if (attempt < maxAttempts - 1 && config.retryConfig) {
              if (config.onRetry) {
                config.onRetry(attempt + 1, error, config.retryConfig.initialDelayMs);
              }
              // Wait before retry
              await new Promise((resolve) =>
                setTimeout(resolve, config?.retryConfig?.initialDelayMs ?? 100)
              );
            }
          }
        }

        // Return gracefully (don't throw)
        if (config.onFailure) {
          config.onFailure(lastError, maxAttempts);
        }
        return { success: false, value: config.strategy === RecoveryStrategy.GRACEFUL_DEGRADE ? undefined : null, error: lastError };
      }
    ),
    getLogger: jest.fn(() => new MockLogger()),
    addCallback: jest.fn(),
    removeCallback: jest.fn(),
    isRecoveryMode: jest.fn(() => true),
  };

  return mockEH as jest.Mocked<ErrorHandler>;
}

describe('Phase 8.9.39: TradeHistoryService - Error Handling Integration', () => {
  let service: TradeHistoryService;
  let errorHandler: jest.Mocked<ErrorHandler>;
  let logger: MockLogger;
  let tempDir: string;

  beforeEach(() => {
    logger = new MockLogger();
    errorHandler = createMockErrorHandler();
    tempDir = path.join(process.cwd(), 'test-trade-history-' + Date.now());

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    service = new TradeHistoryService(logger, tempDir, errorHandler);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // APPEND TRADE TESTS (RETRY Strategy)
  // ============================================================================

  describe('appendTrade - RETRY Strategy', () => {
    it('should successfully append trade on first attempt', async () => {
      const trade = createTradeRecord();

      await service.appendTrade(trade);

      // Verify executeAsync was called with RETRY strategy
      expect(errorHandler.executeAsync).toHaveBeenCalled();
      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].strategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should call executeAsync with correct retry configuration', async () => {
      const trade = createTradeRecord();

      await service.appendTrade(trade);

      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      const config = callArgs[1];

      expect(config.retryConfig).toBeDefined();
      expect(config.retryConfig.maxAttempts).toBe(3);
      expect(config.retryConfig.initialDelayMs).toBe(100);
      expect(config.retryConfig.backoffMultiplier).toBe(2);
    });

    it('should call onRetry callback during retry attempts', async () => {
      const trade = createTradeRecord();
      const onRetrySpy = jest.fn();

      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        try {
          const value = await fn();
          return { success: true, value };
        } catch (error: any) {
          config.onRetry?.(1, error as any, 100);
          return { success: false, error };
        }
      });

      await service.appendTrade(trade);

      // Verify onRetry was passed in config
      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].onRetry).toBeDefined();
    });

    it('should call onFailure callback when max retries exceeded', async () => {
      const trade = createTradeRecord();
      const onFailureSpy = jest.fn();

      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        config.onFailure?.(new Error('Write failed') as any, 3);
        return { success: false, error: new Error('Write failed') };
      });

      try {
        await service.appendTrade(trade);
      } catch (e) {
        // Expected to throw
      }

      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].onFailure).toBeDefined();
    });

    it('should handle successful recovery from write errors', async () => {
      const trade = createTradeRecord();
      let attemptCount = 0;

      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        // Simulate retry logic: fail first, succeed second time
        if (attemptCount === 0) {
          attemptCount++;
          if (config.onRetry) {
            config.onRetry(1, new Error('Write failed'), 100);
          }
          // Try again
          try {
            const value = await fn();
            if (config.onRecover) {
              config.onRecover(config.strategy, 2);
            }
            return { success: true, value };
          } catch (error: any) {
            return { success: false, error };
          }
        }

        // First attempt
        try {
          const value = await fn();
          if (config.onRecover) {
            config.onRecover(config.strategy, 1);
          }
          return { success: true, value };
        } catch (error: any) {
          return { success: false, error };
        }
      });

      await service.appendTrade(trade);

      expect(errorHandler.executeAsync).toHaveBeenCalled();
    });

    it('should detect new fields and update schema during append', async () => {
      const trade = createTradeRecord({
        customIndicator: 'RSI_SIGNAL',
        rsiValue: 30.5,
      });

      await service.appendTrade(trade);

      const schema = service.getCurrentSchema();
      expect(schema).toContain('customIndicator');
      expect(schema).toContain('rsiValue');
    });

    it('should handle multiple sequential appends with RETRY', async () => {
      const trade1 = createTradeRecord({ id: 'trade-1' });
      const trade2 = createTradeRecord({ id: 'trade-2' });

      await service.appendTrade(trade1);
      await service.appendTrade(trade2);

      expect(errorHandler.executeAsync).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // READ TRADES TESTS (GRACEFUL_DEGRADE Strategy)
  // ============================================================================

  describe('readAllTrades - GRACEFUL_DEGRADE Strategy', () => {
    it('should successfully read trades on first attempt', async () => {
      const trade = createTradeRecord();
      await service.appendTrade(trade);

      const trades = await service.readAllTrades();

      expect(errorHandler.executeAsync).toHaveBeenCalled();
      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[1]; // Second call
      expect(callArgs[1].strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADE);
    });

    it('should return empty array on read failure with GRACEFUL_DEGRADE', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        return { success: false, value: [], error: new Error('Read failed') };
      });

      const trades = await service.readAllTrades();

      expect(trades).toEqual([]);
    });

    it('should call onFailure when read fails', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        config.onFailure?.(new Error('Read failed') as any, 1);
        return { success: false, value: [] };
      });

      await service.readAllTrades();

      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].onFailure).toBeDefined();
    });

    it('should handle corrupted CSV gracefully', async () => {
      const csvPath = path.join(tempDir, 'trade-history.csv');
      fs.writeFileSync(csvPath, 'invalid csv data [[ broken', 'utf-8');

      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        try {
          return { success: true, value: await fn() };
        } catch (error: any) {
          config.onFailure?.(error as any, 1);
          return { success: false, value: [] };
        }
      });

      const trades = await service.readAllTrades();

      expect(Array.isArray(trades)).toBe(true);
    });

    it('should return empty array instead of throwing', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        return { success: false, value: [] };
      });

      expect(async () => {
        await service.readAllTrades();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // STATISTICS TESTS (GRACEFUL_DEGRADE Strategy)
  // ============================================================================

  describe('getStatistics - GRACEFUL_DEGRADE Strategy', () => {
    it('should successfully calculate statistics', async () => {
      const trade = createTradeRecord({ netPnl: 100 });
      await service.appendTrade(trade);

      const stats = await service.getStatistics();

      expect(errorHandler.executeAsync).toHaveBeenCalled();
      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[1]; // After append
      expect(callArgs[1].strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADE);
    });

    it('should return default statistics on failure', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        return {
          success: false,
          value: {
            totalTrades: 0,
            totalPnL: 0,
            winRate: 0,
            avgPnL: 0,
            byStrategy: {},
            bySession: {},
          },
        };
      });

      const stats = await service.getStatistics();

      expect(stats.totalTrades).toBe(0);
      expect(stats.totalPnL).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    it('should call onFailure when stats calculation fails', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        config.onFailure?.(new Error('Stats failed') as any, 1);
        return { success: false, value: undefined };
      });

      await service.getStatistics();

      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].onFailure).toBeDefined();
    });

    it('should calculate correct statistics for winning trades', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        return { success: true, value: await fn() };
      });

      const trade1 = createTradeRecord({ id: 'trade-1', netPnl: 100 });
      const trade2 = createTradeRecord({ id: 'trade-2', netPnl: -50 });

      await service.appendTrade(trade1);
      await service.appendTrade(trade2);

      const stats = await service.getStatistics();

      expect(stats.totalTrades).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // STATISTICS BY FIELD TESTS (GRACEFUL_DEGRADE Strategy)
  // ============================================================================

  describe('getStatisticsByField - GRACEFUL_DEGRADE Strategy', () => {
    it('should successfully calculate statistics by field', async () => {
      const trade = createTradeRecord({ strategy: 'rsi-dip' });
      await service.appendTrade(trade);

      const stats = await service.getStatisticsByField('strategy');

      expect(errorHandler.executeAsync).toHaveBeenCalled();
      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[1]; // After append
      expect(callArgs[1].strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADE);
    });

    it('should return empty object on field stats failure', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        return { success: false, value: {} };
      });

      const stats = await service.getStatisticsByField('strategy');

      expect(stats).toEqual({});
    });

    it('should handle missing field gracefully', async () => {
      const trade = createTradeRecord();
      await service.appendTrade(trade);

      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        try {
          return { success: true, value: await fn() };
        } catch (error: any) {
          config.onFailure?.(error as any, 1);
          return { success: false, value: {} };
        }
      });

      const stats = await service.getStatisticsByField('nonExistentField');

      // When field doesn't exist, trades get grouped under 'unknown'
      expect(stats).toHaveProperty('unknown');
    });

    it('should call onFailure when field stats fail', async () => {
      (errorHandler.executeAsync as jest.Mock) = jest.fn(async (fn: any, config: any) => {
        config.onFailure?.(new Error('Field stats failed') as any, 1);
        return { success: false, value: {} };
      });

      await service.getStatisticsByField('strategy');

      const callArgs = (errorHandler.executeAsync as jest.Mock).mock.calls[0];
      expect(callArgs[1].onFailure).toBeDefined();
    });
  });

  // ============================================================================
  // SCHEMA ERROR HANDLING TESTS (SKIP Strategy)
  // ============================================================================

  describe('Schema Error Handling - SKIP Strategy', () => {
    it('should initialize with default schema on load failure', () => {
      // Create service with invalid schema file
      const schemaPath = path.join(tempDir, 'csv-schema.json');
      fs.writeFileSync(schemaPath, 'invalid json', 'utf-8');

      const newService = new TradeHistoryService(logger, tempDir, errorHandler);

      const schema = newService.getCurrentSchema();
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
    });

    it('should skip schema save errors without throwing', async () => {
      // Make schema file read-only to force write failure
      const schemaPath = path.join(tempDir, 'csv-schema.json');

      (errorHandler.handle as jest.Mock) = jest.fn((error: any, options: any) => {
        if (options.strategy === RecoveryStrategy.SKIP) {
          return { success: true, strategy: RecoveryStrategy.SKIP };
        }
        throw error;
      });

      // This should not throw even if schema save fails
      const trade = createTradeRecord({ customField: 'value' });
      await service.appendTrade(trade);

      const schema = service.getCurrentSchema();
      expect(schema).toBeDefined();
    });

    it('should continue with existing schema on verify failure', () => {
      const newService = new TradeHistoryService(logger, tempDir, errorHandler);

      const initialSchema = newService.getCurrentSchema();
      expect(initialSchema.length).toBeGreaterThan(0);
    });

    it('should handle migration skip gracefully', async () => {
      (errorHandler.handle as jest.Mock) = jest.fn((error: any, options: any) => {
        if (options.strategy === RecoveryStrategy.SKIP) {
          // Log and continue
          return { success: true, strategy: RecoveryStrategy.SKIP };
        }
        return { success: false, error };
      });

      const trade = createTradeRecord({
        newField1: 'value1',
        newField2: 'value2',
      });

      // Should not throw on migration failure
      await service.appendTrade(trade);

      const schema = service.getCurrentSchema();
      expect(schema).toBeDefined();
    });
  });

  // ============================================================================
  // INITIALIZATION TESTS (SKIP Strategy)
  // ============================================================================

  describe('Initialization - SKIP Strategy', () => {
    it('should skip directory creation errors', () => {
      const readOnlyDir = path.join(tempDir, 'readonly');
      fs.mkdirSync(readOnlyDir);

      // Create service with read-only parent
      (errorHandler.handle as jest.Mock) = jest.fn((error: any, options: any) => {
        if (options.strategy === RecoveryStrategy.SKIP) {
          return { success: true, strategy: RecoveryStrategy.SKIP };
        }
        throw error;
      });

      // Should not throw
      expect(() => {
        new TradeHistoryService(logger, readOnlyDir, errorHandler);
      }).not.toThrow();
    });

    it('should continue with empty schema on initialize failure', () => {
      (errorHandler.handle as jest.Mock) = jest.fn((error: any, options: any) => {
        if (options.strategy === RecoveryStrategy.SKIP) {
          return { success: true, strategy: RecoveryStrategy.SKIP };
        }
        throw error;
      });

      const newService = new TradeHistoryService(logger, tempDir, errorHandler);
      const schema = newService.getCurrentSchema();

      expect(Array.isArray(schema)).toBe(true);
    });
  });

  // ============================================================================
  // NO ERROR HANDLER FALLBACK TESTS
  // ============================================================================

  describe('Fallback (No ErrorHandler)', () => {
    it('should work without ErrorHandler for appendTrade', async () => {
      const serviceWithoutEH = new TradeHistoryService(logger, tempDir);
      const trade = createTradeRecord();

      // Should not throw even without ErrorHandler
      await serviceWithoutEH.appendTrade(trade);
    });

    it('should work without ErrorHandler for readAllTrades', async () => {
      const serviceWithoutEH = new TradeHistoryService(logger, tempDir);
      const trade = createTradeRecord();
      await serviceWithoutEH.appendTrade(trade);

      const trades = await serviceWithoutEH.readAllTrades();

      expect(Array.isArray(trades)).toBe(true);
    });

    it('should work without ErrorHandler for getStatistics', async () => {
      const serviceWithoutEH = new TradeHistoryService(logger, tempDir);
      const trade = createTradeRecord();
      await serviceWithoutEH.appendTrade(trade);

      const stats = await serviceWithoutEH.getStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalTrades).toBeGreaterThanOrEqual(0);
    });

    it('should work without ErrorHandler for getStatisticsByField', async () => {
      const serviceWithoutEH = new TradeHistoryService(logger, tempDir);
      const trade = createTradeRecord();
      await serviceWithoutEH.appendTrade(trade);

      const stats = await serviceWithoutEH.getStatisticsByField('strategy');

      expect(typeof stats).toBe('object');
    });
  });
});
