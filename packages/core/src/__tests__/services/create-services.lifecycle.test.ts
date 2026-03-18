import { BotInitializer } from '../../services/bot-initializer';
import type { IBotInitializerServices } from '../../interfaces';
import {
  createTrackedLifecycleHarness,
  createTrackedServices,
  shutdownTrackedServices,
  type TrackedServiceState,
} from '../helpers/service-lifecycle-test.utils';

describe('createServices lifecycle orchestration', () => {
  let trackedServices: TrackedServiceState[];

  beforeEach(() => {
    trackedServices = [];
  });

  afterEach(async () => {
    await shutdownTrackedServices(trackedServices);
  });

  test('services stay idle until explicit bootstrap/start and stop on shutdown', async () => {
    const harness = createTrackedLifecycleHarness(trackedServices);
    const services = harness.services;
    const initializer = new BotInitializer(
      services as unknown as IBotInitializerServices,
      harness.config,
    );

    const bybit = services.marketDataServices.bybitService;
    const wsManager = services.marketDataServices.webSocketManager;
    const publicWs = services.marketDataServices.publicWebSocket;
    const positionMonitor = services.executionServices.positionMonitor;

    const bybitInitSpy = jest.spyOn(bybit, 'initialize');
    const bybitOpenPositionsSpy = jest.spyOn(bybit, 'getOpenPositions');

    const syncSpy = jest
      .spyOn(services.coreServices.timeService, 'syncWithExchange')
      .mockResolvedValue(undefined);
    const sessionStartSpy = jest
      .spyOn(services.sessionStats, 'startSession')
      .mockReturnValue('session-test');
    const sessionEndSpy = jest
      .spyOn(services.sessionStats, 'endSession')
      .mockImplementation(() => undefined);

    const wsStartSpy = jest.spyOn(wsManager, 'start').mockResolvedValue(undefined);
    const wsStopSpy = jest.spyOn(wsManager, 'stop').mockResolvedValue(undefined);
    const publicStartSpy = jest.spyOn(publicWs, 'start').mockImplementation(() => undefined);
    const publicStopSpy = jest.spyOn(publicWs, 'stop').mockImplementation(() => undefined);
    const monitorStartSpy = jest.spyOn(positionMonitor, 'start').mockImplementation(() => undefined);
    const monitorStopSpy = jest.spyOn(positionMonitor, 'stop').mockImplementation(() => undefined);

    // Side-effect-free creation: no lifecycle start calls at construction time.
    expect(bybitInitSpy).not.toHaveBeenCalled();
    expect(wsStartSpy).not.toHaveBeenCalled();
    expect(publicStartSpy).not.toHaveBeenCalled();
    expect(monitorStartSpy).not.toHaveBeenCalled();

    try {
      await initializer.bootstrap();

      expect(bybitInitSpy).toHaveBeenCalledTimes(1);
      expect(bybitOpenPositionsSpy).toHaveBeenCalled();
      expect(syncSpy).toHaveBeenCalled();
      expect(sessionStartSpy).toHaveBeenCalled();
      expect(wsStartSpy).toHaveBeenCalledTimes(1);
      expect(publicStartSpy).toHaveBeenCalledTimes(1);
      expect(monitorStartSpy).toHaveBeenCalledTimes(1);
    } finally {
      await initializer.shutdown();
    }

    expect(wsStopSpy).toHaveBeenCalledTimes(1);
    expect(publicStopSpy).toHaveBeenCalledTimes(1);
    expect(monitorStopSpy).toHaveBeenCalledTimes(1);
    expect(sessionEndSpy).toHaveBeenCalled();
  });
});
