import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { PublicWebSocketService } from '../../public-websocket.service';
import { OrderbookManagerService } from '../../orderbook-manager.service';

export const initializePublicMarketDataServices = (
  state: BotServicesState,
  config: Config,
): void => {
  state.publicWebSocket = new PublicWebSocketService(
    config.exchange,
    config.exchange.symbol,
    state.timeframeProvider,
    state.logger,
    state.errorHandler,
    config.btcConfirmation,
  );

  state.orderbookManager = new OrderbookManagerService(
    config.exchange.symbol,
    state.logger,
    state.wallTrackerService,
  );
};
