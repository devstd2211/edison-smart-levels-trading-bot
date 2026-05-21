import { buildBotFactoryServiceState } from '../../services/factories/bot-service-state';
import { createBotFactoryServiceStateConfig } from '../helpers/bot-factory-runtime-test.utils';
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
    const config = createBotFactoryServiceStateConfig();
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
});
