import {
  TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS,
  createTestBalanceExchangeConfig,
  createTestBalanceLogger,
  loadTestBalanceEnvironment,
  prepareTestBalanceRuntime,
  readTestBalanceCredentials,
} from '../../test-balance.entrypoint';

describe('test-balance entrypoint helpers', () => {
  test('loadTestBalanceEnvironment delegates to the provided loader', () => {
    const environmentLoader = jest.fn();

    loadTestBalanceEnvironment(environmentLoader);

    expect(environmentLoader).toHaveBeenCalledTimes(1);
  });

  test('readTestBalanceCredentials returns the expected Bybit credentials', () => {
    expect(
      readTestBalanceCredentials({
        BYBIT_API_KEY: 'key',
        BYBIT_API_SECRET: 'secret',
      }),
    ).toEqual({
      apiKey: 'key',
      apiSecret: 'secret',
    });
  });

  test('readTestBalanceCredentials rejects missing credentials', () => {
    expect(() => readTestBalanceCredentials({})).toThrow(
      'Missing BYBIT_API_KEY or BYBIT_API_SECRET in .env file',
    );
  });

  test('createTestBalanceExchangeConfig pins the demo connection defaults', () => {
    expect(
      createTestBalanceExchangeConfig({
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    ).toEqual({
      name: 'bybit',
      apiKey: 'key',
      apiSecret: 'secret',
      ...TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS,
    });
  });

  test('createTestBalanceLogger keeps the standalone debug logger contract', () => {
    const logger = createTestBalanceLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.getLogFilePath).toBe('function');
  });

  test('prepareTestBalanceRuntime bootstraps env loading, logger creation, credentials, and exchange config together', () => {
    const environmentLoader = jest.fn();
    const logger = { info: jest.fn() };

    const runtime = prepareTestBalanceRuntime({
      environmentLoader,
      environment: {
        BYBIT_API_KEY: 'key',
        BYBIT_API_SECRET: 'secret',
      },
      createLogger: () => logger as never,
    });

    expect(environmentLoader).toHaveBeenCalledTimes(1);
    expect(runtime).toEqual({
      logger,
      credentials: {
        apiKey: 'key',
        apiSecret: 'secret',
      },
      exchangeConfig: {
        name: 'bybit',
        apiKey: 'key',
        apiSecret: 'secret',
        ...TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS,
      },
    });
  });
});
