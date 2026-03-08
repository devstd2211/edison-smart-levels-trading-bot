import { OrderState, TERMINAL_STATES } from '../../constants/phase-13-constants';

interface TimeoutCandidate {
  locked: boolean;
  currentState: OrderState;
  timeoutAt?: number;
}

export function shouldProcessTimeout(
  stateMachine: TimeoutCandidate,
  now: number,
): boolean {
  if (stateMachine.locked) {
    return false;
  }

  if (TERMINAL_STATES.has(stateMachine.currentState)) {
    return false;
  }

  return typeof stateMachine.timeoutAt === 'number' && now >= stateMachine.timeoutAt;
}
