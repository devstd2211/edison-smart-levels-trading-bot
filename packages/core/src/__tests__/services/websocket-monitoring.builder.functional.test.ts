import type { BotServiceState } from '../../services/bot-services.builder';
import { resolveMonitoringConfig } from '../../services/factories/builders/monitoring-config.builder';
import { createPositionMonitorDependencies } from '../../services/factories/builders/position-monitoring-support.builder';
import { createWebSocketMonitoringConfig } from '../../services/factories/builders/websocket-monitoring.builder';
import {
  createTrackedBotFactoryRuntimeSource,
  createWebSocketMonitoringBuilderCandleEnabledConfig,
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
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(resolveMonitoringConfig(config)).toEqual({
      metricsEnabled: true,
      collectInterval: 5000,
    });
  });

  test('creates websocket monitoring config outside the composition root body', () => {
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();

    expect(createWebSocketMonitoringConfig(config)).toEqual({
      exchange: config.exchange,
      btcConfirmation: config.btcConfirmation,
      riskManagement: config.riskManagement,
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
    const config = createWebSocketMonitoringBuilderCandleEnabledConfig();
    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config);

    expect(services.marketDataServices.webSocketManager).toBeDefined();
    expect(services.marketDataServices.publicWebSocket).toBeDefined();
    expect(services.marketDataServices.orderbookManager).toBeDefined();
    expect(services.executionServices.positionMonitor).toBeDefined();
  });
});
