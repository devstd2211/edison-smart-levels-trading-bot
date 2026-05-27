import * as fs from 'fs';
import * as path from 'path';
import {
  configureCliEnvironment,
  createCliRuntimeHandoff,
  createCliWebRuntimeHandoff,
  createCliWindowTitle,
  logCliBanner,
  logCliBotInitialization,
  logCliBotStartup,
  logCliConfiguration,
  logCliMainnetWarning,
  logCliStartupComplete,
  logCliStartupFailure,
  logCliWebServerInitialization,
  logCliWebServerSuccess,
  loadCliStartupConfig,
} from '../../cli/cli-entrypoint-runtime';
import type { Config } from '../../types/legacy';

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
  test('keeps startup config and runtime handoffs named at the CLI helper boundary', async () => {
    type Runtime = {
      bot: { kind: 'bot' };
      webApiAdapter: { kind: 'web-api' };
    };

    const loadConfig = jest.fn().mockResolvedValue(config);
    const createRuntime = jest.fn<Promise<Runtime>, [Config]>().mockResolvedValue({
      bot: { kind: 'bot' },
      webApiAdapter: { kind: 'web-api' },
    });
    const createWebRuntime = jest.fn((bot, webApiAdapter) => ({
      botAdapter: bot,
      webApiAdapter,
    }));

    const loadedConfig = await loadCliStartupConfig(loadConfig);
    const runtime = await createCliRuntimeHandoff(loadedConfig, createRuntime);
    const webRuntime = createCliWebRuntimeHandoff(
      runtime.bot,
      runtime.webApiAdapter,
      createWebRuntime,
    );

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(createRuntime).toHaveBeenCalledWith(config);
    expect(createWebRuntime).toHaveBeenCalledWith(runtime.bot, runtime.webApiAdapter);
    expect(webRuntime).toEqual({
      botAdapter: runtime.bot,
      webApiAdapter: runtime.webApiAdapter,
    });
  });

  test('documents the CLI web handoff as runtime-pair materialization without lifecycle start', () => {
    const cliRuntimeSource = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'cli', 'cli-entrypoint-runtime.ts'),
      'utf8',
    );

    expect(cliRuntimeSource).toContain(
      'Materializes the web runtime pair from the already-created CLI bot runtime.',
    );
    expect(cliRuntimeSource).toContain(
      'Lifecycle remains with the web starter after this helper returns the pair.',
    );
  });

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
    logCliBotInitialization(output);
    logCliWebServerInitialization(output);
    logCliWebServerSuccess(output);
    logCliBotStartup(output);
    await logCliMainnetWarning(output, delay);
    logCliStartupComplete(output, { apiPort: 4000, wsPort: 4001 }, true);
    logCliStartupFailure(output, new Error('boom'));

    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('Edison - Level-Based Trading Strategy'));
    expect(output.log).toHaveBeenCalledWith('[Main] Active Strategy: Level Based');
    expect(output.log).toHaveBeenCalledWith('\n[Main] Initializing Trading Bot via BotFactory...');
    expect(output.log).toHaveBeenCalledWith('[Main] Initializing Web Server...');
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('Web Server initialized successfully'));
    expect(output.log).toHaveBeenCalledWith('[Main] Starting Trading Bot...\n');
    expect(delay).toHaveBeenCalledTimes(1);
    expect(output.log).toHaveBeenCalledWith(expect.stringContaining('API: http://localhost:4000'));
    expect(output.error).toHaveBeenCalledWith('\n[Main] Failed to start bot:', expect.any(Error));
  });
});
