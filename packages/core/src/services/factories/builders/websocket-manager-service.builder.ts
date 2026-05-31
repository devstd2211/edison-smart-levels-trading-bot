import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { OrderExecutionDetectorService } from '../../order-execution-detector.service';
import { WebSocketAuthenticationService } from '../../websocket-authentication.service';
import { EventDeduplicationService } from '../../event-deduplication.service';
import { WebSocketKeepAliveService } from '../../websocket-keep-alive.service';
import { WebSocketManagerService } from '../../websocket-manager.service';

type WebSocketManagerBuilderState = Pick<
  BotServiceState,
  'logger' | 'errorHandler' | 'webSocketManager'
>;

export type WebSocketManagerConfig = Pick<Config, 'exchange'>;

export const createWebSocketManagerConfig = (
  config: Pick<Config, 'exchange'>,
): WebSocketManagerConfig => ({
  exchange: config.exchange,
});

export const initializeWebSocketManager = (
  state: WebSocketManagerBuilderState,
  config: Pick<Config, 'exchange'>,
): void => {
  const webSocketManagerConfig = createWebSocketManagerConfig(config);
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
    webSocketManagerConfig.exchange,
    webSocketManagerConfig.exchange.symbol,
    state.errorHandler,
    orderExecutionDetector,
    authService,
    deduplicationService,
    keepAliveService,
  );
};
