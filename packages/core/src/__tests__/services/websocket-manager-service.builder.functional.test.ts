import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createWebSocketManagerConfig,
  createWebSocketManagerDependencies,
  createWebSocketManagerRuntimeServices,
  initializeWebSocketManager,
} from '../../services/factories/builders/websocket-manager-service.builder';
import {
  createTrackedBotFactoryBuilderState,
  createWebSocketMonitoringBuilderCandleEnabledConfig,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Websocket manager builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates websocket manager config outside the composition root body', () => {
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(createWebSocketManagerConfig(config)).toEqual({
      exchange: config.exchange,
    });
  });

  test('creates websocket manager dependencies and runtime services outside the composition root body', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
    } as unknown as BotServiceState;
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(createWebSocketManagerDependencies(state)).toEqual({
      logger,
      errorHandler: state.errorHandler,
    });

    expect(createWebSocketManagerRuntimeServices(state)).toEqual({
      authService: expect.anything(),
      deduplicationService: expect.anything(),
      keepAliveService: expect.anything(),
      orderExecutionDetector: expect.anything(),
    });

    initializeWebSocketManager(state, config);

    expect(state.webSocketManager).toBeDefined();
  });

  test('builder path wires extracted websocket manager builder through state creation', () => {
    const state = createTrackedBotFactoryBuilderState(
      trackedServices,
      createWebSocketMonitoringBuilderCandleEnabledConfig(),
    );

    expect(state.webSocketManager).toBeDefined();
    expect(state.marketDataServices.webSocketManager).toBe(state.webSocketManager);
  });
});
