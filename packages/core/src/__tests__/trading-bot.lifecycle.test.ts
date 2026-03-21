import { BotInitializer } from '../services/bot-initializer';
import {
  createTrackedTradingBotHarness,
  shutdownTrackedServices,
  type TrackedServiceState,
} from './helpers/service-lifecycle-test.utils';
import { WebSocketEventHandlerManager } from '../services/websocket-event-handler-manager';

describe('TradingBot lifecycle delegation', () => {
  let trackedServices: TrackedServiceState[];

  beforeEach(() => {
    trackedServices = [];
  });

  afterEach(async () => {
    await shutdownTrackedServices(trackedServices);
    jest.restoreAllMocks();
  });

  const createBot = () => {
    return createTrackedTradingBotHarness(trackedServices);
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
    });
    const shutdownSpy = jest
      .spyOn(BotInitializer.prototype, 'shutdown')
      .mockResolvedValue(undefined);
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
    expect(shutdownSpy).not.toHaveBeenCalled();
    expect(telegram.notifyBotStarted).not.toHaveBeenCalled();
  });
});
