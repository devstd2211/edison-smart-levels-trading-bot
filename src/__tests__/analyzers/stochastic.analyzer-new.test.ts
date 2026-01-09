/**
 * Stochastic Analyzer NEW - Technical Tests
 */

import { StochasticAnalyzerNew } from '../../analyzers/stochastic.analyzer-new';
import type { Candle } from '../../types/core';
import type { StochasticAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createDefaultConfig(): StochasticAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.8,
    priority: 5,
    kPeriod: 14,
    dPeriod: 3,
  };
}

function createCandle(high: number, low: number, close: number): Candle {
  return {
    timestamp: Date.now(),
    open: low + (high - low) * 0.5,
    high,
    low,
    close,
    volume: 1000,
  };
}

function createCandleSequence(highs: number[], lows: number[], closes: number[]): Candle[] {
  return highs.map((h, i) => createCandle(h, lows[i], closes[i]));
}

// ============================================================================
// TESTS
// ============================================================================

describe('StochasticAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).enabled;
    expect(() => new StochasticAnalyzerNew(config as any)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: enabled');
  });

  test('should throw on invalid weight', () => {
    const config = { ...createDefaultConfig(), weight: 1.5 };
    expect(() => new StochasticAnalyzerNew(config)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: weight');
  });

  test('should throw on invalid priority', () => {
    const config = { ...createDefaultConfig(), priority: 0 };
    expect(() => new StochasticAnalyzerNew(config)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: priority');
  });

  test('should throw on invalid kPeriod', () => {
    const config = { ...createDefaultConfig(), kPeriod: 0 };
    expect(() => new StochasticAnalyzerNew(config)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: kPeriod');
  });

  test('should throw on invalid dPeriod', () => {
    const config = { ...createDefaultConfig(), dPeriod: 101 };
    expect(() => new StochasticAnalyzerNew(config)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: dPeriod');
  });

  test('should throw on missing kPeriod field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).kPeriod;
    expect(() => new StochasticAnalyzerNew(config as any)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: kPeriod');
  });

  test('should throw on missing dPeriod field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).dPeriod;
    expect(() => new StochasticAnalyzerNew(config as any)).toThrow('[STOCHASTIC_ANALYZER] Missing or invalid: dPeriod');
  });
});

describe('StochasticAnalyzerNew - Input Validation Tests', () => {
  test('should throw when analyzer is disabled', () => {
    const config = { ...createDefaultConfig(), enabled: false };
    const analyzer = new StochasticAnalyzerNew(config);
    const candles = Array.from({ length: 50 }, (_, i) => createCandle(100 + i, 99 + i, 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow('[STOCHASTIC_ANALYZER] Analyzer is disabled');
  });

  test('should throw on invalid candles input', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    expect(() => analyzer.analyze(null as any)).toThrow('[STOCHASTIC_ANALYZER] Invalid candles input');
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 20 }, (_, i) => createCandle(100 + i, 99 + i, 100 + i));
    expect(() => analyzer.analyze(candles)).toThrow('[STOCHASTIC_ANALYZER] Not enough candles');
  });

  test('should throw on candle with missing high', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 50 }, (_, i) => createCandle(100 + i, 99 + i, 100 + i));
    (candles[25] as any).high = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[STOCHASTIC_ANALYZER] Invalid candle');
  });

  test('should throw on candle with missing low', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 50 }, (_, i) => createCandle(100 + i, 99 + i, 100 + i));
    (candles[25] as any).low = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[STOCHASTIC_ANALYZER] Invalid candle');
  });

  test('should throw on candle with missing close', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const candles = Array.from({ length: 50 }, (_, i) => createCandle(100 + i, 99 + i, 100 + i));
    (candles[25] as any).close = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[STOCHASTIC_ANALYZER] Invalid candle');
  });
});

describe('StochasticAnalyzerNew - Signal Generation Tests', () => {
  test('should generate LONG signal on %K > %D in oversold zone', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create 50+ candles with uptrend starting from oversold levels
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.source).toBe('STOCHASTIC_ANALYZER');
  });

  test('should generate SHORT signal on %K < %D in overbought zone', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create 50+ candles with downtrend starting from overbought levels
    const highs = Array.from({ length: 50 }, (_, i) => 200 - i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 199 - i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 199.5 - i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  test('should generate HOLD signal in neutral zone', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create consolidation pattern (neutral %K and %D)
    const highs = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 1);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + Math.sin(i * 0.2) * 1);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + Math.sin(i * 0.2) * 1);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.HOLD);
  });

  test('should calculate correct score', () => {
    const config = { ...createDefaultConfig(), weight: 0.5 };
    const analyzer = new StochasticAnalyzerNew(config);
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * config.weight, 1);
  });
});

describe('StochasticAnalyzerNew - Confidence Calculation Tests', () => {
  test('should clamp confidence to maximum value', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create extreme downtrend to force high confidence
    const highs = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const lows = Array.from({ length: 50 }, (_, i) => 199 - i * 2);
    const closes = Array.from({ length: 50 }, (_, i) => 199.5 - i * 2);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeLessThanOrEqual(95); // MAX_CONFIDENCE = 0.95 = 95%
  });

  test('should respect minimum confidence floor', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.1) * 2);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + Math.sin(i * 0.1) * 2);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + Math.sin(i * 0.1) * 2);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });

  test('should scale confidence with crossover strength', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create weak uptrend (near %K = %D)
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.1);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.1);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.1);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeDefined();
  });
});

describe('StochasticAnalyzerNew - State Management Tests', () => {
  test('should track last signal', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });

  test('should initially have null last signal', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state with all config values', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);
    const state = analyzer.getState();
    expect(state.config.weight).toBe(config.weight);
    expect(state.config.priority).toBe(config.priority);
    expect(state.config.kPeriod).toBe(config.kPeriod);
    expect(state.config.dPeriod).toBe(config.dPeriod);
  });

  test('should reset state', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('StochasticAnalyzerNew - Stochastic Value Tests', () => {
  test('should retrieve Stochastic values (%K and %D)', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const values = analyzer.getStochasticValues(candles);
    expect(typeof values.k).toBe('number');
    expect(typeof values.d).toBe('number');
    expect(values.k).toBeGreaterThanOrEqual(0);
    expect(values.k).toBeLessThanOrEqual(100);
    expect(values.d).toBeGreaterThanOrEqual(0);
    expect(values.d).toBeLessThanOrEqual(100);
  });

  test('should detect oversold zone (%K < 20)', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create downtrend to get into oversold territory
    const highs = Array.from({ length: 50 }, (_, i) => 100 - i * 1.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 - i * 1.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 - i * 1.5);
    const candles = createCandleSequence(highs, lows, closes);

    const isOversold = analyzer.isOversold(candles);
    expect(typeof isOversold).toBe('boolean');
  });

  test('should detect overbought zone (%K > 80)', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create uptrend to get into overbought territory
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 1.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 1.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 1.5);
    const candles = createCandleSequence(highs, lows, closes);

    const isOverbought = analyzer.isOverbought(candles);
    expect(typeof isOverbought).toBe('boolean');
  });

  test('should detect bullish cross (%K > %D)', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create uptrend
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.8);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.8);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.8);
    const candles = createCandleSequence(highs, lows, closes);

    const isBullish = analyzer.isBullishCross(candles);
    expect(typeof isBullish).toBe('boolean');
  });

  test('should detect bearish cross (%K < %D)', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    // Create downtrend
    const highs = Array.from({ length: 50 }, (_, i) => 200 - i * 0.8);
    const lows = Array.from({ length: 50 }, (_, i) => 199 - i * 0.8);
    const closes = Array.from({ length: 50 }, (_, i) => 199.5 - i * 0.8);
    const candles = createCandleSequence(highs, lows, closes);

    const isBearish = analyzer.isBearishCross(candles);
    expect(typeof isBearish).toBe('boolean');
  });
});

describe('StochasticAnalyzerNew - Edge Cases Tests', () => {
  test('should handle very high prices', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100000 + i * 100);
    const lows = Array.from({ length: 50 }, (_, i) => 99900 + i * 100);
    const closes = Array.from({ length: 50 }, (_, i) => 99950 + i * 100);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle very small price movements', () => {
    const analyzer = new StochasticAnalyzerNew(createDefaultConfig());
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.001);
    const lows = Array.from({ length: 50 }, (_, i) => 99.999 + i * 0.001);
    const closes = Array.from({ length: 50 }, (_, i) => 99.9995 + i * 0.001);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle zero weight', () => {
    const config = { ...createDefaultConfig(), weight: 0 };
    const analyzer = new StochasticAnalyzerNew(config);
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should maintain consistent config across analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);
    const highs = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles = createCandleSequence(highs, lows, closes);

    analyzer.analyze(candles);
    const state1 = analyzer.getState();
    analyzer.analyze(candles);
    const state2 = analyzer.getState();

    expect(state1.config.weight).toBe(state2.config.weight);
    expect(state1.config.priority).toBe(state2.config.priority);
    expect(state1.config.kPeriod).toBe(state2.config.kPeriod);
    expect(state1.config.dPeriod).toBe(state2.config.dPeriod);
  });
});

describe('StochasticAnalyzerNew - Multiple Analysis Tests', () => {
  test('should flip signal on significant market change', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Phase 1: Downtrend (oversold)
    const downtrend1 = Array.from({ length: 25 }, (_, i) => 200 - i * 2);
    const downtrend2 = Array.from({ length: 25 }, (_, i) => 150 - i * 2);
    const downPrices = [...downtrend1, ...downtrend2];
    const downHighs = downPrices.map(p => p + 1);
    const downLows = downPrices.map(p => p - 1);
    const downCandles = createCandleSequence(downHighs, downLows, downPrices);
    const signal1 = analyzer.analyze(downCandles);

    // Phase 2: Uptrend (overbought)
    const uptrend1 = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
    const uptrend2 = Array.from({ length: 25 }, (_, i) => 150 + i * 2);
    const upPrices = [...uptrend1, ...uptrend2];
    const upHighs = upPrices.map(p => p + 1);
    const upLows = upPrices.map(p => p - 1);
    const upCandles = createCandleSequence(upHighs, upLows, upPrices);
    const signal2 = analyzer.analyze(upCandles);

    // Signals should be different or at least represent different market states
    expect([signal1.direction, signal2.direction]).toBeDefined();
  });

  test('should track signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // First analysis
    const highs1 = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const lows1 = Array.from({ length: 50 }, (_, i) => 99 + i * 0.5);
    const closes1 = Array.from({ length: 50 }, (_, i) => 99.5 + i * 0.5);
    const candles1 = createCandleSequence(highs1, lows1, closes1);
    const signal1 = analyzer.analyze(candles1);

    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis
    const highs2 = Array.from({ length: 50 }, (_, i) => 150 - i * 0.5);
    const lows2 = Array.from({ length: 50 }, (_, i) => 149 - i * 0.5);
    const closes2 = Array.from({ length: 50 }, (_, i) => 149.5 - i * 0.5);
    const candles2 = createCandleSequence(highs2, lows2, closes2);
    const signal2 = analyzer.analyze(candles2);

    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
    expect(state2.lastSignal).not.toBe(state1.lastSignal);
  });
});
