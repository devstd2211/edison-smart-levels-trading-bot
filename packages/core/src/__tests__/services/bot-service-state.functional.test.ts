import {
  buildBotFactoryServiceState,
  createBotFactoryRuntimeSource,
  finalizeBotFactoryServiceState,
} from '../../services/factories/bot-service-state';
import { createBotServiceStateBoundaryRuntimeDefaultConfig } from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('buildBotFactoryServiceState bootstrap wiring', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('builds runtime, exchange, journal, and market-data slices as one side-effect-free state', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();
    const services = buildBotFactoryServiceState(config);
    trackedServices.push({ config, services });

    expect(services.telegram).toBeDefined();
    expect(services.timeService).toBeDefined();
    expect(services.exchangeFactory).toBeDefined();
    expect(services.bybitService).toBeDefined();
    expect(services.journal).toBeDefined();
    expect(services.sessionStats).toBeDefined();
    expect(services.realityCheck).toBeDefined();
    expect(services.candleProvider).toBeDefined();
    expect(services.indicatorCache).toBeDefined();
    expect(services.indicatorPreCalc).toBeDefined();
    expect(services.btcCandles1m).toEqual([]);
  });

  test('finalizeBotFactoryServiceState narrows bootstrap state to the public runtime-source boundary', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();
    const state = buildBotFactoryServiceState(config);
    trackedServices.push({ config, services: state });

    const runtimeSource = finalizeBotFactoryServiceState(state);

    expect(runtimeSource.coreServices).toBe(state.coreServices);
    expect(runtimeSource.marketDataServices).toBe(state.marketDataServices);
    expect(runtimeSource.executionServices).toBe(state.executionServices);
    expect(runtimeSource.bybitService).toBe(state.bybitService);
    expect('telegram' in (runtimeSource as unknown as Record<string, unknown>)).toBe(false);
    expect('timeService' in (runtimeSource as unknown as Record<string, unknown>)).toBe(false);
    expect('eventBus' in (runtimeSource as unknown as Record<string, unknown>)).toBe(false);
  });

  test('createBotFactoryRuntimeSource keeps overrides inside the narrowed runtime-source shell', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();
    const mockExchange = { name: 'MockExchange' };

    const runtimeSource = createBotFactoryRuntimeSource(config, {
      bybitService: mockExchange as never,
    });
    trackedServices.push({ config, services: runtimeSource });

    expect(runtimeSource.bybitService).toBe(mockExchange);
    expect(runtimeSource.coreServices.logger).toBeDefined();
    expect('telegram' in (runtimeSource as unknown as Record<string, unknown>)).toBe(false);
    expect('positionRepository' in (runtimeSource as unknown as Record<string, unknown>)).toBe(false);
  });
});
