import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { ConfigValidatorService } from '../../services/config-validator.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export const createConfigValidatorLogger = (): LoggerService =>
  new LoggerService(LogLevel.ERROR, './logs', false);

export const createConfigValidatorErrorHandler = (): ErrorHandler & { handle: jest.Mock } => {
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
    strategy: RecoveryStrategy.THROW,
  } as Awaited<ReturnType<ErrorHandler['handle']>>);

  return handler as ErrorHandler & { handle: jest.Mock };
};

export const createConfigValidatorService = ({
  logger = createConfigValidatorLogger(),
  errorHandler,
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): ConfigValidatorService => new ConfigValidatorService(logger, errorHandler);

export const createConfigValidatorFactory = ({
  logger = createConfigValidatorLogger(),
  errorHandler,
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) => (): ConfigValidatorService =>
  createConfigValidatorService({
    logger,
    errorHandler,
  });

export const createConfigValidatorHarness = () => {
  const logger = createConfigValidatorLogger();
  const errorHandler = createConfigValidatorErrorHandler();
  const validator = createConfigValidatorService({ logger, errorHandler });

  return {
    logger,
    errorHandler,
    validator,
  };
};

export const createValidConfigValidatorConfig = () => ({
  exchange: {
    symbol: 'BTCUSDT',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
  },
  riskManagement: {
    stopLossPercent: 2.5,
    positionSizeUsdt: 10,
  },
  trading: {
    leverage: 10,
  },
  thresholds: {
    defaults: {
      confidence: {
        min: 0.6,
        clampMin: 0.3,
        clampMax: 0.9,
      },
    },
    regimes: {
      LOW: { confidence: { min: 0.5 } },
      MEDIUM: { confidence: { min: 0.6 } },
      HIGH: { confidence: { min: 0.7 } },
    },
  },
  strategies: {
    levelBased: {
      minConfidenceThreshold: 0.65,
      blockLongInDowntrend: true,
      blockShortInUptrend: false,
      levelClustering: {
        trendFilters: {
          downtrend: { rsiThreshold: 30 },
          uptrend: { rsiThreshold: 70 },
        },
      },
    },
  },
  entryScanner: {
    minConfidenceThreshold: 0.3,
    confidenceClampMin: 0.2,
    confidenceClampMax: 0.95,
  },
  entryThresholds: {
    minTotalScore: 0.55,
  },
  strategicWeights: {
    technicalIndicators: {
      rsi: { enabled: true },
      ema: { enabled: true },
      atr: { enabled: true },
    },
    marketStructure: {
      liquidity: { enabled: false },
      divergence: { enabled: false },
      breakout: { enabled: false },
      flatMarket: { enabled: false },
    },
    smcMicrostructure: {
      footprint: { enabled: true },
      orderBlock: { enabled: true },
      fairValueGap: { enabled: false },
    },
    externalData: {
      btcCorrelation: { enabled: false },
      fundingRate: { enabled: false },
      orderbookImbalance: { enabled: false },
    },
  },
});

export const asConfigValidatorInput = (
  value: unknown,
): Parameters<ConfigValidatorService['validateAll']>[0] =>
  value as Parameters<ConfigValidatorService['validateAll']>[0];
