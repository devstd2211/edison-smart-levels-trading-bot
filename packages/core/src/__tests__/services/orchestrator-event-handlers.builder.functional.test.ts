import type { BotServiceState } from '../../services/bot-services.builder';
import {
  createOrchestratorEventHandlerDependencies,
  createPositionEventHandler,
  createWebSocketEventHandler,
  initializeOrchestratorEventHandlers,
} from '../../services/factories/builders/orchestrator-event-handlers.builder';
import { PositionEventHandler, WebSocketEventHandler } from '../../services/handlers';

describe('Orchestrator event handlers builder boundaries', () => {
  test('creates event-handler dependencies and runtime handlers outside the composition root body', () => {
    const state = {
      positionManager: { getCurrentPosition: jest.fn(), clearPosition: jest.fn() },
      positionExitingService: { closeFullPosition: jest.fn() },
      bybitService: { getCurrentPrice: jest.fn(), closePosition: jest.fn() },
      telegram: { sendAlert: jest.fn(), notifyPositionClosed: jest.fn() },
      logger: {
        info: jest.fn(),
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      webSocketManager: { getLastCloseReason: jest.fn(), resetLastCloseReason: jest.fn() },
      journal: { getTrade: jest.fn() },
    } as unknown as BotServiceState;

    expect(createOrchestratorEventHandlerDependencies(state)).toEqual({
      positionManager: state.positionManager,
      positionExitingService: state.positionExitingService,
      bybitService: state.bybitService,
      telegram: state.telegram,
      logger: state.logger,
      webSocketManager: state.webSocketManager,
      journal: state.journal,
    });

    expect(createPositionEventHandler(state)).toBeInstanceOf(PositionEventHandler);
    expect(createWebSocketEventHandler(state)).toBeInstanceOf(WebSocketEventHandler);

    initializeOrchestratorEventHandlers(state);

    expect(state.positionEventHandler).toBeInstanceOf(PositionEventHandler);
    expect(state.webSocketEventHandler).toBeInstanceOf(WebSocketEventHandler);
  });
});
