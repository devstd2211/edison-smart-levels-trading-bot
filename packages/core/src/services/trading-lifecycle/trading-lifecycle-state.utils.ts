import {
  LoggerService,
  PositionLifecycleState,
  TrackedPosition,
} from '../../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../../errors';

interface UpdateStateParams {
  position: TrackedPosition;
  nextState: PositionLifecycleState;
  validateTransition: (from: PositionLifecycleState, to: PositionLifecycleState) => boolean;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
  context: string;
  warnMessage: string;
  timestamp: number;
}

export async function tryUpdatePositionState({
  position,
  nextState,
  validateTransition,
  errorHandler,
  logger,
  context,
  warnMessage,
  timestamp,
}: UpdateStateParams): Promise<void> {
  if (nextState === position.state) {
    return;
  }

  if (!validateTransition(position.state, nextState)) {
    return;
  }

  try {
    position.state = nextState;
    position.lastUpdateTime = timestamp;
  } catch (error) {
    if (errorHandler) {
      await errorHandler.handle(error, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context,
      });
    }
    logger.warn(warnMessage);
  }
}
