import { ErrorHandler } from '../../errors/ErrorHandler';
import { StrategyConfigMergerService } from '../../services/strategy-config-merger.service';

type StrategyConfigMergerLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

type StrategyConfigMergerHarness = {
  service: StrategyConfigMergerService;
  errorHandler: ErrorHandler;
  logger: StrategyConfigMergerLogger;
};

export interface ManagedStrategyConfigMergerContext {
  service: StrategyConfigMergerService;
  errorHandler: ErrorHandler;
  logger: StrategyConfigMergerLogger;
  createService: (options?: ServiceOptions) => StrategyConfigMergerService;
  cleanup: () => void;
}

export type StrategyConfigMergerRuntime = Pick<
  ManagedStrategyConfigMergerContext,
  'logger' | 'service' | 'errorHandler'
>;

export type StrategyConfigMergerFactories = Pick<
  ManagedStrategyConfigMergerContext,
  'createService'
>;

export type StrategyConfigMergerState = StrategyConfigMergerRuntime &
  StrategyConfigMergerFactories &
  Pick<ManagedStrategyConfigMergerContext, 'cleanup'>;

type ServiceOptions = {
  logger?: ConstructorParameters<typeof StrategyConfigMergerService>[0];
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
};

export function createStrategyConfigMergerLogger(): StrategyConfigMergerLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

export function createStrategyConfigMergerErrorHandler(
  logger: ConstructorParameters<typeof ErrorHandler>[0] = createStrategyConfigMergerLogger() as unknown as ConstructorParameters<typeof ErrorHandler>[0],
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createStrategyConfigMergerService(options: ServiceOptions = {}): StrategyConfigMergerService {
  const logger = options.logger ?? createStrategyConfigMergerLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : (options.errorHandler ?? createStrategyConfigMergerErrorHandler(logger as ConstructorParameters<typeof ErrorHandler>[0]));

  return new StrategyConfigMergerService(logger, errorHandler);
}

export function createStrategyConfigMergerHarness(options: ServiceOptions = {}): StrategyConfigMergerHarness {
  const logger = (options.logger ?? createStrategyConfigMergerLogger()) as StrategyConfigMergerLogger;
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : (options.errorHandler ?? createStrategyConfigMergerErrorHandler(logger as ConstructorParameters<typeof ErrorHandler>[0]));
  const service = new StrategyConfigMergerService(logger, errorHandler);

  return {
    service,
    errorHandler: errorHandler ?? createStrategyConfigMergerErrorHandler(logger as ConstructorParameters<typeof ErrorHandler>[0]),
    logger,
  };
}

export function createStrategyConfigMergerMainConfig() {
  return {
    version: 1,
    meta: { description: 'Test', lastUpdated: '2024-01-01', activeAnalyzers: [] },
    exchange: { name: 'Bybit', symbol: 'BTCUSDT', demo: false, testnet: false, apiKey: 'key', apiSecret: 'secret' },
    trading: { leverage: 1, positionSizeUsdt: 100, maxPositions: 5, orderType: 'MARKET', tradingCycleIntervalMs: 1000 },
    riskManagement: {
      maxRiskPercent: 1,
      stopLoss: { type: 'ATR', multiplier: 2 },
      takeProfits: [],
    },
    timeframes: {},
    indicators: {
      ema: { enabled: true, fast: 12, slow: 26 },
      rsi: { enabled: true, period: 14 },
    },
    analyzers: {},
    filters: {},
    confidence: {},
    strategies: {},
    services: {},
    monitoring: {},
  };
}

export function createStrategyConfigMergerStrategy() {
  return {
    version: 1,
    metadata: { name: 'test-strategy', version: '1.0' },
    indicators: {
      ema: { fast: 10 },
    },
    riskManagement: {
      stopLoss: { type: 'FIXED', percent: 2 },
      takeProfits: [{ percent: 1 }],
    },
    analyzers: [],
  };
}

export function createManagedStrategyConfigMergerContext(
  options: ServiceOptions = {},
): ManagedStrategyConfigMergerContext {
  jest.clearAllMocks();

  const harness = createStrategyConfigMergerHarness(options);

  return {
    ...harness,
    createService: (serviceOptions: ServiceOptions = {}) =>
      createStrategyConfigMergerService({
        logger: serviceOptions.logger ?? harness.logger,
        errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
        withErrorHandler: serviceOptions.withErrorHandler,
      }),
    cleanup() {
      jest.clearAllMocks();
      jest.restoreAllMocks();
    },
  };
}
