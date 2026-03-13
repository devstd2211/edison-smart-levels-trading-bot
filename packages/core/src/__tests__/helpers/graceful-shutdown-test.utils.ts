import * as fs from 'fs';
import { IExchange } from '../../interfaces/IExchange';
import { ActionQueueService } from '../../services/action-queue.service';
import { BotEventBus } from '../../services/event-bus';
import { GracefulShutdownManager } from '../../services/graceful-shutdown.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import {
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
