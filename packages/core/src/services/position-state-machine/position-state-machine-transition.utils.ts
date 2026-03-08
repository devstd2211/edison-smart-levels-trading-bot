import { PositionState } from '../../types/legacy';
import type {
  PositionStateMachineState,
  StateTransitionRequest,
  StateTransitionResult,
} from '../../types/legacy';

export interface TransitionHistoryEntryLike {
  request: StateTransitionRequest;
  result: StateTransitionResult;
  timestamp: number;
}

export function buildInvalidTransitionResult(
  currentState: PositionState,
  targetState: PositionState,
  error: string,
): StateTransitionResult {
  return {
    allowed: false,
    currentState,
    error,
    stateChange: `${currentState} âœ— ${targetState}`,
  };
}

export function buildNextState(
  request: StateTransitionRequest,
  currentStateObj: PositionStateMachineState | undefined,
  now: number,
): PositionStateMachineState {
  return {
    symbol: request.symbol,
    positionId: request.positionId,
    currentState: request.targetState,
    stateChangedAt: now,
    createdAt: currentStateObj?.createdAt || now,
    closedAt: request.targetState === PositionState.CLOSED ? now : undefined,
    reason: request.reason,
    preBEMode: request.metadata?.preBEMode,
    trailingMode: request.metadata?.trailingMode,
    bbTrailingMode: request.metadata?.bbTrailingMode,
    closureReason: request.closureReason,
    closurePrice: request.closurePrice,
    closurePnL: request.closurePnL,
  };
}

export function buildSuccessfulTransitionResult(
  targetState: PositionState,
  previousState: PositionState,
): StateTransitionResult {
  return {
    allowed: true,
    currentState: targetState,
    previousState,
    stateChange: `${previousState} â†’ ${targetState}`,
  };
}

export function buildTransitionHistoryEntry(
  request: StateTransitionRequest,
  result: StateTransitionResult,
  timestamp: number,
): TransitionHistoryEntryLike {
  return {
    request,
    result,
    timestamp,
  };
}
