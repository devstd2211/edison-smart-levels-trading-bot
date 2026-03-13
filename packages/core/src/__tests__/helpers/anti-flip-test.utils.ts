import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { AntiFlipConfig } from '../../services/anti-flip.service';
import { Candle, LoggerService, LogLevel } from '../../types/legacy';

export type AntiFlipLoggerLike = Pick<LoggerService, 'debug' | 'info' | 'warn' | 'error'>;

export const createAntiFlipLogger = (): LoggerService =>
  new LoggerService(LogLevel.ERROR, './logs', false);

export const createAntiFlipMockLogger = (): AntiFlipLoggerLike => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

export const asAntiFlipLogger = (logger: AntiFlipLoggerLike): LoggerService =>
  logger as LoggerService;

export const createAntiFlipConfig = (
  overrides: Partial<AntiFlipConfig> = {},
): Partial<AntiFlipConfig> => ({
  enabled: true,
  cooldownCandles: 3,
  cooldownMs: 300000,
  requiredConfirmationCandles: 2,
  overrideConfidenceThreshold: 85,
  strongReversalRsiThreshold: 25,
  ...overrides,
});

export const createAntiFlipErrorHandler = (): ErrorHandler & { handle: jest.Mock } => {
  type HandleResult = Awaited<ReturnType<ErrorHandler['handle']>>;
  const handler = new ErrorHandler({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  });

  jest.spyOn(handler, 'handle').mockResolvedValue({
    success: true,
    recovered: true,
    message: 'Handled',
    strategy: RecoveryStrategy.SKIP,
  } as HandleResult);

  return handler as ErrorHandler & { handle: jest.Mock };
};

export const createBullishAntiFlipCandle = (price: number): Candle => ({
  timestamp: Date.now(),
  open: price - 1,
  high: price + 0.5,
  low: price - 1.5,
  close: price,
  volume: 100,
});

export const createBearishAntiFlipCandle = (price: number): Candle => ({
  timestamp: Date.now(),
  open: price + 1,
  high: price + 1.5,
  low: price - 0.5,
  close: price,
  volume: 100,
});
