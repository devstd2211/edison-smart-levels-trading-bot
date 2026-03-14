import { ErrorHandler } from '../../errors/ErrorHandler';
import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { LoggerService, LogLevel, PositionSide } from '../../types/legacy';

export function createTakeProfitManagerLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createTakeProfitManagerConfig(overrides: Partial<{
  positionId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  totalQuantity: number;
  leverage: number;
}> = {}) {
  return {
    positionId: 'test_123',
    symbol: 'APEXUSDT',
    side: PositionSide.SHORT,
    entryPrice: 1.1748,
    totalQuantity: 85.2,
    leverage: 10,
    ...overrides,
  };
}

export function createTakeProfitManagerHarness(options: {
  configOverrides?: Partial<{
    positionId: string;
    symbol: string;
    side: PositionSide;
    entryPrice: number;
    totalQuantity: number;
    leverage: number;
  }>;
  withErrorHandler?: boolean;
} = {}) {
  const logger = createTakeProfitManagerLogger();
  const errorHandler = new ErrorHandler(logger);
  const config = createTakeProfitManagerConfig(options.configOverrides);
  const manager = createTakeProfitManagerService({
    configOverrides: options.configOverrides,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    manager,
    logger,
    errorHandler,
    config,
  };
}

export function createTakeProfitManagerService(options: {
  configOverrides?: Partial<{
    positionId: string;
    symbol: string;
    side: PositionSide;
    entryPrice: number;
    totalQuantity: number;
    leverage: number;
  }>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createTakeProfitManagerLogger();
  const config = createTakeProfitManagerConfig(options.configOverrides);

  return new TakeProfitManagerService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
