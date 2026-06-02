import type { Config } from '../../../types/legacy';
import type { BotServiceState } from '../../bot-services.builder';
import { OrderExecutionDetectorService } from '../../order-execution-detector.service';
import { WebSocketAuthenticationService } from '../../websocket-authentication.service';
import { EventDeduplicationService } from '../../event-deduplication.service';
import { WebSocketKeepAliveService } from '../../websocket-keep-alive.service';
import { WebSocketManagerService } from '../../websocket-manager.service';
import {
  WEBSOCKET_MANAGER_RUNTIME_DEFAULTS,
} from './websocket-manager-service.builder.constants';

type WebSocketManagerBuilderState = Pick<
  BotServiceState,
  'logger' | 'errorHandler' | 'webSocketManager'
>;

type WebSocketManagerDependencies = Pick<
  WebSocketManagerBuilderState,
  'logger' | 'errorHandler'
>;

export type WebSocketManagerConfig = Pick<Config, 'exchange'>;

export type WebSocketManagerRuntimeServices = {
  orderExecutionDetector: OrderExecutionDetectorService;
  authService: WebSocketAuthenticationService;
  deduplicationService: EventDeduplicationService;
  keepAliveService: WebSocketKeepAliveService;
};

export const createWebSocketManagerConfig = (
  config: Pick<Config, 'exchange'>,
): WebSocketManagerConfig => ({
  exchange: config.exchange,
});

export const createWebSocketManagerDependencies = (
  state: Pick<BotServiceState, 'logger' | 'errorHandler'>,
): WebSocketManagerDependencies => ({
  logger: state.logger,
  errorHandler: state.errorHandler,
});

export const createWebSocketManagerRuntimeServices = (
  dependencies: WebSocketManagerDependencies,
): WebSocketManagerRuntimeServices => {
  return {
    orderExecutionDetector: new OrderExecutionDetectorService(dependencies.logger),
    authService: new WebSocketAuthenticationService(),
    deduplicationService: new EventDeduplicationService(
      WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationCapacity,
      WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.eventDeduplicationTtlMs,
      dependencies.logger,
      dependencies.errorHandler,
    ),
    keepAliveService: new WebSocketKeepAliveService(
      WEBSOCKET_MANAGER_RUNTIME_DEFAULTS.keepAliveIntervalMs,
      dependencies.logger,
    ),
  };
};

export const createWebSocketManagerService = (
  config: Pick<Config, 'exchange'>,
  dependencies: WebSocketManagerDependencies,
  runtimeServices: WebSocketManagerRuntimeServices,
): WebSocketManagerService => {
  const webSocketManagerConfig = createWebSocketManagerConfig(config);

  return new WebSocketManagerService(
    webSocketManagerConfig.exchange,
    webSocketManagerConfig.exchange.symbol,
    dependencies.errorHandler,
    runtimeServices.orderExecutionDetector,
    runtimeServices.authService,
    runtimeServices.deduplicationService,
    runtimeServices.keepAliveService,
  );
};

export const initializeWebSocketManager = (
  state: WebSocketManagerBuilderState,
  config: Pick<Config, 'exchange'>,
): void => {
  const dependencies = createWebSocketManagerDependencies(state);
  const runtimeServices = createWebSocketManagerRuntimeServices(dependencies);
  state.webSocketManager = createWebSocketManagerService(
    config,
    dependencies,
    runtimeServices,
  );
};
