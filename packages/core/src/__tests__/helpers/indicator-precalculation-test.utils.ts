import { CandleProvider } from '../../providers/candle.provider';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { IndicatorPreCalculationService } from '../../services/indicator-precalculation.service';
import { LoggerService } from '../../services/logger.service';
import { LogLevel } from '../../types/legacy';
import type { IIndicatorCache, IIndicatorCalculator } from '../../types/legacy';

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

export function createIndicatorPrecalculationHarness(options?: {
  logger?: LoggerService;
  candleProvider?: IndicatorPrecalculationMockCandleProvider;
  cache?: IndicatorPrecalculationMockCache;
  calculators?: IndicatorPrecalculationMockCalculator[];
  withErrorHandler?: boolean;
}) {
  const logger = options?.logger ?? new LoggerService(LogLevel.ERROR, './logs', false);
  const errorHandler = new ErrorHandler(logger);
  const candleProvider =
    options?.candleProvider ?? createIndicatorPrecalculationMockCandleProvider();
  const cache = options?.cache ?? createIndicatorPrecalculationMockCache();
  const calculators = options?.calculators ?? [
    createIndicatorPrecalculationMockCalculator('RSI'),
    createIndicatorPrecalculationMockCalculator('EMA'),
    createIndicatorPrecalculationMockCalculator('BB'),
  ];

  const service = new IndicatorPreCalculationService(
    candleProvider as unknown as CandleProvider,
    cache as unknown as IIndicatorCache,
    calculators as unknown as IIndicatorCalculator[],
    logger,
    options?.withErrorHandler === false ? undefined : errorHandler,
  );

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
