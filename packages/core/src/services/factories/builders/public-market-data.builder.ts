import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { PublicWebSocketService } from '../../public-websocket.service';
import { OrderbookManagerService } from '../../orderbook-manager.service';

type PublicMarketDataBuilderState = Pick<
  BotServiceState,
  | 'timeframeProvider'
  | 'logger'
  | 'errorHandler'
  | 'wallTrackerService'
  | 'publicWebSocket'
  | 'orderbookManager'
>;

export type PublicMarketDataConfig = Pick<Config, 'exchange' | 'btcConfirmation'>;

export const createPublicMarketDataConfig = (
  config: Pick<Config, 'exchange' | 'btcConfirmation'>,
): PublicMarketDataConfig => ({
  exchange: config.exchange,
  btcConfirmation: config.btcConfirmation,
});

export const initializePublicMarketDataServices = (
  state: PublicMarketDataBuilderState,
  config: Pick<Config, 'exchange' | 'btcConfirmation'>,
): void => {
  const publicMarketDataConfig = createPublicMarketDataConfig(config);

  state.publicWebSocket = new PublicWebSocketService(
    publicMarketDataConfig.exchange,
    publicMarketDataConfig.exchange.symbol,
    state.timeframeProvider,
    state.logger,
    state.errorHandler,
    publicMarketDataConfig.btcConfirmation,
  );

  state.orderbookManager = new OrderbookManagerService(
    publicMarketDataConfig.exchange.symbol,
    state.logger,
    state.wallTrackerService,
  );
};
