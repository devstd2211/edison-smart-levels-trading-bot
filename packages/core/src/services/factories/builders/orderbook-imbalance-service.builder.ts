import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { OrderbookImbalanceService } from '../../orderbook-imbalance.service';

export const initializeOrderbookImbalanceService = (
  state: BotServicesState,
  config: Config,
): void => {
  if (!config.orderbookImbalance?.enabled) {
    return;
  }

  state.orderbookImbalanceService = new OrderbookImbalanceService(
    config.orderbookImbalance,
    state.logger,
  );
  state.logger.info('\u2705 Orderbook Imbalance initialized', {
    minImbalance: `${config.orderbookImbalance.minImbalancePercent}%`,
    levels: config.orderbookImbalance.levels,
  });
};
