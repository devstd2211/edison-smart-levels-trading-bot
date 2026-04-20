import { ErrorHandler } from '../../errors/ErrorHandler';
import { DeltaAnalyzerService } from '../../services/delta-analyzer.service';
import {
  DeltaConfig,
  DeltaTick,
  LoggerService,
  LogLevel,
  Signal,
  SignalDirection,
  SignalType,
} from '../../types/legacy';

export const createDeltaAnalyzerLogger = (): LoggerService =>
  new LoggerService(LogLevel.ERROR, './logs', false);

export const createDeltaAnalyzerMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogs: jest.fn(() => []),
  getLogsByLevel: jest.fn(() => []),
  clear: jest.fn(),
  disableConsoleOutput: jest.fn(),
  enableConsoleOutputMode: jest.fn(),
});

export type DeltaAnalyzerMockLogger = ReturnType<typeof createDeltaAnalyzerMockLogger>;

export const asDeltaAnalyzerLogger = (logger: DeltaAnalyzerMockLogger): LoggerService =>
  logger as unknown as LoggerService;

export type DeltaAnalyzerHarness = {
  service: DeltaAnalyzerService;
  logger: DeltaAnalyzerMockLogger;
  errorHandler: ErrorHandler;
  config: DeltaConfig;
};

export interface ManagedDeltaAnalyzerContext extends DeltaAnalyzerHarness {
  createHarness: (options?: {
    config?: DeltaConfig;
    configOverrides?: Partial<DeltaConfig>;
    logger?: DeltaAnalyzerMockLogger;
    errorHandler?: ErrorHandler;
  }) => DeltaAnalyzerHarness;
  createService: (options?: {
    config?: DeltaConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => DeltaAnalyzerService;
  cleanup: () => void;
}

export type ManagedDeltaAnalyzerRuntime = Pick<
  ManagedDeltaAnalyzerContext,
  'service' | 'logger' | 'config' | 'cleanup'
>;

export type ManagedDeltaAnalyzerErrorHandlingRuntime = Pick<
  ManagedDeltaAnalyzerContext,
  'logger' | 'errorHandler' | 'createHarness' | 'createService' | 'cleanup'
>;

export const createDeltaAnalyzerErrorHandler = (
  logger: LoggerService = asDeltaAnalyzerLogger(createDeltaAnalyzerMockLogger()),
): ErrorHandler => new ErrorHandler(logger);

export const createDeltaAnalyzerConfig = (
  overrides: Partial<DeltaConfig> = {},
): DeltaConfig => ({
  enabled: true,
  windowSizeMs: 60000,
  minDeltaThreshold: 1000,
  ...overrides,
});

export const createDeltaAnalyzerTick = (
  overrides: Partial<DeltaTick> = {},
): DeltaTick => ({
  timestamp: Date.now(),
  price: 50000,
  quantity: 100,
  side: 'BUY',
  ...overrides,
});

export const createDeltaAnalyzerTickBatch = (
  count: number,
  overrides: Partial<DeltaTick> = {},
): DeltaTick[] =>
  Array.from({ length: count }, (_, index) =>
    createDeltaAnalyzerTick({
      timestamp: (overrides.timestamp ?? Date.now()) + index,
      ...overrides,
    }),
  );

export const createDeltaAnalyzerVolumePair = (
  buyQuantity: number,
  sellQuantity: number,
  baseTimestamp: number = Date.now(),
  overrides: {
    buyPrice?: number;
    sellPrice?: number;
  } = {},
): DeltaTick[] => [
  createDeltaAnalyzerTick({
    timestamp: baseTimestamp,
    quantity: buyQuantity,
    price: overrides.buyPrice ?? 50000,
    side: 'BUY',
  }),
  createDeltaAnalyzerTick({
    timestamp: baseTimestamp + 1000,
    quantity: sellQuantity,
    price: overrides.sellPrice ?? 50010,
    side: 'SELL',
  }),
];

export const seedDeltaAnalyzerTicks = (
  service: DeltaAnalyzerService,
  ticks: DeltaTick[],
): void => {
  ticks.forEach((tick) => service.addTick(tick));
};

export const createDeltaAnalyzerSignal = (
  direction: SignalDirection = SignalDirection.LONG,
  overrides: Partial<Signal> = {},
): Signal => ({
  timestamp: Date.now(),
  type: SignalType.LEVEL_BASED,
  direction,
  price: 50000,
  stopLoss: 49500,
  takeProfits: [],
  confidence: 80,
  reason: 'Test signal',
  ...overrides,
});

export const createDeltaAnalyzerService = (
  options: {
    config?: DeltaConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  } = {},
): DeltaAnalyzerService => {
  const logger = options.logger ?? createDeltaAnalyzerLogger();
  const config = Object.prototype.hasOwnProperty.call(options, 'config')
    ? options.config
    : createDeltaAnalyzerConfig();

  return new DeltaAnalyzerService(config as DeltaConfig, logger, options.errorHandler);
};

export const createDeltaAnalyzerHarness = (
  options: {
    config?: DeltaConfig;
    configOverrides?: Partial<DeltaConfig>;
    logger?: DeltaAnalyzerMockLogger;
    errorHandler?: ErrorHandler;
  } = {},
): DeltaAnalyzerHarness => {
  const logger = options.logger ?? createDeltaAnalyzerMockLogger();
  const config = options.config ?? createDeltaAnalyzerConfig(options.configOverrides);
  const errorHandler = options.errorHandler ?? createDeltaAnalyzerErrorHandler(asDeltaAnalyzerLogger(logger));
  const service = createDeltaAnalyzerService({
    config,
    logger: asDeltaAnalyzerLogger(logger),
    errorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
    config,
  };
};

export const createManagedDeltaAnalyzerContext = (
  options: {
    config?: DeltaConfig;
    configOverrides?: Partial<DeltaConfig>;
    logger?: DeltaAnalyzerMockLogger;
    errorHandler?: ErrorHandler;
  } = {},
): ManagedDeltaAnalyzerContext => {
  const trackedHarnesses: DeltaAnalyzerHarness[] = [];
  const createHarness = (nextOptions: {
    config?: DeltaConfig;
    configOverrides?: Partial<DeltaConfig>;
    logger?: DeltaAnalyzerMockLogger;
    errorHandler?: ErrorHandler;
  } = {}) => {
    const harness = createDeltaAnalyzerHarness({
      ...options,
      ...nextOptions,
    });
    trackedHarnesses.push(harness);
    return harness;
  };
  const harness = createHarness(options);

  return {
    ...harness,
    createHarness,
    createService: (serviceOptions = {}) =>
      createDeltaAnalyzerService({
        config: serviceOptions.config,
        logger: serviceOptions.logger ?? asDeltaAnalyzerLogger(harness.logger),
        errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
      }),
    cleanup: () => {
      trackedHarnesses.length = 0;
      Object.values(harness.logger).forEach((mockFn) => {
        if (typeof mockFn === 'function' && 'mockClear' in mockFn) {
          (mockFn as jest.Mock).mockClear();
        }
      });
      jest.clearAllMocks();
    },
  };
};
