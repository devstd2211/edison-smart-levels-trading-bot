import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { TradeHistoryService } from '../../services/trade-history.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export type TradeRecordInput = Parameters<TradeHistoryService['appendTrade']>[0];
export type ExecuteAsyncConfig = Parameters<ErrorHandler['executeAsync']>[1];
export type ExecuteAsyncResult<T = unknown> = { success: boolean; value?: T; error?: unknown };
export type RetryError = Parameters<NonNullable<ExecuteAsyncConfig['onRetry']>>[1];
export type FailureError = Parameters<NonNullable<ExecuteAsyncConfig['onFailure']>>[0];

export class TradeHistoryMockLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

export function createTradeHistoryTempDir(prefix: string = 'trade-history-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupTradeHistoryTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function createTradeHistoryRecord(
  overrides: Partial<TradeRecordInput> = {},
): TradeRecordInput {
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

export function createTradeHistoryErrorHandler(): jest.Mocked<ErrorHandler> {
  const mockEH = {
    handle: jest.fn((error: unknown, options: { strategy: RecoveryStrategy }) => {
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
      async (fn: () => Promise<unknown>, config: ExecuteAsyncConfig): Promise<ExecuteAsyncResult> => {
        let lastError: unknown = null;
        const maxAttempts = config?.retryConfig?.maxAttempts ?? 1;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          try {
            const value = await fn();
            if (config.onRecover) {
              config.onRecover(config.strategy, attempt + 1);
            }
            return { success: true, value };
          } catch (error: unknown) {
            lastError = error;
            if (attempt < maxAttempts - 1 && config.retryConfig) {
              if (config.onRetry) {
                config.onRetry(attempt + 1, error as RetryError, config.retryConfig.initialDelayMs);
              }
              await new Promise((resolve) =>
                setTimeout(resolve, config?.retryConfig?.initialDelayMs ?? 100),
              );
            }
          }
        }

        if (config.onFailure) {
          config.onFailure(lastError as FailureError, maxAttempts);
        }

        return {
          success: false,
          value: config.strategy === RecoveryStrategy.GRACEFUL_DEGRADE ? undefined : null,
          error: lastError,
        };
      },
    ),
    getLogger: jest.fn(() => new TradeHistoryMockLogger()),
    addCallback: jest.fn(),
    removeCallback: jest.fn(),
    isRecoveryMode: jest.fn(() => true),
  };

  return mockEH as unknown as jest.Mocked<ErrorHandler>;
}

export function createTradeHistoryHarness(options: {
  logger?: TradeHistoryMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
  tempDir?: string;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? new TradeHistoryMockLogger();
  const errorHandler = options.errorHandler ?? createTradeHistoryErrorHandler();
  const tempDir = options.tempDir ?? createTradeHistoryTempDir();
  const service = new TradeHistoryService(
    logger,
    tempDir,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    service,
    logger,
    errorHandler,
    tempDir,
  };
}
