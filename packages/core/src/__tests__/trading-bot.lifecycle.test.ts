import { BotInitializer } from '../services/bot-initializer';
import {
  createManagedTrackedServicesContext,
  type ManagedTrackedServicesContext,
} from './helpers/service-lifecycle-test.utils';
import { WebSocketEventHandlerManager } from '../services/websocket-event-handler-manager';

describe('TradingBot lifecycle delegation', () => {
  let context: ManagedTrackedServicesContext;

  beforeEach(() => {
    context = createManagedTrackedServicesContext();
  });

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  const createBot = () => {
    return context.createTradingBotHarness();
  };

  test('start() delegates startup to initializer.bootstrap()', async () => {
    const { bot, telegram } = createBot();
    const registerAllHandlersSpy = jest
      .spyOn(WebSocketEventHandlerManager.prototype, 'registerAllHandlers')
      .mockImplementation(() => {});
    const bootstrapSpy = jest
      .spyOn(BotInitializer.prototype, 'bootstrap')
      .mockImplementation(async (hooks) => {
        await hooks?.beforeMonitoring?.();
        await hooks?.afterStart?.();
      });
    jest.spyOn(BotInitializer.prototype, 'shutdown').mockResolvedValue(undefined);

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
    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      await hooks?.afterStart?.();
    });
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockImplementation(async (hooks) => {
        await hooks?.beforeShutdown?.();
        await hooks?.afterShutdown?.();
      });
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
    jest.spyOn(BotInitializer.prototype, 'bootstrap').mockImplementation(async (hooks) => {
      await hooks?.beforeMonitoring?.();
      await hooks?.afterStart?.();
    });
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
});
