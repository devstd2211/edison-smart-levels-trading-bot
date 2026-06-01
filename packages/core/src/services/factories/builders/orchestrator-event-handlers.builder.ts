import type { BotServiceState } from '../../bot-services.builder';
import {
  PositionEventHandler,
  WebSocketEventHandler,
  createPositionEventHandlerDependencies,
  createWebSocketEventHandlerDependencies,
} from '../../handlers';

type OrchestratorEventHandlersState = Pick<
  BotServiceState,
  | 'positionManager'
  | 'positionExitingService'
  | 'bybitService'
  | 'telegram'
  | 'logger'
  | 'webSocketManager'
  | 'journal'
  | 'positionEventHandler'
  | 'webSocketEventHandler'
>;

export type OrchestratorEventHandlerDependencies = Pick<
  OrchestratorEventHandlersState,
  | 'positionManager'
  | 'positionExitingService'
  | 'bybitService'
  | 'telegram'
  | 'logger'
  | 'webSocketManager'
  | 'journal'
>;

export const createOrchestratorEventHandlerDependencies = (
  state: OrchestratorEventHandlerDependencies,
): OrchestratorEventHandlerDependencies => ({
  positionManager: state.positionManager,
  positionExitingService: state.positionExitingService,
  bybitService: state.bybitService,
  telegram: state.telegram,
  logger: state.logger,
  webSocketManager: state.webSocketManager,
  journal: state.journal,
});

export const createPositionEventHandler = (
  state: OrchestratorEventHandlerDependencies,
): PositionEventHandler => {
  const dependencies = createPositionEventHandlerDependencies(
    createOrchestratorEventHandlerDependencies(state),
  );

  return new PositionEventHandler(dependencies);
};

export const createWebSocketEventHandler = (
  state: OrchestratorEventHandlerDependencies,
): WebSocketEventHandler => {
  const dependencies = createWebSocketEventHandlerDependencies(
    createOrchestratorEventHandlerDependencies(state),
  );

  return new WebSocketEventHandler(dependencies);
};

export const initializeOrchestratorEventHandlers = (
  state: OrchestratorEventHandlersState,
): void => {
  state.positionEventHandler = createPositionEventHandler(state);
  state.webSocketEventHandler = createWebSocketEventHandler(state);
};
