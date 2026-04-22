import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService, Tick, TickDeltaAnalyzerConfig } from '../../types/legacy';
import { TickDeltaAnalyzerService } from '../../services/tick-delta-analyzer.service';

export type TickDeltaAnalyzerMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  getLogs: jest.Mock;
  getLogsByLevel: jest.Mock;
  clear: jest.Mock;
  disableConsoleOutput: jest.Mock;
  enableConsoleOutputMode: jest.Mock;
};

export type TickDeltaAnalyzerHarness = {
  service: TickDeltaAnalyzerService;
  config: TickDeltaAnalyzerConfig;
  logger: LoggerService;
  mockLogger: TickDeltaAnalyzerMockLogger;
  errorHandler?: ErrorHandler;
};

export interface ManagedTickDeltaAnalyzerContext extends TickDeltaAnalyzerHarness {
  createService: typeof createTickDeltaAnalyzerService;
  cleanup: () => void;
  reset: () => void;
}

export type TickDeltaAnalyzerState = Pick<
  ManagedTickDeltaAnalyzerContext,
  'service' | 'config' | 'logger' | 'mockLogger' | 'errorHandler' | 'createService' | 'cleanup'
>;

export type TickDeltaAnalyzerRuntime = Pick<
  ManagedTickDeltaAnalyzerContext,
  'service' | 'createService' | 'cleanup'
>;

export type TickDeltaAnalyzerErrorHandlingRuntime = Pick<
  ManagedTickDeltaAnalyzerContext,
  'service' | 'errorHandler' | 'mockLogger' | 'createService' | 'cleanup'
>;

export function createTickDeltaAnalyzerMockLogger(): TickDeltaAnalyzerMockLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogs: jest.fn(() => []),
    getLogsByLevel: jest.fn(() => []),
    clear: jest.fn(),
    disableConsoleOutput: jest.fn(),
    enableConsoleOutputMode: jest.fn(),
  };
}

export function createTickDeltaAnalyzerConfig(
  overrides: Partial<TickDeltaAnalyzerConfig> = {},
): TickDeltaAnalyzerConfig {
  return {
    minDeltaRatio: 2.0,
    detectionWindow: 5_000,
    minTickCount: 20,
    minVolumeUSDT: 1_000,
    maxConfidence: 85,
    ...overrides,
  };
}

export function createTickDeltaAnalyzerMomentumConfig(
  overrides: Partial<TickDeltaAnalyzerConfig> = {},
): TickDeltaAnalyzerConfig {
  return createTickDeltaAnalyzerConfig({
    minDeltaRatio: 1.5,
    detectionWindow: 60_000,
    minTickCount: 10,
    maxConfidence: 100,
    ...overrides,
  });
}

export function createTickDeltaAnalyzerTick(
  overrides: Partial<Tick> = {},
): Tick {
  return {
    side: 'BUY',
    price: 1.0,
    size: 100,
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createTickDeltaAnalyzerTickBatch(
  count: number,
  overrides: Partial<Tick> = {},
): Tick[] {
  const baseTimestamp = overrides.timestamp ?? Date.now();

  return Array.from({ length: count }, (_, index) =>
    createTickDeltaAnalyzerTick({
      timestamp: baseTimestamp + index,
      ...overrides,
    }),
  );
}

export function createTickDeltaAnalyzerDirectionalTicks(
  buyCount: number,
  sellCount: number,
  overrides: {
    timestamp?: number;
    buySize?: number;
    sellSize?: number;
    buyPrice?: number;
    sellPrice?: number;
  } = {},
): Tick[] {
  const baseTimestamp = overrides.timestamp ?? Date.now();
  const buyTicks = createTickDeltaAnalyzerTickBatch(buyCount, {
    timestamp: baseTimestamp,
    side: 'BUY',
    size: overrides.buySize ?? 100,
    price: overrides.buyPrice ?? 1.0,
  });
  const sellTicks = createTickDeltaAnalyzerTickBatch(sellCount, {
    timestamp: baseTimestamp + buyCount,
    side: 'SELL',
    size: overrides.sellSize ?? 100,
    price: overrides.sellPrice ?? overrides.buyPrice ?? 1.0,
  });

  return [...buyTicks, ...sellTicks];
}

export function seedTickDeltaAnalyzerHistory(
  service: TickDeltaAnalyzerService,
  ticks: Tick[],
): void {
  ticks.forEach((tick) => service.addTick(tick));
}

export function createTickDeltaAnalyzerHarness(options: {
  config?: TickDeltaAnalyzerConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): TickDeltaAnalyzerHarness {
  const config = options.config ?? createTickDeltaAnalyzerConfig();
  const defaultMockLogger = createTickDeltaAnalyzerMockLogger();
  const logger = options.logger ?? (defaultMockLogger as unknown as LoggerService);
  const mockLogger = options.logger
    ? (options.logger as unknown as TickDeltaAnalyzerMockLogger)
    : defaultMockLogger;
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);
  const service = new TickDeltaAnalyzerService(config, logger, errorHandler);

  return {
    service,
    config,
    logger,
    mockLogger,
    errorHandler,
  };
}

export function createTickDeltaAnalyzerService(options: {
  config?: TickDeltaAnalyzerConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): TickDeltaAnalyzerService {
  const config =
    'config' in options
      ? options.config
      : createTickDeltaAnalyzerConfig();
  const logger =
    options.logger ?? (createTickDeltaAnalyzerMockLogger() as unknown as LoggerService);

  return new TickDeltaAnalyzerService(
    config as TickDeltaAnalyzerConfig,
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createManagedTickDeltaAnalyzerContext(options: {
  config?: TickDeltaAnalyzerConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}): ManagedTickDeltaAnalyzerContext {
  const harness = createTickDeltaAnalyzerHarness(options);
  const trackedServices = new Set<TickDeltaAnalyzerService>([harness.service]);

  return {
    ...harness,
    createService: (serviceOptions = {}) => {
      const service = createTickDeltaAnalyzerService({
        ...(options.config !== undefined ? { config: options.config } : {}),
        logger: harness.logger,
        errorHandler: harness.errorHandler,
        ...(options.withErrorHandler !== undefined
          ? { withErrorHandler: options.withErrorHandler }
          : {}),
        ...serviceOptions,
      });
      trackedServices.add(service);
      return service;
    },
    cleanup: () => {
      for (const service of trackedServices) {
        service.clearHistory();
      }
      trackedServices.clear();
      trackedServices.add(harness.service);
      jest.clearAllMocks();
    },
    reset: () => {
      for (const service of trackedServices) {
        service.clearHistory();
      }
      jest.clearAllMocks();
    },
  };
}
