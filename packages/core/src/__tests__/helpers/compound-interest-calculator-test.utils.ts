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

export function createStandardCompoundInterestService(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
} = {}) {
  return createCompoundInterestService({
    configOverrides: options.configOverrides,
    logger: options.logger,
    getBalance: options.getBalance,
    errorHandler: options.errorHandler,
  });
}

export function createLegacyCompoundInterestService(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
} = {}) {
  return createCompoundInterestService({
    configOverrides: options.configOverrides,
    logger: options.logger,
    getBalance: options.getBalance,
    withErrorHandler: false,
  });
}

export function createCompoundInterestFactory(options: {
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
} = {}) {
  return (factoryOptions: {
    configOverrides?: Partial<CompoundInterestConfig>;
    withErrorHandler?: boolean;
  } = {}) =>
    createCompoundInterestService({
      configOverrides: factoryOptions.configOverrides,
      logger: options.logger,
      getBalance: options.getBalance,
      errorHandler: options.errorHandler,
      withErrorHandler: factoryOptions.withErrorHandler,
    });
}

export function createStandardCompoundInterestFactory(options: {
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
} = {}) {
  return (factoryOptions: {
    configOverrides?: Partial<CompoundInterestConfig>;
  } = {}) =>
    createStandardCompoundInterestService({
      configOverrides: factoryOptions.configOverrides,
      logger: options.logger,
      getBalance: options.getBalance,
      errorHandler: options.errorHandler,
    });
}

export function createLegacyCompoundInterestFactory(options: {
  logger?: LoggerService;
  getBalance?: jest.Mock;
} = {}) {
  return (factoryOptions: {
    configOverrides?: Partial<CompoundInterestConfig>;
  } = {}) =>
    createLegacyCompoundInterestService({
      configOverrides: factoryOptions.configOverrides,
      logger: options.logger,
      getBalance: options.getBalance,
    });
}

export function createCompoundInterestInvalidConfig(
  overrides: Partial<CompoundInterestConfig>,
): CompoundInterestConfig {
  return {
    ...createCompoundInterestConfig(),
    ...overrides,
  };
}

export function createStandardCompoundInterestBoundFactory(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createCompoundInterestLogger();
  const mockGetBalance = options.getBalance ?? jest.fn();
  const errorHandler = options.errorHandler ?? createCompoundInterestErrorHandler(logger);
  const defaultConfig = createCompoundInterestConfig(options.configOverrides);

  return {
    logger,
    mockGetBalance,
    errorHandler,
    defaultConfig,
    createCalculator: (factoryOptions: {
      configOverrides?: Partial<CompoundInterestConfig>;
    } = {}) =>
      createStandardCompoundInterestService({
        configOverrides: {
          ...options.configOverrides,
          ...factoryOptions.configOverrides,
        },
        logger,
        getBalance: mockGetBalance,
        errorHandler,
      }),
  };
}

export function createStandardCompoundInterestHarness(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
} = {}) {
  return createStandardCompoundInterestBoundFactory(options);
}

export function createLegacyCompoundInterestBoundFactory(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
} = {}) {
  const logger = options.logger ?? createCompoundInterestLogger();
  const mockGetBalance = options.getBalance ?? jest.fn();
  const defaultConfig = createCompoundInterestConfig(options.configOverrides);

  return {
    logger,
    mockGetBalance,
    errorHandler: undefined,
    defaultConfig,
    createCalculator: (factoryOptions: {
      configOverrides?: Partial<CompoundInterestConfig>;
    } = {}) =>
      createLegacyCompoundInterestService({
        configOverrides: {
          ...options.configOverrides,
          ...factoryOptions.configOverrides,
        },
        logger,
        getBalance: mockGetBalance,
      }),
  };
}

export function createLegacyCompoundInterestHarness(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
} = {}) {
  return createLegacyCompoundInterestBoundFactory(options);
}

export function createCompoundInterestBoundFactory(options: {
  configOverrides?: Partial<CompoundInterestConfig>;
  logger?: LoggerService;
  getBalance?: jest.Mock;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createCompoundInterestLogger();
  const mockGetBalance = options.getBalance ?? jest.fn();
  const errorHandler = options.errorHandler ?? createCompoundInterestErrorHandler(logger);
  const defaultConfig = createCompoundInterestConfig(options.configOverrides);

  return {
    logger,
    mockGetBalance,
    errorHandler,
    defaultConfig,
    createCalculator: (factoryOptions: {
      configOverrides?: Partial<CompoundInterestConfig>;
      withErrorHandler?: boolean;
    } = {}) =>
      createCompoundInterestService({
        configOverrides: {
          ...options.configOverrides,
          ...factoryOptions.configOverrides,
        },
        logger,
        getBalance: mockGetBalance,
        errorHandler,
        withErrorHandler: factoryOptions.withErrorHandler ?? options.withErrorHandler,
      }),
  };
}
