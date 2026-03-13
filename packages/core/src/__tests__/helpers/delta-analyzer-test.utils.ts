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

export const createDeltaAnalyzerService = ({
  config = createDeltaAnalyzerConfig(),
  logger = createDeltaAnalyzerLogger(),
  errorHandler,
}: {
  config?: DeltaConfig;
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): DeltaAnalyzerService => new DeltaAnalyzerService(config, logger, errorHandler);
