import { SignalDirection } from '../../types/legacy';
import {
  createEnhancedExitConfig,
  createManagedEnhancedExitContext,
} from '../helpers/enhanced-exit-test.utils';

describe('EnhancedExitService functional', () => {
  it('reports ASCII-safe time-decay wording when TP is tightened over time', () => {
    const { createService, cleanup } = createManagedEnhancedExitContext();

    try {
      const service = createService({
        config: {
          ...createEnhancedExitConfig(),
          timeDecayTP: {
            enabled: true,
            decayStartMinutes: 60,
            decayRatePerHour: 0.2,
            minTPPercent: 0.5,
          },
        },
      });

      const now = Date.now();
      const result = service.calculateTimeDecay(3.0, now - 3 * 60 * 60_000, now);

      expect(result.adjusted).toBe(true);
      expect(result.newTPPercent).toBeLessThan(3.0);
      expect(result.reason).toContain('TP adjusted from 3.00% to');
      expect(result.reason).not.toContain('->');
      expect(service.checkAdaptiveTrailing(100, 102, SignalDirection.LONG).shouldActivate).toBe(true);
    } finally {
      cleanup();
    }
  });
});
