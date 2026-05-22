import { runCliMain } from '../../cli';

describe('cli entrypoint functional behavior', () => {
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
        API_PORT: '4100',
        WS_PORT: '4101',
      },
      exit: jest.fn(),
      title: '',
    };
    const bot = {
      start: jest.fn().mockResolvedValue(undefined),
      enableTestMode: jest.fn(),
    };
    const webApiAdapter = { kind: 'adapter' };
    const setupShutdown = jest.fn();

    await runCliMain({
      console: output,
      createBotRuntime: jest.fn().mockResolvedValue({ bot, webApiAdapter }),
      createWebServerRuntime: jest.fn(() => ({ bot, webApiAdapter })) as never,
      delay: jest.fn().mockResolvedValue(undefined),
      envLoader,
      loadValidatedConfig: jest.fn().mockResolvedValue({
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
      }),
      process: processRef as never,
      setupGracefulShutdown: setupShutdown as never,
      startWebServer: jest.fn().mockRejectedValue(new Error('port busy')),
    });

    expect(envLoader.config).toHaveBeenCalledWith({ path: expect.stringContaining('.env') });
    expect(processRef.title).toBe('Edison - Level Based (BTCUSDT)');
    expect(bot.start).toHaveBeenCalledTimes(1);
    expect(bot.enableTestMode).toHaveBeenCalledTimes(1);
    expect(setupShutdown).toHaveBeenCalledWith(bot, null);
    expect(output.warn).toHaveBeenCalledWith(
      '[Main] Continuing without web server - bot can run standalone',
    );
    expect(processRef.exit).not.toHaveBeenCalled();
  });
});
