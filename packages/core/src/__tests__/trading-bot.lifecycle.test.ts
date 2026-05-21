import { BotInitializer } from '../services/bot-initializer';
import {
  createManagedTrackedServicesBotRuntime,
  mockSuccessfulInitializerLifecycle,
  type TrackedServicesBotRuntime,
} from './helpers/service-lifecycle-test.utils';
import { WebSocketEventHandlerManager } from '../services/websocket-event-handler-manager';

describe('TradingBot lifecycle delegation', () => {
  let createTradingBotHarness!: TrackedServicesBotRuntime['createTradingBotHarness'];
  let cleanup!: TrackedServicesBotRuntime['cleanup'];

  beforeEach(() => {
    ({
      createTradingBotHarness,
      cleanup,
    } = createManagedTrackedServicesBotRuntime());
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  const createBot = () => {
    return createTradingBotHarness();
  };

  test('start() delegates startup to initializer.bootstrap()', async () => {
    const { bot, telegram } = createBot();
    const registerAllHandlersSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'registerAllHandlers')
      .mockImplementation(() => {});
    const { bootstrapSpy } = mockSuccessfulInitializerLifecycle();

    try {
      await bot.start();

      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
      expect(registerAllHandlersSpy).toHaveBeenCalledTimes(1);
      expect(telegram.notifyBotStarted).toHaveBeenCalledTimes(1);
      expect(bot.isRunning).toBe(true);
    } finally {
      await bot.stop();
    }
  });

  test('stop() delegates shutdown to initializer.shutdown()', async () => {
    const { bot } = createBot();
    const { shutdownSpy } = mockSuccessfulInitializerLifecycle();
    const cleanupSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'cleanupAllListeners')
      .mockImplementation(() => {});

    await bot.start();
    await bot.stop();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(bot.isRunning).toBe(false);
  });

  test('start() propagates bootstrap error and keeps bot stopped', async () => {
    const { bot, telegram } = createBot();
    jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockRejectedValue(new Error('bootstrap failed'));
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);

    await expect(bot.start()).rejects.toThrow('bootstrap failed');

    expect(bot.isRunning).toBe(false);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(telegram.notifyBotStarted).not.toHaveBeenCalled();
  });

  test('start() cleans runtime listeners when bootstrap fails after startup hooks', async () => {
    const { bot } = createBot();
    const registerAllHandlersSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'registerAllHandlers')
      .mockImplementation(() => {});
    const cleanupSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'cleanupAllListeners')
      .mockImplementation(() => {});
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockImplementation(async (hooks) => {
        await hooks?.beforeShutdown?.();
        await hooks?.afterShutdown?.();
      });
    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      throw new Error('bootstrap failed after hooks');
    });

    await expect(bot.start()).rejects.toThrow('bootstrap failed after hooks');

    expect(registerAllHandlersSpy).toHaveBeenCalledTimes(1);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
    expect(bot.isRunning).toBe(false);
  });

  test('stop() resets runtime state even when initializer.shutdown() fails', async () => {
    const { bot } = createBot();
    mockSuccessfulInitializerLifecycle();
    const cleanupSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'cleanupAllListeners')
      .mockImplementation(() => {});
    jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockRejectedValue(new Error('shutdown failed'));

    await bot.start();
    await expect(bot.stop()).rejects.toThrow('shutdown failed');

    expect(cleanupSpy).toHaveBeenCalled();
    expect(bot.isRunning).toBe(false);
  });

  test('start() wires a typed critical-error listener that stops the bot', async () => {
    const { bot, services } = createBot();
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    const stopSpy = jest.spyOn(bot, 'stop').mockResolvedValue(undefined);

    mockSuccessfulInitializerLifecycle();

    await bot.start();
    services.coreServices.eventBus.emit('critical-error', new Error('critical boom'));
    await new Promise((resolve) => setImmediate(resolve));

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
