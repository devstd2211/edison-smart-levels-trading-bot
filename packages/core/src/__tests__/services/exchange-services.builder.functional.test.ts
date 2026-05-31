import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createExchangeServicesConfig,
  createExchangeServicesDependencies,
  initializeExchangeServices,
} from '../../services/factories/builders/exchange-services.builder';
import {
  createBotServiceStateBoundaryRuntimeDefaultConfig,
  createTrackedBotFactoryBuilderState,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Exchange services builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates exchange services config outside the composition root body', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();

    expect(createExchangeServicesConfig(config)).toEqual({
      exchange: {
        name: 'bybit',
        symbol: config.exchange.symbol,
        demo: config.exchange.demo,
        testnet: config.exchange.testnet,
        apiKey: config.exchange.apiKey,
        apiSecret: config.exchange.apiSecret,
      },
      useDirectBybitAdapter: true,
    });
  });

  test('creates exchange services dependencies and initializes the runtime exchange outside the composition root body', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const timeService = {
      setBybitService: jest.fn(),
    };
    const state = {
      logger,
      marketDataRepository: {},
      timeService,
    } as unknown as BotServiceState;
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();

    expect(createExchangeServicesDependencies(state)).toEqual({
      logger,
      marketDataRepository: state.marketDataRepository,
      timeService,
    });

    initializeExchangeServices(state, config);

    expect(state.exchangeFactory).toBeDefined();
    expect(state.bybitService).toBeDefined();
    expect(state.exchangeFactory?.getExchangeName()).toBe('bybit');
    expect(timeService.setBybitService).toHaveBeenCalledWith(state.bybitService);
  });

  test('builder path wires extracted exchange builder through state creation', () => {
    const state = createTrackedBotFactoryBuilderState(
      trackedServices,
      createBotServiceStateBoundaryRuntimeDefaultConfig(),
    );

    expect(state.exchangeFactory).toBeDefined();
    expect(state.bybitService).toBeDefined();
    expect(state.bybitService).toBe(state.marketDataServices.bybitService);
  });
});
