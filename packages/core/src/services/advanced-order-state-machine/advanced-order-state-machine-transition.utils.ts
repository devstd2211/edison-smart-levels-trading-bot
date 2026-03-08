import { OrderState, TransitionTrigger } from '../../constants/phase-13-constants';

export interface StateTransitionRecord {
  id: string;
  from: OrderState;
  to: OrderState;
  timestamp: number;
  reason: string;
  triggeredBy: TransitionTrigger;
  metadata?: Record<string, unknown>;
}

export interface MutableOrderStateMachine {
  currentState: OrderState;
  previousState?: OrderState;
  updatedAt: number;
  transitions: StateTransitionRecord[];
  timeoutAt?: number;
}

interface CreateTransitionParams {
  transitionIdPrefix: string;
  orderId: string;
  fromState: OrderState;
  toState: OrderState;
  reason: string;
  triggeredBy: TransitionTrigger;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface ApplyTransitionParams {
  stateMachine: MutableOrderStateMachine;
  transition: StateTransitionRecord;
  maxTransitionHistory: number;
  stateTimeouts: Record<OrderState, number>;
}

export function createStateTransitionRecord({
  transitionIdPrefix,
  orderId,
  fromState,
  toState,
  reason,
  triggeredBy,
  metadata,
  timestamp,
}: CreateTransitionParams): StateTransitionRecord {
  return {
    id: `${transitionIdPrefix}${orderId}_${timestamp}`,
    from: fromState,
    to: toState,
    timestamp,
    reason,
    triggeredBy,
    metadata,
  };
}

export function createBlockedStateTransitionRecord(
  transitionIdPrefix: string,
  currentState: OrderState,
  timestamp: number,
): StateTransitionRecord {
  return {
    id: `${transitionIdPrefix}failed_${timestamp}`,
    from: currentState,
    to: currentState,
    timestamp,
    reason: 'Lock acquisition failed',
    triggeredBy: TransitionTrigger.ERROR,
  };
}

export function applyStateTransition({
  stateMachine,
  transition,
  maxTransitionHistory,
  stateTimeouts,
}: ApplyTransitionParams): void {
  stateMachine.previousState = stateMachine.currentState;
  stateMachine.currentState = transition.to;
  stateMachine.updatedAt = transition.timestamp;
  stateMachine.transitions.push(transition);

  if (stateMachine.transitions.length > maxTransitionHistory) {
    stateMachine.transitions = stateMachine.transitions.slice(-maxTransitionHistory);
  }

  const stateTimeout = stateTimeouts[transition.to];
  if (stateTimeout > 0) {
    stateMachine.timeoutAt = transition.timestamp + stateTimeout;
    return;
  }

  stateMachine.timeoutAt = undefined;
}
