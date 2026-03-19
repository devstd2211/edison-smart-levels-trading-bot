import { ErrorHandler, ErrorHandlingResult, RecoveryStrategy } from '../../errors';
import { PerformanceAnalytics } from '../../services/performance-analytics.service';
import { TradingJournalService } from '../../services/trading-journal.service';
import { LoggerService } from '../../types/legacy';
import type { PerformanceAnalyticsConfig } from '../../types/legacy';

export const createPerformanceAnalyticsConfig = (): PerformanceAnalyticsConfig => ({
  enabled: true,
  metricsInterval: 10,
  historicalPeriods: {
    last10Trades: true,
    last30Trades: true,
    last100Trades: true,
    sessionMetrics: true,
    allTimeMetrics: true,
  },
});

export type PerformanceAnalyticsTrade = {
  tradeId: string;
  symbol: string;
  direction: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  entryTime: number;
  exitTime: number;
  openedAt: number;
  exitReason: string;
};

export const createPerformanceAnalyticsTrade = (
  overrides: Partial<PerformanceAnalyticsTrade> = {},
): PerformanceAnalyticsTrade => ({
  tradeId: `trade-${Math.random()}`,
  symbol: 'BTCUSDT',
  direction: 'LONG',
  entryPrice: 45000,
  exitPrice: 45450,
  pnl: 450,
  pnlPercent: 1,
  entryTime: Date.now() - 3600000,
  exitTime: Date.now(),
  openedAt: Date.now() - 3600000,
  exitReason: 'TAKE_PROFIT',
  ...overrides,
});

export const createPerformanceAnalyticsTrades = (
  trades: Array<Partial<PerformanceAnalyticsTrade>>,
): PerformanceAnalyticsTrade[] =>
  trades.map((trade) => createPerformanceAnalyticsTrade(trade));

export const createPerformanceAnalyticsLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

export type PerformanceAnalyticsMockLogger = ReturnType<typeof createPerformanceAnalyticsLogger>;

export type PerformanceAnalyticsMockJournal = {
  getAllTrades: jest.Mock<unknown[], []>;
};

export const createPerformanceAnalyticsJournal = (
  trades: unknown[] = [],
): PerformanceAnalyticsMockJournal => ({
  getAllTrades: jest.fn(() => trades),
});

export const asPerformanceAnalyticsJournal = (
  value: PerformanceAnalyticsMockJournal,
): TradingJournalService => value as unknown as TradingJournalService;

export const asPerformanceAnalyticsLogger = (
  value: PerformanceAnalyticsMockLogger,
): LoggerService => value as unknown as LoggerService;

export const asPerformanceAnalyticsTrades = (
  value: unknown,
): Parameters<PerformanceAnalytics['calculateWinRate']>[0] =>
  value as Parameters<PerformanceAnalytics['calculateWinRate']>[0];

export const asPerformanceAnalyticsPeriod = (
  value: unknown,
): Parameters<PerformanceAnalytics['getMetrics']>[0] =>
  value as Parameters<PerformanceAnalytics['getMetrics']>[0];

export const createPerformanceAnalyticsErrorHandler = () =>
  ({
    handle: jest.fn((error, options): Promise<ErrorHandlingResult> => {
      if (options.strategy === RecoveryStrategy.THROW) {
        throw error;
      }

      return Promise.resolve({
        success: true,
        recovered:
          options.strategy !== RecoveryStrategy.SKIP &&
          options.strategy !== RecoveryStrategy.THROW,
        attempts: 1,
        message: 'Handled successfully',
        strategy: options.strategy,
        error: error as ErrorHandlingResult['error'],
      });
    }),
    getLogger: jest.fn(() => createPerformanceAnalyticsLogger()),
  } as unknown as jest.Mocked<ErrorHandler>);

export const createPerformanceAnalyticsService = ({
  config = createPerformanceAnalyticsConfig(),
  journal = createPerformanceAnalyticsJournal(),
  logger = createPerformanceAnalyticsLogger(),
  errorHandler,
}: {
  config?: PerformanceAnalyticsConfig;
  journal?: PerformanceAnalyticsMockJournal;
  logger?: PerformanceAnalyticsMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
} = {}): PerformanceAnalytics =>
  new PerformanceAnalytics(
    config,
    asPerformanceAnalyticsJournal(journal),
    asPerformanceAnalyticsLogger(logger),
    errorHandler,
  );

export const createPerformanceAnalyticsServiceWithHarness = ({
  config,
  journal,
  logger,
  errorHandler,
}: {
  config?: PerformanceAnalyticsConfig;
  journal?: PerformanceAnalyticsMockJournal;
  logger?: PerformanceAnalyticsMockLogger;
  errorHandler?: jest.Mocked<ErrorHandler>;
} = {}): PerformanceAnalytics =>
  createPerformanceAnalyticsService({
    config,
    journal,
    logger,
    errorHandler,
  });

export const createPerformanceAnalyticsHarness = () => {
  const config = createPerformanceAnalyticsConfig();
  const logger = createPerformanceAnalyticsLogger();
  const journal = createPerformanceAnalyticsJournal();
  const errorHandler = createPerformanceAnalyticsErrorHandler();
  const service = createPerformanceAnalyticsService({
    config,
    journal,
    logger,
    errorHandler,
  });

  return {
    config,
    logger,
    journal,
    errorHandler,
    service,
  };
};
