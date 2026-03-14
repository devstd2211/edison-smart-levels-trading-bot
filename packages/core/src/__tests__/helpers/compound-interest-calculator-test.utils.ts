import { ErrorHandler } from '../../errors/ErrorHandler';
import { CompoundInterestCalculatorService } from '../../services/compound-interest-calculator.service';
import { CompoundInterestConfig, LoggerService, LogLevel } from '../../types/legacy';

export function createCompoundInterestLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createCompoundInterestConfig(
  overrides: Partial<CompoundInterestConfig> = {},
): CompoundInterestConfig {
  return {
    enabled: true,
    useVirtualBalance: true,
    baseDeposit: 100,
    reinvestmentPercent: 50,
    maxRiskPerTrade: 2,
    minPositionSize: 10,
    maxPositionSize: 1000,
    profitLockPercent: 30,
    ...overrides,
  };
}

export function createCompoundInterestHarness(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createCompoundInterestLogger();
  const config = createCompoundInterestConfig(options.configOverrides);
  const mockGetBalance = options.getBalance ?? jest.fn();
  const errorHandler = createCompoundInterestErrorHandler(logger);
  const service = createCompoundInterestService({
    configOverrides: options.configOverrides,
    logger,
    getBalance: mockGetBalance,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    config,
    mockGetBalance,
    errorHandler,
  };
}

export function createCompoundInterestErrorHandler(
  logger: LoggerService = createCompoundInterestLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createCompoundInterestService(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createCompoundInterestLogger();
  const config = createCompoundInterestConfig(options.configOverrides);
  const getBalance = options.getBalance ?? jest.fn();

  return new CompoundInterestCalculatorService(
    config,
    logger,
    getBalance,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
