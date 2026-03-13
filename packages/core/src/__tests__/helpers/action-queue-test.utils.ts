import { ErrorHandler } from '../../errors/ErrorHandler';
import { ActionQueueService } from '../../services/action-queue.service';
import {
  IAction,
  ActionResult,
  IActionHandler,
  AnyAction,
  ActionType,
  OpenPositionAction,
  ClosePositionAction,
  Signal,
  SignalDirection,
  SignalType,
} from '../../types/legacy';

export const mockActionQueueLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

export interface ActionQueueHarness {
  service: ActionQueueService;
  errorHandler: ErrorHandler;
}

export function createTestSignal(): Signal {
  return {
    direction: SignalDirection.LONG,
    type: SignalType.LEVEL_BASED,
    confidence: 70,
    price: 100,
    stopLoss: 95,
    takeProfits: [{ level: 1, percent: 100, sizePercent: 100, price: 110, hit: false }],
    reason: 'test',
    timestamp: Date.now(),
  };
}

export function createTestAction(
  id: string,
  type: ActionType = ActionType.OPEN_POSITION,
  maxRetries = 2,
): IAction {
  const base: IAction = {
    id,
    type,
    timestamp: Date.now(),
    maxRetries,
    retries: 0,
    priority: 'NORMAL',
    metadata: {},
  };

  if (type === ActionType.OPEN_POSITION) {
    return {
      ...base,
      signal: createTestSignal(),
      positionSize: 1,
      stopLoss: 100,
      takeProfits: [110],
      leverage: 1,
      symbol: 'BTCUSDT',
    } as OpenPositionAction;
  }

  if (type === ActionType.CLOSE_POSITION) {
    return {
      ...base,
      positionId: 'pos-123',
      reason: 'Test',
    } as ClosePositionAction;
  }

  return base;
}

export function createTestHandler(
  name: string,
  canHandleType: ActionType | null = null,
  implementation?: (action: AnyAction) => Promise<ActionResult>,
): IActionHandler {
  return {
    name,
    canHandle: (action: IAction): action is AnyAction => {
      if (canHandleType === null) {
        return true;
      }

      return action.type === canHandleType;
    },
    handle:
      implementation
      ?? (async (action: AnyAction) => ({
        success: true,
        actionId: action.id,
        timestamp: Date.now(),
      })),
  };
}

export function createActionQueueHarness(): ActionQueueHarness {
  return {
    service: new ActionQueueService(),
    errorHandler: new ErrorHandler(mockActionQueueLogger),
  };
}
