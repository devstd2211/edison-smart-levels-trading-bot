import { OrderState } from '../../constants/phase-13-constants';
import {
  clearStateMachineResources,
  getStateMachineCurrentState,
  getStateMachineHistorySnapshot,
  isStateMachineTerminal,
} from '../../services/advanced-order-state-machine/advanced-order-state-machine-state.utils';
import type { OrderStateMachine } from '../../services/advanced-order-state-machine.service';

function createStateMachine(
  overrides: Partial<OrderStateMachine> = {},
): OrderStateMachine {
  return {
    orderId: 'order-1',
    currentState: OrderState.PENDING,
    transitions: [],
    createdAt: 1,
    updatedAt: 1,
    timeoutMs: 1000,
    locked: false,
    ...overrides,
  };
}

describe('advanced-order-state-machine-state.utils', () => {
  it('returns copied history snapshot', () => {
    const stateMachine = createStateMachine({
      transitions: [
        {
          id: 't1',
          from: OrderState.PENDING,
          to: OrderState.VALIDATING,
          timestamp: 1,
          reason: 'test',
          triggeredBy: 'SYSTEM' as never,
        },
      ],
    });

    const snapshot = getStateMachineHistorySnapshot(stateMachine);
    snapshot.push({
      id: 't2',
      from: OrderState.VALIDATING,
      to: OrderState.SUBMITTED,
      timestamp: 2,
      reason: 'copy only',
      triggeredBy: 'SYSTEM' as never,
    });

    expect(stateMachine.transitions).toHaveLength(1);
  });

  it('reads current state and terminal flag', () => {
    const stateMachine = createStateMachine({
      currentState: OrderState.FILLED,
    });

    expect(getStateMachineCurrentState(stateMachine)).toBe(OrderState.FILLED);
    expect(
      isStateMachineTerminal(stateMachine, new Set([OrderState.FILLED])),
    ).toBe(true);
  });

  it('clears tracked state machine resources', () => {
    const machines = new Map([['order-1', createStateMachine()]]);
    const locks = new Map([['order-1', true]]);

    clearStateMachineResources(machines, locks, 'order-1');

    expect(machines.has('order-1')).toBe(false);
    expect(locks.has('order-1')).toBe(false);
  });
});
