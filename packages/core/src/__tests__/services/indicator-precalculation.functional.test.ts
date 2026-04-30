import { TimeframeRole } from '../../types/legacy';
import {
  createIndicatorPrecalculationMockCalculator,
  createManagedIndicatorPrecalculationContext,
} from '../helpers/indicator-precalculation-test.utils';

describe('IndicatorPreCalculationService - Functional behavior', () => {
  it('recalculates calculators for shared candle-close batches and only notifies the entry timeframe callback once', async () => {
    const entryCalculator = createIndicatorPrecalculationMockCalculator('RSI');
    entryCalculator.getConfig.mockReturnValue({
      indicators: [
        {
          name: 'RSI',
          periods: [14, 21],
          timeframes: ['ENTRY'],
          minCandlesRequired: 50,
        },
      ],
    });
    entryCalculator.calculate.mockResolvedValue(
      new Map([
        ['RSI-14-ENTRY', 44],
        ['RSI-21-ENTRY', 47],
      ]),
    );

    const trendCalculator = createIndicatorPrecalculationMockCalculator('EMA');
    trendCalculator.getConfig.mockReturnValue({
      indicators: [
        {
          name: 'EMA',
          periods: [20],
          timeframes: ['ENTRY', 'TREND'],
          minCandlesRequired: 120,
        },
      ],
    });
    trendCalculator.calculate.mockResolvedValue(
      new Map([
        ['EMA-20-ENTRY', 101.5],
        ['EMA-20-TREND', 104.25],
      ]),
    );

    const {
      service,
      cache,
      candleProvider,
      cleanup,
    } = createManagedIndicatorPrecalculationContext({
      calculators: [entryCalculator, trendCalculator],
    });

    const onIndicatorsReady = jest.fn().mockResolvedValue(undefined);
    service.setOnIndicatorsReady(onIndicatorsReady);
    service.setEntryTimeframe('ENTRY' as TimeframeRole);

    const closeTime = 1_710_000_000_000;

    await Promise.all([
      service.onCandleClosed('ENTRY' as TimeframeRole, closeTime),
      service.onCandleClosed('TREND' as TimeframeRole, closeTime),
    ]);

    expect(candleProvider.getCandles).toHaveBeenCalledWith('ENTRY', 120);
    expect(candleProvider.getCandles).toHaveBeenCalledWith('TREND', 120);
    expect(cache.invalidate).toHaveBeenCalledWith('RSI-14-ENTRY');
    expect(cache.invalidate).toHaveBeenCalledWith('RSI-21-ENTRY');
    expect(cache.invalidate).toHaveBeenCalledWith('EMA-20-ENTRY');
    expect(cache.invalidate).toHaveBeenCalledWith('EMA-20-TREND');
    expect(cache.set).toHaveBeenCalledWith('RSI-14-ENTRY', 44);
    expect(cache.set).toHaveBeenCalledWith('RSI-21-ENTRY', 47);
    expect(cache.set).toHaveBeenCalledWith('EMA-20-ENTRY', 101.5);
    expect(cache.set).toHaveBeenCalledWith('EMA-20-TREND', 104.25);
    expect(onIndicatorsReady).toHaveBeenCalledTimes(1);
    expect(onIndicatorsReady).toHaveBeenCalledWith('ENTRY', closeTime);

    cleanup();
  });
});
