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

export const initializeOrchestratorEventHandlers = (
  state: OrchestratorEventHandlersState,
): void => {
  state.positionEventHandler = new PositionEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.telegram,
    state.logger,
  );

  state.webSocketEventHandler = new WebSocketEventHandler(
    state.positionManager,
    state.positionExitingService,
    state.bybitService,
    state.webSocketManager,
    state.journal,
    state.telegram,
    state.logger,
  );
};
