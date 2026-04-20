import { ErrorHandler } from '../../errors/ErrorHandler';
import { TimeframeWeightingService } from '../../services/timeframe-weighting.service';
import { MultiTimeframeAnalysis, TradingMode, TrendBias } from '../../types/legacy';

export const createTimeframeWeightingMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

export type TimeframeWeightingMockLogger = ReturnType<
  typeof createTimeframeWeightingMockLogger
>;

export const asTimeframeWeightingErrorLogger = (
  value: TimeframeWeightingMockLogger,
): ConstructorParameters<typeof ErrorHandler>[0] =>
  value as unknown as ConstructorParameters<typeof ErrorHandler>[0];

export const asTimeframeWeightingLogger = (
  value: TimeframeWeightingMockLogger,
): ConstructorParameters<typeof TimeframeWeightingService>[0] =>
  value as unknown as ConstructorParameters<typeof TimeframeWeightingService>[0];

export const asTimeframeWeightingMultiTF = (
  value: unknown,
): Parameters<TimeframeWeightingService['combine']>[0] =>
  value as Parameters<TimeframeWeightingService['combine']>[0];

export const asTimeframeWeightingMode = (value: unknown): TradingMode =>
  value as TradingMode;

export const createValidTimeframeWeightingMultiTF =
  (): MultiTimeframeAnalysis => ({
    byTimeframe: {
      '5m': {
        bias: TrendBias.BULLISH,
        strength: 0.7,
        timeframe: '5m',
        swingHighsCount: 2,
        swingLowsCount: 1,
      } as unknown as MultiTimeframeAnalysis['byTimeframe']['5m'],
      '15m': {
        bias: TrendBias.BULLISH,
        strength: 0.8,
        timeframe: '15m',
        swingHighsCount: 2,
        swingLowsCount: 1,
      } as unknown as MultiTimeframeAnalysis['byTimeframe']['5m'],
      '1h': {
        bias: TrendBias.BULLISH,
        strength: 0.75,
        timeframe: '1h',
        swingHighsCount: 2,
        swingLowsCount: 1,
      } as unknown as MultiTimeframeAnalysis['byTimeframe']['5m'],
      '4h': {
        bias: TrendBias.BULLISH,
        strength: 0.65,
        timeframe: '4h',
        swingHighsCount: 2,
        swingLowsCount: 1,
      } as unknown as MultiTimeframeAnalysis['byTimeframe']['5m'],
    },
    consensus: {
      primaryTrend: TrendBias.BULLISH,
      currentTrend: TrendBias.BULLISH,
      entryTrend: TrendBias.BULLISH,
      strength: 0.725,
      alignment: 'ALIGNED',
    },
  });

export const createTimeframeWeightingMultiTF = (overrides: Partial<MultiTimeframeAnalysis> = {}): MultiTimeframeAnalysis => ({
  ...createValidTimeframeWeightingMultiTF(),
  ...overrides,
});

export const createInvalidTimeframeWeightingMultiTF = (
  overrides: Partial<MultiTimeframeAnalysis['byTimeframe']> = {},
): Parameters<TimeframeWeightingService['combine']>[0] =>
  asTimeframeWeightingMultiTF({
    byTimeframe: {
      ...createValidTimeframeWeightingMultiTF().byTimeframe,
      ...overrides,
    },
  });

export const createTimeframeWeightingService = (options: {
  logger?: TimeframeWeightingMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): TimeframeWeightingService =>
  new TimeframeWeightingService(
    options.logger
      ? asTimeframeWeightingLogger(options.logger)
      : undefined,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );

export const createTimeframeWeightingErrorHandler = (
  logger: TimeframeWeightingMockLogger,
): ErrorHandler => new ErrorHandler(asTimeframeWeightingErrorLogger(logger));

export const createTimeframeWeightingHarness = (options: {
  logger?: TimeframeWeightingMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) => {
  const logger = options.logger ?? createTimeframeWeightingMockLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : options.errorHandler ?? createTimeframeWeightingErrorHandler(logger);
  const createStandardService = (overrides: {
    logger?: TimeframeWeightingMockLogger;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  } = {}) =>
    createTimeframeWeightingService({
      logger: overrides.logger ?? logger,
      errorHandler: overrides.errorHandler ?? errorHandler,
      withErrorHandler: overrides.withErrorHandler ?? options.withErrorHandler,
    });

  const createLegacyService = (overrides: {
    logger?: TimeframeWeightingMockLogger;
  } = {}) =>
    createTimeframeWeightingService({
      logger: overrides.logger ?? logger,
      withErrorHandler: false,
    });

  return {
    logger,
    errorHandler,
    service: createStandardService(),
    createStandardService,
    createLegacyService,
    createMultiTF: (overrides: Partial<MultiTimeframeAnalysis> = {}) =>
      createTimeframeWeightingMultiTF(overrides),
  };
};

export type TimeframeWeightingHarness = ReturnType<
  typeof createTimeframeWeightingHarness
>;

export type ManagedTimeframeWeightingContext = TimeframeWeightingHarness & {
  cleanup: () => void;
};

export type TimeframeWeightingManagedRuntime = Pick<
  ManagedTimeframeWeightingContext,
  'service' | 'logger' | 'errorHandler'
>;

export type TimeframeWeightingServiceFactories = Pick<
  ManagedTimeframeWeightingContext,
  'createStandardService' | 'createLegacyService' | 'createMultiTF' | 'cleanup'
>;

export const createManagedTimeframeWeightingContext = (options: {
  logger?: TimeframeWeightingMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedTimeframeWeightingContext => {
  const harness = createTimeframeWeightingHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.clearAllTimers();
      jest.useRealTimers();
    },
  };
};
