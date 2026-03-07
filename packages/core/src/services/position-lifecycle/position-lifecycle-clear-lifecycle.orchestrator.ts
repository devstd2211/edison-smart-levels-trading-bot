import { BotEventBus } from '../event-bus';
import { LoggerService, Position } from '../../types/legacy';
import {
  buildPositionIdLogPayload,
  buildPositionLifecycleEventPayload,
} from './position-lifecycle-open.utils';

type FinalizePositionClearLifecycleParams = {
  closedPosition: Position | null;
  hasRepository: boolean;
  writeStoredPosition: (position: Position | null) => void;
  clearRuntimeState: () => void;
  strategyId?: string;
  eventBus: BotEventBus;
  logger: LoggerService;
};

export function finalizePositionClearLifecycleOrchestrated(
  params: FinalizePositionClearLifecycleParams,
): void {
  const {
    closedPosition,
    hasRepository,
    writeStoredPosition,
    clearRuntimeState,
    strategyId,
    eventBus,
    logger,
  } = params;

  if (hasRepository && closedPosition) {
    writeStoredPosition(null);
    const payload = buildPositionIdLogPayload(closedPosition.id);
    logger.debug('[Phase 6.2] Position cleared from repository', payload);
  } else {
    writeStoredPosition(null);
  }

  clearRuntimeState();

  if (!closedPosition) {
    return;
  }

  const payload = buildPositionLifecycleEventPayload(closedPosition, strategyId);
  eventBus.emit('position-closed', payload);
}
