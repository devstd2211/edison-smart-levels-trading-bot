import * as fs from 'fs';
import { IExchange } from '../../interfaces/IExchange';
import { ActionQueueService } from '../../services/action-queue.service';
import { BotEventBus } from '../../services/event-bus';
import { GracefulShutdownManager } from '../../services/graceful-shutdown.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import {
  BotStateSnapshot,
  GracefulShutdownConfig,
  LoggerService,
  Position,
  PositionSide,
} from '../../types/legacy';

export interface GracefulShutdownMocks {
  positionLifecycleService: jest.Mocked<PositionLifecycleService>;
  actionQueue: jest.Mocked<ActionQueueService>;
  exchange: jest.Mocked<IExchange>;
  logger: jest.Mocked<LoggerService>;
  eventBus: jest.Mocked<BotEventBus>;
}

export interface GracefulShutdownHarness {
  mocks: GracefulShutdownMocks;
  manager: GracefulShutdownManager;
  createManager: (options?: {
    config?: GracefulShutdownConfig;
    stateDirectory?: string;
  }) => GracefulShutdownManager;
}

export interface GracefulShutdownTestContext {
  harness: GracefulShutdownHarness;
  mocks: GracefulShutdownMocks;
  manager: GracefulShutdownManager;
  rebuild: (options?: {
    position?: Position | null;
    config?: GracefulShutdownConfig;
    stateDirectory?: string;
  }) => GracefulShutdownManager;
}

export interface ManagedGracefulShutdownTestContext extends GracefulShutdownTestContext {
  cleanup: () => void;
}

type GracefulShutdownContextOptions = {
  position?: Position | null;
  config?: GracefulShutdownConfig;
  stateDirectory?: string;
};

export const defaultGracefulShutdownConfig: GracefulShutdownConfig = {
  enabled: true,
  timeoutMs: 30000,
  forceExitOnTimeout: true,
  closeAllPositions: true,
  persistState: true,
};

export function createMockShutdownPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-123',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    quantity: 0.1,
    entryPrice: 45000,
    leverage: 10,
    marginUsed: 450,
    unrealizedPnL: 500,
    status: 'OPEN',
    openedAt: Date.now() - 3600000,
    orderId: 'order-123',
    reason: 'shutdown-test',
    takeProfits: [{ level: 1, percent: 0.5, sizePercent: 50, price: 46000, hit: false }],
    stopLoss: {
      price: 44000,
      initialPrice: 44000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  };
}

export function createGracefulShutdownMocks(
  position: Position | null = createMockShutdownPosition(),
): GracefulShutdownMocks {
  return {
    positionLifecycleService: {
      getCurrentPosition: jest.fn().mockReturnValue(position),
      getPositionHistory: jest.fn().mockReturnValue([]),
      updatePosition: jest.fn(),
    } as unknown as jest.Mocked<PositionLifecycleService>,
    actionQueue: {
      enqueue: jest.fn(),
      waitEmpty: jest.fn().mockResolvedValue(undefined),
      getQueueSize: jest.fn().mockReturnValue(0),
      clear: jest.fn(),
    } as unknown as jest.Mocked<ActionQueueService>,
    exchange: {
      cancelAllOrders: jest.fn().mockResolvedValue(undefined),
      cancelAllConditionalOrders: jest.fn().mockResolvedValue(undefined),
      getSymbols: jest.fn().mockResolvedValue([]),
      getBalance: jest.fn().mockResolvedValue({}),
      placeOrder: jest.fn(),
      cancelOrder: jest.fn(),
      getOrderHistory: jest.fn(),
      getOpenOrders: jest.fn(),
      getPositions: jest.fn(),
      getTradingPairs: jest.fn(),
      getTicker: jest.fn(),
      getKlines: jest.fn(),
      subscribeToTicker: jest.fn(),
      subscribeToPositions: jest.fn(),
      subscribeToOrders: jest.fn(),
      unsubscribeTicker: jest.fn(),
    } as unknown as jest.Mocked<IExchange>,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>,
    eventBus: {
      publishSync: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as unknown as jest.Mocked<BotEventBus>,
  };
}

export function setupGracefulShutdownFsMocks(options: {
  exists?: boolean;
  readFile?: string;
} = {}): void {
  (fs.existsSync as jest.Mock).mockReturnValue(options.exists ?? false);
  (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
  (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  (fs.readFileSync as jest.Mock).mockReturnValue(options.readFile ?? '{}');
}

export function createGracefulShutdownManager(
  mocks: GracefulShutdownMocks,
  options: {
    config?: GracefulShutdownConfig;
    stateDirectory?: string;
  } = {},
): GracefulShutdownManager {
  return new GracefulShutdownManager(
    options.config ?? defaultGracefulShutdownConfig,
    mocks.positionLifecycleService,
    mocks.actionQueue,
    mocks.exchange,
    mocks.logger,
    mocks.eventBus,
    options.stateDirectory ?? './test-shutdown-state',
  );
}

export function createGracefulShutdownHarness(options: {
  position?: Position | null;
  config?: GracefulShutdownConfig;
  stateDirectory?: string;
} = {}): GracefulShutdownHarness {
  const mocks = createGracefulShutdownMocks(options.position);
  const createManager = (managerOptions: {
    config?: GracefulShutdownConfig;
    stateDirectory?: string;
  } = {}) =>
    createGracefulShutdownManager(mocks, {
      config: managerOptions.config ?? options.config,
      stateDirectory: managerOptions.stateDirectory ?? options.stateDirectory,
    });

  return {
    mocks,
    manager: createManager(),
    createManager,
  };
}

export function createStandardGracefulShutdownManager(
  harness: Pick<GracefulShutdownHarness, 'createManager'>,
  options?: {
    config?: GracefulShutdownConfig;
    stateDirectory?: string;
  },
): GracefulShutdownManager {
  return harness.createManager(options);
}

export function createGracefulShutdownTestContext(
  options: GracefulShutdownContextOptions = {},
): GracefulShutdownTestContext {
  const context = {
    harness: undefined as unknown as GracefulShutdownHarness,
    mocks: undefined as unknown as GracefulShutdownMocks,
    manager: undefined as unknown as GracefulShutdownManager,
    rebuild(rebuildOptions: GracefulShutdownContextOptions = {}) {
      context.harness = createGracefulShutdownHarness({
        position:
          Object.prototype.hasOwnProperty.call(rebuildOptions, 'position')
            ? rebuildOptions.position
            : options.position,
        config: rebuildOptions.config ?? options.config,
        stateDirectory: rebuildOptions.stateDirectory ?? options.stateDirectory,
      });
      context.mocks = context.harness.mocks;
      context.manager = context.harness.manager;
      return context.manager;
    },
  };

  context.rebuild();

  return context;
}

export function createManagedGracefulShutdownTestContext(
  options: GracefulShutdownContextOptions = {},
): ManagedGracefulShutdownTestContext {
  const context = createGracefulShutdownTestContext(options);

  return {
    ...context,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

export function getGracefulShutdownInternals(
  manager: GracefulShutdownManager,
): { cancelAllPendingOrders: () => Promise<number> } {
  return manager as unknown as { cancelAllPendingOrders: () => Promise<number> };
}

export function registerGracefulShutdownHandlers(
  manager: GracefulShutdownManager,
): jest.SpiedFunction<typeof process.on> {
  const spy = jest.spyOn(process, 'on');
  manager.registerShutdownHandlers();
  return spy;
}

export function getRegisteredShutdownHandler(
  registrationSpy: jest.SpiedFunction<typeof process.on>,
  signal: 'SIGINT' | 'SIGTERM',
): () => Promise<void> {
  return registrationSpy.mock.calls.find((call) => call[0] === signal)?.[1] as () => Promise<void>;
}

export function createGracefulShutdownSavedState(
  overrides: Partial<BotStateSnapshot> = {},
): BotStateSnapshot {
  return {
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
        persistedAt: Date.now(),
      },
    ],
    sessionMetrics: {
      totalTrades: 5,
      totalPnL: 2500,
      startTime: Date.now(),
    },
    riskMetrics: {
      dailyPnL: 2500,
      consecutiveLosses: 0,
      totalExposure: 45000,
    },
    ...overrides,
  };
}
