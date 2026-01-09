/**
 * ATR Analyzer NEW - Technical Tests
 * Comprehensive testing of configuration, validation, and signal generation
 */

import { AtrAnalyzerNew } from '../../analyzers/atr.analyzer-new';
import type { Candle } from '../../types/core';
import type { AtrAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createDefaultConfig(): AtrAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.8,
    priority: 5,
    confidenceMultiplier: 1.0,
    maxConfidence: 0.95,
  };
}

function createCandle(high: number, low: number, close: number): Candle {
  return {
    open: (high + low) / 2,
    high,
    low,
    close,
    volume: 1000,
    timestamp: Date.now(),
  };
}

function createHighVolatilityCandles(): Candle[] {
  // Large true ranges (high volatility)
  const candles = [];
  for (let i = 0; i < 50; i++) {
    const high = 100 + i * 0.5;
    const low = 100 + i * 0.5 - 5;
    const close = 100 + i * 0.5 - 1;
    candles.push(createCandle(high, low, close));
  }
  return candles;
}

function createLowVolatilityCandles(): Candle[] {
  // Small true ranges (low volatility)
  const candles = [];
  for (let i = 0; i < 50; i++) {
    const base = 100 + i * 0.1;
    const high = base + 0.1;
    const low = base - 0.1;
    const close = base;
    candles.push(createCandle(high, low, close));
  }
  return candles;
}

// ============================================================================
// TESTS
// ============================================================================

describe('AtrAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).enabled;
    expect(() => new AtrAnalyzerNew(config as any)).toThrow('[ATR_ANALYZER] Missing or invalid: enabled');
  });

  test('should throw on invalid weight (negative)', () => {
    const config = { ...createDefaultConfig(), weight: -0.5 };
    expect(() => new AtrAnalyzerNew(config)).toThrow('[ATR_ANALYZER] Missing or invalid: weight');
  });

  test('should throw on invalid weight (> 1)', () => {
    const config = { ...createDefaultConfig(), weight: 1.5 };
    expect(() => new AtrAnalyzerNew(config)).toThrow('[ATR_ANALYZER] Missing or invalid: weight');
  });

  test('should throw on invalid priority', () => {
    const config = { ...createDefaultConfig(), priority: 0 };
    expect(() => new AtrAnalyzerNew(config)).toThrow('[ATR_ANALYZER] Missing or invalid: priority');
  });

  test('should throw on invalid confidenceMultiplier', () => {
    const config = { ...createDefaultConfig(), confidenceMultiplier: -1 };
    expect(() => new AtrAnalyzerNew(config)).toThrow('[ATR_ANALYZER] Missing or invalid: confidenceMultiplier');
  });

  test('should throw on invalid maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 1.5 };
    expect(() => new AtrAnalyzerNew(config)).toThrow('[ATR_ANALYZER] Missing or invalid: maxConfidence');
  });
});

describe('AtrAnalyzerNew - Input Validation Tests', () => {
  test('should throw when analyzer is disabled', () => {
    const config = { ...createDefaultConfig(), enabled: false };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    expect(() => analyzer.analyze(candles)).toThrow('[ATR_ANALYZER] Analyzer is disabled');
  });

  test('should throw on invalid candles input (not array)', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    expect(() => analyzer.analyze(null as any)).toThrow('[ATR_ANALYZER] Invalid candles input');
  });

  test('should throw on insufficient candles', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + i, 99 + i, 99.5 + i),
    );
    expect(() => analyzer.analyze(candles)).toThrow('[ATR_ANALYZER] Not enough candles');
  });

  test('should throw on candle with missing high price', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    (candles[25] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[ATR_ANALYZER] Invalid candle');
  });
});

describe('AtrAnalyzerNew - Signal Generation Tests', () => {
  test('should generate LONG signal on high volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.LONG);
  });

  test('should generate SHORT signal on low volatility', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createLowVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.SHORT);
  });

  test('should calculate correct score from confidence and weight', () => {
    const config = { ...createDefaultConfig(), weight: 0.5 };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    const expectedScore = (signal.confidence / 100) * config.weight;
    expect(signal.score).toBeCloseTo(expectedScore, 1);
  });
});

describe('AtrAnalyzerNew - Confidence Calculation Tests', () => {
  test('should clamp confidence to maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 0.5 };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeLessThanOrEqual(50);
  });

  test('should respect minimum confidence floor', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 0.05 };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });

  test('should scale confidence with confidenceMultiplier', () => {
    const highMultiplier = { ...createDefaultConfig(), confidenceMultiplier: 2.0 };
    const lowMultiplier = { ...createDefaultConfig(), confidenceMultiplier: 0.5 };

    const analyzerHigh = new AtrAnalyzerNew(highMultiplier);
    const analyzerLow = new AtrAnalyzerNew(lowMultiplier);

    const candles = createHighVolatilityCandles();
    const signalHigh = analyzerHigh.analyze(candles);
    const signalLow = analyzerLow.analyze(candles);

    expect(signalHigh.confidence).toBeGreaterThan(signalLow.confidence);
  });
});

describe('AtrAnalyzerNew - State Management Tests', () => {
  test('should track last signal', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    const lastSignal = analyzer.getLastSignal();
    expect(lastSignal).toBe(signal);
  });

  test('should initially have null last signal', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state with all config values', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const state = analyzer.getState();
    expect(state.config.weight).toBe(config.weight);
    expect(state.config.priority).toBe(config.priority);
    expect(state.config.confidenceMultiplier).toBe(config.confidenceMultiplier);
    expect(state.config.maxConfidence).toBe(config.maxConfidence);
  });

  test('should reset state', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).not.toBeNull();
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('AtrAnalyzerNew - ATR Value Tests', () => {
  test('should retrieve ATR value', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const atr = analyzer.getAtrValue(candles);
    expect(typeof atr).toBe('number');
    expect(atr).toBeGreaterThan(0);
  });

  test('should throw on insufficient candles for ATR', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + i, 99 + i, 99.5 + i),
    );
    expect(() => analyzer.getAtrValue(candles)).toThrow('[ATR_ANALYZER] Not enough candles');
  });

  test('should have higher ATR in high volatility scenario', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const highVolCandles = createHighVolatilityCandles();
    const lowVolCandles = createLowVolatilityCandles();
    const highAtr = analyzer.getAtrValue(highVolCandles);
    analyzer.reset(); // Reset to clear state
    const lowAtr = analyzer.getAtrValue(lowVolCandles);
    expect(highAtr).toBeGreaterThan(lowAtr);
  });
});

describe('AtrAnalyzerNew - Volatility Detection Tests', () => {
  test('should detect high volatility with default threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    expect(analyzer.isHighVolatility(candles)).toBe(true);
  });

  test('should detect low volatility with default threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createLowVolatilityCandles();
    expect(analyzer.isLowVolatility(candles)).toBe(true);
  });

  test('should respect custom high volatility threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const atr = analyzer.getAtrValue(candles);
    expect(analyzer.isHighVolatility(candles, atr - 1)).toBe(true);
    expect(analyzer.isHighVolatility(candles, atr + 1)).toBe(false);
  });

  test('should respect custom low volatility threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createLowVolatilityCandles();
    const atr = analyzer.getAtrValue(candles);
    expect(analyzer.isLowVolatility(candles, atr + 1)).toBe(true);
    expect(analyzer.isLowVolatility(candles, atr - 1)).toBe(false);
  });
});

describe('AtrAnalyzerNew - Edge Cases Tests', () => {
  test('should handle very large price values', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = Array.from({ length: 50 }, (_, i) =>
      createCandle(100000 + i * 100, 100000 + i * 100 - 500, 100000 + i * 100 - 100),
    );
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
    expect([SignalDirection.LONG, SignalDirection.SHORT, SignalDirection.HOLD]).toContain(
      signal.direction,
    );
  });

  test('should handle very small price values', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);
    const candles = Array.from({ length: 50 }, (_, i) =>
      createCandle(0.001 + i * 0.0001, 0.0005 + i * 0.0001, 0.0008 + i * 0.0001),
    );
    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle zero weight', () => {
    const config = { ...createDefaultConfig(), weight: 0 };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle minimum maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 0.01 };
    const analyzer = new AtrAnalyzerNew(config);
    const candles = createHighVolatilityCandles();
    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });
});

describe('AtrAnalyzerNew - Multiple Analysis Tests', () => {
  test('should handle sequential analyses with different volatility levels', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    const highVolCandles = createHighVolatilityCandles();
    const signal1 = analyzer.analyze(highVolCandles);
    expect(signal1.direction).toBe(SignalDirection.LONG);

    const lowVolCandles = createLowVolatilityCandles();
    const signal2 = analyzer.analyze(lowVolCandles);
    expect(signal2.direction).toBe(SignalDirection.SHORT);
  });

  test('should maintain consistent config across multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new AtrAnalyzerNew(config);

    const candles = createHighVolatilityCandles();

    analyzer.analyze(candles);
    const state1 = analyzer.getState();

    analyzer.analyze(candles);
    const state2 = analyzer.getState();

    expect(state1.config.weight).toBe(state2.config.weight);
    expect(state1.config.priority).toBe(state2.config.priority);
    expect(state1.config.confidenceMultiplier).toBe(state2.config.confidenceMultiplier);
    expect(state1.config.maxConfidence).toBe(state2.config.maxConfidence);
  });
});
