import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { TradingError } from '../../errors/BaseError';
import { ActionQueueService } from '../../services/action-queue.service';
import { BotEventBus } from '../../services/event-bus';
import type { LoggerService } from '../../services/logger.service';
import { TradingLifecycleManager } from '../../services/trading-lifecycle.service';
import {
  PositionLifecycleConfig,
  PositionLifecycleState,
  TrackedPosition,
} from '../../types/legacy';

type ExecuteAsyncResult = { success: boolean; value?: unknown; error?: TradingError };
type ExecuteAsyncConfig = { retryConfig?: { maxAttempts?: number; initialDelayMs?: number } };

export interface MockTradingLifecycleLogger extends Partial<LoggerService> {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
}

export interface MockTradingLifecycleEventBus extends Partial<BotEventBus> {
  subscribe: jest.Mock;
  publishSync: jest.Mock;
  publish: jest.Mock;
  unsubscribe: jest.Mock;
  clear: jest.Mock;
  getSubscribers: jest.Mock;
}

export interface MockTradingLifecycleActionQueue extends Partial<ActionQueueService> {
  enqueue: jest.Mock;
  process: jest.Mock;
  getQueue: jest.Mock;
  getPendingActions: jest.Mock;
  getResults: jest.Mock;
  getMetrics: jest.Mock;
  clear: jest.Mock;
  resetMetrics: jest.Mock;
}

export interface TradingLifecycleTestHarness {
  logger: MockTradingLifecycleLogger;
  eventBus: MockTradingLifecycleEventBus;
  actionQueue: MockTradingLifecycleActionQueue;
  errorHandler: jest.Mocked<ErrorHandler>;
  manager: TradingLifecycleManager;
  createManager: (
    overrides?: Partial<{
      config: PositionLifecycleConfig;
      logger: MockTradingLifecycleLogger;
      eventBus: MockTradingLifecycleEventBus;
      actionQueue: MockTradingLifecycleActionQueue;
      errorHandler: jest.Mocked<ErrorHandler> | undefined;
    }>,
  ) => TradingLifecycleManager;
  stopTrackedManagers: () => void;
}

export interface TradingLifecycleTestContext {
  harness: TradingLifecycleTestHarness;
  logger: MockTradingLifecycleLogger;
  eventBus: MockTradingLifecycleEventBus;
  actionQueue: MockTradingLifecycleActionQueue;
  errorHandler: jest.Mocked<ErrorHandler>;
  manager: TradingLifecycleManager;
  rebuild: (overrides?: Partial<{
    config: PositionLifecycleConfig;
    logger: MockTradingLifecycleLogger;
    eventBus: MockTradingLifecycleEventBus;
    actionQueue: MockTradingLifecycleActionQueue;
    errorHandler: jest.Mocked<ErrorHandler> | undefined;
  }>) => TradingLifecycleManager;
  cleanup: () => void;
}

export interface ManagedTradingLifecycleContext extends TradingLifecycleTestContext {}

export function createMockTradingLifecycleLogger(): MockTradingLifecycleLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createMockTradingLifecycleEventBus(): MockTradingLifecycleEventBus {
  return {
    subscribe: jest.fn(() => jest.fn()),
    publishSync: jest.fn(),
    publish: jest.fn(),
    unsubscribe: jest.fn(),
    clear: jest.fn(),
    getSubscribers: jest.fn(() => ({})),
  };
}

export function createMockTradingLifecycleActionQueue(): MockTradingLifecycleActionQueue {
  return {
    enqueue: jest.fn(),
    process: jest.fn(),
    getQueue: jest.fn(() => []),
    getPendingActions: jest.fn(() => []),
    getResults: jest.fn(() => new Map()),
    getMetrics: jest.fn(() => ({ enqueued: 0, processed: 0, failed: 0 })),
    clear: jest.fn(),
    resetMetrics: jest.fn(),
  };
}

export function createMockTradingLifecycleErrorHandler(): jest.Mocked<ErrorHandler> {
  return {
    handle: jest.fn((error: unknown, options: { strategy?: RecoveryStrategy }) => {
      if (options.strategy === RecoveryStrategy.THROW) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof TradingError ? error : undefined,
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
            return { success: true, value };
          } catch (error) {
            lastError = error;
            if (attempt < maxAttempts - 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, config?.retryConfig?.initialDelayMs ?? 100),
              );
            }
          }
        }

        return {
          success: false,
          error: lastError instanceof TradingError ? lastError : undefined,
        };
      },
    ),
    getLogger: jest.fn(() => createMockTradingLifecycleLogger() as unknown as LoggerService),
    addCallback: jest.fn(),
    removeCallback: jest.fn(),
    isRecoveryMode: jest.fn(() => true),
  } as unknown as jest.Mocked<ErrorHandler>;
}

export function createTradingLifecycleConfig(
  overrides?: Partial<PositionLifecycleConfig>,
): PositionLifecycleConfig {
  return {
    maxHoldingTimeMinutes: 60,
    warningThresholdMinutes: 45,
    enableAutomaticTimeout: true,
    ...overrides,
  };
}

export function createTrackedPositionFixture(
  overrides?: Partial<TrackedPosition>,
): TrackedPosition {
  return {
    positionId: 'pos-123',
    symbol: 'BTCUSDT',
    direction: 'LONG',
    entryPrice: 50000,
    entryTime: Date.now() - 60000,
    quantity: 1,
    totalExposureUsdt: 50000,
    state: PositionLifecycleState.OPEN,
    lastUpdateTime: Date.now(),
    ...overrides,
  };
}

export function createTradingLifecycleTestHarness(): TradingLifecycleTestHarness {
  const logger = createMockTradingLifecycleLogger();
  const eventBus = createMockTradingLifecycleEventBus();
  const actionQueue = createMockTradingLifecycleActionQueue();
  const errorHandler = createMockTradingLifecycleErrorHandler();
  const trackedManagers: TradingLifecycleManager[] = [];

  const createManager: TradingLifecycleTestHarness['createManager'] = (overrides = {}) => {
    const manager = new TradingLifecycleManager(
      overrides.config ?? createTradingLifecycleConfig(),
      (overrides.logger ?? logger) as unknown as LoggerService,
      (overrides.eventBus ?? eventBus) as unknown as BotEventBus,
      (overrides.actionQueue ?? actionQueue) as unknown as ActionQueueService,
      overrides.errorHandler === undefined ? errorHandler : overrides.errorHandler,
    );

    trackedManagers.push(manager);
    return manager;
  };

  return {
    logger,
    eventBus,
    actionQueue,
    errorHandler,
    manager: createManager(),
    createManager,
    stopTrackedManagers(): void {
      while (trackedManagers.length > 0) {
        trackedManagers.pop()?.stop();
      }
    },
  };
}

export function createTradingLifecycleTestContext(
  overrides?: Partial<{
    config: PositionLifecycleConfig;
    logger: MockTradingLifecycleLogger;
    eventBus: MockTradingLifecycleEventBus;
    actionQueue: MockTradingLifecycleActionQueue;
    errorHandler: jest.Mocked<ErrorHandler> | undefined;
  }>,
): TradingLifecycleTestContext {
  const harness = createTradingLifecycleTestHarness();

  const context: TradingLifecycleTestContext = {
    harness,
    logger: harness.logger,
    eventBus: harness.eventBus,
    actionQueue: harness.actionQueue,
    errorHandler: harness.errorHandler,
    manager: harness.manager,
    rebuild(rebuildOverrides = {}) {
      context.logger = rebuildOverrides.logger ?? harness.logger;
      context.eventBus = rebuildOverrides.eventBus ?? harness.eventBus;
      context.actionQueue = rebuildOverrides.actionQueue ?? harness.actionQueue;
      context.errorHandler =
        Object.prototype.hasOwnProperty.call(rebuildOverrides, 'errorHandler')
          ? (rebuildOverrides.errorHandler as jest.Mocked<ErrorHandler>)
          : harness.errorHandler;
      context.manager = harness.createManager({
        ...overrides,
        ...rebuildOverrides,
      });
      return context.manager;
    },
    cleanup() {
      harness.stopTrackedManagers();
    },
  };

  context.manager = harness.createManager(overrides);

  return context;
}

export function createManagedTradingLifecycleContext(
  overrides?: Partial<{
    config: PositionLifecycleConfig;
    logger: MockTradingLifecycleLogger;
    eventBus: MockTradingLifecycleEventBus;
    actionQueue: MockTradingLifecycleActionQueue;
    errorHandler: jest.Mocked<ErrorHandler> | undefined;
  }>,
): ManagedTradingLifecycleContext {
  jest.clearAllMocks();

  const context = createTradingLifecycleTestContext(overrides);
  const cleanup = context.cleanup.bind(context);

  context.cleanup = () => {
    cleanup();
    jest.clearAllMocks();
  };

  return context;
}

export function createStandardTradingLifecycleManager(
  harness: Pick<TradingLifecycleTestHarness, 'createManager'>,
  overrides?: Partial<{
    config: PositionLifecycleConfig;
    logger: MockTradingLifecycleLogger;
    eventBus: MockTradingLifecycleEventBus;
    actionQueue: MockTradingLifecycleActionQueue;
    errorHandler: jest.Mocked<ErrorHandler>;
  }>,
): TradingLifecycleManager {
  return harness.createManager(overrides);
}

export function createLegacyTradingLifecycleManager(
  harness: Pick<TradingLifecycleTestHarness, 'createManager'>,
  overrides?: Partial<{
    config: PositionLifecycleConfig;
    logger: MockTradingLifecycleLogger;
    eventBus: MockTradingLifecycleEventBus;
    actionQueue: MockTradingLifecycleActionQueue;
  }>,
): TradingLifecycleManager {
  return harness.createManager({
    ...overrides,
    errorHandler: undefined,
  });
}
