import {
  OrderState,
  TransitionTrigger,
} from '../../constants/phase-13-constants';
import { createManagedAdvancedOrderStateMachineContext } from '../helpers/advanced-order-state-machine-test.utils';

describe('AdvancedOrderStateMachineService functional', () => {
  it('processes lifecycle transitions and cleanup through public API', async () => {
    const { service, cleanup } = createManagedAdvancedOrderStateMachineContext();

    try {
      service.start();
      service.createStateMachine('order-1', { timeoutMs: 500 });

      await service.transitionState('order-1', OrderState.VALIDATING, {
        reason: 'validate',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order-1', OrderState.SUBMITTED, {
        reason: 'submit',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      await service.handleCancellation(
        'order-1',
        'cancel',
        TransitionTrigger.USER,
      );

      expect(service.isTerminalState('order-1')).toBe(true);
      expect(service.getOrderHistory('order-1')).toHaveLength(3);

      service.removeStateMachine('order-1');
      expect(service.getStateMachine('order-1')).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
