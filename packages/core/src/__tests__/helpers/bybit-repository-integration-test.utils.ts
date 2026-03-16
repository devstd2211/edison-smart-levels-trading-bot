import { MarketDataCacheRepository } from '../../repositories/market-data.cache-repository';
import { BybitService } from '../../services/bybit/bybit.service';
import { LoggerService } from '../../services/logger.service';
import type { ExchangeConfig } from '../../types/legacy';

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
  };
}
