import { CircuitBreakerService, CircuitState } from '../../../services/resilience/circuit-breaker.service';

describe('resilience/CircuitBreakerService functional', () => {
  it('tracks each named circuit independently through snapshot reads', async () => {
    const service = new CircuitBreakerService({
      failureThreshold: 2,
      failureRateThreshold: 0.5,
      successThreshold: 1,
      timeout: 1_000,
      volumeThreshold: 2,
    });

    await expect(service.execute(async () => {
      throw new Error('alpha-1');
    }, 'alpha')).rejects.toThrow('alpha-1');
    await expect(service.execute(async () => {
      throw new Error('alpha-2');
    }, 'alpha')).rejects.toThrow('alpha-2');

    await expect(service.execute(async () => 'beta-ok', 'beta')).resolves.toBe('beta-ok');

    expect(service.getStateSnapshot('alpha')).toBe(CircuitState.OPEN);
    expect(service.getStateSnapshot('beta')).toBe(CircuitState.CLOSED);
  });
});
