import { LifecycleManager } from '../../services/lifecycle-manager.service';
import {
  BOT_INITIALIZER_LIFECYCLE_IDS,
  createBotInitializerLifecycleCollaborators,
  getBotInitializerMonitoringServer,
  getBotInitializerListenerCleanupTargets,
  hasBotInitializerLifecycleStageServices,
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
    const monitoringServer = { start: jest.fn(), stop: jest.fn() };
    const metricsService = { start: jest.fn(), stop: jest.fn() };
    const dashboard = { start: jest.fn(), stop: jest.fn() };
    const rateLimiter = { start: jest.fn(), stop: jest.fn() };
    const retryPolicy = { start: jest.fn(), stop: jest.fn() };
    const bulkhead = { start: jest.fn(), stop: jest.fn() };

    services.monitoringServices = {
      metricsService,
      dashboard,
      monitoringServer,
    } as never;
    services.resilienceServices = {
      rateLimiter,
      retryPolicy,
      bulkhead,
    } as never;
    (services.executionServices as Record<string, unknown>).orderStateMachine = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const registerAllSpy = jest.spyOn(LifecycleManager.prototype, 'registerAll');
    const lifecycleManager = new LifecycleManager();
    const collaborators = createBotInitializerLifecycleCollaborators(services);

    registerBotInitializerLifecycleServices(lifecycleManager, collaborators);

    expect(registerAllSpy).toHaveBeenCalledTimes(1);
    const registrations = registerAllSpy.mock.calls[0]?.[0];
    expect(Array.from(registrations ?? [])).toEqual([
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
        label: 'private WebSocket',
        service: services.marketDataServices.webSocketManager,
        stage: 'websocket',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
        label: 'public WebSocket',
        service: services.marketDataServices.publicWebSocket,
        stage: 'websocket',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
        label: 'position monitor',
        service: services.executionServices.positionMonitor,
        stage: 'position-monitor',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.monitoringServer,
        label: 'monitoring server',
        service: monitoringServer,
        stage: 'monitoring-server',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.metricsService,
        label: 'metrics service',
        service: metricsService,
        stage: 'monitoring',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.dashboard,
        label: 'dashboard',
        service: dashboard,
        stage: 'monitoring',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.rateLimiter,
        label: 'rate limiter',
        service: rateLimiter,
        stage: 'resilience',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.retryPolicy,
        label: 'retry policy',
        service: retryPolicy,
        stage: 'resilience',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.bulkhead,
        label: 'bulkhead',
        service: bulkhead,
        stage: 'resilience',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.tradingOrchestrator,
        label: 'trading orchestrator',
        service: services.executionServices.tradingOrchestrator,
        stage: 'execution',
      },
      {
        id: BOT_INITIALIZER_LIFECYCLE_IDS.orderStateMachine,
        label: 'order state machine',
        service: services.executionServices.orderStateMachine,
        stage: 'execution',
      },
    ]);
  });

  test('returns only listener cleanup targets that expose removeAllListeners', () => {
    const services = createBotInitializerMockServices();
    const collaborators = createBotInitializerLifecycleCollaborators(services);
    delete ((services.marketDataServices.publicWebSocket as unknown) as Record<string, unknown>).removeAllListeners;

    const targets = getBotInitializerListenerCleanupTargets(collaborators);

    expect(targets.map((target) => target.label)).toEqual([
      'Position monitor',
      'Private WebSocket',
    ]);
  });

  test('reports optional lifecycle stages only when the stage contains lifecycle services', () => {
    const services = createBotInitializerMockServices();

    expect(hasBotInitializerLifecycleStageServices(
      createBotInitializerLifecycleCollaborators(services),
      'monitoring',
    )).toBe(false);
    expect(hasBotInitializerLifecycleStageServices(
      createBotInitializerLifecycleCollaborators(services),
      'resilience',
    )).toBe(false);

    services.monitoringServices = {
      dashboard: { start: jest.fn(), stop: jest.fn() },
    } as never;
    services.resilienceServices = {
      retryPolicy: { start: jest.fn(), stop: jest.fn() },
    } as never;

    const collaborators = createBotInitializerLifecycleCollaborators(services);

    expect(hasBotInitializerLifecycleStageServices(collaborators, 'monitoring')).toBe(true);
    expect(hasBotInitializerLifecycleStageServices(collaborators, 'resilience')).toBe(true);
  });

  test('returns the monitoring server only when it exposes a lifecycle contract', () => {
    const services = createBotInitializerMockServices();

    expect(getBotInitializerMonitoringServer(
      createBotInitializerLifecycleCollaborators(services),
    )).toBeNull();

    const monitoringServer = { start: jest.fn(), stop: jest.fn() };
    services.monitoringServices = {
      monitoringServer,
    } as never;

    expect(getBotInitializerMonitoringServer(
      createBotInitializerLifecycleCollaborators(services),
    )).toBe(monitoringServer);
  });
});
