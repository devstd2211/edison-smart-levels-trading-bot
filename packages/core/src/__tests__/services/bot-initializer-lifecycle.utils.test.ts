import { LifecycleManager } from '../../services/lifecycle-manager.service';
import {
  BOT_INITIALIZER_LIFECYCLE_IDS,
  getBotInitializerListenerCleanupTargets,
  isLifecycleService,
  registerBotInitializerLifecycleServices,
} from '../../services/bot-initializer/bot-initializer-lifecycle.utils';
import { createBotInitializerMockServices } from '../helpers/bot-initializer-test.utils';

describe('bot initializer lifecycle utils', () => {
  test('recognizes explicit start/stop lifecycle services only', () => {
    expect(isLifecycleService({ start: jest.fn(), stop: jest.fn() })).toBe(true);
    expect(isLifecycleService({ start: jest.fn() })).toBe(false);
    expect(isLifecycleService(null)).toBe(false);
  });

  test('registers lifecycle services used by startup and shutdown boundaries', () => {
    const services = createBotInitializerMockServices();
    services.monitoringServices = {
      metricsService: { start: jest.fn(), stop: jest.fn() },
      dashboard: { start: jest.fn(), stop: jest.fn() },
      monitoringServer: { start: jest.fn(), stop: jest.fn() },
    } as never;
    services.resilienceServices = {
      rateLimiter: { start: jest.fn(), stop: jest.fn() },
      retryPolicy: { start: jest.fn(), stop: jest.fn() },
      bulkhead: { start: jest.fn(), stop: jest.fn() },
    } as never;
    (services.executionServices as Record<string, unknown>).orderStateMachine = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const registerSpy = jest.spyOn(LifecycleManager.prototype, 'register');
    const lifecycleManager = new LifecycleManager();

    registerBotInitializerLifecycleServices(lifecycleManager, services);

    expect(registerSpy).toHaveBeenCalledTimes(11);
    expect(registerSpy).toHaveBeenNthCalledWith(1, {
      id: BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
      label: 'private WebSocket',
      service: services.marketDataServices.webSocketManager,
      stage: 'websocket',
    });
    expect(registerSpy).toHaveBeenNthCalledWith(2, {
      id: BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
      label: 'public WebSocket',
      service: services.marketDataServices.publicWebSocket,
      stage: 'websocket',
    });
    expect(registerSpy).toHaveBeenNthCalledWith(3, {
      id: BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
      label: 'position monitor',
      service: services.executionServices.positionMonitor,
      stage: 'position-monitor',
    });
    expect(registerSpy).toHaveBeenLastCalledWith({
      id: BOT_INITIALIZER_LIFECYCLE_IDS.orderStateMachine,
      label: 'order state machine',
      service: services.executionServices.orderStateMachine,
      stage: 'execution',
    });
  });

  test('returns only listener cleanup targets that expose removeAllListeners', () => {
    const services = createBotInitializerMockServices();
    delete ((services.marketDataServices.publicWebSocket as unknown) as Record<string, unknown>).removeAllListeners;

    const targets = getBotInitializerListenerCleanupTargets(services);

    expect(targets.map((target) => target.label)).toEqual([
      'Position monitor',
      'Private WebSocket',
    ]);
  });
});
