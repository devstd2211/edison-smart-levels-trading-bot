import { ErrorHandler } from '../../errors/ErrorHandler';
import { RetestEntryService } from '../../services/retest-entry.service';
import {
  Candle,
  LoggerService,
  LogLevel,
  RetestConfig,
  Signal,
  SignalDirection,
  SignalType,
} from '../../types/legacy';

export function createRetestEntryLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createRetestEntryMockLogger(overrides: Record<string, unknown> = {}) {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    ...overrides,
  };
}

export function createRetestEntryMockLoggerService(
  overrides: Record<string, unknown> = {},
): LoggerService {
  return createRetestEntryMockLogger(overrides) as unknown as LoggerService;
}

export function createRetestEntryConfig(
  overrides: Partial<RetestConfig> = {},
): RetestConfig {
  return {
    enabled: true,
    minImpulsePercent: 0.5,
    retestZoneFibStart: 50,
    retestZoneFibEnd: 61.8,
    maxRetestWaitMs: 300000,
    volumeMultiplier: 0.8,
    requireStructureIntact: true,
    ...overrides,
  };
}

export function createRetestEntrySignal(
  overrides: Partial<Signal> = {},
): Signal {
  return {
    direction: SignalDirection.LONG,
    type: SignalType.TREND_FOLLOWING,
    confidence: 85,
    price: 1.1575,
    stopLoss: 1.1475,
    takeProfits: [
      { level: 1, price: 1.1635, percent: 0.5, sizePercent: 33.33, hit: false },
      { level: 2, price: 1.1695, percent: 1.0, sizePercent: 33.33, hit: false },
      { level: 3, price: 1.1815, percent: 2.0, sizePercent: 33.34, hit: false },
    ],
    reason: 'Test signal',
    timestamp: Date.now(),
    marketData: {
      rsi: 60,
      ema20: 1.15,
      ema50: 1.145,
      atr: 0.01,
    },
    ...overrides,
  };
}

export function createRetestEntryCandles(): Candle[] {
  return [
    { timestamp: Date.now() - 5000, open: 1.15, high: 1.151, low: 1.149, close: 1.1505, volume: 1000 },
    { timestamp: Date.now() - 4000, open: 1.1505, high: 1.152, low: 1.15, close: 1.1515, volume: 1000 },
    { timestamp: Date.now() - 3000, open: 1.1515, high: 1.154, low: 1.151, close: 1.1535, volume: 1000 },
    { timestamp: Date.now() - 2000, open: 1.1535, high: 1.156, low: 1.153, close: 1.1555, volume: 1000 },
    { timestamp: Date.now() - 1000, open: 1.1555, high: 1.158, low: 1.155, close: 1.1575, volume: 1000 },
  ];
}

export function createRetestEntryInvalidCandle(
  overrides: Partial<Candle> = {},
): Candle {
  return {
    timestamp: Date.now(),
    open: NaN,
    high: NaN,
    low: NaN,
    close: NaN,
    volume: NaN,
    ...overrides,
  };
}

export function createRetestEntryHarness(options: {
  configOverrides?: Partial<RetestConfig>;
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createRetestEntryLogger();
  const config = createRetestEntryConfig(options.configOverrides);
  const errorHandler =
    options.withErrorHandler === false ? undefined : createRetestEntryErrorHandler(logger);
  const service = createRetestEntryService({
    configOverrides: options.configOverrides,
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });
  const createService = (
    serviceOptions: {
      configOverrides?: Partial<RetestConfig>;
      logger?: LoggerService;
      errorHandler?: ErrorHandler;
      withErrorHandler?: boolean;
    } = {},
  ) =>
    createRetestEntryService({
      configOverrides: options.configOverrides,
      logger,
      errorHandler,
      withErrorHandler: options.withErrorHandler,
      ...serviceOptions,
    });

  return {
    service,
    logger,
    config,
    errorHandler,
    createService,
  };
}

export function createRetestEntryErrorHandler(
  logger: LoggerService = createRetestEntryLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createRetestEntryService(options: {
  configOverrides?: Partial<RetestConfig>;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createRetestEntryLogger();
  const config = createRetestEntryConfig(options.configOverrides);

  return new RetestEntryService(
    config,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}
