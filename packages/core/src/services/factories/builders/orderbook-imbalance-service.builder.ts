import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { OrderbookImbalanceService } from '../../orderbook-imbalance.service';
import { ICONS } from '../../../cli/cli-runtime';

export const initializeOrderbookImbalanceService = (
  state: BotServiceState,
  config: Config,
): void => {
  if (!config.orderbookImbalance?.enabled) {
    return;
  }

  state.orderbookImbalanceService = new OrderbookImbalanceService(
    config.orderbookImbalance,
    state.logger,
  );
  state.logger.info(`${ICONS.success} Orderbook Imbalance initialized`, {
    minImbalance: `${config.orderbookImbalance.minImbalancePercent}%`,
    levels: config.orderbookImbalance.levels,
  });
};
