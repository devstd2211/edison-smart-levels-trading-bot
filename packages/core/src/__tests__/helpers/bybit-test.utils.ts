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

export function createStandardBybitErrorHandlingHarness(options: {
  logger?: jest.Mocked<LoggerService>;
  config?: ExchangeConfig;
} = {}) {
  return createBybitErrorHandlingHarness(options);
}

export type BybitErrorHandlingHarness = ReturnType<
  typeof createStandardBybitErrorHandlingHarness
>;

export type ManagedBybitErrorHandlingContext = BybitErrorHandlingHarness & {
  cleanup: () => void;
};

export type ManagedBybitErrorHandlingRuntime = Pick<
  ManagedBybitErrorHandlingContext,
  'logger' | 'config' | 'restClient' | 'cleanup'
>;

export type BybitErrorHandlingRuntime = ManagedBybitErrorHandlingRuntime;

export function createManagedBybitErrorHandlingContext(options: {
  logger?: jest.Mocked<LoggerService>;
  config?: ExchangeConfig;
} = {}): ManagedBybitErrorHandlingContext {
  const harness = createStandardBybitErrorHandlingHarness(options);

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
      jest.clearAllTimers();
    },
  };
}
