import { ErrorHandler } from '../../errors/ErrorHandler';
import { CandleAggregatorService } from '../../services/candle-aggregator.service';
import type { LoggerService } from '../../services/logger.service';
import type { Candle } from '../../types/legacy';

export type CandleAggregatorMockLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  silly: jest.Mock;
};

export function createCandleAggregatorMockLogger(): CandleAggregatorMockLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    silly: jest.fn(),
  };
}

export function asCandleAggregatorLogger(
  logger: CandleAggregatorMockLogger,
): LoggerService {
  return logger as unknown as LoggerService;
}

export function createCandleAggregatorHarness() {
  const mockLogger = createCandleAggregatorMockLogger();
  const errorHandler = new ErrorHandler(asCandleAggregatorLogger(mockLogger));
  const service = new CandleAggregatorService(
    asCandleAggregatorLogger(mockLogger),
    errorHandler,
  );

  return {
    service,
    errorHandler,
    mockLogger,
  };
}

export function createAggregatorMockCandle(timestamp: number, price: number): Candle {
  return {
    timestamp,
    open: price,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 1000,
  };
}

export function createFiveMinuteAggregatorCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  for (let i = 0; i < 10; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 10,
    });
    timestamp += 60000;
    price += 0.1;
  }

  return candles;
}

export function createFifteenMinuteAggregatorCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  for (let i = 0; i < 30; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 5,
    });
    timestamp += 60000;
    price += 0.05;
  }

  return candles;
}

export function createOneHourAggregatorCandles(): Candle[] {
  const candles: Candle[] = [];
  let timestamp = 1000;
  let price = 100;

  for (let i = 0; i < 60; i++) {
    candles.push({
      timestamp,
      open: price,
      high: price + 0.5,
      low: price - 0.5,
      close: price,
      volume: 100 + i * 2,
    });
    timestamp += 60000;
    price += 0.02;
  }

  return candles;
}
