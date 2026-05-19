import { MarketDataCacheRepository } from '../../repositories/market-data.cache-repository';
import { BybitService } from '../../services/bybit/bybit.service';
import { LoggerService } from '../../services/logger.service';
import type { Candle, ExchangeConfig } from '../../types/legacy';
import { cleanupManagedHarnesses } from './managed-test-context.utils';

export function createBybitRepositoryLogger(): LoggerService {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

export function createBybitRepositoryConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return {
    name: 'bybit',
    symbol: 'XRPUSDT',
    timeframe: '5',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    demo: true,
    testnet: false,
    ...overrides,
  };
}

export function createBybitRepositoryHarness(
  overrides: Partial<ExchangeConfig> = {},
): {
  logger: LoggerService;
  repository: MarketDataCacheRepository;
  config: ExchangeConfig;
  createService: (options?: {
    config?: ExchangeConfig;
    logger?: LoggerService;
    repository?: MarketDataCacheRepository;
  }) => BybitService;
  createStandardService: (options?: {
    config?: ExchangeConfig;
    logger?: LoggerService;
    repository?: MarketDataCacheRepository;
  }) => BybitService;
} {
  const logger = createBybitRepositoryLogger();
  const repository = new MarketDataCacheRepository();
  const config = createBybitRepositoryConfig(overrides);
  const createService = (options: {
    config?: ExchangeConfig;
    logger?: LoggerService;
    repository?: MarketDataCacheRepository;
  } = {}): BybitService =>
    new BybitService(
      options.config ?? config,
      Object.prototype.hasOwnProperty.call(options, 'logger') ? options.logger ?? logger : logger,
      Object.prototype.hasOwnProperty.call(options, 'repository') ? options.repository : repository,
    );

  return {
    logger,
    repository,
    config,
    createService,
    createStandardService: createService,
  };
}

export function createRepositoryCandle(
  timestamp: number,
  overrides: Partial<Candle> = {},
): Candle {
  return {
    timestamp,
    open: 1.0,
    high: 1.1,
    low: 0.9,
    close: 1.05,
    volume: 100,
    ...overrides,
  };
}

export function createRepositoryCandles(
  entries: Array<{ timestamp: number; overrides?: Partial<Candle> }>,
): Candle[] {
  return entries.map(({ timestamp, overrides }) => createRepositoryCandle(timestamp, overrides));
}

export function seedRepositoryCandles(
  repository: MarketDataCacheRepository,
  symbol: string,
  timeframe: string,
  candles: Candle[],
): Candle[] {
  repository.saveCandles(symbol, timeframe, candles);
  return candles;
}

export function createSequentialRepositoryCandles(
  count: number,
  buildOverrides: (index: number) => Partial<Candle> = () => ({}),
): Candle[] {
  return Array.from({ length: count }, (_, index) =>
    createRepositoryCandle((index + 1) * 1000, buildOverrides(index)),
  );
}

export interface ManagedBybitRepositoryIntegrationContext
  extends ReturnType<typeof createBybitRepositoryHarness> {
  createHarness: (
    overrides?: Parameters<typeof createBybitRepositoryHarness>[0],
  ) => ReturnType<typeof createBybitRepositoryHarness>;
  cleanup: () => void;
}

export type BybitRepositoryIntegrationRuntime = Pick<
  ManagedBybitRepositoryIntegrationContext,
  'logger' | 'repository' | 'config' | 'createService' | 'cleanup'
>;

export type BybitRepositoryIntegrationState = Pick<
  ManagedBybitRepositoryIntegrationContext,
  'logger' | 'repository' | 'createService' | 'cleanup'
>;

export function createManagedBybitRepositoryIntegrationContext(
  overrides: Parameters<typeof createBybitRepositoryHarness>[0] = {},
): ManagedBybitRepositoryIntegrationContext {
  const trackedHarnesses: Array<ReturnType<typeof createBybitRepositoryHarness>> = [];
  const createHarness = (
    nextOverrides: Parameters<typeof createBybitRepositoryHarness>[0] = {},
  ) => {
    const harness = createBybitRepositoryHarness({
      ...overrides,
      ...nextOverrides,
    });
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      cleanupManagedHarnesses({
        trackedHarnesses,
        resetHarness: ({ repository }) => {
          repository.clear();
        },
      });
    },
  };
}
