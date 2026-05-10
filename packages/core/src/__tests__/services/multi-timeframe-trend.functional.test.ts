import { ICONS } from '../../cli/cli-runtime';
import {
  createManagedMultiTimeframeTrendContext,
  createMultiTimeframeTrendData,
} from '../helpers/multi-timeframe-trend-test.utils';

describe('MultiTimeframeTrendService - Functional behavior', () => {
  it('analyzes timeframes, forms consensus, and logs through shared icons', async () => {
    const { service, logger, cleanup } = createManagedMultiTimeframeTrendContext();

    try {
      const result = await service.analyze(createMultiTimeframeTrendData());

      expect(result.consensus.primaryTrend).toBeDefined();
      expect(result.consensus.currentTrend).toBeDefined();
      expect(result.consensus.entryTrend).toBeDefined();
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.chart} Multi-timeframe analysis complete`,
        expect.objectContaining({
          '5m': expect.any(String),
          '1h': expect.any(String),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} Consensus formed`,
        expect.objectContaining({
          alignment: expect.any(String),
          strength: expect.any(String),
        }),
      );
    } finally {
      cleanup();
    }
  });
});
