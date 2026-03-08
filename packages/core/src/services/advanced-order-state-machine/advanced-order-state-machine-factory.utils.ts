import {
  DEFAULT_ORDER_TIMEOUT_MS,
  OrderState,
} from '../../constants/phase-13-constants';
import type { OrderStateMachine, StateTransition } from '../advanced-order-state-machine.service';

interface BuildStateMachineOptions {
  timeoutMs?: number;
  onStateChange?: (transition: StateTransition) => void;
  onTimeout?: () => void;
  onError?: (error: Error) => void;
}

export function buildInitialStateMachine(
  orderId: string,
  now: number,
  options?: BuildStateMachineOptions,
): OrderStateMachine {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_ORDER_TIMEOUT_MS;
  return {
    orderId,
    currentState: OrderState.PENDING,
    previousState: undefined,
    transitions: [],
    createdAt: now,
    updatedAt: now,
    timeoutMs,
    timeoutAt: now + timeoutMs,
    locked: false,
    onStateChange: options?.onStateChange,
    onTimeout: options?.onTimeout,
    onError: options?.onError,
  };
}
