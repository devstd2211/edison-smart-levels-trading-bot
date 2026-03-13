import { CandleProvider } from '../../providers/candle.provider';
import type { ErrorHandler } from '../../errors/ErrorHandler';
import { TimeframeRole } from '../../types/enums';

type ProviderLogger = ConstructorParameters<typeof CandleProvider>[2];
type ProviderTimeframeProvider = ConstructorParameters<typeof CandleProvider>[0];
type ProviderExchange = ConstructorParameters<typeof CandleProvider>[1];
type ProviderRepository = ConstructorParameters<typeof CandleProvider>[4];

type MockTimeframeConfig = {
  interval: string;
  candleLimit: number;
  enabled: boolean;
};

export type CandleProviderMockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  getLogFilePath: jest.Mock;
};

export type CandleProviderMockTimeframeProvider = {
  getAllTimeframes: jest.Mock;
  getTimeframe: jest.Mock;
};

export type CandleProviderMockExchange = {
  getCandles: jest.Mock;
};

export type CandleProviderMockRepository = {
  saveCandles: jest.Mock;
  getCandles: jest.Mock;
  clear: jest.Mock;
  getStats: jest.Mock;
};

export type CandleProviderGetCandlesParams = Parameters<
  ProviderExchange['getCandles']
>[0];

export function createCandleProviderMockLogger():
  CandleProviderMockLogger & ProviderLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogFilePath: jest.fn().mockReturnValue('/mock/log/path'),
  } as unknown as CandleProviderMockLogger & ProviderLogger;
}

export function createCandleProviderMockTimeframeProvider():
  CandleProviderMockTimeframeProvider & ProviderTimeframeProvider {
  return {
    getAllTimeframes: jest.fn().mockReturnValue(
      new Map([
        [
          TimeframeRole.ENTRY,
          { interval: '1', candleLimit: 100, enabled: true },
        ],
        [
          TimeframeRole.PRIMARY,
          { interval: '5', candleLimit: 100, enabled: true },
        ],
        [
          TimeframeRole.TREND1,
          { interval: '15', candleLimit: 100, enabled: true },
        ],
      ]),
    ),
    getTimeframe: jest.fn((role: TimeframeRole) => {
      const timeframes: Record<TimeframeRole, MockTimeframeConfig> = {
        [TimeframeRole.ENTRY]: { interval: '1', candleLimit: 100, enabled: true },
        [TimeframeRole.PRIMARY]: {
          interval: '5',
          candleLimit: 100,
          enabled: true,
        },
        [TimeframeRole.TREND1]: {
          interval: '15',
          candleLimit: 100,
          enabled: true,
        },
        [TimeframeRole.TREND2]: {
          interval: '60',
          candleLimit: 100,
          enabled: false,
        },
        [TimeframeRole.CONTEXT]: {
          interval: '240',
          candleLimit: 100,
          enabled: false,
        },
      };

      return timeframes[role] || null;
    }),
  } as unknown as CandleProviderMockTimeframeProvider &
    ProviderTimeframeProvider;
}

export function createCandleProviderMockExchange():
  CandleProviderMockExchange & ProviderExchange {
  return {
    getCandles: jest.fn().mockResolvedValue([
      { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
      { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
    ]),
  } as unknown as CandleProviderMockExchange & ProviderExchange;
}

export function createCandleProviderMockRepository():
  CandleProviderMockRepository & ProviderRepository {
  return {
    saveCandles: jest.fn(),
    getCandles: jest.fn().mockReturnValue([
      { timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { timestamp: 2, open: 105, high: 115, low: 95, close: 110, volume: 1100 },
      { timestamp: 3, open: 110, high: 120, low: 100, close: 115, volume: 1200 },
    ]),
    clear: jest.fn(),
    getStats: jest.fn().mockReturnValue({ capacity: 1000 }),
  } as unknown as CandleProviderMockRepository & ProviderRepository;
}

export function createCandleProviderMockCandle() {
  return {
    timestamp: Date.now(),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 500,
  };
}

export function createCandleProviderHarness(options?: {
  logger?: CandleProviderMockLogger & ProviderLogger;
  timeframeProvider?: CandleProviderMockTimeframeProvider &
    ProviderTimeframeProvider;
  exchange?: CandleProviderMockExchange & ProviderExchange;
  repository?: CandleProviderMockRepository & ProviderRepository;
  errorHandler?: ErrorHandler;
  symbol?: string;
}) {
  const logger = options?.logger ?? createCandleProviderMockLogger();
  const timeframeProvider =
    options?.timeframeProvider ?? createCandleProviderMockTimeframeProvider();
  const exchange = options?.exchange ?? createCandleProviderMockExchange();
  const repository =
    options?.repository ?? createCandleProviderMockRepository();
  const symbol = options?.symbol ?? 'APEXUSDT';
  const provider = new CandleProvider(
    timeframeProvider,
    exchange,
    logger,
    symbol,
    repository,
    options?.errorHandler,
  );

  return {
    provider,
    logger,
    timeframeProvider,
    exchange,
    repository,
    symbol,
  };
}
