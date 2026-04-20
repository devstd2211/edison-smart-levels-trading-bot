import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { BotMetricsService, TradeMetrics } from '../../services/bot-metrics.service';
import { LoggerService, LogLevel } from '../../types/legacy';

export class BotMetricsTestLogger extends LoggerService {
  logCalls: Array<{ level: string; message: string; meta?: unknown }> = [];
  throwOnCall = false;

  constructor() {
    super(LogLevel.INFO, './logs', false);
  }

  info(message: string, meta?: unknown): void {
    this.logCalls.push({ level: 'info', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  debug(message: string, meta?: unknown): void {
    this.logCalls.push({ level: 'debug', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  warn(message: string, meta?: unknown): void {
    this.logCalls.push({ level: 'warn', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  error(message: string, meta?: unknown): void {
    this.logCalls.push({ level: 'error', message, meta });
    if (this.throwOnCall) {
      throw new Error('Logger failed');
    }
  }

  getLogFilePath(): string | null {
    return null;
  }

  setConsoleOutputEnabled(_enabled: boolean): void {}
}

export const createBotMetricsMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
});

export const createBotMetricsTrade = (
  overrides: Partial<TradeMetrics> = {},
): TradeMetrics => ({
  id: `trade-${Date.now()}`,
  direction: 'LONG',
  entryPrice: 100,
  exitPrice: 105,
  quantity: 1,
  pnl: 5,
  pnlPercent: 5,
  duration: 60000,
  exitType: 'TAKE_PROFIT_1',
  timestamp: Date.now(),
  ...overrides,
});

export const createBotMetricsErrorHandler = (): ErrorHandler => {
  type HandleConfig = Parameters<ErrorHandler['handle']>[1];
  const mockEH = {
    handle: jest.fn((error: unknown, options: HandleConfig) => {
      if (options.strategy === RecoveryStrategy.THROW) {
        throw error;
      }

      return {
        success: false,
        error: error instanceof Error ? error : undefined,
        strategy: options.strategy,
      };
    }),
  };

  return mockEH as unknown as ErrorHandler;
};

export const createBotMetricsService = ({
  logger = createBotMetricsMockLogger() as LoggerService,
  errorHandler,
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): BotMetricsService => new BotMetricsService(logger, errorHandler);

export const createStandardBotMetricsService = ({
  logger = createBotMetricsMockLogger() as LoggerService,
  errorHandler = createBotMetricsErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): BotMetricsService => createBotMetricsService({ logger, errorHandler });

export const createLegacyBotMetricsService = ({
  logger = createBotMetricsMockLogger() as LoggerService,
}: {
  logger?: LoggerService;
} = {}): BotMetricsService => createBotMetricsService({ logger });

export const createBotMetricsHarness = ({
  logger = new BotMetricsTestLogger(),
  errorHandler = createBotMetricsErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): {
  logger: LoggerService;
  errorHandler: ErrorHandler;
  service: BotMetricsService;
} => ({
  logger,
  errorHandler,
  service: createStandardBotMetricsService({ logger, errorHandler }),
});

export interface BotMetricsTestContext {
  logger: LoggerService;
  errorHandler: ErrorHandler;
  service: BotMetricsService;
  createStandardService: (overrides?: {
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
  }) => BotMetricsService;
  createLegacyService: (overrides?: {
    logger?: LoggerService;
  }) => BotMetricsService;
  rebuild: (overrides?: {
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    legacy?: boolean;
  }) => BotMetricsService;
}

export interface ManagedBotMetricsTestContext extends BotMetricsTestContext {
  cleanup: () => void;
}

export type ManagedBotMetricsRuntime = Pick<
  ManagedBotMetricsTestContext,
  'logger' | 'errorHandler' | 'service' | 'createStandardService' | 'createLegacyService' | 'cleanup'
>;

export const createBotMetricsTestContext = ({
  logger = new BotMetricsTestLogger(),
  errorHandler = createBotMetricsErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): BotMetricsTestContext => {
  const context: BotMetricsTestContext = {
    logger,
    errorHandler,
    service: undefined as unknown as BotMetricsService,
    createStandardService(overrides = {}) {
      return createStandardBotMetricsService({
        logger: overrides.logger ?? context.logger,
        errorHandler: overrides.errorHandler ?? context.errorHandler,
      });
    },
    createLegacyService(overrides = {}) {
      return createLegacyBotMetricsService({
        logger: overrides.logger ?? context.logger,
      });
    },
    rebuild(overrides = {}) {
      context.logger = overrides.logger ?? context.logger;
      context.errorHandler = overrides.errorHandler ?? context.errorHandler;
      context.service = overrides.legacy
        ? context.createLegacyService({ logger: context.logger })
        : context.createStandardService({
            logger: context.logger,
            errorHandler: context.errorHandler,
          });
      return context.service;
    },
  };

  context.rebuild();

  return context;
};

export const createManagedBotMetricsTestContext = ({
  logger = new BotMetricsTestLogger(),
  errorHandler = createBotMetricsErrorHandler(),
}: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
} = {}): ManagedBotMetricsTestContext => {
  const context = createBotMetricsTestContext({ logger, errorHandler });

  return {
    ...context,
    cleanup: () => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
};

export const seedBotMetricsService = (
  service: BotMetricsService,
  options: {
    trades?: Partial<TradeMetrics>[];
    events?: Array<{
      name: string;
      duration: number;
      success: boolean;
      errorMessage?: string;
    }>;
  } = {},
): BotMetricsService => {
  options.trades?.forEach((trade, index) => {
    service.recordTrade(createBotMetricsTrade({
      id: trade.id ?? `seed-trade-${index + 1}`,
      ...trade,
    }));
  });

  options.events?.forEach((event) => {
    service.recordEvent(event.name, event.duration, event.success, event.errorMessage);
  });

  return service;
};
