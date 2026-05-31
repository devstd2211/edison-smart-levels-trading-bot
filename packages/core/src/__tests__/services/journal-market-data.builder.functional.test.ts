import type { BotServiceState } from '../../services/bot-services.builder';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createJournalMarketDataConfig,
  createJournalMarketDataDependencies,
  initializeJournalAndMarketData,
} from '../../services/factories/builders/journal-market-data.builder';
import {
  createBotServiceStateBoundaryRuntimeDefaultConfig,
  createTrackedBotFactoryBuilderState,
} from '../helpers/bot-factory-runtime-test.utils';
import {
  createManagedTrackedServicesState,
  type TrackedServicesState,
} from '../helpers/service-lifecycle-test.utils';

describe('Journal and market-data builder boundaries', () => {
  let trackedServices!: TrackedServicesState['trackedServices'];
  let cleanup!: TrackedServicesState['cleanup'];

  beforeEach(() => {
    ({ trackedServices, cleanup } = createManagedTrackedServicesState());
  });

  afterEach(async () => {
    await cleanup();
  });

  test('creates journal and market-data config outside the composition root body', () => {
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();

    expect(createJournalMarketDataConfig(config)).toEqual({
      tradeHistory: config.tradeHistory,
      compoundInterestBaseDeposit: config.compoundInterest?.baseDeposit ?? 50,
      timeframes: config.timeframes,
      exchangeSymbol: config.exchange.symbol,
    });
  });

  test('creates journal and market-data dependencies and initializes the runtime slice outside the composition root body', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const state = {
      logger,
      errorHandler: new ErrorHandler(logger as never),
      journalRepository: {},
      marketDataRepository: {},
      bybitService: {
        getCandles: jest.fn(),
      },
    } as unknown as BotServiceState;
    const config = createBotServiceStateBoundaryRuntimeDefaultConfig();

    expect(createJournalMarketDataDependencies(state)).toEqual({
      logger,
      errorHandler: state.errorHandler,
      journalRepository: state.journalRepository,
      marketDataRepository: state.marketDataRepository,
      bybitService: state.bybitService,
    });

    initializeJournalAndMarketData(state, config);

    expect(state.journal).toBeDefined();
    expect(state.sessionStats).toBeDefined();
    expect(state.realityCheck).toBeDefined();
    expect(state.candleProvider).toBeDefined();
    expect(state.indicatorCache).toBeDefined();
    expect(state.indicatorPreCalc).toBeDefined();
    expect(state.btcCandles1m).toEqual([]);
  });

  test('builder path wires extracted journal and market-data builder through state creation', () => {
    const state = createTrackedBotFactoryBuilderState(
      trackedServices,
      createBotServiceStateBoundaryRuntimeDefaultConfig(),
    );

    expect(state.journal).toBeDefined();
    expect(state.sessionStats).toBeDefined();
    expect(state.realityCheck).toBeDefined();
    expect(state.marketDataServices.candleProvider).toBe(state.candleProvider);
  });
});
