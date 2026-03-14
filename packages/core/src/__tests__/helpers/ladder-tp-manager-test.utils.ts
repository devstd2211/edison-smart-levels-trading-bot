import { ErrorHandler } from '../../errors/ErrorHandler';
import type { IExchange } from '../../interfaces/IExchange';
import { LadderTpManagerService } from '../../services/ladder-tp-manager.service';
import {
  LadderTpManagerConfig,
  LoggerService,
  LogLevel,
  Position,
  PositionSide,
} from '../../types/legacy';

export function createMockLadderTpBybitService(): jest.Mocked<IExchange> {
  return {
    closePosition: jest.fn().mockResolvedValue(undefined),
    updateStopLoss: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<IExchange>;
}

export function createLadderTpLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createLadderTpConfig(
  overrides: Partial<LadderTpManagerConfig> = {},
): LadderTpManagerConfig {
  return {
    levels: [
      { pricePercent: 0.08, closePercent: 33 },
      { pricePercent: 0.15, closePercent: 33 },
      { pricePercent: 0.25, closePercent: 34 },
    ],
    moveToBreakevenAfterTP1: true,
    trailingAfterTP2: true,
    minPartialClosePercent: 10,
    maxPartialClosePercent: 90,
    trailingDistancePercent: 0.05,
    ...overrides,
  };
}

export function createLadderTpPosition(
  side: PositionSide,
  entryPrice: number,
  quantity: number = 1,
  openedAt: number = Date.now(),
): Position {
  const slPrice = side === PositionSide.LONG ? entryPrice * 0.998 : entryPrice * 1.002;
  return {
    id: 'APEXUSDT_' + side,
    symbol: 'APEXUSDT',
    side,
    entryPrice,
    quantity,
    stopLoss: {
      price: slPrice,
      initialPrice: slPrice,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [],
    leverage: 10,
    marginUsed: 100,
    openedAt,
    unrealizedPnL: 0,
    orderId: 'ORDER_123',
    reason: 'Test',
    status: 'OPEN',
  };
}

export function createLadderTpHarness(options: {
  configOverrides?: Partial<LadderTpManagerConfig>;
  logger?: LoggerService;
  bybitService?: jest.Mocked<IExchange>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createLadderTpLogger();
  const bybitService = options.bybitService ?? createMockLadderTpBybitService();
  const errorHandler = createLadderTpErrorHandler(logger);
  const config = createLadderTpConfig(options.configOverrides);
  const service = createLadderTpService({
    configOverrides: options.configOverrides,
    logger,
    bybitService,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    bybitService,
    errorHandler,
    config,
  };
}

export function createLadderTpErrorHandler(
  logger: LoggerService = createLadderTpLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createLadderTpService(options: {
  configOverrides?: Partial<LadderTpManagerConfig>;
  logger?: LoggerService;
  bybitService?: jest.Mocked<IExchange>;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createLadderTpLogger();
  const bybitService = options.bybitService ?? createMockLadderTpBybitService();
  const config = createLadderTpConfig(options.configOverrides);

  return new LadderTpManagerService(
    config,
    bybitService,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
