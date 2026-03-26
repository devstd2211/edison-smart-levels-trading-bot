import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { MLSignalValidatorService } from '../../services/ml-signal-validator.service';
import {
  type MarketContext,
  type MLSignalValidatorConfig,
  type SignalRecord,
} from '../../types/ml-signal-validator';
import {
  LogLevel,
  SignalDirection,
  SignalType,
  type Signal,
  type SignalValidationConfig,
} from '../../types/legacy';

export function createMLSignalValidatorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createMLSignalValidatorErrorHandler(
  logger: LoggerService = createMLSignalValidatorLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

type MLSignalValidatorServiceOptions = {
  config?: Partial<MLSignalValidatorConfig>;
  strategicConfig?: SignalValidationConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createMLSignalValidatorService(
  options: MLSignalValidatorServiceOptions = {},
): MLSignalValidatorService {
  return new MLSignalValidatorService(
    options.config,
    options.strategicConfig,
    options.logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createMLSignalValidatorHarness(
  options: MLSignalValidatorServiceOptions = {},
) {
  const logger = options.logger ?? createMLSignalValidatorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? createMLSignalValidatorErrorHandler(logger);

  return {
    logger,
    errorHandler,
    service: createMLSignalValidatorService({
      ...options,
      logger,
      errorHandler,
    }),
    createStandardService: (serviceOptions: MLSignalValidatorServiceOptions = {}) =>
      createMLSignalValidatorService({
        config: serviceOptions.config ?? options.config,
        strategicConfig: serviceOptions.strategicConfig ?? options.strategicConfig,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createLegacyService: (serviceOptions: Omit<MLSignalValidatorServiceOptions, 'errorHandler'> = {}) =>
      createMLSignalValidatorService({
        config: serviceOptions.config ?? options.config,
        strategicConfig: serviceOptions.strategicConfig ?? options.strategicConfig,
        logger: serviceOptions.logger ?? logger,
        withErrorHandler: false,
      }),
  };
}

export interface ManagedMLSignalValidatorContext {
  service: MLSignalValidatorService;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
  createService: NonNullable<ReturnType<typeof createMLSignalValidatorHarness>['createStandardService']>;
  createStandardService: NonNullable<ReturnType<typeof createMLSignalValidatorHarness>['createStandardService']>;
  createLegacyService: NonNullable<ReturnType<typeof createMLSignalValidatorHarness>['createLegacyService']>;
  cleanup: () => void;
}

export function createManagedMLSignalValidatorContext(
  options: MLSignalValidatorServiceOptions = {},
): ManagedMLSignalValidatorContext {
  jest.clearAllMocks();

  const harness = createMLSignalValidatorHarness(options);
  const createdServices = new Set<MLSignalValidatorService>([harness.service]);

  const trackService = (service: MLSignalValidatorService) => {
    createdServices.add(service);
    return service;
  };

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    createService: (serviceOptions = {}) => trackService(harness.createStandardService(serviceOptions)),
    createStandardService: (serviceOptions = {}) =>
      trackService(harness.createStandardService(serviceOptions)),
    createLegacyService: (serviceOptions = {}) =>
      trackService(harness.createLegacyService(serviceOptions)),
    cleanup: () => {
      for (const service of createdServices) {
        service.clearHistory();
      }
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createMLSignalValidatorSignal(overrides?: Partial<Signal>): Signal {
  return {
    direction: SignalDirection.LONG,
    type: SignalType.LEVEL_BASED,
    confidence: 75,
    price: 50000,
    stopLoss: 49500,
    takeProfits: [{ level: 1, percent: 2, sizePercent: 100, price: 51000, hit: false }],
    reason: 'Test signal',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createMLSignalValidatorContext(
  overrides?: Partial<MarketContext>,
): MarketContext {
  return {
    regime: 'trending_up',
    volatility: 1.0,
    trendStrength: 0.7,
    currentPrice: 50000,
    volumeRatio: 1.2,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createMLSignalValidatorRecord(
  overrides?: Partial<SignalRecord>,
): SignalRecord {
  return {
    signal: createMLSignalValidatorSignal(),
    context: createMLSignalValidatorContext(),
    wasWinner: true,
    profitLoss: 2.5,
    actualRR: 3.0,
    duration: 3600000,
    timestamp: Date.now(),
    ...overrides,
  };
}
