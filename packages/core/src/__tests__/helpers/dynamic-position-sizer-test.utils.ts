import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  DynamicPositionSizerService,
  SizingConfig,
} from '../../services/dynamic-position-sizer.service';
import { LoggerService } from '../../types/legacy';

type LoggerMock = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export function createDynamicPositionSizerLogger(
  overrides: Partial<LoggerMock> = {},
): LoggerMock {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function createDynamicPositionSizerBrokenLogger(): LoggerMock {
  const throwError = () => {
    throw new Error('Logger broken');
  };

  return createDynamicPositionSizerLogger({
    debug: jest.fn(throwError),
    info: jest.fn(throwError),
    warn: jest.fn(throwError),
    error: jest.fn(throwError),
  });
}

export function createDynamicPositionSizerConfig(
  overrides: Partial<SizingConfig> = {},
): SizingConfig {
  return {
    baseRiskPercent: 1.0,
    maxRiskPercent: 3.0,
    minPositionSize: 10,
    maxPositionSize: 1000,
    volatilityMultiplier: 1.0,
    confidenceThreshold: 0.5,
    ...overrides,
  };
}

export function createDynamicPositionSizerHarness(
  overrides: Partial<SizingConfig> = {},
): {
  service: DynamicPositionSizerService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: SizingConfig;
} {
  const logger = createDynamicPositionSizerLogger() as unknown as LoggerService;
  const errorHandler = new ErrorHandler(logger);
  const config = createDynamicPositionSizerConfig(overrides);

  return {
    service: new DynamicPositionSizerService(config, logger, errorHandler),
    logger,
    errorHandler,
    config,
  };
}

