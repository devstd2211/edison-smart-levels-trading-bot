import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { TradingJournalService, SessionStatsService } from '../../index';
import { RealityCheckService } from '../../reality-check.service';
import { TimeframeProvider } from '../../../providers/timeframe.provider';
import { CandleProvider } from '../../../providers/candle.provider';
import { IndicatorCacheService } from '../../indicator-cache.service';
import { IndicatorPreCalculationService } from '../../indicator-precalculation.service';
import { CalculatorFactory } from '../../../factories/calculator.factory';
import { INTEGER_MULTIPLIERS } from '../../../constants';

type JournalMarketDataBuilderState = Pick<
  BotServiceState,
  | 'logger'
  | 'journalRepository'
  | 'errorHandler'
  | 'bybitService'
  | 'marketDataRepository'
  | 'journal'
  | 'sessionStats'
  | 'realityCheck'
  | 'timeframeProvider'
  | 'candleProvider'
  | 'btcCandles1m'
  | 'indicatorCache'
  | 'indicatorPreCalc'
>;

type JournalMarketDataDependencies = Pick<
  JournalMarketDataBuilderState,
  'logger' | 'journalRepository' | 'errorHandler' | 'bybitService' | 'marketDataRepository'
>;

export type JournalMarketDataConfig = {
  tradeHistory: Config['tradeHistory'];
  compoundInterestBaseDeposit: number;
  timeframes: Config['timeframes'];
  exchangeSymbol: string;
};

export const createJournalMarketDataConfig = (
  config: Pick<Config, 'tradeHistory' | 'compoundInterest' | 'timeframes' | 'exchange'>,
): JournalMarketDataConfig => ({
  tradeHistory: config.tradeHistory,
  compoundInterestBaseDeposit:
    config.compoundInterest?.baseDeposit || INTEGER_MULTIPLIERS.FIFTY,
  timeframes: config.timeframes,
  exchangeSymbol: config.exchange.symbol,
});

export const createJournalMarketDataDependencies = (
  state: Pick<
    BotServiceState,
    'logger' | 'journalRepository' | 'errorHandler' | 'bybitService' | 'marketDataRepository'
  >,
): JournalMarketDataDependencies => ({
  logger: state.logger,
  journalRepository: state.journalRepository,
  errorHandler: state.errorHandler,
  bybitService: state.bybitService,
  marketDataRepository: state.marketDataRepository,
});

export const initializeJournalAndMarketData = (
  state: JournalMarketDataBuilderState,
  config: Pick<Config, 'tradeHistory' | 'compoundInterest' | 'timeframes' | 'exchange'>,
): void => {
  const journalMarketDataConfig = createJournalMarketDataConfig(config);
  const dependencies = createJournalMarketDataDependencies(state);

  state.journal = new TradingJournalService(
    dependencies.logger,
    undefined,
    journalMarketDataConfig.tradeHistory,
    journalMarketDataConfig.compoundInterestBaseDeposit,
    dependencies.journalRepository,
    dependencies.errorHandler,
  );

  state.sessionStats = new SessionStatsService(
    dependencies.logger,
    undefined,
    dependencies.errorHandler,
  );

  state.realityCheck = new RealityCheckService(dependencies.logger);

  state.timeframeProvider = new TimeframeProvider(journalMarketDataConfig.timeframes);
  state.candleProvider = new CandleProvider(
    state.timeframeProvider,
    dependencies.bybitService,
    dependencies.logger,
    journalMarketDataConfig.exchangeSymbol,
    dependencies.marketDataRepository,
    dependencies.errorHandler,
  );

  state.btcCandles1m = [];

  state.indicatorCache = new IndicatorCacheService(dependencies.marketDataRepository);
  dependencies.logger.info('Indicator cache initialized (Phase 6.2)', {
    capacity: state.indicatorCache.getStats().capacity,
    backendRepository: 'MarketDataCacheRepository',
  });

  const calculators = CalculatorFactory.createAllCalculators();
  state.indicatorPreCalc = new IndicatorPreCalculationService(
    state.candleProvider,
    state.indicatorCache,
    calculators,
    dependencies.logger,
  );
  dependencies.logger.info('Pre-calculation service initialized', {
    calculators: calculators.length,
  });
};
