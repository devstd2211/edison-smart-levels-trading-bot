import { CircuitState } from '../../services/circuit-breaker.service';
import { createManagedCircuitBreakerContext } from '../helpers/circuit-breaker-test.utils';

describe('CircuitBreakerService functional behavior', () => {
  it('opens, cools down, and closes again through the public snapshot read API', () => {
    jest.useFakeTimers();
    const { service, cleanup } = createManagedCircuitBreakerContext({
      configOverrides: {
        errorThreshold: 2,
        cooldownMs: 100,
      },
    });

    try {
      service.recordError('first');
      service.recordError('second');
      expect(service.getStateSnapshot()).toBe(CircuitState.OPEN);

      jest.advanceTimersByTime(150);
      expect(service.isOpen()).toBe(false);
      expect(service.getStateSnapshot()).toBe(CircuitState.HALF_OPEN);

      service.recordSuccess();
      expect(service.getStateSnapshot()).toBe(CircuitState.CLOSED);
    } finally {
      cleanup();
    }
  });
});
