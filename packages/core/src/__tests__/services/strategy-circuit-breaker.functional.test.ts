import { CircuitBreakerStatus } from '../../types/legacy';
import { createManagedStrategyCircuitBreakerContext } from '../helpers/strategy-circuit-breaker-test.utils';

describe('StrategyCircuitBreakerService functional behavior', () => {
  it('tracks each strategy independently through open, reset, and snapshot reads', () => {
    const { service, cleanup } = createManagedStrategyCircuitBreakerContext();

    try {
      for (let i = 0; i < 5; i++) {
        service.recordFailure('alpha', new Error(`alpha-${i}`));
      }

      service.recordSuccess('beta');

      const alphaSnapshot = service.getStateSnapshot('alpha');
      const betaSnapshot = service.getStateSnapshot('beta');
      expect(alphaSnapshot.status).toBe(CircuitBreakerStatus.OPEN);
      expect(betaSnapshot.status).toBe(CircuitBreakerStatus.CLOSED);

      alphaSnapshot.failureCount = 0;
      expect(service.getStateSnapshot('alpha').failureCount).toBe(5);

      service.reset('alpha');
      expect(service.getStateSnapshot('alpha').status).toBe(CircuitBreakerStatus.CLOSED);
      expect(service.canExecute('beta')).toBe(true);
    } finally {
      cleanup();
    }
  });
});
