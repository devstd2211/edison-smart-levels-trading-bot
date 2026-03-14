import { ErrorHandler } from '../../errors/ErrorHandler';
import { PatternRecognitionService } from '../../services/pattern-recognition.service';
import { LoggerService } from '../../services/logger.service';
import {
  Candle,
  LogLevel,
  Pattern,
  PatternRecognitionConfig,
  SwingPoint,
  SwingPointType,
} from '../../types/legacy';

type LoggerMethod = jest.Mock;

export type PatternRecognitionInternals = {
  performPatternRecognition: (candles: Candle[]) => Pattern[];
  performStrengthCalculation: (pattern: Pattern) => number;
  performFibonacciCalculation: (swing: SwingPoint) => Array<{ level: number; price: number }>;
  performReliabilityScoring: (pattern: Pattern) => number;
  performZoneIdentification: () => Array<unknown>;
  candleHistory: Candle[];
};

export function asPatternRecognitionConfig(value: unknown): PatternRecognitionConfig {
  return value as PatternRecognitionConfig;
}

export function asPatternRecognitionCandles(value: unknown): Candle[] {
  return value as Candle[];
}

export function asPatternRecognitionPattern(value: unknown): Pattern {
  return value as Pattern;
}

export function asPatternRecognitionSwing(value: unknown): SwingPoint {
  return value as SwingPoint;
}

export function createPatternRecognitionLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createPatternRecognitionMockLogger(
  overrides: Partial<Record<'debug' | 'info' | 'warn' | 'error', LoggerMethod>> = {},
): LoggerService {
  return {
    debug: overrides.debug ?? jest.fn(),
    info: overrides.info ?? jest.fn(),
    warn: overrides.warn ?? jest.fn(),
    error: overrides.error ?? jest.fn(),
  } as unknown as LoggerService;
}

export function createPatternRecognitionCandle(
  open: number,
  high: number,
  low: number,
  close: number,
  timestamp: number = Date.now(),
): Candle {
  return {
    timestamp,
    open,
    high,
    low,
    close,
    volume: 1000,
  };
}

export function createPatternRecognitionCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 50000;

  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 100;
    const high = Math.max(open, close) + Math.random() * 50;
    const low = Math.min(open, close) - Math.random() * 50;

    candles.push(
      createPatternRecognitionCandle(open, high, low, close, Date.now() - (count - i) * 60000),
    );
    price = close;
  }

  return candles;
}

export function createPatternRecognitionSwing(overrides: Partial<SwingPoint> = {}): SwingPoint {
  return {
    type: SwingPointType.HIGH,
    price: 51000,
    timestamp: Date.now(),
    index: 10,
    strength: 70,
    ...overrides,
  };
}

export function createPatternRecognitionHarness(options: {
  config?: Partial<PatternRecognitionConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createPatternRecognitionLogger();
  const errorHandler = options.withErrorHandler === false ? undefined : new ErrorHandler(logger);
  const service = new PatternRecognitionService(options.config, undefined, logger, errorHandler);

  return {
    service,
    logger,
    errorHandler,
  };
}

export function asPatternRecognitionInternals(
  service: PatternRecognitionService,
): PatternRecognitionInternals {
  return service as unknown as PatternRecognitionInternals;
}
