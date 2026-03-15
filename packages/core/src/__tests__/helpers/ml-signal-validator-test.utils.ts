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
};

export function createMLSignalValidatorService(
  options: MLSignalValidatorServiceOptions = {},
): MLSignalValidatorService {
  return new MLSignalValidatorService(
    options.config,
    options.strategicConfig,
    options.logger,
    options.errorHandler,
  );
}

export function createMLSignalValidatorHarness(
  options: MLSignalValidatorServiceOptions = {},
) {
  const logger = options.logger ?? createMLSignalValidatorLogger();
  const errorHandler = options.errorHandler ?? createMLSignalValidatorErrorHandler(logger);

  return {
    logger,
    errorHandler,
    service: createMLSignalValidatorService({
      ...options,
      logger,
      errorHandler,
    }),
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
