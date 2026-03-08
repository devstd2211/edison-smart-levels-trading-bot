import type { OrderStateMachine } from '../advanced-order-state-machine.service';

export function markLockAcquired(stateMachine: OrderStateMachine | undefined, timestamp: number): void {
  if (!stateMachine) {
    return;
  }

  stateMachine.locked = true;
  stateMachine.lockAcquiredAt = timestamp;
}

export function markLockReleased(stateMachine: OrderStateMachine | undefined): void {
  if (!stateMachine) {
    return;
  }

  stateMachine.locked = false;
  stateMachine.lockAcquiredAt = undefined;
}
