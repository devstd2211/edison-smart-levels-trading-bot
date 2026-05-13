import {
  AnalyzerType,
  getAdvancedAnalyzerTypes,
  getAllAnalyzerTypes,
  getAnalyzersByCategory,
  getBasicIndicatorAnalyzerTypes,
  isValidAnalyzerType,
} from '../../types/analyzer';

describe('AnalyzerType enum helpers', () => {
  test('splits basic and advanced analyzers without overlap', () => {
    const basic = getBasicIndicatorAnalyzerTypes();
    const advanced = getAdvancedAnalyzerTypes();

    expect(basic).toEqual([
      AnalyzerType.EMA,
      AnalyzerType.RSI,
      AnalyzerType.ATR,
      AnalyzerType.VOLUME,
      AnalyzerType.STOCHASTIC,
      AnalyzerType.BOLLINGER_BANDS,
    ]);
    expect(advanced).toHaveLength(getAllAnalyzerTypes().length - basic.length);
    basic.forEach((type) => {
      expect(advanced).not.toContain(type);
    });
  });

  test('maps categories back to the full analyzer set', () => {
    const categories = [
      'basic',
      'divergence',
      'breakout',
      'priceAction',
      'structure',
      'levels',
      'liquidity',
      'orderFlow',
      'scalping',
    ] as const;

    const categorized = categories.flatMap((category) => getAnalyzersByCategory(category));

    expect(new Set(categorized)).toEqual(new Set(getAllAnalyzerTypes()));
    expect(getAnalyzersByCategory('liquidity')).toContain(AnalyzerType.WHALE);
    expect(getAnalyzersByCategory('orderFlow')).toContain(AnalyzerType.DELTA);
  });

  test('accepts only known analyzer type values', () => {
    getAllAnalyzerTypes().forEach((type) => {
      expect(isValidAnalyzerType(type)).toBe(true);
    });

    expect(isValidAnalyzerType('EMA ')).toBe(false);
    expect(isValidAnalyzerType('UNKNOWN')).toBe(false);
  });
});
