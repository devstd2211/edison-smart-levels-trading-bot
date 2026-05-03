import { WebSocketEventHandlerManager } from '../../services/websocket-event-handler-manager';
import { createTradingBotRuntimeDependencies } from '../../services/bot-services-adapter';
import { createManagedTrackedServicesContext } from '../helpers/service-lifecycle-test.utils';

describe('WebSocketEventHandlerManager functional boundary', () => {
  const context = createManagedTrackedServicesContext();

  afterEach(async () => {
    await context.cleanup();
    jest.restoreAllMocks();
  });

  test('registers and cleans up grouped runtime listeners through the narrowed adapter contract', () => {
    const { config, services } = context.createInitializerHarness();
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

    manager.registerAllHandlers({});

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
});
