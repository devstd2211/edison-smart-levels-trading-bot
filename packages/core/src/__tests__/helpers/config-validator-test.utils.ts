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

export const createStandardConfigValidatorService = ({
  logger = createConfigValidatorLogger(),
  errorHandler,
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): ConfigValidatorService =>
  createConfigValidatorService({
    logger,
    errorHandler,
  });

export const createLegacyConfigValidatorService = ({
  logger = createConfigValidatorLogger(),
}: {
  logger?: LoggerService;
} = {}): ConfigValidatorService =>
  createConfigValidatorService({
    logger,
  });

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

export const createStandardConfigValidatorFactory = ({
  logger = createConfigValidatorLogger(),
  errorHandler,
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) => (): ConfigValidatorService =>
  createStandardConfigValidatorService({
    logger,
    errorHandler,
  });

export const createLegacyConfigValidatorFactory = ({
  logger = createConfigValidatorLogger(),
}: {
  logger?: LoggerService;
} = {}) => (): ConfigValidatorService =>
  createLegacyConfigValidatorService({
    logger,
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

export const createStandardConfigValidatorHarness = () => {
  const logger = createConfigValidatorLogger();
  const errorHandler = createConfigValidatorErrorHandler();
  const validator = createStandardConfigValidatorService({ logger, errorHandler });

  return {
    logger,
    errorHandler,
    validator,
  };
};

export interface ManagedConfigValidatorContext {
  logger: LoggerService;
  errorHandler: ErrorHandler & { handle: jest.Mock };
  validator: ConfigValidatorService;
  createValidator: () => ConfigValidatorService;
  createLegacyValidator: () => ConfigValidatorService;
  cleanup: () => void;
}

export const createManagedConfigValidatorContext = ({
  logger = createConfigValidatorLogger(),
  errorHandler = createConfigValidatorErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler & { handle: jest.Mock };
} = {}): ManagedConfigValidatorContext => {
  const validator = createStandardConfigValidatorService({ logger, errorHandler });

  return {
    logger,
    errorHandler,
    validator,
    createValidator: createBoundStandardConfigValidatorFactory({ logger, errorHandler }),
    createLegacyValidator: createBoundLegacyConfigValidatorFactory({ logger }),
    cleanup: () => {
      errorHandler.handle.mockClear();
      jest.clearAllMocks();
    },
  };
};

export const createBoundStandardConfigValidatorFactory = ({
  logger = createConfigValidatorLogger(),
  errorHandler = createConfigValidatorErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}) => () =>
  createStandardConfigValidatorService({
    logger,
    errorHandler,
  });

export const createBoundLegacyConfigValidatorFactory = ({
  logger = createConfigValidatorLogger(),
}: {
  logger?: LoggerService;
} = {}) => () =>
  createLegacyConfigValidatorService({
    logger,
  });

export const createLegacyConfigValidatorHarness = () => {
  const logger = createConfigValidatorLogger();
  const validator = createLegacyConfigValidatorService({ logger });

  return {
    logger,
    errorHandler: undefined,
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

export type ConfigValidatorTestConfig = ReturnType<typeof createValidConfigValidatorConfig>;

type ExchangeOverrides = Omit<Partial<ConfigValidatorTestConfig['exchange']>, 'symbol'> & {
  symbol?: ConfigValidatorTestConfig['exchange']['symbol'] | null;
};

export const createConfigValidatorConfig = ({
  exchange,
  riskManagement,
  trading,
  thresholdsDefaultsConfidence,
  strategiesLevelBased,
  technicalIndicators,
}: {
  exchange?: ExchangeOverrides;
  riskManagement?: Partial<ConfigValidatorTestConfig['riskManagement']>;
  trading?: Partial<ConfigValidatorTestConfig['trading']>;
  thresholdsDefaultsConfidence?: Partial<
    ConfigValidatorTestConfig['thresholds']['defaults']['confidence']
  >;
  strategiesLevelBased?: Partial<ConfigValidatorTestConfig['strategies']['levelBased']>;
  technicalIndicators?: Partial<
    {
      [TKey in keyof ConfigValidatorTestConfig['strategicWeights']['technicalIndicators']]:
        Partial<ConfigValidatorTestConfig['strategicWeights']['technicalIndicators'][TKey]>;
    }
  >;
} = {}): ConfigValidatorTestConfig => {
  const base = createValidConfigValidatorConfig();

  return {
    ...base,
    exchange: {
      ...base.exchange,
      ...exchange,
    } as ConfigValidatorTestConfig['exchange'],
    riskManagement: {
      ...base.riskManagement,
      ...riskManagement,
    },
    trading: {
      ...base.trading,
      ...trading,
    },
    thresholds: {
      ...base.thresholds,
      defaults: {
        ...base.thresholds.defaults,
        confidence: {
          ...base.thresholds.defaults.confidence,
          ...thresholdsDefaultsConfidence,
        },
      },
    },
    strategies: {
      ...base.strategies,
      levelBased: {
        ...base.strategies.levelBased,
        ...strategiesLevelBased,
      },
    },
    strategicWeights: {
      ...base.strategicWeights,
      technicalIndicators: {
        rsi: {
          ...base.strategicWeights.technicalIndicators.rsi,
          ...technicalIndicators?.rsi,
        },
        ema: {
          ...base.strategicWeights.technicalIndicators.ema,
          ...technicalIndicators?.ema,
        },
        atr: {
          ...base.strategicWeights.technicalIndicators.atr,
          ...technicalIndicators?.atr,
        },
      },
    },
  };
};

export const omitConfigValidatorSection = <
  TKey extends keyof ConfigValidatorTestConfig,
>(
  config: ConfigValidatorTestConfig,
  key: TKey,
): Omit<ConfigValidatorTestConfig, TKey> => {
  const next = { ...config };
  delete next[key];
  return next;
};

export const asConfigValidatorInput = (
  value: unknown,
): Parameters<ConfigValidatorService['validateAll']>[0] =>
  value as Parameters<ConfigValidatorService['validateAll']>[0];
