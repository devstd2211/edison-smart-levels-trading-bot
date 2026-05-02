import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { BybitService } from '../../index';
import { BybitServiceAdapter } from '../../bybit/bybit-service.adapter';
import { ExchangeFactory } from '../../exchange-factory.service';

export const initializeExchangeServices = (
  state: BotServicesState,
  config: Config,
): void => {
  const exchangeFactory = new ExchangeFactory(state.logger, {
    name: (config.exchange.name || 'bybit') as 'bybit' | 'binance',
    symbol: config.exchange.symbol,
    demo: config.exchange.demo,
    testnet: config.exchange.testnet,
    apiKey: config.exchange.apiKey,
    apiSecret: config.exchange.apiSecret,
  });

  if (!config.exchange.name || config.exchange.name === 'bybit') {
    const rawBybitService = new BybitService(
      config.exchange,
      state.logger,
      state.marketDataRepository,
    );
    state.bybitService = new BybitServiceAdapter(rawBybitService, state.logger);
  } else {
    const exchange = exchangeFactory.getExchange();
    if (!exchange) {
      const exchangeName = config.exchange.name || 'unknown';
      throw new Error(`ExchangeFactory returned no exchange for "${exchangeName}"`);
    }
    state.bybitService = exchange;
  }

  state.exchangeFactory = exchangeFactory;
  state.timeService.setBybitService(state.bybitService);
};
