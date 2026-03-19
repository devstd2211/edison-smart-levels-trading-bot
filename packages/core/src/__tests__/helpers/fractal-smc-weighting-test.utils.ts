import { ErrorHandler } from '../../errors/ErrorHandler';
import { FractalSmcWeightingService } from '../../services/fractal-smc-weighting.service';
import type { StrategyMarketData, WeightedSignalConfig } from '../../types/legacy';

export type FractalSmcWeightingMockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  silly: jest.Mock;
};

export function createFractalSmcWeightingMockLogger(): FractalSmcWeightingMockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  };
}

export function createFractalSmcWeightingMockLoggerWithFailures(
  overrides: Partial<FractalSmcWeightingMockLogger> = {},
): FractalSmcWeightingMockLogger {
  return {
    ...createFractalSmcWeightingMockLogger(),
    ...overrides,
  };
}

export function createFractalSmcWeightingConfig(): WeightedSignalConfig {
  return {
    threshold: 70,
    highConfidenceThreshold: 90,
    maxFractalScore: 125,
    maxSmcScore: 110,
  };
}

export function createFractalSmcWeightingSetup() {
  return {
    breakout: {
      confirmedByClose: true,
      strength: 0.8,
      volumeRatio: 1.5,
    },
    retest: {
      isSecondTouch: true,
      touchCount: 2,
    },
    reversal: {
      strongCandleBody: true,
      confirmationBars: 2,
      priceActionPattern: 'HAMMER',
      volumeConfirmed: true,
      structureAligned: true,
    },
  };
}

export function createFractalSmcWeightingData(): StrategyMarketData {
  return {
    liquidity: {
      strongZones: [{ price: 100 }],
      recentSweep: {
        detected: true,
      },
    },
  } as StrategyMarketData;
}

export function createFractalSmcWeightingInvalidSetup() {
  return {
    ...createFractalSmcWeightingSetup(),
    breakout: {
      confirmedByClose: true,
      strength: NaN,
      volumeRatio: Infinity,
    },
  };
}

export function createFractalSmcWeightingErrorHandler(
  logger: FractalSmcWeightingMockLogger = createFractalSmcWeightingMockLogger(),
): ErrorHandler {
  return new ErrorHandler(logger as unknown as ConstructorParameters<typeof ErrorHandler>[0]);
}

type FractalSmcWeightingServiceOptions = {
  config?: WeightedSignalConfig;
  logger?: FractalSmcWeightingMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createFractalSmcWeightingService(
  options: FractalSmcWeightingServiceOptions = {},
): FractalSmcWeightingService {
  const hasConfig = Object.prototype.hasOwnProperty.call(options, 'config');
  return new FractalSmcWeightingService(
    hasConfig ? (options.config as WeightedSignalConfig) : createFractalSmcWeightingConfig(),
    options.logger as unknown as ConstructorParameters<typeof FractalSmcWeightingService>[1],
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createFractalSmcWeightingHarness(
  options: FractalSmcWeightingServiceOptions = {},
) {
  const logger = options.logger ?? createFractalSmcWeightingMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? createFractalSmcWeightingErrorHandler(logger);
  const createService = (
    serviceOptions: FractalSmcWeightingServiceOptions = {},
  ) =>
    createFractalSmcWeightingService({
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    logger,
    errorHandler,
    service: createService(options),
    createService,
  };
}
