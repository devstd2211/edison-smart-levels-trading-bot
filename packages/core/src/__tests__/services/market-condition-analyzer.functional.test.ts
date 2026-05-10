import { ICONS } from '../../cli/cli-runtime';
import {
  createManagedMarketConditionContext,
  createMarketConditionResult,
  createMarketConditionTakeProfitSeries,
} from '../helpers/market-condition-analyzer-test.utils';

describe('MarketConditionAnalyzerService - Functional behavior', () => {
  it('condenses flat-market take profits and logs through shared icons', () => {
    const { service, logger, cleanup } = createManagedMarketConditionContext();

    try {
      const result = service.adjustTakeProfitsForMarketCondition(
        createMarketConditionTakeProfitSeries([
          { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
          { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
        ]),
        createMarketConditionResult(true, 82),
      );

      expect(result).toHaveLength(1);
      expect(result[0].sizePercent).toBe(100);
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.chart} FLAT market - adjusted to single TP`,
        expect.objectContaining({
          confidence: '82.0%',
        }),
      );
    } finally {
      cleanup();
    }
  });

  it('keeps multi-TP trending behavior and logs through shared icons', () => {
    const { service, logger, cleanup } = createManagedMarketConditionContext();
    const takeProfits = createMarketConditionTakeProfitSeries([
      { level: 1, price: 100, sizePercent: 50, percent: 0.5 },
      { level: 2, price: 110, sizePercent: 30, percent: 1.0 },
      { level: 3, price: 120, sizePercent: 20, percent: 1.5 },
    ]);

    try {
      const result = service.adjustTakeProfitsForMarketCondition(
        takeProfits,
        createMarketConditionResult(false, 91),
      );

      expect(result).toEqual(takeProfits);
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.chart} TRENDING market - keeping multi-TP strategy`,
        expect.objectContaining({
          tpCount: 3,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
