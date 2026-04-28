import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  DynamicPositionSizerService,
  SizingConfig,
} from '../../services/dynamic-position-sizer.service';
import { LoggerService } from '../../types/legacy';

type LoggerMock = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export type DynamicPositionSizerInputs = {
  entryPrice: number;
  stopLoss: number;
  accountBalance: number;
  confidence: number;
  currentATR?: number;
  averageATR?: number;
  riskRewardRatio?: number;
};

export type DynamicPositionSizerServiceOptions = {
  config?: SizingConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
};

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

export function createDynamicSizingInputs(
  overrides: Partial<DynamicPositionSizerInputs> = {},
) {
  return {
    entryPrice: 105,
    stopLoss: 100,
    accountBalance: 10000,
    confidence: 0.7,
    currentATR: undefined,
    averageATR: undefined,
    riskRewardRatio: undefined,
    ...overrides,
  };
}

export async function calculateDynamicSizeScenario(
  service: DynamicPositionSizerService,
  overrides: Partial<DynamicPositionSizerInputs> = {},
) {
  const input = createDynamicSizingInputs(overrides);
  return service.calculateOptimalSize(
    input.entryPrice,
    input.stopLoss,
    input.accountBalance,
    input.confidence,
    input.currentATR,
    input.averageATR,
    input.riskRewardRatio,
  );
}

export function createDynamicPositionSizerHarness(
  overrides: Partial<SizingConfig> = {},
): {
  service: DynamicPositionSizerService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: SizingConfig;
  createInvalidService: (
    config: ConstructorParameters<typeof DynamicPositionSizerService>[0],
    options?: {
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
    },
  ) => DynamicPositionSizerService;
  createBrokenService: () => DynamicPositionSizerService;
  createNoHandlerService: () => DynamicPositionSizerService;
  createService: (options?: DynamicPositionSizerServiceOptions) => DynamicPositionSizerService;
} {
  const logger = createDynamicPositionSizerLogger() as unknown as LoggerService;
  const errorHandler = new ErrorHandler(logger);
  const config = createDynamicPositionSizerConfig(overrides);
  const createService = (
    options: DynamicPositionSizerServiceOptions = {},
  ): DynamicPositionSizerService =>
    new DynamicPositionSizerService(
      options.config ?? config,
      Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger : logger,
      Object.prototype.hasOwnProperty.call(options, 'errorHandler') ? options.errorHandler : errorHandler,
    );

  return {
    service: createService(),
    logger,
    errorHandler,
    config,
    createInvalidService: (invalidConfig, options = {}) =>
      new DynamicPositionSizerService(
        invalidConfig,
        Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger : logger,
        Object.prototype.hasOwnProperty.call(options, 'errorHandler') ? options.errorHandler : errorHandler,
      ),
    createBrokenService: () => {
      const brokenLogger = createDynamicPositionSizerBrokenLogger() as unknown as LoggerService;
      return createService({
        logger: brokenLogger,
        errorHandler: new ErrorHandler(brokenLogger),
      });
    },
    createNoHandlerService: () => createService({ errorHandler: undefined }),
    createService,
  };
}

export interface ManagedDynamicPositionSizerContext {
  service: DynamicPositionSizerService;
  logger: LoggerService;
  errorHandler: ErrorHandler;
  config: SizingConfig;
  createInvalidService: ReturnType<typeof createDynamicPositionSizerHarness>['createInvalidService'];
  createBrokenService: ReturnType<typeof createDynamicPositionSizerHarness>['createBrokenService'];
  createNoHandlerService: ReturnType<typeof createDynamicPositionSizerHarness>['createNoHandlerService'];
  createService: ReturnType<typeof createDynamicPositionSizerHarness>['createService'];
  cleanup: () => void;
}

export type DynamicPositionSizerState = Pick<
  ManagedDynamicPositionSizerContext,
  | 'service'
  | 'logger'
  | 'errorHandler'
  | 'config'
  | 'createInvalidService'
  | 'createBrokenService'
  | 'createNoHandlerService'
  | 'createService'
  | 'cleanup'
>;

export type DynamicPositionSizerRuntime = DynamicPositionSizerState;

export function createManagedDynamicPositionSizerContext(
  overrides: Partial<SizingConfig> = {},
): ManagedDynamicPositionSizerContext {
  jest.clearAllMocks();

  const harness = createDynamicPositionSizerHarness(overrides);

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
