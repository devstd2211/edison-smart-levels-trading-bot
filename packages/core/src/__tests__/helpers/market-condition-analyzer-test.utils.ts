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
  const service = createMarketConditionService({
    logger,
    errorHandler,
  });

  return {
    logger,
    errorHandler,
    service,
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

export function createMarketConditionResult(
  isFlat: boolean,
  confidence: number,
): { isFlat: boolean; confidence: number } {
  return {
    isFlat,
    confidence,
  };
}
