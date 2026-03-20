import { ErrorHandler } from '../../errors/ErrorHandler';
import type { LoggerService, TakeProfit } from '../../types/legacy';
import { MarketConditionAnalyzerService } from '../../services/market-condition-analyzer.service';

export type MarketConditionMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

export function createMarketConditionMockLogger(
  overrides?: Partial<MarketConditionMockLogger>,
): MarketConditionMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function asMarketConditionLogger(
  logger: MarketConditionMockLogger,
): LoggerService {
  return logger as unknown as LoggerService;
}

export function createMarketConditionHarness(
  overrides?: Partial<MarketConditionMockLogger>,
) {
  const logger = createMarketConditionMockLogger(overrides);
  const errorHandler = createMarketConditionErrorHandler(logger);
  const createService = (options?: {
    logger?: MarketConditionMockLogger;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  }) => createMarketConditionService({
    logger,
    errorHandler,
    ...options,
  });
  const service = createService();

  return {
    logger,
    errorHandler,
    service,
    createService,
  };
}

export function createMarketConditionErrorHandler(
  logger: MarketConditionMockLogger = createMarketConditionMockLogger(),
): ErrorHandler {
  return new ErrorHandler(asMarketConditionLogger(logger));
}

export function createMarketConditionService(options?: {
  logger?: MarketConditionMockLogger;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
}) {
  const logger = options?.logger ?? createMarketConditionMockLogger();
  if (options?.withErrorHandler === false) {
    return new MarketConditionAnalyzerService(asMarketConditionLogger(logger));
  }

  return new MarketConditionAnalyzerService(
    asMarketConditionLogger(logger),
    options?.errorHandler ?? new ErrorHandler(asMarketConditionLogger(logger)),
  );
}

export function createMarketConditionTakeProfit(
  level: number,
  price: number,
  sizePercent: number,
  percent: number,
): TakeProfit {
  return {
    level,
    price,
    sizePercent,
    percent,
    hit: false,
  };
}

export function createMarketConditionTakeProfitSeries(
  entries: Array<{
    level: number;
    price: number;
    sizePercent: number;
    percent: number;
  }>,
): TakeProfit[] {
  return entries.map((entry) =>
    createMarketConditionTakeProfit(
      entry.level,
      entry.price,
      entry.sizePercent,
      entry.percent,
    ),
  );
}

export function createSequentialMarketConditionTakeProfits(
  count: number,
  overrides: {
    startPrice?: number;
    priceStep?: number;
    sizePercent?: number;
    percentStep?: number;
  } = {},
): TakeProfit[] {
  const startPrice = overrides.startPrice ?? 100;
  const priceStep = overrides.priceStep ?? 10;
  const sizePercent = overrides.sizePercent ?? 5;
  const percentStep = overrides.percentStep ?? 0.1;

  return Array.from({ length: count }, (_, index) =>
    createMarketConditionTakeProfit(
      index + 1,
      startPrice + index * priceStep,
      sizePercent,
      percentStep * (index + 1),
    ),
  );
}

export function createInvalidMarketConditionTakeProfit(
  overrides: Partial<TakeProfit> = {},
): TakeProfit {
  return {
    ...createMarketConditionTakeProfit(1, 100, 50, 0.5),
    price: NaN,
    ...overrides,
  };
}

export function createMarketConditionResult(
  isFlat: boolean,
  confidence: number,
): { isFlat: boolean; confidence: number } {
  return {
    isFlat,
    confidence,
  };
}

export function createInvalidMarketConditionResult(
  overrides: Partial<{ isFlat: boolean; confidence: number }> = {},
): { isFlat: boolean; confidence: number } {
  return {
    isFlat: true,
    confidence: NaN,
    ...overrides,
  };
}
