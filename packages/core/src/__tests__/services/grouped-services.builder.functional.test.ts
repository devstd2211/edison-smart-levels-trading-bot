import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createBotStateWebApiReadServices,
  createCoreServicesDeps,
  createEventHandlerServicesDeps,
  createExecutionServicesDeps,
  createMarketDataServicesDeps,
  createMonitoringServicesDeps,
  createRiskServicesDeps,
  createWebApiServicesDeps,
} from '../../services/factories/builders/grouped-service-inputs.builder';
import { getDefaultWebApiIndicatorPreferences } from '../../config/web-api-config';
import {
  createBotFactoryRuntimeTestConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesContext,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Grouped services builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesContext());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates market-data, execution, monitoring, and risk deps outside the composition root body', () => {
    const state = createTrackedBotFactoryRuntimeSource(
      trackedServices,
      createBotFactoryRuntimeTestConfig(),
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

  test('creates web-api, core, and event-handler deps outside the composition root body', () => {
    const config = createBotFactoryRuntimeTestConfig();
    config.webApi = {
      indicatorPreferences: {
        enableRsi: true,
        enableMacd: false,
        enableEma: true,
        enableBollinger: false,
        enableAtr: true,
        enableVolume: false,
      },
    } as NonNullable<typeof config.webApi>;

    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;

    const webApiDeps = createWebApiServicesDeps(state, config);
    const webApiReadDeps = createBotStateWebApiReadServices(state);
    const coreDeps = createCoreServicesDeps(state);
    const eventHandlerDeps = createEventHandlerServicesDeps(state);

    const expectedIndicatorPreferences = {
      timeframes: ['1h', '4h'],
      rsiPeriods: [14],
      emaPeriods: [20, 50],
      atrPeriods: [14],
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
    const config = createBotFactoryRuntimeTestConfig();
    delete config.webApi;

    const state = createTrackedBotFactoryRuntimeSource(trackedServices, config) as BotServiceState;
    const webApiDeps = createWebApiServicesDeps(state, config);

    expect(webApiDeps.indicatorPreferences).toEqual(getDefaultWebApiIndicatorPreferences());
  });

  test('factory path wires extracted grouped-service builders through service creation', () => {
    const config = createBotFactoryRuntimeTestConfig();
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
});
