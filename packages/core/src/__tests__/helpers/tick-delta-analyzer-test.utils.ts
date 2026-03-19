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
