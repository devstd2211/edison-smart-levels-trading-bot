import {
  configureCliEnvironment,
  createCliWindowTitle,
  logCliBanner,
  logCliConfiguration,
  logCliMainnetWarning,
  logCliStartupComplete,
} from '../../cli/cli-entrypoint-runtime';

const config = {
  exchange: {
    symbol: 'BTCUSDT',
    timeframe: '1m',
    demo: false,
    testnet: true,
  },
  trading: {
    leverage: 3,
    riskPercent: 1,
    tradingCycleIntervalMs: 5000,
  },
  strategies: {
    levelBased: {
      enabled: true,
    },
  },
} as const;

describe('cli entrypoint runtime helpers', () => {
  test('configures the env path and derives the process title from the active strategy', () => {
    const environmentLoader = {
      config: jest.fn(),
    };
    const resolvePath = jest.fn(() => 'D:/repo/.env');

    expect(configureCliEnvironment('D:/repo', environmentLoader, resolvePath)).toBe('D:/repo/.env');
    expect(environmentLoader.config).toHaveBeenCalledWith({ path: 'D:/repo/.env' });
    expect(createCliWindowTitle(config as never)).toBe('Edison - Level Based (BTCUSDT)');
  });

  test('logs banner, config summary, mainnet warning, and startup endpoints', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const delay = jest.fn().mockResolvedValue(undefined);

    logCliBanner(output);
    logCliConfiguration(output, config as never);
    await logCliMainnetWarning(output, delay);
    logCliStartupComplete(output, { apiPort: 4000, wsPort: 4001 }, true);

    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('Edison - Level-Based Trading Strategy'));
    expect(output.log).toHaveBeenCalledWith('[Main] Active Strategy: Level Based');
    expect(delay).toHaveBeenCalledTimes(1);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('API: http://localhost:4000'));
  });
});
