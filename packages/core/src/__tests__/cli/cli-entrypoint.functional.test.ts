import * as cliEntrypoint from '../../cli';
import * as fs from 'fs';
import * as path from 'path';
import { CLI_DEFAULT_PORTS } from '../../cli/cli-runtime';
import { CLI_STARTUP_OUTPUT_LINES } from '../../cli/cli-entrypoint-runtime';
import {
  CLI_ENTRYPOINT_EXPORT_NAMES,
  runCliMain,
  runCliMainIfMain,
  shouldRunCliMain,
} from '../../cli';

describe('cli entrypoint functional behavior', () => {
  function readCliEntrypointSource(): string {
    return fs.readFileSync(path.resolve(__dirname, '..', '..', 'cli', 'index.ts'), 'utf8');
  }

  test('keeps the dedicated CLI entrypoint export surface focused on startup helpers only', () => {
    expect(Object.keys(cliEntrypoint).sort()).toEqual(
      [...CLI_ENTRYPOINT_EXPORT_NAMES].sort(),
    );
  });

  test('loads env, starts runtime, tolerates web startup failure, and exits only on fatal startup errors', async () => {
    const output = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const envLoader = {
      config: jest.fn(),
    };
    const processRef = {
      cwd: jest.fn(() => 'D:/repo'),
      env: {
        API_PORT: `${CLI_DEFAULT_PORTS.apiPort + 100}`,
        WS_PORT: `${CLI_DEFAULT_PORTS.wsPort + 100}`,
      },
      exit: jest.fn(),
      title: '',
    };
    const bot = {
      start: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    const webApiAdapter = { kind: 'adapter' };
    const webRuntime = { botAdapter: { close: jest.fn() }, webApiAdapter };
    const createBotRuntime = jest.fn().mockResolvedValue({ bot, webApiAdapter });
    const createWebServerRuntime = jest.fn(() => webRuntime);
    const startWebServer = jest.fn().mockRejectedValue(new Error('port busy'));
    const setupShutdown = jest.fn();
    const config = {
      exchange: {
        symbol: 'BTCUSDT',
        timeframe: '1m',
        demo: true,
        testnet: false,
      },
      trading: {
        leverage: 2,
        riskPercent: 1,
        tradingCycleIntervalMs: 10_000,
      },
      strategies: {
        levelBased: {
          enabled: true,
        },
      },
      meta: {
        testMode: true,
      },
    };

    await runCliMain({
      console: output,
      createBotRuntime,
      createWebServerRuntime: createWebServerRuntime as never,
      delay: jest.fn().mockResolvedValue(undefined),
      envLoader,
      loadValidatedConfig: jest.fn().mockResolvedValue(config),
      process: processRef as never,
      setupGracefulShutdown: setupShutdown as never,
      startWebServer,
    });

    expect(envLoader.config).toHaveBeenCalledWith({ path: expect.stringContaining('.env') });
    expect(createBotRuntime).toHaveBeenCalledWith(config);
    expect(createWebServerRuntime).toHaveBeenCalledWith(bot, webApiAdapter);
    expect(startWebServer).toHaveBeenCalledWith(webRuntime, {
      apiPort: CLI_DEFAULT_PORTS.apiPort + 100,
      wsPort: CLI_DEFAULT_PORTS.wsPort + 100,
    });
    expect(createBotRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      createWebServerRuntime.mock.invocationCallOrder[0],
    );
    expect(createWebServerRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      startWebServer.mock.invocationCallOrder[0],
    );
    expect(startWebServer.mock.invocationCallOrder[0]).toBeLessThan(
      bot.start.mock.invocationCallOrder[0],
    );
    expect(output.warn.mock.invocationCallOrder[0]).toBeLessThan(
      bot.start.mock.invocationCallOrder[0],
    );
    expect(processRef.title).toBe('Edison - Level Based (BTCUSDT)');
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(bot.enableTestMode).toHaveBeenCalledTimes(1);
    expect(setupShutdown).toHaveBeenCalledWith(bot, null);
    expect(output.error).toHaveBeenCalledWith(
      CLI_STARTUP_OUTPUT_LINES.webServerFailure,
      'port busy',
    );
    expect(output.warn).toHaveBeenCalledWith(CLI_STARTUP_OUTPUT_LINES.webServerDegraded);
    expect(processRef.exit).not.toHaveBeenCalled();
  });

  test('direct execution helpers only run the CLI entrypoint when the module is main', async () => {
    const currentModule = { id: 'cli-entrypoint' } as NodeModule;
    const otherModule = { id: 'other' } as NodeModule;
    const mainEntrypoint = jest.fn().mockResolvedValue(undefined);

    expect(shouldRunCliMain(currentModule, currentModule)).toBe(true);
    expect(shouldRunCliMain(currentModule, otherModule)).toBe(false);
    expect(runCliMainIfMain(currentModule, otherModule, mainEntrypoint)).toBeUndefined();

    await expect(
      runCliMainIfMain(currentModule, currentModule, mainEntrypoint),
    ).resolves.toBeUndefined();
    expect(mainEntrypoint).toHaveBeenCalledTimes(1);
  });

  test('keeps CLI dependency bindings named for the composition root boundary', () => {
    const cliEntrypointSource = readCliEntrypointSource();

    expect(cliEntrypointSource).toContain('const cliOutput = dependencies.console ?? console;');
    expect(cliEntrypointSource).toContain('const cliProcess = dependencies.process ?? process;');
    expect(cliEntrypointSource).toContain(
      'const cliBotRuntimeFactory = dependencies.createBotRuntime ?? createBotRuntime;',
    );
    expect(cliEntrypointSource).toContain(
      'const cliWebRuntimeFactory = dependencies.createWebServerRuntime ?? createWebServerRuntime;',
    );
    expect(cliEntrypointSource).toContain(
      'const cliWebServerStarter = dependencies.startWebServer ?? startWebServer;',
    );
  });
});
