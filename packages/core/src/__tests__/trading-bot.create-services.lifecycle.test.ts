import {
  createManagedTrackedServicesContext,
} from './helpers/service-lifecycle-test.utils';

describe('TradingBot + createServices lifecycle orchestration', () => {
  type ManagedTrackedServices = ReturnType<typeof createManagedTrackedServicesContext>;
  let createTradingBotHarness: ManagedTrackedServices['createTradingBotHarness'];
  let cleanup: ManagedTrackedServices['cleanup'];

  beforeEach(() => {
    ({ createTradingBotHarness, cleanup } = createManagedTrackedServicesContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('services are idle before start and explicitly stopped via bot.stop()', async () => {
    const harness = createTradingBotHarness();
    const serviceState = harness.services;
    const bot = harness.bot;

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

    expect(harness.exchange.initialize).not.toHaveBeenCalled();
    expect(syncSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();
    expect(bot.isRunning).toBe(false);

    try {
      await bot.start();
      expect(bot.isRunning).toBe(true);
      expect(harness.exchange.initialize).toHaveBeenCalledTimes(1);
      expect(syncSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
      expect(harness.telegram.notifyBotStarted).toHaveBeenCalledTimes(1);
    } finally {
      await bot.stop();
    }

    expect(bot.isRunning).toBe(false);
    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(harness.telegram.notifyBotStopped).toHaveBeenCalledTimes(1);
  });
});
