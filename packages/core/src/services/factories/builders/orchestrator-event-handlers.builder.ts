import type { BotServiceState } from '../../bot-services.builder';
import { PositionEventHandler, WebSocketEventHandler } from '../../handlers';

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
  const dependencies = createOrchestratorEventHandlerDependencies(state);

  return new PositionEventHandler(
    dependencies.positionManager,
    dependencies.positionExitingService,
    dependencies.bybitService,
    dependencies.telegram,
    dependencies.logger,
  );
};

export const createWebSocketEventHandler = (
  state: OrchestratorEventHandlerDependencies,
): WebSocketEventHandler => {
  const dependencies = createOrchestratorEventHandlerDependencies(state);

  return new WebSocketEventHandler(
    dependencies.positionManager,
    dependencies.positionExitingService,
    dependencies.bybitService,
    dependencies.webSocketManager,
    dependencies.journal,
    dependencies.telegram,
    dependencies.logger,
  );
};

export const initializeOrchestratorEventHandlers = (
  state: OrchestratorEventHandlersState,
): void => {
  state.positionEventHandler = createPositionEventHandler(state);
  state.webSocketEventHandler = createWebSocketEventHandler(state);
};
