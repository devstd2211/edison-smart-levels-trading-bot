type AtomicCloseLogPayloadBase = {
  reason: string;
};

type AtomicCloseRequest = {
  positionId: string;
  hasCloseHandler: boolean;
};

type AtomicCloseStartLogPayload = AtomicCloseLogPayloadBase & {
  hasCloseHandler: boolean;
};

type AtomicCloseFailureLogPayload = AtomicCloseLogPayloadBase & {
  error: string;
};

type SnapshotDegradedLogPayload = {
  error: string;
};

type SnapshotFailureLogPayload = {
  error: unknown;
};

type ConditionalOrderCancelRetryLogPayload = {
  delayMs: number;
  error: string;
};

type AtomicCloseLogShape<TPayload> = {
  message: string;
  payload: TPayload;
};

const ATOMIC_CLOSE_LOG_PREFIX = '[P0.1 + P3]';

export function buildAtomicCloseAlreadyInProgressLog(
  positionId: string,
  reason: string,
): AtomicCloseLogShape<AtomicCloseLogPayloadBase> {
  return {
    message: `${ATOMIC_CLOSE_LOG_PREFIX} Position already closing: ${positionId}`,
    payload: { reason },
  };
}

export function buildAtomicCloseNoPositionLog(
  positionId: string,
  reason: string,
): AtomicCloseLogShape<AtomicCloseLogPayloadBase> {
  return {
    message: `${ATOMIC_CLOSE_LOG_PREFIX} Position already closed or not found: ${positionId}`,
    payload: { reason },
  };
}

export function buildAtomicCloseStartLog(
  positionId: string,
  reason: string,
  hasCloseHandler: boolean,
): AtomicCloseLogShape<AtomicCloseStartLogPayload> {
  return {
    message: `${ATOMIC_CLOSE_LOG_PREFIX} Closing position with atomic lock: ${positionId}`,
    payload: { reason, hasCloseHandler },
  };
}

export function buildAtomicCloseSuccessLog(
  positionId: string,
  reason: string,
): AtomicCloseLogShape<AtomicCloseLogPayloadBase> {
  return {
    message: `${ATOMIC_CLOSE_LOG_PREFIX} Position closed successfully: ${positionId}`,
    payload: { reason },
  };
}

export function buildAtomicCloseFailureLog(
  positionId: string,
  reason: string,
  errorMessage: string,
): AtomicCloseLogShape<AtomicCloseFailureLogPayload> {
  return {
    message: `${ATOMIC_CLOSE_LOG_PREFIX} Failed to close position: ${positionId}`,
    payload: { reason, error: errorMessage },
  };
}

export function buildPositionSnapshotDegradedLog(
  errorMessage: string,
): AtomicCloseLogShape<SnapshotDegradedLogPayload> {
  return {
    message: '[P0.3] Failed to create position snapshot, using reference (degraded mode)',
    payload: { error: errorMessage },
  };
}

export function buildPositionSnapshotFailureLog(
  error: unknown,
): AtomicCloseLogShape<SnapshotFailureLogPayload> {
  return {
    message: '[P0.3] Failed to create position snapshot',
    payload: { error },
  };
}

export function buildConditionalOrderCancelStartLogMessage(): string {
  return 'Cancelling conditional orders after position close...';
}

export function buildConditionalOrderCancelFailureLogMessage(): string {
  return 'Failed to cancel orders - proceeding with position clear';
}

export function buildConditionalOrderCancelRetryLog(
  attempt: number,
  delayMs: number,
  errorMessage: string,
): AtomicCloseLogShape<ConditionalOrderCancelRetryLogPayload> {
  return {
    message: `Retrying order cancellation (attempt ${attempt}/3)`,
    payload: {
      delayMs,
      error: errorMessage,
    },
  };
}

export function buildAtomicCloseRequest(
  positionId: string,
  onCloseInternal?: () => Promise<void>,
): AtomicCloseRequest {
  return {
    positionId,
    hasCloseHandler: Boolean(onCloseInternal),
  };
}
