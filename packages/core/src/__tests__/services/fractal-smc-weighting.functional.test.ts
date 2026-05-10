import { ICONS } from '../../cli/cli-runtime';
import {
  createFractalSmcWeightingData,
  createFractalSmcWeightingSetup,
  createManagedFractalSmcWeightingContext,
} from '../helpers/fractal-smc-weighting-test.utils';

describe('FractalSmcWeightingService - Functional behavior', () => {
  it('calculates a weighted signal and logs through shared icons without marker glyphs in reasoning', () => {
    const { service, logger, cleanup } = createManagedFractalSmcWeightingContext();
    const setup = createFractalSmcWeightingSetup() as Parameters<
      typeof service.calculateWeightedScore
    >[0];
    const data = createFractalSmcWeightingData() as Parameters<
      typeof service.calculateWeightedScore
    >[1];

    try {
      const result = service.calculateWeightedScore(setup, data);

      expect(result.combinedScore).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Strong reversal candle');
      expect(result.reasoning.join(' ')).not.toContain('✓');
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} FractalSmcWeightingService initialized`,
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Weighted score calculated',
        expect.objectContaining({
          confidence: result.confidence,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
