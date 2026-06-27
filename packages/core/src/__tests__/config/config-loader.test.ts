import * as path from 'path';
import {
  applyConfigEnvironmentOverrides,
  loadConfigEnvironment,
  logConfigDefaultsApplied,
  logConfigLoadDebug,
  readBaseConfigFile,
  resolveRootConfigPath,
} from '../../config-loader';

describe('config loader helpers', () => {
  test('loadConfigEnvironment delegates to the provided loader', () => {
    const environmentLoader = jest.fn();

    loadConfigEnvironment(environmentLoader);

    expect(environmentLoader).toHaveBeenCalledTimes(1);
  });

  test('resolveRootConfigPath keeps config.json anchored at the workspace root', () => {
    expect(
      resolveRootConfigPath(path.join('workspace', 'packages', 'core', 'src')),
    ).toBe(
      path.resolve(path.join('workspace', 'config.json')),
    );
  });

  test('readBaseConfigFile reads and parses the config payload', () => {
    const fileSystem = {
      existsSync: jest.fn().mockReturnValue(true),
      readFileSync: jest
        .fn()
        .mockReturnValue('{"exchange":{"apiKey":"a","apiSecret":"b","testnet":false,"demo":false}}'),
    };

    expect(
      readBaseConfigFile('/workspace/config.json', fileSystem as never),
    ).toMatchObject({
      exchange: {
        apiKey: 'a',
        apiSecret: 'b',
        testnet: false,
        demo: false,
      },
    });
  });

  test('readBaseConfigFile rejects missing config files before reading', () => {
    const fileSystem = {
      existsSync: jest.fn().mockReturnValue(false),
      readFileSync: jest.fn(),
    };

    expect(() =>
      readBaseConfigFile('/workspace/config.json', fileSystem as never),
    ).toThrow('Config file not found: /workspace/config.json');
    expect(fileSystem.readFileSync).not.toHaveBeenCalled();
  });

  test('logConfigLoadDebug logs the config path to the provided logger', () => {
    const logger = { log: jest.fn() };

    logConfigLoadDebug(logger, '/workspace/config.json', {} as never, false);

    expect(logger.log).toHaveBeenCalledWith(
      expect.stringContaining('DEBUG'),
      '/workspace/config.json',
    );
  });

  test('logConfigLoadDebug logs the defaults warning when dataSubscriptions were missing', () => {
    const logger = { log: jest.fn() };

    logConfigLoadDebug(logger, '/config.json', {} as never, true);

    const messages = logger.log.mock.calls.map(([msg]: [string]) => msg);
    expect(messages.some((msg) => msg.includes('dataSubscriptions'))).toBe(true);
  });

  test('logConfigDefaultsApplied logs applied defaults when dataSubscriptions were missing', () => {
    const logger = { log: jest.fn() };
    const config = { dataSubscriptions: ['BTC'] } as never;

    logConfigDefaultsApplied(logger, config, true);

    expect(logger.log).toHaveBeenCalledTimes(1);
  });

  test('logConfigDefaultsApplied is silent when dataSubscriptions were already present', () => {
    const logger = { log: jest.fn() };

    logConfigDefaultsApplied(logger, {} as never, false);

    expect(logger.log).not.toHaveBeenCalled();
  });

  test('applyConfigEnvironmentOverrides falls back to legacy API_KEY when BYBIT_API_KEY is absent', () => {
    const config = {
      exchange: { apiKey: 'config-key', apiSecret: 'config-secret', testnet: false, demo: false },
    };

    applyConfigEnvironmentOverrides(config as never, {
      API_KEY: 'legacy-key',
      API_SECRET: 'legacy-secret',
    });

    expect(config.exchange.apiKey).toBe('legacy-key');
    expect(config.exchange.apiSecret).toBe('legacy-secret');
    expect(config.exchange.testnet).toBe(false);
    expect(config.exchange.demo).toBe(false);
  });

  test('applyConfigEnvironmentOverrides leaves config unchanged when no env vars are set', () => {
    const config = {
      exchange: { apiKey: 'config-key', apiSecret: 'config-secret', testnet: false, demo: false },
    };

    applyConfigEnvironmentOverrides(config as never, {});

    expect(config.exchange).toEqual({
      apiKey: 'config-key',
      apiSecret: 'config-secret',
      testnet: false,
      demo: false,
    });
  });

  test('applyConfigEnvironmentOverrides prefers BYBIT vars and keeps legacy fallbacks', () => {
    const config = {
      exchange: {
        apiKey: 'config-key',
        apiSecret: 'config-secret',
        testnet: false,
        demo: false,
      },
    };

    applyConfigEnvironmentOverrides(config as never, {
      BYBIT_API_KEY: 'bybit-key',
      API_KEY: 'legacy-key',
      BYBIT_API_SECRET: 'bybit-secret',
      API_SECRET: 'legacy-secret',
      BYBIT_TESTNET: 'true',
      BYBIT_DEMO: 'true',
    });

    expect(config.exchange).toEqual({
      apiKey: 'bybit-key',
      apiSecret: 'bybit-secret',
      testnet: true,
      demo: true,
    });
  });
});
