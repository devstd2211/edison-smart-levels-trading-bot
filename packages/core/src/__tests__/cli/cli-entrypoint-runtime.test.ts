import * as fs from 'fs';
import * as path from 'path';
import {
  CLI_BANNER_OUTPUT_LINES,
  CLI_CONFIGURATION_OUTPUT_LINES,
  CLI_MAINNET_WARNING_OUTPUT_LINES,
  CLI_STARTUP_OUTPUT_LINES,
  CLI_STARTUP_ENDPOINT_OUTPUT_LINES,
  createCliConfigurationOutputRows,
  createCliStartupEndpointOutputRows,
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
  logCliWebServerFailure,
  logCliWebServerInitialization,
  logCliWebServerSuccess,
  loadCliStartupConfig,
} from '../../cli/cli-entrypoint-runtime';
import { CLI_SEPARATOR_LENGTH } from '../../cli/cli-runtime';
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
      'Materializes the CLI-owned web runtime pair from the already-created bot runtime.',
    );
    expect(cliRuntimeSource).toContain(
      'Lifecycle start remains with `startWebServer(...)`; this helper only returns the pair.',
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
    logCliWebServerFailure(output, new Error('port busy'));
    logCliBotStartup(output);
    await logCliMainnetWarning(output, delay);
    logCliStartupComplete(output, { apiPort: 4000, wsPort: 4001 }, true);
    logCliStartupFailure(output, new Error('boom'));

    expect(output.log).toHaveBeenCalledWith(CLI_BANNER_OUTPUT_LINES.title);
    expect(output.log).toHaveBeenCalledWith(
      CLI_CONFIGURATION_OUTPUT_LINES.activeStrategy('Level Based'),
    );
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.botInitialization);
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.webServerInitialization);
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.webServerSuccess);
    expect(output.error).toHaveBeenCalledWith(
      CLI_STARTUP_OUTPUT_LINES.webServerFailure,
      'port busy',
    );
    expect(output.warn).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.webServerDegraded);
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.botStartup);
    expect(delay).toHaveBeenCalledTimes(1);
    expect(output.log).toHaveBeenCalledWith(CLI_MAINNET_WARNING_OUTPUT_LINES.countdown);
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.api(4000));
    expect(output.log).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.testMode);
    expect(output.error).toHaveBeenCalledWith(
      CLI_STARTUP_OUTPUT_LINES.fatalStartupFailure,
      expect.any(Error),
    );
  });

  test('keeps banner, web success, configuration, test-mode, fatal, endpoint, and countdown output behind CLI constants', () => {
    expect(CLI_BANNER_OUTPUT_LINES.separator).toBe('='.repeat(CLI_SEPARATOR_LENGTH));
    expect(CLI_BANNER_OUTPUT_LINES.title).toContain('Edison - Level-Based Trading Strategy');
    expect(CLI_CONFIGURATION_OUTPUT_LINES.loadingConfiguration).toBe('\n[Main] Loading configuration...');
    expect(CLI_CONFIGURATION_OUTPUT_LINES.validatingConfiguration).toBe('[Main] Validating configuration...');
    expect(CLI_CONFIGURATION_OUTPUT_LINES.symbol('ETHUSDT')).toBe('[Main] Symbol: ETHUSDT');
    expect(CLI_CONFIGURATION_OUTPUT_LINES.tradingCycle(15)).toBe('[Main] Trading Cycle: 15s');
    expect(CLI_STARTUP_OUTPUT_LINES.testMode).toContain('TEST MODE ENABLED');
    expect(CLI_STARTUP_OUTPUT_LINES.webServerSuccess).toContain('Web Server initialized successfully');
    expect(CLI_STARTUP_OUTPUT_LINES.fatalStartupFailure).toBe('\n[Main] Failed to start bot:');
    expect(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webInterface()).toContain('http://localhost:3000');
    expect(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.api(4100)).toContain('http://localhost:4100');
    expect(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webSocket(4101)).toContain('ws://localhost:4101');
    expect(CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webClientDevServerNote()).toContain(
      'cd packages/web-client && npm run dev',
    );
    expect(CLI_MAINNET_WARNING_OUTPUT_LINES.countdown).toContain('5 seconds');
  });

  test('groups configuration and startup endpoint output rows at the CLI runtime boundary', () => {
    expect(createCliConfigurationOutputRows(config as never)).toEqual([
      CLI_CONFIGURATION_OUTPUT_LINES.loadingConfiguration,
      CLI_CONFIGURATION_OUTPUT_LINES.validatingConfiguration,
      CLI_CONFIGURATION_OUTPUT_LINES.activeStrategy('Level Based'),
      CLI_CONFIGURATION_OUTPUT_LINES.symbol('BTCUSDT'),
      CLI_CONFIGURATION_OUTPUT_LINES.timeframe('1m'),
      CLI_CONFIGURATION_OUTPUT_LINES.leverage(3),
      CLI_CONFIGURATION_OUTPUT_LINES.risk(1),
      CLI_CONFIGURATION_OUTPUT_LINES.tradingCycle(5),
      CLI_CONFIGURATION_OUTPUT_LINES.mode('TESTNET ⚠️'),
    ]);
    expect(createCliStartupEndpointOutputRows({ apiPort: 4100, wsPort: 4101 })).toEqual([
      CLI_STARTUP_ENDPOINT_OUTPUT_LINES.running,
      CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webInterface(),
      CLI_STARTUP_ENDPOINT_OUTPUT_LINES.api(4100),
      CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webSocket(4101),
      CLI_STARTUP_ENDPOINT_OUTPUT_LINES.webClientDevServerNote(),
    ]);
  });
});
