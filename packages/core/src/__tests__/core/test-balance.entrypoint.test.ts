import {
  TEST_BALANCE_DEFAULT_EXCHANGE_SETTINGS,
  createTestBalanceExchangeConfig,
  createTestBalanceLogger,
  createTestBalanceWorkflowRuntime,
  loadTestBalanceEnvironment,
  prepareTestBalanceRuntime,
  readTestBalanceCredentials,
  runTestBalanceChecks,
  runTestBalanceWorkflow,
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

  test('createTestBalanceWorkflowRuntime resolves console, process, runtime setup, and bybit service together', () => {
    const consoleRef = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getLogFilePath: jest.fn().mockReturnValue('./logs/test.log'),
    };
    const bybitService = {
      getServerTime: jest.fn(),
      getBalance: jest.fn(),
      getCurrentPrice: jest.fn(),
      getCandles: jest.fn(),
      getPosition: jest.fn(),
    };

    const runtime = createTestBalanceWorkflowRuntime({
      consoleRef,
      processRef,
      environmentLoader: jest.fn(),
      environment: {
        BYBIT_API_KEY: 'key',
        BYBIT_API_SECRET: 'secret',
      },
      createLogger: () => logger as never,
      createBybitService: () => bybitService as never,
    });

    expect(runtime.consoleRef).toBe(consoleRef);
    expect(runtime.processRef).toBe(processRef);
    expect(runtime.setup.logger).toBe(logger);
    expect(runtime.bybitService).toBe(bybitService);
  });

  test('runTestBalanceWorkflow exits early with logger guidance when credentials are missing', async () => {
    const logger = {
      error: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
    };

    await runTestBalanceWorkflow({
      environment: {},
      createLogger: () => logger as never,
      processRef,
    });

    expect(logger.error).toHaveBeenNthCalledWith(1, 'Missing API credentials in .env file');
    expect(logger.error).toHaveBeenNthCalledWith(2, 'Please set BYBIT_API_KEY and BYBIT_API_SECRET');
    expect(processRef.exit).toHaveBeenCalledWith(1);
  });

  test('runTestBalanceWorkflow does not relabel unrelated runtime setup failures as missing credentials', async () => {
    const logger = {
      error: jest.fn(),
    };
    const processRef = {
      exit: jest.fn(),
    };

    await expect(
      runTestBalanceWorkflow({
        environmentLoader: jest.fn(),
        environment: {
          BYBIT_API_KEY: 'key',
          BYBIT_API_SECRET: 'secret',
        },
        createLogger: () => logger as never,
        createBybitService: () => {
          throw new Error('Bybit unavailable');
        },
        processRef,
      }),
    ).rejects.toThrow('Bybit unavailable');

    expect(logger.error).not.toHaveBeenCalled();
    expect(processRef.exit).not.toHaveBeenCalled();
  });

  test('runTestBalanceChecks executes the shared connectivity sequence against the prepared runtime', async () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getLogFilePath: jest.fn().mockReturnValue('./logs/test.log'),
    };
    const consoleRef = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const bybitService = {
      getServerTime: jest.fn().mockResolvedValue(42),
      getBalance: jest.fn().mockResolvedValue(123.45),
      getCurrentPrice: jest.fn().mockResolvedValue(65000),
      getCandles: jest.fn().mockResolvedValue([
        { timestamp: 1, close: 100 },
        { timestamp: 2, close: 200 },
      ]),
      getPosition: jest.fn().mockResolvedValue(null),
    };

    await runTestBalanceChecks({
      consoleRef,
      processRef: { exit: jest.fn() },
      setup: {
        logger: logger as never,
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
      },
      bybitService: bybitService as never,
    });

    expect(bybitService.getServerTime).toHaveBeenCalledTimes(1);
    expect(bybitService.getBalance).toHaveBeenCalledTimes(1);
    expect(bybitService.getCurrentPrice).toHaveBeenCalledTimes(1);
    expect(bybitService.getCandles).toHaveBeenCalledWith(10);
    expect(bybitService.getPosition).toHaveBeenCalledTimes(1);
    expect(consoleRef.log).toHaveBeenCalledWith(expect.stringContaining('USDT Balance: 123.45'));
  });

  test('runTestBalanceWorkflow executes the shared standalone connectivity checks through injected dependencies', async () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getLogFilePath: jest.fn().mockReturnValue('./logs/test.log'),
    };
    const consoleRef = {
      log: jest.fn(),
      error: jest.fn(),
    };
    const bybitService = {
      getServerTime: jest.fn().mockResolvedValue(42),
      getBalance: jest.fn().mockResolvedValue(123.45),
      getCurrentPrice: jest.fn().mockResolvedValue(65000),
      getCandles: jest.fn().mockResolvedValue([
        { timestamp: 1, close: 100 },
        { timestamp: 2, close: 200 },
      ]),
      getPosition: jest.fn().mockResolvedValue(null),
    };

    await runTestBalanceWorkflow({
      environmentLoader: jest.fn(),
      environment: {
        BYBIT_API_KEY: 'key',
        BYBIT_API_SECRET: 'secret',
      },
      createLogger: () => logger as never,
      createBybitService: () => bybitService as never,
      consoleRef,
      processRef: { exit: jest.fn() },
    });

    expect(bybitService.getServerTime).toHaveBeenCalledTimes(1);
    expect(bybitService.getBalance).toHaveBeenCalledTimes(1);
    expect(bybitService.getCurrentPrice).toHaveBeenCalledTimes(1);
    expect(bybitService.getCandles).toHaveBeenCalledWith(10);
    expect(bybitService.getPosition).toHaveBeenCalledTimes(1);
    expect(consoleRef.log).toHaveBeenCalledWith(expect.stringContaining('USDT Balance: 123.45'));
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('ALL TESTS PASSED!'),
    );
  });
});
