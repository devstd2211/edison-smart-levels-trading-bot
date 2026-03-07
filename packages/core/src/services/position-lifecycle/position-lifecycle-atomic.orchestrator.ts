import { LoggerService, Position } from '../../types/legacy';
import {
  buildAtomicCloseAlreadyInProgressLog,
  buildAtomicCloseFailureLog,
  buildAtomicCloseNoPositionLog,
  buildAtomicCloseRequest,
  buildAtomicCloseStartLog,
  buildAtomicCloseSuccessLog,
} from './position-lifecycle-atomic.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';

type ClosePositionWithAtomicLockParams = {
  reason: string;
  onCloseInternal?: () => Promise<void>;
  positionClosing: Map<string, Promise<void>>;
  getCurrentPosition: () => Position | null;
  clearPosition: () => Promise<void>;
  logger: LoggerService;
};

export async function closePositionWithAtomicLockOrchestrated(
  params: ClosePositionWithAtomicLockParams,
): Promise<void> {
  const {
    reason,
    onCloseInternal,
    positionClosing,
    getCurrentPosition,
    clearPosition,
    logger,
  } = params;

  const position = getCurrentPosition();
  const request = buildAtomicCloseRequest(position?.id || 'UNKNOWN', onCloseInternal);
  const { positionId } = request;

  if (positionClosing.has(positionId)) {
    const logShape = buildAtomicCloseAlreadyInProgressLog(positionId, reason);
    logger.warn(logShape.message, logShape.payload);
    return positionClosing.get(positionId)!;
  }

  const closePromise = performClose({
    positionId,
    reason,
    onCloseInternal,
    getCurrentPosition,
    clearPosition,
    logger,
  });
  positionClosing.set(positionId, closePromise);

  try {
    await closePromise;
  } finally {
    positionClosing.delete(positionId);
  }
}

type PerformCloseParams = {
  positionId: string;
  reason: string;
  onCloseInternal?: () => Promise<void>;
  getCurrentPosition: () => Position | null;
  clearPosition: () => Promise<void>;
  logger: LoggerService;
};

async function performClose(params: PerformCloseParams): Promise<void> {
  const { positionId, reason, onCloseInternal, getCurrentPosition, clearPosition, logger } = params;
  const request = buildAtomicCloseRequest(positionId, onCloseInternal);
  const position = getCurrentPosition();
  if (!position) {
    const logShape = buildAtomicCloseNoPositionLog(positionId, reason);
    logger.info(logShape.message, logShape.payload);
    return;
  }

  try {
    const startLog = buildAtomicCloseStartLog(positionId, reason, request.hasCloseHandler);
    logger.info(startLog.message, startLog.payload);

    if (onCloseInternal) {
      await onCloseInternal();
    } else {
      await clearPosition();
    }

    const successLog = buildAtomicCloseSuccessLog(positionId, reason);
    logger.info(successLog.message, successLog.payload);
  } catch (error) {
    const failureLog = buildAtomicCloseFailureLog(positionId, reason, toErrorMessage(error));
    logger.error(failureLog.message, failureLog.payload);
    throw error;
  }
}
