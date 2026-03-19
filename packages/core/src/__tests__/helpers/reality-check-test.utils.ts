import { ErrorHandler } from '../../errors/ErrorHandler';
import { RealityCheckEvent, RealityCheckService } from '../../services/reality-check.service';
import { Signal } from '../../types/core';
import { SignalDirection, SignalType } from '../../types/enums';
import { LogLevel, LoggerService } from '../../types/legacy';
import { AnalyzerSignal } from '../../types/strategy';

type RealityCheckHarnessOptions = {
  logger?: LoggerService;
  withLogger?: boolean;
};

export const createRealityCheckMockLogger = (): LoggerService =>
  ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    getLogLevel: jest.fn(() => LogLevel.ERROR),
    setLogLevel: jest.fn(),
    logToFile: jest.fn(),
  }) as unknown as LoggerService;

export const createRealityCheckSignal = (override: Partial<Signal> = {}): Signal => ({
  direction: SignalDirection.LONG,
  type: SignalType.LEVEL_BASED,
  confidence: 75,
  price: 100,
  stopLoss: 99,
  takeProfits: [{ level: 1, percent: 2, sizePercent: 50, price: 102, hit: false }],
  reason: 'Test signal',
  timestamp: Date.now(),
  ...override,
});

export const createRealityCheckEvent = (
  override: Partial<RealityCheckEvent> = {},
): RealityCheckEvent => ({
  symbol: 'BTCUSDT',
  tradeId: 'trade-1',
  openedAt: Date.now() - 3600000,
  closedAt: Date.now(),
  direction: 'LONG',
  signalConfidence: 75,
  signalReason: 'Support bounce',
  trendAtEntry: 'UPTREND',
  entryPrice: 100,
  targetPrice: 102,
  stoplossPrice: 99,
  highestPrice: 101,
  lowestPrice: 98,
  closingPrice: 98.5,
  exitType: 'SL_HIT',
  actualTrendAtExit: 'DOWNTREND',
  priceMovedAgainst: true,
  priceReachedTarget: false,
  breakingAssumptions: ['Trend reversal not detected'],
  reason: 'REGIME_CHANGE',
  explanation: 'Expected uptrend but downtrend occurred',
  signingAnalyzers: ['RSI', 'MACD'],
  conflictingSignals: false,
  ...override,
});

export const createRealityCheckAnalyzerSignal = (
  override: Partial<AnalyzerSignal> = {},
): AnalyzerSignal => ({
  source: 'RSI',
  direction: SignalDirection.LONG,
  confidence: 80,
  weight: 0.5,
  priority: 5,
  ...override,
});

export const createRealityCheckPriceScenario = (overrides: {
  entryPrice?: number;
  highestPrice?: number;
  lowestPrice?: number;
  closingPrice?: number;
} = {}) => ({
  entryPrice: 100,
  highestPrice: 99,
  lowestPrice: 98.8,
  closingPrice: 98.8,
  ...overrides,
});

export const createRealityCheckHarness = (
  options: RealityCheckHarnessOptions = {},
): {
  service: RealityCheckService;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  createService: (serviceOptions?: RealityCheckHarnessOptions) => RealityCheckService;
} => {
  const logger = options.withLogger === false ? undefined : options.logger ?? createRealityCheckMockLogger();
  const createService = (
    serviceOptions: RealityCheckHarnessOptions = {},
  ) => createRealityCheckService({
    logger,
    withLogger: options.withLogger,
    ...serviceOptions,
  });

  return {
    service: createService(),
    logger,
    errorHandler: logger ? new ErrorHandler(logger) : undefined,
    createService,
  };
};

export const createRealityCheckService = (
  options: RealityCheckHarnessOptions = {},
): RealityCheckService => {
  const logger =
    options.withLogger === false
      ? undefined
      : options.logger ?? createRealityCheckMockLogger();
  return new RealityCheckService(logger);
};
