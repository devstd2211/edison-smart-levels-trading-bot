import { ICONS } from '../../cli/cli-runtime';
import { TradingMode, TrendBias } from '../../types/legacy';
import {
  createManagedTimeframeWeightingContext,
} from '../helpers/timeframe-weighting-test.utils';

describe('TimeframeWeightingService - Functional behavior', () => {
  it('combines weighted trends and logs through shared icons', () => {
    const {
      service,
      logger,
      createMultiTF,
      cleanup,
    } = createManagedTimeframeWeightingContext();

    try {
      const result = service.combine(createMultiTF(), TradingMode.DAY);

      expect(result.bias).toBe(TrendBias.BULLISH);
      expect(result.reasoning).toContain('Final=BULLISH');
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} TimeframeWeightingService initialized`,
        undefined,
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Weighted combination complete`,
        expect.objectContaining({
          tradingMode: TradingMode.DAY,
          finalBias: TrendBias.BULLISH,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
