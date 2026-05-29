import { WebSocketEventHandlerManager } from '../../services/websocket-event-handler-manager';
import { createTradingBotRuntimeDependencies } from '../../services/runtime-service-adapters';
import {
  createManagedTrackedServicesInitializerRuntime,
  type TrackedServicesInitializerRuntime,
} from '../helpers/service-lifecycle-test.utils';

describe('WebSocketEventHandlerManager functional boundary', () => {
  let createInitializerHarness!: TrackedServicesInitializerRuntime['createInitializerHarness'];
  let cleanup!: TrackedServicesInitializerRuntime['cleanup'];

  beforeEach(() => {
    ({
      createInitializerHarness,
      cleanup,
    } = createManagedTrackedServicesInitializerRuntime());
  });

  afterEach(async () => {
    await cleanup();
    jest.restoreAllMocks();
  });

  test('registers and cleans up grouped runtime listeners without a bot collaborator', () => {
    const { config, services } = createInitializerHarness();
    const runtimeDependencies = createTradingBotRuntimeDependencies(services);
    const manager = new WebSocketEventHandlerManager(runtimeDependencies.eventHandlerServices, config);
    const stopLossEvent = { reason: 'test-stop-loss' } as Parameters<
      typeof runtimeDependencies.eventHandlerServices.eventHandlerServices.positionEventHandler.handleStopLossHit
    >[0];
    const positionUpdate = { id: 'position-1' } as Parameters<
      typeof runtimeDependencies.eventHandlerServices.eventHandlerServices.webSocketEventHandler.handlePositionUpdate
    >[0];

    const stopLossSpy = jest
      .spyOn(
        runtimeDependencies.eventHandlerServices.eventHandlerServices.positionEventHandler,
        'handleStopLossHit',
      )
      .mockResolvedValue(undefined);
    const positionUpdateSpy = jest
      .spyOn(
        runtimeDependencies.eventHandlerServices.eventHandlerServices.webSocketEventHandler,
        'handlePositionUpdate',
      )
      .mockResolvedValue(undefined);

    manager.registerAllHandlers();

    services.executionServices.positionMonitor.emit('stopLossHit', stopLossEvent);
    services.marketDataServices.webSocketManager.emit('positionUpdate', positionUpdate);

    expect(stopLossSpy).toHaveBeenCalledWith(stopLossEvent);
    expect(positionUpdateSpy).toHaveBeenCalledWith(positionUpdate);

    manager.cleanupAllListeners();
    services.executionServices.positionMonitor.emit('stopLossHit', stopLossEvent);
    services.marketDataServices.webSocketManager.emit('positionUpdate', positionUpdate);

    expect(stopLossSpy).toHaveBeenCalledTimes(1);
    expect(positionUpdateSpy).toHaveBeenCalledTimes(1);
  });

  test('reuses the shared core logger through the websocket boundary contract', () => {
    const { config, services } = createInitializerHarness();
    const runtimeDependencies = createTradingBotRuntimeDependencies(services);
    const manager = new WebSocketEventHandlerManager(runtimeDependencies.eventHandlerServices, config);

    expect(runtimeDependencies.eventHandlerServices.coreServices.logger).toBe(
      services.coreServices.logger,
    );
    expect('logger' in runtimeDependencies.eventHandlerServices).toBe(false);
    expect(manager).toBeInstanceOf(WebSocketEventHandlerManager);
  });
});
