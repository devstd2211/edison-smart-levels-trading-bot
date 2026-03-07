import { ErrorHandler } from '../../errors';
import { LoggerService, Position } from '../../types/legacy';
import {
  buildPositionSnapshotDegradedLog,
  buildPositionSnapshotFailureLog,
} from './position-lifecycle-atomic.utils';
import { clonePositionSnapshot } from './position-lifecycle-sync.utils';
import { toErrorMessage } from './position-lifecycle-error.utils';

type GetPositionSnapshotParams = {
  position: Position | null;
  errorHandler?: ErrorHandler;
  logger: LoggerService;
};

export function getPositionSnapshotOrchestrated(
  params: GetPositionSnapshotParams,
): Position | null {
  const { position, errorHandler, logger } = params;
  if (!position) {
    return null;
  }

  if (errorHandler) {
    try {
      return clonePositionSnapshot(position);
    } catch (error) {
      const logShape = buildPositionSnapshotDegradedLog(toErrorMessage(error));
      logger.warn(logShape.message, logShape.payload);
      return position;
    }
  }

  try {
    return clonePositionSnapshot(position);
  } catch (error) {
    const logShape = buildPositionSnapshotFailureLog(error);
    logger.error(logShape.message, logShape.payload);
    return position;
  }
}
