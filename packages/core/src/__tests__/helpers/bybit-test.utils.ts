import { ExchangeConfig, LoggerService } from '../../types/legacy';

export function createBybitMockLogger(): jest.Mocked<LoggerService> {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;
}

export function createBybitExchangeConfig(
  overrides: Partial<ExchangeConfig> = {},
): ExchangeConfig {
  return {
    name: 'bybit',
    apiKey: 'test-key',
    apiSecret: 'test-secret',
    symbol: 'BTCUSDT',
    timeframe: '1m',
    testnet: true,
    demo: false,
    ...overrides,
  } as ExchangeConfig;
}

export function createBybitErrorHandlingHarness(options: {
  logger?: jest.Mocked<LoggerService>;
  config?: ExchangeConfig;
} = {}) {
  return {
    logger: options.logger ?? createBybitMockLogger(),
    config: options.config ?? createBybitExchangeConfig(),
    restClient: {
      getServerTime: jest.fn(),
    },
  };
}
