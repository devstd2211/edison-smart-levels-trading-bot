import type { BotServiceState } from '../../services/bot-services.builder';
import { resolveMonitoringConfig } from '../../services/factories/builders/monitoring-config.builder';
import { createPositionMonitorDependencies } from '../../services/factories/builders/position-monitoring-support.builder';
import {
  createBotFactoryRuntimeTestConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('WebSocket/monitoring builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('resolves monitoring config outside the composition root body', () => {
    const config = createBotFactoryRuntimeTestConfig() as ReturnType<typeof createBotFactoryRuntimeTestConfig> & {
      monitoring?: {
        metricsEnabled: boolean;
        collectInterval: number;
      };
    };

    config.monitoring = {
      metricsEnabled: true,
      collectInterval: 5000,
    };

    expect(resolveMonitoringConfig(config)).toEqual({
      metricsEnabled: true,
      collectInterval: 5000,
    });
  });

  test('creates position-monitor dependencies outside the composition root body', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      bybitService: { getPosition: jest.fn() },
      positionManager: { getCurrentPosition: jest.fn(), clearPosition: jest.fn() },
      telegram: { sendAlert: jest.fn() },
      positionExitingService: { executeExitAction: jest.fn() },
    } as unknown as BotServiceState;

    const dependencies = createPositionMonitorDependencies(state);

    expect(dependencies.exitTypeDetectorService).toBeDefined();
    expect(dependencies.pnlCalculatorService).toBeDefined();
    expect(dependencies.positionSyncService).toBeDefined();
  });

  test('factory path wires extracted websocket/monitoring builders through service creation', () => {
    const config = createBotFactoryRuntimeTestConfig();
    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

    expect(services.webSocketManager).toBeDefined();
    expect(services.publicWebSocket).toBeDefined();
    expect(services.orderbookManager).toBeDefined();
    expect(services.positionMonitor).toBeDefined();
    expect(services.marketDataServices.webSocketManager).toBe(services.webSocketManager);
    expect(services.marketDataServices.publicWebSocket).toBe(services.publicWebSocket);
    expect(services.marketDataServices.orderbookManager).toBe(services.orderbookManager);
    expect(services.executionServices.positionMonitor).toBe(services.positionMonitor);
  });
});
