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

export interface ManagedTradeHistoryContext {
  service: TradeHistoryService;
  logger: TradeHistoryMockLogger;
  errorHandler: jest.Mocked<ErrorHandler>;
  tempDir: string;
  createService: (options?: {
    withErrorHandler?: boolean;
    tempDir?: string;
    errorHandler?: jest.Mocked<ErrorHandler>;
  }) => TradeHistoryService;
  cleanup: () => void;
}

export type TradeHistoryManagedState = Pick<
  ManagedTradeHistoryContext,
  'service' | 'logger' | 'errorHandler' | 'tempDir' | 'cleanup' | 'createService'
>;

export type TradeHistoryRuntimeState = Omit<TradeHistoryManagedState, 'errorHandler'> & {
  errorHandler: jest.Mocked<ErrorHandler>;
};

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
  autoStart?: boolean;
} = {}) {
  const logger = options.logger ?? new TradeHistoryMockLogger();
  const errorHandler = options.errorHandler ?? createTradeHistoryErrorHandler();
  const tempDir = options.tempDir ?? createTradeHistoryTempDir();
  const service = new TradeHistoryService(
    logger,
    tempDir,
    options.withErrorHandler === false ? undefined : errorHandler,
  );
  if (options.autoStart !== false) {
    service.start();
  }

  return {
    service,
    logger,
    errorHandler,
    tempDir,
  };
}

export function createStandardTradeHistoryService(options: {
  logger?: TradeHistoryMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
  tempDir?: string;
  autoStart?: boolean;
} = {}): TradeHistoryService {
  return createTradeHistoryHarness({
    ...options,
    withErrorHandler: true,
  }).service;
}

export function createLegacyTradeHistoryService(options: {
  logger?: TradeHistoryMockLogger;
  tempDir?: string;
  autoStart?: boolean;
} = {}): TradeHistoryService {
  return createTradeHistoryHarness({
    ...options,
    withErrorHandler: false,
  }).service;
}

export function createTradeHistoryService(options: {
  logger?: TradeHistoryMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
  tempDir?: string;
  withErrorHandler?: boolean;
  autoStart?: boolean;
} = {}): TradeHistoryService {
  return createTradeHistoryHarness(options).service;
}

export function createTradeHistoryBoundFactory(options: {
  logger?: TradeHistoryMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
  tempDir?: string;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? new TradeHistoryMockLogger();
  const errorHandler = options.errorHandler ?? createTradeHistoryErrorHandler();
  const tempDir = options.tempDir ?? createTradeHistoryTempDir();

  return {
    logger,
    errorHandler,
    tempDir,
    createStandardService: (serviceOptions: {
      logger?: TradeHistoryMockLogger;
      errorHandler?: jest.Mocked<ErrorHandler>;
      tempDir?: string;
      autoStart?: boolean;
    } = {}) =>
      createStandardTradeHistoryService({
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
        tempDir: serviceOptions.tempDir ?? tempDir,
        autoStart: serviceOptions.autoStart,
      }),
    createLegacyService: (serviceOptions: {
      logger?: TradeHistoryMockLogger;
      tempDir?: string;
      autoStart?: boolean;
    } = {}) =>
      createLegacyTradeHistoryService({
        logger: serviceOptions.logger ?? logger,
        tempDir: serviceOptions.tempDir ?? tempDir,
        autoStart: serviceOptions.autoStart,
      }),
  };
}

export function createManagedTradeHistoryContext(options: {
  logger?: TradeHistoryMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
  tempDir?: string;
} = {}): ManagedTradeHistoryContext {
  const harness = createTradeHistoryHarness(options);
  const factory = createTradeHistoryBoundFactory({
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    tempDir: harness.tempDir,
  });

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    tempDir: harness.tempDir,
    createService: (serviceOptions = {}) =>
      serviceOptions.withErrorHandler === false
        ? factory.createLegacyService({
            tempDir: serviceOptions.tempDir,
          })
        : factory.createStandardService({
            tempDir: serviceOptions.tempDir,
            errorHandler: serviceOptions.errorHandler,
          }),
    cleanup() {
      cleanupTradeHistoryTempDir(harness.tempDir);
      jest.clearAllMocks();
    },
  };
}
