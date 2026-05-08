import type {
  OrderStateMachine,
  StateTransition,
} from '../advanced-order-state-machine.service';
import type { OrderState } from '../../constants/phase-13-constants';

export function getStateMachineHistorySnapshot(
  stateMachine: OrderStateMachine,
): StateTransition[] {
  return stateMachine.transitions.map((transition) => ({
    ...transition,
    metadata: transition.metadata ? { ...transition.metadata } : undefined,
  }));
}

export function getStateMachineSnapshot(
  stateMachine?: OrderStateMachine,
): OrderStateMachine | undefined {
  if (!stateMachine) {
    return undefined;
  }

  return {
    ...stateMachine,
    transitions: getStateMachineHistorySnapshot(stateMachine),
  };
}

export function getStateMachineCurrentState(
  stateMachine?: OrderStateMachine,
): OrderState | undefined {
  return stateMachine?.currentState;
}

export function isStateMachineTerminal(
  stateMachine: OrderStateMachine | undefined,
  terminalStates: ReadonlySet<OrderState>,
): boolean {
  return stateMachine ? terminalStates.has(stateMachine.currentState) : false;
}

export function clearStateMachineResources(
  stateMachines: Map<string, OrderStateMachine>,
  locks: Map<string, boolean>,
  orderId: string,
): void {
  stateMachines.delete(orderId);
  locks.delete(orderId);
}
