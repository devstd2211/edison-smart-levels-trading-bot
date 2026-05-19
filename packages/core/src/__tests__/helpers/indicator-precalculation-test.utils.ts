import { CandleProvider } from '../../providers/candle.provider';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { IndicatorPreCalculationService } from '../../services/indicator-precalculation.service';
import { LoggerService } from '../../services/logger.service';
import { LogLevel } from '../../types/legacy';
import type { IIndicatorCache, IIndicatorCalculator } from '../../types/legacy';
import { createManagedHarnessTracker } from './managed-test-context.utils';

export function createIndicatorPrecalculationMockCalculator(name: string) {
  return {
    calculate: jest.fn(),
    getConfig: jest.fn().mockReturnValue({
      indicators: [
        {
          name,
          periods: [14],
          timeframes: ['ENTRY'],
          minCandlesRequired: 100,
        },
      ],
    }),
  };
}

export type IndicatorPrecalculationMockCalculator = ReturnType<
  typeof createIndicatorPrecalculationMockCalculator
>;

export function createIndicatorPrecalculationMockCache() {
  return {
    set: jest.fn(),
    get: jest.fn(),
    invalidate: jest.fn(),
    clear: jest.fn(),
    getStatistics: jest.fn().mockReturnValue({
      hitCount: 0,
      missCount: 0,
      size: 0,
    }),
  };
}

export type IndicatorPrecalculationMockCache = ReturnType<
  typeof createIndicatorPrecalculationMockCache
>;

export function createIndicatorPrecalculationMockCandleProvider() {
  return {
    getCandles: jest.fn().mockResolvedValue([
      {
        timestamp: Date.now(),
        open: 100,
        high: 101,
        low: 99,
        close: 100.5,
        volume: 1000,
      },
      {
        timestamp: Date.now() - 60000,
        open: 99,
        high: 100,
        low: 98,
        close: 100,
        volume: 1000,
      },
    ]),
  };
}

export type IndicatorPrecalculationMockCandleProvider = ReturnType<
  typeof createIndicatorPrecalculationMockCandleProvider
>;

export type IndicatorPrecalculationHarnessOptions = {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
  withErrorHandler?: boolean;
};

export type IndicatorPrecalculationServiceFactoryOptions = {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createIndicatorPrecalculationLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createIndicatorPrecalculationErrorHandler(
  logger: LoggerService = createIndicatorPrecalculationLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createIndicatorPrecalculationService(
  options?: IndicatorPrecalculationServiceFactoryOptions,
) {
  const logger = options?.logger ?? createIndicatorPrecalculationLogger();
  const candleProvider =
    options?.candleProvider ?? createIndicatorPrecalculationMockCandleProvider();
  const cache = options?.cache ?? createIndicatorPrecalculationMockCache();
  const calculators = options?.calculators ?? [
    createIndicatorPrecalculationMockCalculator('RSI'),
    createIndicatorPrecalculationMockCalculator('EMA'),
    createIndicatorPrecalculationMockCalculator('BB'),
  ];

  return new IndicatorPreCalculationService(
    candleProvider as unknown as CandleProvider,
    cache as unknown as IIndicatorCache,
    calculators as unknown as IIndicatorCalculator[],
    logger,
    options?.withErrorHandler === false
      ? undefined
      : (options?.errorHandler ?? createIndicatorPrecalculationErrorHandler(logger)),
  );
}

export function createStandardIndicatorPrecalculationService(options?: {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
  errorHandler?: ErrorHandler;
}) {
  return createIndicatorPrecalculationService({
    logger: options?.logger,
    candleProvider: options?.candleProvider,
    cache: options?.cache,
    calculators: options?.calculators,
    errorHandler: options?.errorHandler,
  });
}

export function createLegacyIndicatorPrecalculationService(options?: {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
}) {
  return createIndicatorPrecalculationService({
    logger: options?.logger,
    candleProvider: options?.candleProvider,
    cache: options?.cache,
    calculators: options?.calculators,
    withErrorHandler: false,
  });
}

export function createIndicatorPrecalculationHarness(
  options?: IndicatorPrecalculationHarnessOptions,
) {
  const logger = options?.logger ?? createIndicatorPrecalculationLogger();
  const errorHandler = createIndicatorPrecalculationErrorHandler(logger);
  const candleProvider =
    options?.candleProvider ?? createIndicatorPrecalculationMockCandleProvider();
  const cache = options?.cache ?? createIndicatorPrecalculationMockCache();
  const calculators = options?.calculators ?? [
    createIndicatorPrecalculationMockCalculator('RSI'),
    createIndicatorPrecalculationMockCalculator('EMA'),
    createIndicatorPrecalculationMockCalculator('BB'),
  ];

  const service =
    options?.withErrorHandler === false
      ? createLegacyIndicatorPrecalculationService({
          logger,
          candleProvider,
          cache,
          calculators,
        })
      : createStandardIndicatorPrecalculationService({
          logger,
          candleProvider,
          cache,
          calculators,
          errorHandler,
        });

  service.setOnIndicatorsReady(jest.fn().mockResolvedValue(undefined));

  return {
    service,
    logger,
    errorHandler,
    candleProvider,
    cache,
    calculators,
  };
}

export function createLegacyIndicatorPrecalculationHarness(options?: {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
}) {
  return createIndicatorPrecalculationHarness({
    ...options,
    withErrorHandler: false,
  });
}

export type IndicatorPrecalculationHarness = ReturnType<
  typeof createIndicatorPrecalculationHarness
>;

export type ManagedIndicatorPrecalculationContext = IndicatorPrecalculationHarness & {
  createHarness: (options?: IndicatorPrecalculationHarnessOptions) => IndicatorPrecalculationHarness;
  createStandardService: (
    options?: Omit<IndicatorPrecalculationServiceFactoryOptions, 'withErrorHandler'>,
  ) => IndicatorPreCalculationService;
  createLegacyHarness: (
    options?: Omit<IndicatorPrecalculationHarnessOptions, 'withErrorHandler'>,
  ) => IndicatorPrecalculationHarness;
  cleanup: () => void;
};

export type IndicatorPrecalculationManagedRuntime = Pick<
  ManagedIndicatorPrecalculationContext,
  | 'service'
  | 'logger'
  | 'errorHandler'
  | 'candleProvider'
  | 'cache'
  | 'calculators'
  | 'createStandardService'
  | 'createLegacyHarness'
  | 'cleanup'
>;

export type IndicatorPrecalculationErrorHandlingState = IndicatorPrecalculationManagedRuntime;

export function createManagedIndicatorPrecalculationContext(options?: {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
  withErrorHandler?: boolean;
}): ManagedIndicatorPrecalculationContext {
  const tracker = createManagedHarnessTracker({
    baseOptions: options ?? {},
    createHarness: (nextOptions: IndicatorPrecalculationHarnessOptions) =>
      createIndicatorPrecalculationHarness(nextOptions),
    cleanupOptions: {
      clearTimers: true,
    },
  });
  const createHarness = tracker.createTrackedHarness;
  const createLegacyHarness = (
    nextOptions?: Omit<IndicatorPrecalculationHarnessOptions, 'withErrorHandler'>,
  ) => {
    return tracker.trackHarness(createLegacyIndicatorPrecalculationHarness({
      ...options,
      ...nextOptions,
    }));
  };
  const harness = createHarness(options);

  return {
    ...harness,
    createHarness,
    createStandardService: (serviceOptions = {}) =>
      createStandardIndicatorPrecalculationService({
        logger: serviceOptions.logger ?? harness.logger,
        candleProvider: serviceOptions.candleProvider ?? harness.candleProvider,
        cache: serviceOptions.cache ?? harness.cache,
        calculators: serviceOptions.calculators ?? harness.calculators,
        errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
      }),
    createLegacyHarness,
    cleanup: tracker.cleanup,
  };
}
