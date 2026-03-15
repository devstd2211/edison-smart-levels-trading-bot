import { ErrorHandler } from '../../errors/ErrorHandler';
import { ConsoleDashboardService } from '../../services/console-dashboard.service';
import { LoggerService, Position } from '../../types/legacy';

type DashboardConfigInput = ConstructorParameters<typeof ConsoleDashboardService>[0];

export function createConsoleDashboardMockLogger(): LoggerService {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  } as unknown as LoggerService;
}

export function createConsoleDashboardErrorHandler(
  logger: LoggerService = createConsoleDashboardMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createConsoleDashboardService(options: {
  config?: DashboardConfigInput;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ConsoleDashboardService {
  const config =
    Object.prototype.hasOwnProperty.call(options, 'config')
      ? options.config
      : ({ enabled: false } as DashboardConfigInput);

  return new ConsoleDashboardService(
    config,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createConsoleDashboardFactory(options: {
  errorHandler?: ErrorHandler;
} = {}) {
  return (factoryOptions: {
    config?: DashboardConfigInput;
    withErrorHandler?: boolean;
  } = {}) =>
    createConsoleDashboardService({
      config: factoryOptions.config,
      errorHandler: options.errorHandler,
      withErrorHandler: factoryOptions.withErrorHandler,
    });
}

export function createConsoleDashboardHarness(options: {
  config?: DashboardConfigInput;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createConsoleDashboardMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createConsoleDashboardErrorHandler(logger);
  const service = createConsoleDashboardService({
    config: options.config,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}

export function createConsoleDashboardPosition(): Position {
  return {
    id: 'test-pos',
    symbol: 'BTC/USDT',
    entryPrice: 50000,
    quantity: 0.1,
    side: 'LONG',
    status: 'OPEN',
    createdAt: new Date(),
    updatedAt: new Date(),
    pnl: 1000,
    pnlPercent: 2,
    fees: 10,
    takeProfits: [],
    stopLoss: 49000,
  } as unknown as Position;
}
