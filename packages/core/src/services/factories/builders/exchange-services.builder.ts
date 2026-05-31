import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { BybitService } from '../../index';
import { BybitServiceAdapter } from '../../bybit/bybit-service.adapter';
import { ExchangeFactory } from '../../exchange-factory.service';

type ExchangeServicesBuilderState = Pick<
  BotServiceState,
  'logger' | 'marketDataRepository' | 'timeService' | 'bybitService' | 'exchangeFactory'
>;

type ExchangeServicesDependencies = Pick<
  ExchangeServicesBuilderState,
  'logger' | 'marketDataRepository' | 'timeService'
>;

export type ExchangeServicesConfig = {
  exchange: ConstructorParameters<typeof ExchangeFactory>[1];
  useDirectBybitAdapter: boolean;
};

export const createExchangeServicesConfig = (
  config: Pick<Config, 'exchange'>,
): ExchangeServicesConfig => ({
  exchange: {
    name: (config.exchange.name || 'bybit') as 'bybit' | 'binance',
    symbol: config.exchange.symbol,
    demo: config.exchange.demo,
    testnet: config.exchange.testnet,
    apiKey: config.exchange.apiKey,
    apiSecret: config.exchange.apiSecret,
  },
  useDirectBybitAdapter: !config.exchange.name || config.exchange.name === 'bybit',
});

export const createExchangeServicesDependencies = (
  state: Pick<BotServiceState, 'logger' | 'marketDataRepository' | 'timeService'>,
): ExchangeServicesDependencies => ({
  logger: state.logger,
  marketDataRepository: state.marketDataRepository,
  timeService: state.timeService,
});

export const initializeExchangeServices = (
  state: ExchangeServicesBuilderState,
  config: Pick<Config, 'exchange'>,
): void => {
  const exchangeServicesConfig = createExchangeServicesConfig(config);
  const dependencies = createExchangeServicesDependencies(state);
  const exchangeFactory = new ExchangeFactory(
    dependencies.logger,
    exchangeServicesConfig.exchange,
  );

  if (exchangeServicesConfig.useDirectBybitAdapter) {
    const rawBybitService = new BybitService(
      config.exchange,
      dependencies.logger,
      dependencies.marketDataRepository,
    );
    state.bybitService = new BybitServiceAdapter(rawBybitService, dependencies.logger);
  } else {
    const exchange = exchangeFactory.getExchange();
    if (!exchange) {
      const exchangeName = config.exchange.name || 'unknown';
      throw new Error(`ExchangeFactory returned no exchange for "${exchangeName}"`);
    }
    state.bybitService = exchange;
  }

  state.exchangeFactory = exchangeFactory;
  dependencies.timeService.setBybitService(state.bybitService);
};
