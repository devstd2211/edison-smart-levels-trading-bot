import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createPublicMarketDataConfig,
  initializePublicMarketDataServices,
} from '../../services/factories/builders/public-market-data.builder';
import {
  createBotFactoryServiceBoundaryRuntimeDefaultConfig,
  createTrackedBotFactoryRuntimeSource,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Public market-data builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates public market-data config outside the composition root body', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();

    expect(createPublicMarketDataConfig(config)).toEqual({
      exchange: config.exchange,
      btcConfirmation: config.btcConfirmation,
    });
  });

  test('creates public websocket and orderbook services outside the composition root body', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
      timeframeProvider: {},
      wallTrackerService: undefined,
    } as unknown as BotServiceState;

    initializePublicMarketDataServices(state, config);

    expect(state.publicWebSocket).toBeDefined();
    expect(state.orderbookManager).toBeDefined();
  });

  test('factory path wires extracted public market-data builder through service creation', () => {
    const config = createBotFactoryServiceBoundaryRuntimeDefaultConfig();
    const services = createTrackedBotFactoryRuntimeSource(trackedServices, config);

    expect(services.marketDataServices.publicWebSocket).toBeDefined();
    expect(services.marketDataServices.orderbookManager).toBeDefined();
  });
});
