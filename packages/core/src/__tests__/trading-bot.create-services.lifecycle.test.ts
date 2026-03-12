import { TradingBot } from '../bot';
import { createTradingBotServiceBundle } from '../services/bot-services-adapter';
import {
  createMinimalLifecycleConfig,
  createMockLifecycleExchange,
  createMockLifecycleTelegram,
  createTrackedServices,
  shutdownTrackedServices,
  type TrackedServiceState,
} from './helpers/service-lifecycle-test.utils';

describe('TradingBot + createServices lifecycle orchestration', () => {
  let trackedServices: TrackedServiceState[];

  beforeEach(() => {
    trackedServices = [];
  });

  afterEach(async () => {
    await shutdownTrackedServices(trackedServices);
  });

  test('services are idle before start and explicitly stopped via bot.stop()', async () => {
    const config = createMinimalLifecycleConfig();
    const mockExchange = createMockLifecycleExchange();
    const mockTelegram = createMockLifecycleTelegram();

    const serviceState = createTrackedServices(trackedServices, config, {
      bybitService: mockExchange,
      telegram: mockTelegram,
    });
    const bot = new TradingBot(createTradingBotServiceBundle(serviceState), config);

    const wsManager = serviceState.marketDataServices.webSocketManager;
    const publicWs = serviceState.marketDataServices.publicWebSocket;
    const positionMonitor = serviceState.executionServices.positionMonitor;

    const syncSpy = jest
      .spyOn(serviceState.coreServices.timeService, 'syncWithExchange')
      .mockResolvedValue(undefined);
    const wsStartSpy = jest.spyOn(wsManager, 'start').mockResolvedValue(undefined);
    const wsStopSpy = jest.spyOn(wsManager, 'stop').mockResolvedValue(undefined);
    const publicStartSpy = jest.spyOn(publicWs, 'start').mockImplementation(() => undefined);
    const publicStopSpy = jest.spyOn(publicWs, 'stop').mockImplementation(() => undefined);
    const monitorStartSpy = jest.spyOn(positionMonitor, 'start').mockImplementation(() => undefined);
    const monitorStopSpy = jest.spyOn(positionMonitor, 'stop').mockImplementation(() => undefined);

    expect(mockExchange.initialize).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();
    expect(bot.isRunning).toBe(false);

    try {
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(mockExchange.initialize).toHaveBeenCalledTimes(1);
      expect(syncSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
      expect(mockTelegram.notifyBotStarted).toHaveBeenCalledTimes(1);
    } finally {
      await bot.stop();
    }

    expect(bot.isRunning).toBe(false);
    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(mockTelegram.notifyBotStopped).toHaveBeenCalledTimes(1);
  });
});
