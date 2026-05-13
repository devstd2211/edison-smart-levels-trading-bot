import {
  IndicatorType,
  getAllIndicatorTypes,
  isValidIndicatorType,
} from '../../types/indicator';

describe('IndicatorType enum helpers', () => {
  test('returns every indicator type exactly once', () => {
    const types = getAllIndicatorTypes();

    expect(types).toEqual([
      IndicatorType.EMA,
      IndicatorType.RSI,
      IndicatorType.ATR,
      IndicatorType.VOLUME,
      IndicatorType.STOCHASTIC,
      IndicatorType.BOLLINGER_BANDS,
    ]);
    expect(new Set(types).size).toBe(types.length);
  });

  test('accepts only known indicator type values', () => {
    getAllIndicatorTypes().forEach((type) => {
      expect(isValidIndicatorType(type)).toBe(true);
    });

    expect(isValidIndicatorType('EMA ')).toBe(false);
    expect(isValidIndicatorType('UNKNOWN')).toBe(false);
  });
});
