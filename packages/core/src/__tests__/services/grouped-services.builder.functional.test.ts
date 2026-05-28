import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createBotStateWebApiReadServices,
  createCoreServicesDeps,
  createEventHandlerServicesDeps,
  createExecutionServicesDeps,
  createGroupedServicesDeps,
  createMarketDataServicesDeps,
  createMonitoringServicesDeps,
  createRiskServicesDeps,
  createWebApiServicesDeps,
} from '../../services/factories/builders/grouped-service-inputs.builder';
import { createExecutionServices } from '../../services/containers/execution-services';
import { createMarketDataServices } from '../../services/containers/market-data-services';
import { createMonitoringServices } from '../../services/containers/monitoring-services';
import { createRiskServices } from '../../services/containers/risk-services';
import { getDefaultWebApiIndicatorPreferences } from '../../config/web-api-config';
import {
  createGroupedServicesBuilderRuntimeDefaultConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Grouped services builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates market-data, execution, monitoring, and risk deps outside the composition root body', () => {
    const state = createTrackedBotFactoryRuntimeSource(
      trackedServices,
      createGroupedServicesBuilderRuntimeDefaultConfig(),
    ) as BotServiceState;

    const marketDataDeps = createMarketDataServicesDeps(state);
    const executionDeps = createExecutionServicesDeps(state);
    const monitoringDeps = createMonitoringServicesDeps(state);
    const riskDeps = createRiskServicesDeps(state);

    expect(marketDataDeps.webSocketManager).toBe(state.webSocketManager);
    expect(marketDataDeps.orderbookManager).toBe(state.orderbookManager);
    expect(executionDeps.positionMonitor).toBe(state.positionMonitor);
    expect(executionDeps.tradingOrchestrator).toBe(state.tradingOrchestrator);
    expect(monitoringDeps.dashboard).toBe(state.dashboard);
    expect(monitoringDeps.metrics).toBe(state.metrics);
    expect(riskDeps.riskManager).toBe(state.riskManager);
    expect(riskDeps.realTimeRiskMonitor).toBe(state.realTimeRiskMonitor);
  });

  test('creates one explicit grouped-service deps object for the grouped container', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();
    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

    const groupedDeps = createGroupedServicesDeps(state, config);

    expect(groupedDeps.marketDataServices).toEqual(createMarketDataServicesDeps(state));
    expect(groupedDeps.executionServices).toEqual(createExecutionServicesDeps(state));
    expect(groupedDeps.monitoringServices).toEqual(createMonitoringServicesDeps(state));
    expect(groupedDeps.riskServices).toEqual(createRiskServicesDeps(state));
    expect(groupedDeps.webApiServices).toEqual(createWebApiServicesDeps(state, config));
    expect(groupedDeps.coreServices).toEqual(createCoreServicesDeps(state));
    expect(groupedDeps.eventHandlerServices).toEqual(createEventHandlerServicesDeps(state));
  });

  test('creates web-api, core, and event-handler deps outside the composition root body', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();
    config.webApi = {
      indicatorPreferences: {
        timeframes: ['15m', '1h'],
        rsiPeriods: [7, 14],
        emaPeriods: [20, 100],
        atrPeriods: [10, 14],
      },
    } as NonNullable<typeof config.webApi>;

    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

    const webApiDeps = createWebApiServicesDeps(state, config);
    const webApiReadDeps = createBotStateWebApiReadServices(state);
    const coreDeps = createCoreServicesDeps(state);
    const eventHandlerDeps = createEventHandlerServicesDeps(state);

    const expectedIndicatorPreferences = {
      ...config.webApi?.indicatorPreferences,
    };

    expect(webApiDeps.journal).toBe(state.journal);
    expect(webApiDeps.bybitService).toBe(state.bybitService);
    expect(webApiDeps.marketDataServices.indicatorCache).toBe(state.indicatorCache);
    expect(webApiDeps.indicatorPreferences).toEqual(expectedIndicatorPreferences);
    expect(webApiReadDeps.logger).toBe(state.coreServices.logger);
    expect(webApiReadDeps.bybitService).toBe(webApiDeps.bybitService);
    expect(webApiReadDeps.candleProvider).toBe(webApiDeps.marketDataServices.candleProvider);
    expect(coreDeps.logger).toBe(state.logger);
    expect(coreDeps.timeService).toBe(state.timeService);
    expect(eventHandlerDeps.positionEventHandler).toBe(state.positionEventHandler);
    expect(eventHandlerDeps.webSocketEventHandler).toBe(state.webSocketEventHandler);
  });

  test('normalizes default web-api indicator preferences when config omits them', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();
    delete config.webApi;

    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;
    const webApiDeps = createWebApiServicesDeps(state, config);

    expect(webApiDeps.indicatorPreferences).toEqual(getDefaultWebApiIndicatorPreferences());
  });

  test('factory path wires extracted grouped-service builders through service creation', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();
    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

    expect(services.marketDataServices.bybitService).toBe(services.bybitService);
    expect(services.marketDataServices.webSocketManager).toBe(services.webSocketManager);
    expect(services.executionServices.positionMonitor).toBe(services.positionMonitor);
    expect(services.monitoringServices.metrics).toBe(services.metrics);
    expect(services.riskServices.riskManager).toBe(services.riskManager);
    expect(services.webApiServices.journal).toBe(services.journal);
    expect(services.coreServices.eventBus).toBe(services.eventBus);
    expect(services.eventHandlerServices.positionEventHandler).toBe(services.positionEventHandler);
  });

  test('domain containers clone only their grouped service boundary fields', () => {
    const config = createGroupedServicesBuilderRuntimeDefaultConfig();
    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;
    const marketDataServices = createMarketDataServices(createMarketDataServicesDeps(state));
    const executionServices = createExecutionServices(createExecutionServicesDeps(state));
    const monitoringServices = createMonitoringServices(createMonitoringServicesDeps(state));
    const riskServices = createRiskServices(createRiskServicesDeps(state));

    expect(marketDataServices).not.toBe(state.marketDataServices);
    expect(Object.keys(marketDataServices).sort()).toEqual([
      'bybitService',
      'candleProvider',
      'indicatorCache',
      'indicatorPreCalc',
      'orderbookManager',
      'publicWebSocket',
      'timeframeProvider',
      'webSocketManager',
    ]);
    expect(Object.keys(executionServices).sort()).toEqual([
      'dynamicPositionSizer',
      'ladderExitDetector',
      'orderStateMachine',
      'positionExitingService',
      'positionManager',
      'positionMonitor',
      'positionScalingService',
      'realTimeRiskMonitor',
      'smartOrderExecution',
      'tradingOrchestrator',
    ]);
    expect(Object.keys(monitoringServices).sort()).toEqual([
      'dashboard',
      'healthCheckService',
      'metrics',
      'metricsService',
      'monitoringServer',
    ]);
    expect(Object.keys(riskServices).sort()).toEqual([
      'realTimeRiskMonitor',
      'realityCheck',
      'riskManager',
    ]);
  });
});
