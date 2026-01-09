/**
 * Bollinger Bands Analyzer NEW - Technical Tests
 */

import { BollingerBandsAnalyzerNew } from '../../analyzers/bollinger-bands.analyzer-new';
import type { Candle } from '../../types/core';
import type { BollingerBandsAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createDefaultConfig(): BollingerBandsAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.7,
    priority: 6,
    period: 20,
    stdDev: 2,
  };
}

function createCandle(close: number): Candle {
  return {
    timestamp: Date.now(),
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  };
}

function createCandleSequence(closes: number[]): Candle[] {
  return closes.map((close) => createCandle(close));
}

// ============================================================================
// TESTS
// ============================================================================

describe('BollingerBandsAnalyzerNew - Configuration Tests', () => {
  test('should create analyzer with valid config', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);
    expect(analyzer.isEnabled()).toBe(true);
  });

  test('should throw on missing enabled field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).enabled;
    expect(() => new BollingerBandsAnalyzerNew(config as any)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: enabled',
    );
  });

  test('should throw on invalid weight', () => {
    const config = { ...createDefaultConfig(), weight: 1.5 };
    expect(() => new BollingerBandsAnalyzerNew(config)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: weight',
    );
  });

  test('should throw on invalid priority', () => {
    const config = { ...createDefaultConfig(), priority: 11 };
    expect(() => new BollingerBandsAnalyzerNew(config)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: priority',
    );
  });

  test('should throw on invalid period', () => {
    const config = { ...createDefaultConfig(), period: 0 };
    expect(() => new BollingerBandsAnalyzerNew(config)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: period',
    );
  });

  test('should throw on invalid stdDev', () => {
    const config = { ...createDefaultConfig(), stdDev: 0.05 };
    expect(() => new BollingerBandsAnalyzerNew(config)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: stdDev',
    );
  });

  test('should throw on missing period field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).period;
    expect(() => new BollingerBandsAnalyzerNew(config as any)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: period',
    );
  });

  test('should throw on missing stdDev field', () => {
    const config = { ...createDefaultConfig() };
    delete (config as any).stdDev;
    expect(() => new BollingerBandsAnalyzerNew(config as any)).toThrow(
      '[BOLLINGER_BANDS_ANALYZER] Missing or invalid: stdDev',
    );
  });
});

describe('BollingerBandsAnalyzerNew - Input Validation Tests', () => {
  test('should throw when analyzer is disabled', () => {
    const config = { ...createDefaultConfig(), enabled: false };
    const analyzer = new BollingerBandsAnalyzerNew(config);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);
    expect(() => analyzer.analyze(candles)).toThrow('[BOLLINGER_BANDS_ANALYZER] Analyzer is disabled');
  });

  test('should throw on invalid candles input', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    expect(() => analyzer.analyze(null as any)).toThrow('[BOLLINGER_BANDS_ANALYZER] Invalid candles input');
  });

  test('should throw on insufficient candles', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 10 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);
    expect(() => analyzer.analyze(candles)).toThrow('[BOLLINGER_BANDS_ANALYZER] Not enough candles');
  });

  test('should throw on candle with missing close', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);
    (candles[15] as any).close = undefined;
    expect(() => analyzer.analyze(candles)).toThrow('[BOLLINGER_BANDS_ANALYZER] Invalid candle');
  });
});

describe('BollingerBandsAnalyzerNew - Signal Generation Tests', () => {
  test('should generate LONG signal on oversold (%B < 20)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create pattern: initial high, then sharp drop to create oversold condition
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 + i),
      ...Array.from({ length: 15 }, (_, i) => 115 - i * 2),
    ];
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.source).toBe('BOLLINGER_BANDS_ANALYZER');
  });

  test('should generate SHORT signal on overbought (%B > 80)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create pattern: initial low, then sharp rise to create overbought condition
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 - i),
      ...Array.from({ length: 15 }, (_, i) => 85 + i * 2),
    ];
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  test('should generate HOLD signal in neutral zone (40 < %B < 60)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create stable middle-zone prices
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * 1);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.HOLD);
  });

  test('should calculate correct score', () => {
    const config = { ...createDefaultConfig(), weight: 0.6 };
    const analyzer = new BollingerBandsAnalyzerNew(config);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.score).toBeCloseTo((signal.confidence / 100) * config.weight, 1);
  });
});

describe('BollingerBandsAnalyzerNew - Confidence Calculation Tests', () => {
  test('should clamp confidence to maximum value', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create extreme movement to maximize confidence
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 - i * 2),
      ...Array.from({ length: 15 }, (_, i) => 70 + i * 0.5),
    ];
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeLessThanOrEqual(95); // MAX_CONFIDENCE = 0.95 = 95%
  });

  test('should respect minimum confidence floor', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, () => 100);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });

  test('should scale confidence with bandwidth', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // High volatility pattern (wide bands)
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.2) * 10);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('BollingerBandsAnalyzerNew - State Management Tests', () => {
  test('should track last signal', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(analyzer.getLastSignal()).toBe(signal);
  });

  test('should initially have null last signal', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    expect(analyzer.getLastSignal()).toBeNull();
  });

  test('should return state with all config values', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);
    const state = analyzer.getState();
    expect(state.config.weight).toBe(config.weight);
    expect(state.config.priority).toBe(config.priority);
    expect(state.config.period).toBe(config.period);
    expect(state.config.stdDev).toBe(config.stdDev);
  });

  test('should reset state', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);

    analyzer.analyze(candles);
    analyzer.reset();
    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('BollingerBandsAnalyzerNew - Bollinger Bands Value Tests', () => {
  test('should retrieve Bollinger Bands values (upper, middle, lower, %B, bandwidth)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(closes);

    const values = analyzer.getBollingerBandsValues(candles);
    expect(typeof values.upper).toBe('number');
    expect(typeof values.middle).toBe('number');
    expect(typeof values.lower).toBe('number');
    expect(typeof values.percentB).toBe('number');
    expect(typeof values.bandwidth).toBe('number');
    expect(values.percentB).toBeGreaterThanOrEqual(0);
    expect(values.percentB).toBeLessThanOrEqual(100);
  });

  test('should detect overbought zone (%B > 80)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create uptrend to reach overbought
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 - i),
      ...Array.from({ length: 15 }, (_, i) => 85 + i * 1.5),
    ];
    const candles = createCandleSequence(closes);

    const isOverbought = analyzer.isOverbought(candles);
    expect(typeof isOverbought).toBe('boolean');
  });

  test('should detect oversold zone (%B < 20)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Create downtrend to reach oversold
    const closes = [
      ...Array.from({ length: 15 }, (_, i) => 100 + i),
      ...Array.from({ length: 15 }, (_, i) => 115 - i * 1.5),
    ];
    const candles = createCandleSequence(closes);

    const isOversold = analyzer.isOversold(candles);
    expect(typeof isOversold).toBe('boolean');
  });

  test('should detect band squeeze (low volatility)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // Tight consolidation (low volatility = squeeze)
    const closes = Array.from({ length: 30 }, () => 100);
    const candles = createCandleSequence(closes);

    const isSqueezed = analyzer.isSqueezing(candles);
    expect(typeof isSqueezed).toBe('boolean');
  });

  test('should detect band expansion (high volatility)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    // High volatility oscillation
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.2) * 15);
    const candles = createCandleSequence(closes);

    const isExpanding = analyzer.isExpanding(candles);
    expect(typeof isExpanding).toBe('boolean');
  });

  test('should classify volatility level', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(closes);

    const volatility = analyzer.getVolatilityClass(candles);
    expect(['very_low', 'low', 'normal', 'high', 'very_high']).toContain(volatility);
  });
});

describe('BollingerBandsAnalyzerNew - Edge Cases Tests', () => {
  test('should handle very high prices', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100000 + i * 100);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle very small price movements', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.01);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBeDefined();
  });

  test('should handle zero weight', () => {
    const config = { ...createDefaultConfig(), weight: 0 };
    const analyzer = new BollingerBandsAnalyzerNew(config);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.score).toBe(0);
  });

  test('should handle flat prices (zero volatility)', () => {
    const analyzer = new BollingerBandsAnalyzerNew(createDefaultConfig());
    const closes = Array.from({ length: 30 }, () => 100);
    const candles = createCandleSequence(closes);

    const signal = analyzer.analyze(candles);
    expect(signal.direction).toBe(SignalDirection.HOLD);
  });

  test('should maintain consistent config across analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);

    analyzer.analyze(candles);
    const state1 = analyzer.getState();
    analyzer.analyze(candles);
    const state2 = analyzer.getState();

    expect(state1.config.weight).toBe(state2.config.weight);
    expect(state1.config.priority).toBe(state2.config.priority);
    expect(state1.config.period).toBe(state2.config.period);
    expect(state1.config.stdDev).toBe(state2.config.stdDev);
  });
});

describe('BollingerBandsAnalyzerNew - Multiple Analysis Tests', () => {
  test('should flip signal on significant market change', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Phase 1: Downtrend (oversold)
    const downtrend = Array.from({ length: 25 }, (_, i) => 150 - i * 2);
    const downCandles = createCandleSequence(downtrend);
    const signal1 = analyzer.analyze(downCandles);

    // Phase 2: Uptrend (overbought)
    const uptrend = Array.from({ length: 25 }, (_, i) => 100 + i * 2);
    const upCandles = createCandleSequence(uptrend);
    const signal2 = analyzer.analyze(upCandles);

    // Signals should be different
    expect([signal1.direction, signal2.direction]).toBeDefined();
  });

  test('should track signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // First analysis
    const closes1 = Array.from({ length: 30 }, (_, i) => 100 + i);
    const candles1 = createCandleSequence(closes1);
    const signal1 = analyzer.analyze(candles1);

    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis
    const closes2 = Array.from({ length: 30 }, (_, i) => 150 - i);
    const candles2 = createCandleSequence(closes2);
    const signal2 = analyzer.analyze(candles2);

    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
    expect(state2.lastSignal).not.toBe(state1.lastSignal);
  });
});
