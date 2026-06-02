import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createWebSocketManagerConfig,
  createWebSocketManagerDependencies,
  createWebSocketManagerService,
  createWebSocketManagerRuntimeServices,
  initializeWebSocketManager,
} from '../../services/factories/builders/websocket-manager-service.builder';
import {
  createTrackedBotFactoryBuilderState,
  createWebSocketMonitoringBuilderCandleEnabledConfig,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedWebSocketManagerContext,
  getEventDeduplicationCacheSize,
  getEventDeduplicationCacheTtlMs,
  getWebSocketKeepAliveIntervalMs,
} from '../helpers/websocket-manager-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';
import { WEBSOCKET_MANAGER_RUNTIME_DEFAULTS } from '../../services/factories/builders/websocket-manager-service.builder.constants';

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

  test('creates websocket manager dependencies, runtime services, and service instance outside the composition root body', () => {
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

    const dependencies = createWebSocketManagerDependencies(state);
    const runtimeServices = createWebSocketManagerRuntimeServices(dependencies);

    expect(runtimeServices).toEqual({
      authService: expect.anything(),
      deduplicationService: expect.anything(),
      keepAliveService: expect.anything(),
      orderExecutionDetector: expect.anything(),
    });

    expect(
      createWebSocketManagerService(config, dependencies, runtimeServices),
    ).toEqual(expect.anything());

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

  test('shares websocket runtime tuning defaults across builder services and test harnesses', async () => {
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
    const dependencies = createWebSocketManagerDependencies(state);
    const runtimeServices = createWebSocketManagerRuntimeServices(dependencies);
    const context = createManagedWebSocketManagerContext();

    try {
      expect(getEventDeduplicationCacheSize(runtimeServices.deduplicationService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationCapacity,
      );
      expect(getEventDeduplicationCacheTtlMs(runtimeServices.deduplicationService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationTtlMs,
      );
      expect(getWebSocketKeepAliveIntervalMs(runtimeServices.keepAliveService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.keepAliveIntervalMs,
      );

      expect(getEventDeduplicationCacheSize(context.deduplicationService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationCapacity,
      );
      expect(getEventDeduplicationCacheTtlMs(context.deduplicationService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationTtlMs,
      );
      expect(getWebSocketKeepAliveIntervalMs(context.keepAliveService)).toBe(
        WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.keepAliveIntervalMs,
      );
    } finally {
      await context.cleanup();
    }
  });
});
