import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { TradingJournalService, SessionStatsService } from '../../index';
import { RealityCheckService } from '../../reality-check.service';
import { TimeframeProvider } from '../../../providers/timeframe.provider';
import { CandleProvider } from '../../../providers/candle.provider';
import { IndicatorCacheService } from '../../indicator-cache.service';
import { IndicatorPreCalculationService } from '../../indicator-precalculation.service';
import { CalculatorFactory } from '../../../factories/calculator.factory';
import { INTEGER_MULTIPLIERS } from '../../../constants';

export const initializeJournalAndMarketData = (
  state: BotServicesState,
  config: Config,
): void => {
  state.journal = new TradingJournalService(
    state.logger,
    undefined,
    config.tradeHistory,
    config.compoundInterest?.baseDeposit || INTEGER_MULTIPLIERS.FIFTY,
    state.journalRepository,
    state.errorHandler,
  );

  state.sessionStats = new SessionStatsService(
    state.logger,
    undefined,
    state.errorHandler,
  );

  state.realityCheck = new RealityCheckService(state.logger);

  state.timeframeProvider = new TimeframeProvider(config.timeframes);
  state.candleProvider = new CandleProvider(
    state.timeframeProvider,
    state.bybitService,
    state.logger,
    config.exchange.symbol,
    state.marketDataRepository,
    state.errorHandler,
  );

  state.btcCandles1m = [];

  state.indicatorCache = new IndicatorCacheService(state.marketDataRepository);
  state.logger.info('Indicator cache initialized (Phase 6.2)', {
    capacity: state.indicatorCache.getStats().capacity,
    backendRepository: 'MarketDataCacheRepository',
  });

  const calculators = CalculatorFactory.createAllCalculators();
  state.indicatorPreCalc = new IndicatorPreCalculationService(
    state.candleProvider,
    state.indicatorCache,
    calculators,
    state.logger,
  );
  state.logger.info('Pre-calculation service initialized', {
    calculators: calculators.length,
  });
};
