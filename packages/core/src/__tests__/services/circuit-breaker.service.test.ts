/**
 * Circuit Breaker Service Tests
 */

import { CircuitState } from '../../services/circuit-breaker.service';
import {
  createCircuitBreakerConfig,
  type CircuitBreakerServiceState,
  createManagedCircuitBreakerContext,
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

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(service.getStateSnapshot()).toBe(CircuitState.CLOSED);
      expect(service.isOpen()).toBe(false);
    });

    it('should have zero errors initially', () => {
      const stats = service.getStats();
      expect(stats.consecutiveErrors).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
    });
  });

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

  describe('error recording', () => {
    it('should record errors and increment counter', () => {
      service.recordError('Error 1');
      service.recordError('Error 2');

      const stats = service.getStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.consecutiveErrors).toBe(2);
    });

    it('should trip circuit after threshold errors', () => {
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getStateSnapshot()).toBe(CircuitState.OPEN);
      expect(service.isOpen()).toBe(true);
      const stats = service.getStats();
      expect(stats.tripCount).toBe(1);
    });
  });

  describe('circuit states', () => {
    it('should block operations when OPEN', () => {
      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.isOpen()).toBe(true);
      expect(service.getStateSnapshot()).toBe(CircuitState.OPEN);
    });

    it('should move to HALF_OPEN after cooldown', async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getStateSnapshot()).toBe(CircuitState.OPEN);

      jest.advanceTimersByTime(5100);
      service.isOpen();

      expect(service.getStateSnapshot()).toBe(CircuitState.HALF_OPEN);
      jest.useRealTimers();
    });
  });

  describe('recovery and reset', () => {
    it('should close circuit after successful call in HALF_OPEN', async () => {
      jest.useFakeTimers();

      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      jest.advanceTimersByTime(5100);

      service.isOpen();
      expect(service.getStateSnapshot()).toBe(CircuitState.HALF_OPEN);

      service.recordSuccess();
      expect(service.getStateSnapshot()).toBe(CircuitState.CLOSED);
      expect(service.isOpen()).toBe(false);
      jest.useRealTimers();
    });

    it('should manually reset circuit', () => {
      service = createService();

      for (let i = 0; i < 5; i++) {
        service.recordError(`Error ${i + 1}`);
      }

      expect(service.getStateSnapshot()).toBe(CircuitState.OPEN);

      service.reset();

      expect(service.getStateSnapshot()).toBe(CircuitState.CLOSED);
      expect(service.getStats().consecutiveErrors).toBe(0);
    });
  });
});
