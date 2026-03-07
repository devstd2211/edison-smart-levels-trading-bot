import { BotEventBus } from '../event-bus';
import { TakeProfitManagerService } from '../take-profit-manager.service';
import { ErrorHandler } from '../../errors';
import { LoggerService, Position, Signal } from '../../types/legacy';
import {
  buildPositionIdLogPayload,
  buildPositionLifecycleEventPayload,
} from './position-lifecycle-open.utils';

type WireOpenedPositionStateParams = {
  position: Position;
  signal: Signal;
  leverage: number;
  strategyId?: string;
  logger: LoggerService;
  eventBus: BotEventBus;
  errorHandler?: ErrorHandler;
  hasRepository: boolean;
  writeStoredPosition: (position: Position | null) => void;
};

export function wireOpenedPositionStateOrchestrated(
  params: WireOpenedPositionStateParams,
): TakeProfitManagerService {
  const {
    position,
    signal,
    leverage,
    strategyId,
    logger,
    eventBus,
    errorHandler,
    hasRepository,
    writeStoredPosition,
  } = params;

  if (hasRepository) {
    writeStoredPosition(position);
    const repoPayload = buildPositionIdLogPayload(position.id);
    logger.debug('[Phase 6.2] Position stored in repository', repoPayload);
  } else {
    writeStoredPosition(position);
  }

  const emittingPayload = buildPositionIdLogPayload(position.id);
  logger.info('Emitting position-opened event', emittingPayload);
  const eventPayload = buildPositionLifecycleEventPayload(position, strategyId);
  eventBus.emit('position-opened', eventPayload);
  const emittedPayload = buildPositionIdLogPayload(position.id);
  logger.debug('[EVENT] position-opened emitted', emittedPayload);

  return new TakeProfitManagerService(
    {
      positionId: position.id,
      symbol: position.symbol,
      side: position.side,
      entryPrice: signal.price,
      totalQuantity: position.quantity,
      leverage,
    },
    logger,
    errorHandler,
  );
}
