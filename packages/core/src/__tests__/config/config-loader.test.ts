import * as path from 'path';
import {
  applyConfigEnvironmentOverrides,
  loadConfigEnvironment,
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
