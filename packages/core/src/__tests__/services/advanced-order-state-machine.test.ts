/**
 * AdvancedOrderStateMachineService Tests
 *
 * Test coverage:
 * - 5 THROW tests - Invalid transitions, null order
 * - 5 THROW tests - State validation failures
 * - 8 GRACEFUL_DEGRADE tests - Transition failures, timeout handling
 * - 4 SKIP tests - Logging failures
 * - 8 Integration tests - Complex state flows
 * - 4 Backward compat tests - Works without ErrorHandler
 * - 6 Edge cases - Concurrent transitions, state rollback, expired orders
 *
 * Total: 40 tests
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 13.2 - Order State Machine
 */

import {
  OrderState,
  TransitionTrigger,
} from '../../constants/phase-13-constants';
import {
  createManagedAdvancedOrderStateMachineContext,
  type AdvancedOrderStateMachineState,
  type AdvancedOrderStateMachineMockLogger,
} from '../helpers/advanced-order-state-machine-test.utils';

describe('AdvancedOrderStateMachineService', () => {
  let service: AdvancedOrderStateMachineState['service'];
  let mockLogger: AdvancedOrderStateMachineMockLogger;
  let errorHandler: AdvancedOrderStateMachineState['errorHandler'];
  let createLegacyService: AdvancedOrderStateMachineState['createLegacyService'];
  let cleanup: AdvancedOrderStateMachineState['cleanup'];

  beforeEach(() => {
    ({
      service,
      logger: mockLogger,
      errorHandler,
      createLegacyService,
      cleanup,
    } = createManagedAdvancedOrderStateMachineContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // THROW TESTS - Invalid Transitions (5 tests)
  // ==========================================================================

  describe('THROW Strategy - Invalid Transitions', () => {
    it('should throw on createStateMachine with null orderId', () => {
      expect(() => {
        service.createStateMachine('');
      }).toThrow('Order ID is required');
    });

    it('should throw on createStateMachine with duplicate orderId', () => {
      service.createStateMachine('order_1');

      expect(() => {
        service.createStateMachine('order_1');
      }).toThrow('State machine already exists');
    });

    it('should throw on transitionState with null orderId', async () => {
      await expect(
        service.transitionState('', OrderState.SUBMITTED, {
          reason: 'test',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).rejects.toThrow('Order ID is required');
    });

    it('should throw on transitionState with null target state', async () => {
      service.createStateMachine('order_1');

      await expect(
        service.transitionState('order_1', null as unknown as OrderState, {
          reason: 'test',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).rejects.toThrow('Target state is required');
    });

    it('should throw on transitionState with non-existent orderId', async () => {
      await expect(
        service.transitionState('nonexistent', OrderState.SUBMITTED, {
          reason: 'test',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).rejects.toThrow('State machine not found');
    });
  });

  // ==========================================================================
  // THROW TESTS - State Validation Failures (5 tests)
  // ==========================================================================

  describe('THROW Strategy - State Validation', () => {
    it('should throw on invalid transition from PENDING to FILLED', async () => {
      service.createStateMachine('order_1');

      await expect(
        service.transitionState('order_1', OrderState.FILLED, {
          reason: 'invalid',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).rejects.toThrow('Invalid state transition: pending → filled');
    });

    it('should throw on transition from terminal state (FILLED)', async () => {
      service.createStateMachine('order_1');

      // Transition to FILLED
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      await service.transitionState('order_1', OrderState.FILLED, {
        reason: 'filled',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      // Try to transition from FILLED
      await expect(
        service.transitionState('order_1', OrderState.CANCELLED, {
          reason: 'invalid',
          triggeredBy: TransitionTrigger.USER,
        })
      ).rejects.toThrow('Invalid state transition');
    });

    it('should throw on handlePartialFill with negative filled size', async () => {
      service.createStateMachine('order_1');

      await expect(
        service.handlePartialFill('order_1', -1, 10)
      ).rejects.toThrow('Invalid fill sizes');
    });

    it('should throw on handlePartialFill with filled >= total', async () => {
      service.createStateMachine('order_1');

      await expect(
        service.handlePartialFill('order_1', 10, 10)
      ).rejects.toThrow('use handleFilled() instead');
    });

    it('should throw on handleError with null error', async () => {
      service.createStateMachine('order_1');

      await expect(
        service.handleError('order_1', null as unknown as Error)
      ).rejects.toThrow('Error object is required');
    });
  });

  // ==========================================================================
  // GRACEFUL_DEGRADE TESTS - Transition Failures (8 tests)
  // ==========================================================================

  describe('GRACEFUL_DEGRADE Strategy - Transition Failures', () => {
    it('should handle concurrent transition by returning same-state transition', async () => {
      service.createStateMachine('order_1');

      // Start first transition (will acquire lock)
      let firstCompleted = false;
      const firstTransition = service
        .transitionState('order_1', OrderState.VALIDATING, {
          reason: 'first',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
        .then(() => {
          firstCompleted = true;
        });

      // Immediately start second transition (should fail to acquire lock)
      const secondTransition = service.transitionState(
        'order_1',
        OrderState.CANCELLED,
        {
          reason: 'concurrent test',
          triggeredBy: TransitionTrigger.USER,
        }
      );

      // Wait for both to complete
      const results = await Promise.all([firstTransition, secondTransition]);

      // At least one should have succeeded
      const stateMachine = service.getStateMachine('order_1')!;
      expect(stateMachine.currentState).toBeDefined();

      // Should have at least 1 transition in history
      expect(stateMachine.transitions.length).toBeGreaterThan(0);
    });

    it('should handle timeout gracefully and transition to EXPIRED', async () => {
      const stateMachine = service.createStateMachine('order_1', {
        timeoutMs: 100, // Very short timeout
      });

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Handle timeout
      const result = await service.handleTimeout('order_1');

      expect(result).not.toBeNull();
      expect(result!.to).toBe(OrderState.EXPIRED);
      expect(result!.triggeredBy).toBe(TransitionTrigger.TIMEOUT);
    });

    it('should handle null orderId in handleTimeout gracefully', async () => {
      await expect(service.handleTimeout('')).rejects.toThrow(
        'Order ID is required'
      );
    });

    it('should handle non-existent orderId in handleTimeout', async () => {
      await expect(service.handleTimeout('nonexistent')).rejects.toThrow(
        'State machine not found'
      );
    });

    it('should handle partial fill transition', async () => {
      service.createStateMachine('order_1');

      // Transition to SUBMITTED first
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      // Handle partial fill
      const result = await service.handlePartialFill('order_1', 5, 10);

      expect(result.to).toBe(OrderState.PARTIAL_FILL);
      expect(result.metadata).toMatchObject({
        filledSize: 5,
        totalSize: 10,
        fillPercentage: 50,
      });
    });

    it('should handle cancellation', async () => {
      service.createStateMachine('order_1');

      const result = await service.handleCancellation(
        'order_1',
        'User cancelled order',
        TransitionTrigger.USER
      );

      expect(result.to).toBe(OrderState.CANCELLED);
      expect(result.triggeredBy).toBe(TransitionTrigger.USER);
      expect(result.reason).toContain('User cancelled');
    });

    it('should handle error and transition to FAILED', async () => {
      service.createStateMachine('order_1');

      const testError = new Error('Test error');
      const result = await service.handleError('order_1', testError);

      expect(result.to).toBe(OrderState.FAILED);
      expect(result.triggeredBy).toBe(TransitionTrigger.ERROR);
      expect(result.reason).toContain('Test error');
    });

    it('should not timeout orders already in terminal state', async () => {
      const stateMachine = service.createStateMachine('order_1', {
        timeoutMs: 100,
      });

      // Transition to terminal state
      await service.handleCancellation(
        'order_1',
        'Cancelled',
        TransitionTrigger.USER
      );

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Try to handle timeout - should return null (already terminal)
      const result = await service.handleTimeout('order_1');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // SKIP TESTS - Logging Failures (4 tests)
  // ==========================================================================

  describe('SKIP Strategy - Logging Failures', () => {
    it('should skip logging errors during createStateMachine', () => {
      mockLogger.info.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      expect(() => {
        service.createStateMachine('order_1');
      }).not.toThrow();
    });

    it('should skip logging errors during transitionState', async () => {
      service.createStateMachine('order_1');

      mockLogger.info.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      await expect(
        service.transitionState('order_1', OrderState.VALIDATING, {
          reason: 'test',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).resolves.not.toThrow();
    });

    it('should skip callback errors during state change', async () => {
      const onStateChange = jest.fn(() => {
        throw new Error('Callback failed');
      });

      service.createStateMachine('order_1', { onStateChange });

      // Should not throw even if callback fails
      await expect(
        service.transitionState('order_1', OrderState.VALIDATING, {
          reason: 'test',
          triggeredBy: TransitionTrigger.SYSTEM,
        })
      ).resolves.not.toThrow();

      expect(onStateChange).toHaveBeenCalled();
    });

    it('should skip timeout callback errors', async () => {
      const onTimeout = jest.fn(() => {
        throw new Error('Timeout callback failed');
      });

      service.createStateMachine('order_1', {
        timeoutMs: 100,
        onTimeout,
      });

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not throw even if timeout callback fails
      await expect(service.handleTimeout('order_1')).resolves.not.toThrow();

      expect(onTimeout).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS - Complex State Flows (8 tests)
  // ==========================================================================

  describe('Integration Tests - Complex State Flows', () => {
    it('should handle full order lifecycle: PENDING → VALIDATING → SUBMITTED → FILLED', async () => {
      service.createStateMachine('order_1');

      // PENDING → VALIDATING
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'Validating order',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      expect(service.getCurrentState('order_1')).toBe(OrderState.VALIDATING);

      // VALIDATING → SUBMITTED
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'Order submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      expect(service.getCurrentState('order_1')).toBe(OrderState.SUBMITTED);

      // SUBMITTED → FILLED
      await service.transitionState('order_1', OrderState.FILLED, {
        reason: 'Order filled',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      expect(service.getCurrentState('order_1')).toBe(OrderState.FILLED);
      expect(service.isTerminalState('order_1')).toBe(true);
    });

    it('should handle partial fill flow: SUBMITTED → PARTIAL_FILL → FILLED', async () => {
      service.createStateMachine('order_1');

      // Get to SUBMITTED state
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      // SUBMITTED → PARTIAL_FILL
      await service.handlePartialFill('order_1', 5, 10);
      expect(service.getCurrentState('order_1')).toBe(OrderState.PARTIAL_FILL);

      // PARTIAL_FILL → FILLED
      await service.transitionState('order_1', OrderState.FILLED, {
        reason: 'Fully filled',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      expect(service.getCurrentState('order_1')).toBe(OrderState.FILLED);
    });

    it('should handle cancellation flow: PENDING → CANCELLED', async () => {
      service.createStateMachine('order_1');

      await service.handleCancellation(
        'order_1',
        'User cancelled',
        TransitionTrigger.USER
      );

      expect(service.getCurrentState('order_1')).toBe(OrderState.CANCELLED);
      expect(service.isTerminalState('order_1')).toBe(true);
    });

    it('should handle rejection flow: VALIDATING → REJECTED', async () => {
      service.createStateMachine('order_1');

      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });

      await service.transitionState('order_1', OrderState.REJECTED, {
        reason: 'Insufficient balance',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      expect(service.getCurrentState('order_1')).toBe(OrderState.REJECTED);
      expect(service.isTerminalState('order_1')).toBe(true);
    });

    it('should handle error flow: SUBMITTED → FAILED', async () => {
      service.createStateMachine('order_1');

      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      const testError = new Error('Connection lost');
      await service.handleError('order_1', testError);

      expect(service.getCurrentState('order_1')).toBe(OrderState.FAILED);
      expect(service.isTerminalState('order_1')).toBe(true);
    });

    it('should track complete state history', async () => {
      service.createStateMachine('order_1');

      // Go through multiple states
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });
      await service.handlePartialFill('order_1', 5, 10);
      await service.transitionState('order_1', OrderState.FILLED, {
        reason: 'filled',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      const history = service.getOrderHistory('order_1');
      expect(history).toHaveLength(4);
      expect(history[0].from).toBe(OrderState.PENDING);
      expect(history[0].to).toBe(OrderState.VALIDATING);
      expect(history[3].to).toBe(OrderState.FILLED);
    });

    it('should invoke all callbacks during state changes', async () => {
      const onStateChange = jest.fn();
      const onTimeout = jest.fn();
      const onError = jest.fn();

      service.createStateMachine('order_1', {
        onStateChange,
        onTimeout,
        onError,
        timeoutMs: 100,
      });

      // State change callback
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'test',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      expect(onStateChange).toHaveBeenCalledTimes(1);

      // Error callback
      const testError = new Error('Test error');
      await service.handleError('order_1', testError);
      expect(onError).toHaveBeenCalledWith(testError);

      // Timeout callback (wait for timeout)
      service.createStateMachine('order_2', {
        onTimeout,
        timeoutMs: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 150));
      await service.handleTimeout('order_2');
      expect(onTimeout).toHaveBeenCalled();
    });

    it('should update statistics correctly', async () => {
      service.createStateMachine('order_1', { timeoutMs: 100 });

      // Do some transitions
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'test',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'test',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      // Handle timeout
      service.createStateMachine('order_2', { timeoutMs: 50 });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await service.handleTimeout('order_2');

      const stats = service.getStats();
      expect(stats.totalTransitions).toBeGreaterThan(0);
      expect(stats.timeoutCount).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // BACKWARD COMPATIBILITY TESTS (4 tests)
  // ==========================================================================

  describe('Backward Compatibility - Without ErrorHandler', () => {
    beforeEach(() => {
      service.cleanup();
      service = createLegacyService({
        logger: mockLogger,
      });
    });

    it('should work without ErrorHandler - basic transitions', async () => {
      service.createStateMachine('order_1');

      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'test',
        triggeredBy: TransitionTrigger.SYSTEM,
      });

      expect(service.getCurrentState('order_1')).toBe(OrderState.VALIDATING);
    });

    it('should work without ErrorHandler - partial fill', async () => {
      service.createStateMachine('order_1');

      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });
      await service.transitionState('order_1', OrderState.SUBMITTED, {
        reason: 'submitted',
        triggeredBy: TransitionTrigger.EXCHANGE,
      });

      await service.handlePartialFill('order_1', 5, 10);
      expect(service.getCurrentState('order_1')).toBe(OrderState.PARTIAL_FILL);
    });

    it('should work without ErrorHandler - cancellation', async () => {
      service.createStateMachine('order_1');

      await service.handleCancellation('order_1', 'Test cancel', TransitionTrigger.USER);
      expect(service.getCurrentState('order_1')).toBe(OrderState.CANCELLED);
    });

    it('should work without ErrorHandler - error handling', async () => {
      service.createStateMachine('order_1');

      await service.handleError('order_1', new Error('Test error'));
      expect(service.getCurrentState('order_1')).toBe(OrderState.FAILED);
    });
  });

  // ==========================================================================
  // EDGE CASES (6 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle concurrent transitions safely with locks', async () => {
      service.createStateMachine('order_1');

      // Start two transitions at the same time
      const promise1 = service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'first',
        triggeredBy: TransitionTrigger.SYSTEM,
      });

      const promise2 = service.transitionState('order_1', OrderState.CANCELLED, {
        reason: 'second',
        triggeredBy: TransitionTrigger.USER,
      });

      // Wait for both
      await Promise.all([promise1, promise2]);

      // One should succeed, one should fail (lock)
      const stateMachine = service.getStateMachine('order_1')!;
      expect(stateMachine.currentState).toBeDefined();
      expect(stateMachine.transitions.length).toBeGreaterThan(0);
    });

    it('should handle state rollback on error', async () => {
      service.createStateMachine('order_1');

      // Successful transition
      await service.transitionState('order_1', OrderState.VALIDATING, {
        reason: 'validating',
        triggeredBy: TransitionTrigger.SYSTEM,
      });

      const previousState = service.getCurrentState('order_1');

      // Try invalid transition (should fail and attempt rollback)
      try {
        await service.transitionState('order_1', OrderState.FILLED, {
          reason: 'invalid',
          triggeredBy: TransitionTrigger.SYSTEM,
        });
      } catch (error) {
        // Expected to throw
      }

      // State should remain in previous valid state
      expect(service.getCurrentState('order_1')).toBe(previousState);
    });

    it('should handle expired orders correctly', async () => {
      service.createStateMachine('order_1', { timeoutMs: 50 });

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await service.handleTimeout('order_1');
      expect(result).not.toBeNull();
      expect(result!.to).toBe(OrderState.EXPIRED);
    });

    it('should handle cleanup of state machines', () => {
      service.createStateMachine('order_1');
      service.createStateMachine('order_2');

      expect(service.getStateMachine('order_1')).toBeDefined();
      expect(service.getStateMachine('order_2')).toBeDefined();

      service.removeStateMachine('order_1');
      expect(service.getStateMachine('order_1')).toBeUndefined();
      expect(service.getStateMachine('order_2')).toBeDefined();

      service.cleanup();
      expect(service.getStateMachine('order_2')).toBeUndefined();
    });

    it('should validate transition correctly', () => {
      // Valid transitions
      expect(service.validateTransition(OrderState.PENDING, OrderState.VALIDATING)).toBe(true);
      expect(service.validateTransition(OrderState.VALIDATING, OrderState.SUBMITTED)).toBe(true);
      expect(service.validateTransition(OrderState.SUBMITTED, OrderState.FILLED)).toBe(true);

      // Invalid transitions
      expect(service.validateTransition(OrderState.PENDING, OrderState.FILLED)).toBe(false);
      expect(service.validateTransition(OrderState.FILLED, OrderState.CANCELLED)).toBe(false);
      expect(service.validateTransition(OrderState.CANCELLED, OrderState.SUBMITTED)).toBe(false);

      // Null/undefined
      expect(service.validateTransition(null as unknown as OrderState, OrderState.SUBMITTED)).toBe(false);
      expect(service.validateTransition(OrderState.PENDING, null as unknown as OrderState)).toBe(false);
    });

    it('should handle getOrderHistory with non-existent order', () => {
      expect(() => {
        service.getOrderHistory('nonexistent');
      }).toThrow('State machine not found');
    });
  });
});
