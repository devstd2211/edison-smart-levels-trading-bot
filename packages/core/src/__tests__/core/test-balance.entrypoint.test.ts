import {
  createTestBalanceExchangeConfig,
  createTestBalanceLogger,
  loadTestBalanceEnvironment,
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
      symbol: 'BTCUSDT',
      timeframe: '15',
      demo: true,
      testnet: false,
    });
  });

  test('createTestBalanceLogger keeps the standalone debug logger contract', () => {
    const logger = createTestBalanceLogger();

    expect(logger).toBeDefined();
    expect(typeof logger.getLogFilePath).toBe('function');
  });
});
