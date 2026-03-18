import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  PositionScalingService,
  PositionState,
  ScalingConfig,
} from '../../services/position-scaling.service';
import { LoggerService } from '../../types/legacy';

type LoggerMock = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export function createPositionScalingLogger(
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

export function createPositionScalingBrokenLogger(): LoggerMock {
  const throwError = () => {
    throw new Error('Logger broken');
  };

  return createPositionScalingLogger({
    debug: jest.fn(throwError),
    info: jest.fn(throwError),
    warn: jest.fn(throwError),
    error: jest.fn(throwError),
  });
}

export function createPositionScalingConfig(
  overrides: Partial<ScalingConfig> = {},
): ScalingConfig {
  return {
    scaleInThreshold: 0.5,
    maxScales: 3,
    scaleReduction: 0.5,
    breakevenThreshold: 0.5,
    ...overrides,
  };
}

export function createPositionScalingPosition(
  overrides: Partial<PositionState> = {},
): PositionState {
  return {
    entryPrice: 100,
    currentPrice: 105,
    size: 100,
    stopLoss: 95,
    profitTarget: 110,
    scaleCount: 0,
    side: 'long',
    ...overrides,
  };
}

export function createPositionScalingHarness(
  overrides: Partial<ScalingConfig> = {},
): {
  service: PositionScalingService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: ScalingConfig;
  position: PositionState;
  createBrokenService: () => PositionScalingService;
  createNoHandlerService: () => PositionScalingService;
  createService: (options?: {
    config?: ScalingConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => PositionScalingService;
} {
  const logger = createPositionScalingLogger() as unknown as LoggerService;
  const errorHandler = new ErrorHandler(logger);
  const config = createPositionScalingConfig(overrides);
  const position = createPositionScalingPosition();
  const createService = (options: {
    config?: ScalingConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  } = {}): PositionScalingService =>
    new PositionScalingService(
      options.config ?? config,
      Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger : logger,
      Object.prototype.hasOwnProperty.call(options, 'errorHandler') ? options.errorHandler : errorHandler,
    );

  return {
    service: createService(),
    logger,
    errorHandler,
    config,
    position,
    createBrokenService: () => {
      const brokenLogger = createPositionScalingBrokenLogger() as unknown as LoggerService;
      return createService({
        logger: brokenLogger,
        errorHandler: new ErrorHandler(brokenLogger),
      });
    },
    createNoHandlerService: () => createService({ errorHandler: undefined }),
    createService,
  };
}
