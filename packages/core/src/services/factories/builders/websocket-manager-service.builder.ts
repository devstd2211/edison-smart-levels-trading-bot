import type { Config } from '../../../types/legacy';
import type { BotServicesState } from '../../bot-services.builder';
import { OrderExecutionDetectorService } from '../../order-execution-detector.service';
import { WebSocketAuthenticationService } from '../../websocket-authentication.service';
import { EventDeduplicationService } from '../../event-deduplication.service';
import { WebSocketKeepAliveService } from '../../websocket-keep-alive.service';
import { WebSocketManagerService } from '../../websocket-manager.service';

export const initializeWebSocketManager = (
  state: BotServicesState,
  config: Config,
): void => {
  const orderExecutionDetector = new OrderExecutionDetectorService(state.logger);
  const authService = new WebSocketAuthenticationService();
  const deduplicationService = new EventDeduplicationService(
    100,
    60000,
    state.logger,
    state.errorHandler,
  );
  const keepAliveService = new WebSocketKeepAliveService(20000, state.logger);

  state.webSocketManager = new WebSocketManagerService(
    config.exchange,
    config.exchange.symbol,
    state.errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  );
};
