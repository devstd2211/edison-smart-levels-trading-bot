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

export function createTakeProfitManagerFactory(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) {
  return (factoryOptions: {
    configOverrides?: Partial<{
      positionId: string;
      symbol: string;
      side: PositionSide;
      entryPrice: number;
      totalQuantity: number;
      leverage: number;
    }>;
    withErrorHandler?: boolean;
  } = {}) =>
    createTakeProfitManagerService({
      configOverrides: factoryOptions.configOverrides,
      logger: options.logger,
      errorHandler: options.errorHandler,
      withErrorHandler: factoryOptions.withErrorHandler,
    });
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

export function createTakeProfitManagerCloseSequence(
  prices: number[],
  quantity = 28.4,
) {
  return prices.map((exitPrice, index) => ({
    level: index + 1,
    quantity,
    exitPrice,
  }));
}

export function createTakeProfitManagerBoundFactory(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createTakeProfitManagerLogger();
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);

  return {
    logger,
    errorHandler,
    createManager: (factoryOptions: {
      configOverrides?: Partial<{
        positionId: string;
        symbol: string;
        side: PositionSide;
        entryPrice: number;
        totalQuantity: number;
        leverage: number;
      }>;
      withErrorHandler?: boolean;
    } = {}) =>
      createTakeProfitManagerService({
        configOverrides: factoryOptions.configOverrides,
        logger,
        errorHandler,
        withErrorHandler: factoryOptions.withErrorHandler ?? options.withErrorHandler,
      }),
  };
}

export interface ManagedTakeProfitManagerContext {
  manager: TakeProfitManagerService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: ReturnType<typeof createTakeProfitManagerConfig>;
  createManager: ReturnType<typeof createTakeProfitManagerBoundFactory>['createManager'];
  cleanup: () => void;
}

export type TakeProfitManagerState = Pick<
  ManagedTakeProfitManagerContext,
  'manager' | 'logger' | 'errorHandler' | 'config' | 'createManager' | 'cleanup'
>;

export function createManagedTakeProfitManagerContext(options: {
  configOverrides?: Partial<{
    positionId: string;
    symbol: string;
    side: PositionSide;
    entryPrice: number;
    totalQuantity: number;
    leverage: number;
  }>;
  withErrorHandler?: boolean;
} = {}): ManagedTakeProfitManagerContext {
  jest.clearAllMocks();

  const harness = createTakeProfitManagerHarness(options);
  const factory = createTakeProfitManagerBoundFactory({
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    withErrorHandler: options.withErrorHandler,
  });
  const createdManagers = new Set<TakeProfitManagerService>([harness.manager]);

  const trackManager = (manager: TakeProfitManagerService) => {
    createdManagers.add(manager);
    return manager;
  };

  return {
    manager: harness.manager,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    config: harness.config,
    createManager: (factoryOptions = {}) => trackManager(factory.createManager(factoryOptions)),
    cleanup: () => {
      createdManagers.forEach((manager) => {
        manager.reset();
      });
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
