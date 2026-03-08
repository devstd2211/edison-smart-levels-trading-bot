import type { OrderState } from '../../constants/phase-13-constants';
import type { OrderStateMachine } from '../advanced-order-state-machine.service';

export function requireOrderId(orderId: string, message: string): void {
  if (!orderId) {
    throw new Error(message);
  }
}

export function requireTargetState(toState: OrderState): void {
  if (!toState) {
    throw new Error('Target state is required for transition');
  }
}

export function requireStateMachine(
  stateMachine: OrderStateMachine | undefined,
  orderId: string,
): OrderStateMachine {
  if (!stateMachine) {
    throw new Error(`State machine not found for order ${orderId}`);
  }
  return stateMachine;
}

export function requirePositiveFillSizes(filledSize: number, totalSize: number): void {
  if (filledSize <= 0 || totalSize <= 0) {
    throw new Error('Invalid fill sizes: both must be positive');
  }

  if (filledSize >= totalSize) {
    throw new Error('Filled size >= total size, use handleFilled() instead');
  }
}

export function requireErrorObject(error: Error | null | undefined): asserts error is Error {
  if (!error) {
    throw new Error('Error object is required');
  }
}
