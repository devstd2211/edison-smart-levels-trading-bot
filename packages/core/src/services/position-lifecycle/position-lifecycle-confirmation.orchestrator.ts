import { DECIMAL_PLACES } from '../../constants';
import { EntryConfirmationManager, type PendingSignalData } from '../entry-confirmation.service';
import { LoggerService, Signal, SignalDirection } from '../../types/legacy';
import {
  buildPendingRejectionDescriptor,
  buildPendingSignalConfirmedLogPayload,
  buildPendingSignalConfirmedLogMessage,
  buildPendingSignalRejectedLogPayload,
  resolvePendingRejectionDirection,
} from './position-lifecycle-confirmation.utils';

type PendingConfirmationInput = {
  pending: {
    id: string;
    direction: SignalDirection;
    keyLevel: number;
    signalData: PendingSignalData;
  };
  currentCandleClose: number;
  entryConfirmation: EntryConfirmationManager;
  logger: LoggerService;
};

export function processPendingConfirmationOrchestrated(
  input: PendingConfirmationInput,
): Signal | null {
  const { pending, currentCandleClose, entryConfirmation, logger } = input;
  const result = entryConfirmation.checkConfirmation(pending.id, currentCandleClose);
  if (result.confirmed) {
    const message = buildPendingSignalConfirmedLogMessage(pending.direction);
    const payload = buildPendingSignalConfirmedLogPayload(
      pending.id,
      pending.direction,
      pending.keyLevel,
      currentCandleClose,
      DECIMAL_PLACES.PRICE,
    );
    logger.info(message, payload);
    return pending.signalData as unknown as Signal;
  }

  const rejectedDirection = resolvePendingRejectionDirection(pending.direction, result.reason);
  if (rejectedDirection) {
    const descriptor = buildPendingRejectionDescriptor(rejectedDirection);
    const payload = buildPendingSignalRejectedLogPayload(
      descriptor.levelKey,
      pending.id,
      pending.keyLevel,
      currentCandleClose,
      DECIMAL_PLACES.PRICE,
    );
    logger.info(descriptor.message, payload);
  }

  return null;
}
