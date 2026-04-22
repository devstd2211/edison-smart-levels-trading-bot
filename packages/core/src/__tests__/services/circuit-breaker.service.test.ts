/**
 * Circuit Breaker Service Tests
 */

import { CircuitState } from '../../services/circuit-breaker.service';
import {
  createCircuitBreakerConfig,
  createManagedCircuitBreakerContext,
  type CircuitBreakerServiceState,
} from '../helpers/circuit-breaker-test.utils';

// ============================================================================
// TESTS
// ============================================================================

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerServiceState['service'];
  let config: Parameters<typeof createCircuitBreakerConfig>[0];
  let createService: CircuitBreakerServiceState['createStandardService'];
  let cleanup: CircuitBreakerServiceState['cleanup'];

  beforeEach(() => {
    config = createCircuitBreakerConfig();
    ({
      service,
      createStandardService: createService,
      cleanup,
    } = createManagedCircuitBreakerContext({
      configOverrides: config,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  // TEST 1-2: Initial state
  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(service.getState()).toBe(CircuitState.CLOSED);
      expect(service.isOpen()).toBe(false);
    });

    it('should have zero errors initially', () => {
      const stats = service.getStats();
      expect(stats.consecutiveErrors).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
    });
  });

  // TEST 3-4: Success recording
  describe('success recording', () => {
    it('should record successful operations', () => {
      service.recordSuccess();
      service.recordSuccess();
      service.recordSuccess();

      const stats = service.getStats();
      expect(stats.totalSuccesses).toBe(3);
      expect(stats.consecutiveErrors).toBe(0);
    });

    it('should reset consecutive errors on success', () => {
      service.recordError('Error 1');
      service.recordError('Error 2');
      expect(service.getStats().consecutiveErrors).toBe(2);

      service.recordSuccess();
      expect(service.getStats().consecutiveErrors).toBe(0);
    });
  });

  // TEST 5-6: Error recording and circuit trip
  describe('error recording', () => {
    it('should record errors and increment counter', () => {
      service.recordError('Error 1');
      service.recordError('Error 2');

      const stats = service.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.consecutiveErrors).toBe(2);
    });

    it('should trip circuit after threshold errors', () => {
      // Record 5 errors (threshold)
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getState()).toBe(CircuitState.OPEN);
      expect(service.isOpen()).toBe(true);
      const stats = service.getStats();
      expect(stats.tripCount).toBe(1);
    });
  });

  // TEST 7-8: Circuit states
  describe('circuit states', () => {
    it('should block operations when OPEN', () => {
      // Trip circuit
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.isOpen()).toBe(true);
      expect(service.getState()).toBe(CircuitState.OPEN);
    });

    it('should move to HALF_OPEN after cooldown', async () => {
      jest.useFakeTimers();

      // Trip circuit
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getState()).toBe(CircuitState.OPEN);

      // Wait for cooldown
      jest.advanceTimersByTime(5100);

      // Check if can recover
      service.isOpen(); // Calling this triggers state transition

      expect(service.getState()).toBe(CircuitState.HALF_OPEN);
      jest.useRealTimers();
    });
  });

  // TEST 9-10: Recovery and reset
  describe('recovery and reset', () => {
    it('should close circuit after successful call in HALF_OPEN', async () => {
      jest.useFakeTimers();

      // Trip circuit
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      // Wait for cooldown
      jest.advanceTimersByTime(5100);

      // Trigger HALF_OPEN
      service.isOpen();
      expect(service.getState()).toBe(CircuitState.HALF_OPEN);

      // Record success
      service.recordSuccess();
      expect(service.getState()).toBe(CircuitState.CLOSED);
      expect(service.isOpen()).toBe(false);
      jest.useRealTimers();
    });

    it('should manually reset circuit', () => {
      service = createService();

      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getState()).toBe(CircuitState.OPEN);

      service.reset();

      expect(service.getState()).toBe(CircuitState.CLOSED);
      expect(service.getStats().consecutiveErrors).toBe(0);
    });
  });
});
