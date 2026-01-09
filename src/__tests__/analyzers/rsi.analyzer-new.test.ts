/**
 * RSI Analyzer NEW - Technical Tests
 * Validates configuration, input handling, and core functionality
 */

import { RsiAnalyzerNew } from '../../analyzers/rsi.analyzer-new';
import type { Candle } from '../../types/core';
import type { RsiAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandle(close: number, high?: number, low?: number, open?: number): Candle {
  return {
    timestamp: Date.now(),
    open: open ?? close,
    high: high ?? close,
    low: low ?? close,
    close,
    volume: 1000,
  };
}

function createCandleSequence(startPrice: number, count: number, direction: 'up' | 'down' | 'flat'): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    if (direction === 'up') {
      price += 0.5;
    } else if (direction === 'down') {
      price -= 0.5;
    }

    candles.push({
      timestamp: Date.now() + i * 60000,
      open: price,
      high: price,
      low: price,
      close: price,
      volume: 1000,
    });
  }

  return candles;
}

function createDefaultConfig(): RsiAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.8,
    priority: 5,
    period: 14,
    oversold: 30,
    overbought: 70,
    maxConfidence: 0.95,
  };
}

// ============================================================================
// TECHNICAL TESTS
// ============================================================================

describe('RsiAnalyzerNew - Configuration Tests', () => {
  it('should create analyzer with valid config', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    expect(analyzer.isEnabled()).toBe(true);
  });

  it('should throw on missing enabled field', () => {
    const config = createDefaultConfig();
    delete (config as any).enabled;

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: enabled (boolean)');
  });

  it('should throw on invalid weight (negative)', () => {
    const config = { ...createDefaultConfig(), weight: -0.1 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: weight (0.0-1.0)');
  });

  it('should throw on invalid weight (> 1)', () => {
    const config = { ...createDefaultConfig(), weight: 1.5 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: weight (0.0-1.0)');
  });

  it('should throw on invalid priority', () => {
    const config = { ...createDefaultConfig(), priority: 11 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: priority (1-10)');
  });

  it('should throw on invalid period', () => {
    const config = { ...createDefaultConfig(), period: 150 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: period (1-100)');
  });

  it('should throw on invalid oversold threshold', () => {
    const config = { ...createDefaultConfig(), oversold: 60 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: oversold (0-50)');
  });

  it('should throw on invalid overbought threshold', () => {
    const config = { ...createDefaultConfig(), overbought: 40 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: overbought (50-100)');
  });

  it('should throw when oversold >= overbought', () => {
    const config = { ...createDefaultConfig(), oversold: 50, overbought: 50 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] oversold must be less than overbought');
  });

  it('should throw on invalid maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 1.5 };

    expect(() => new RsiAnalyzerNew(config)).toThrow('[RSI_ANALYZER] Missing or invalid: maxConfidence (0.0-1.0)');
  });
});

describe('RsiAnalyzerNew - Input Validation Tests', () => {
  it('should throw when analyzer is disabled', () => {
    const config = { ...createDefaultConfig(), enabled: false };
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');

    expect(() => analyzer.analyze(candles)).toThrow('[RSI_ANALYZER] Analyzer is disabled');
  });

  it('should throw on invalid candles input (not array)', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    expect(() => analyzer.analyze(null as any)).toThrow('[RSI_ANALYZER] Invalid candles input (must be array)');
  });

  it('should throw on insufficient candles', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 30, 'flat');

    expect(() => analyzer.analyze(candles)).toThrow('[RSI_ANALYZER] Not enough candles');
  });

  it('should throw on candle with missing close price', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'flat');
    candles[25].close = undefined as any;

    expect(() => analyzer.analyze(candles)).toThrow('[RSI_ANALYZER] Invalid candle at index');
  });
});

describe('RsiAnalyzerNew - Signal Generation Tests', () => {
  it('should generate LONG signal when RSI < oversold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong downtrend generates low RSI
    const candles = createCandleSequence(100, 50, 'down');

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.source).toBe('RSI_ANALYZER');
    expect(signal.weight).toBe(config.weight);
    expect(signal.priority).toBe(config.priority);
  });

  it('should generate SHORT signal when RSI > overbought', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong uptrend generates high RSI
    const candles = createCandleSequence(100, 50, 'up');

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.source).toBe('RSI_ANALYZER');
  });

  it('should generate HOLD signal when RSI in neutral zone', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Flat price generates neutral RSI
    const candles = createCandleSequence(100, 50, 'flat');

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
  });

  it('should calculate correct score from confidence and weight', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'down');
    const signal = analyzer.analyze(candles);

    // Score should be (confidence / 100) * weight
    const expectedScore = (signal.confidence / 100) * config.weight;
    expect(signal.score).toBeCloseTo(expectedScore, 2);
  });
});

describe('RsiAnalyzerNew - Confidence Calculation Tests', () => {
  it('should clamp confidence to maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 0.6 };
    const analyzer = new RsiAnalyzerNew(config);

    // Extreme downtrend would normally generate high confidence
    const candles = createCandleSequence(100, 50, 'down');
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeLessThanOrEqual(60); // 0.6 * 100
  });

  it('should respect minimum confidence floor', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Even neutral zone should have some confidence
    const candles = createCandleSequence(100, 50, 'flat');
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });

  it('should scale confidence with extremeness of RSI', () => {
    const config = createDefaultConfig();

    // Neutral-ish downtrend (just barely oversold)
    const mildAnalyzer = new RsiAnalyzerNew(config);
    const mildCandles = createCandleSequence(100, 50, 'flat');
    const mildSignal = mildAnalyzer.analyze(mildCandles);

    // Strong downtrend
    const strongAnalyzer = new RsiAnalyzerNew(config);
    const strongCandles = createCandleSequence(100, 60, 'down');
    const strongSignal = strongAnalyzer.analyze(strongCandles);

    // Strong should have higher confidence than flat
    expect(strongSignal.direction).toBe(SignalDirection.LONG);
    expect(strongSignal.confidence).toBeGreaterThanOrEqual(mildSignal.confidence);
  });
});

describe('RsiAnalyzerNew - State Management Tests', () => {
  it('should track last signal', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    const signal = analyzer.analyze(candles);

    expect(analyzer.getLastSignal()).toBe(signal);
  });

  it('should initially have null last signal', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    expect(analyzer.getLastSignal()).toBeNull();
  });

  it('should return state with all config values', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    analyzer.analyze(candles);

    const state = analyzer.getState();

    expect(state.enabled).toBe(true);
    expect(state.initialized).toBe(true);
    expect(state.config.weight).toBe(config.weight);
    expect(state.config.priority).toBe(config.priority);
    expect(state.config.period).toBe(config.period);
    expect(state.config.oversold).toBe(config.oversold);
    expect(state.config.overbought).toBe(config.overbought);
    expect(state.config.maxConfidence).toBe(config.maxConfidence);
  });

  it('should reset state', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    analyzer.analyze(candles);

    expect(analyzer.getLastSignal()).not.toBeNull();

    analyzer.reset();

    expect(analyzer.getLastSignal()).toBeNull();
  });
});

describe('RsiAnalyzerNew - RSI Value Tests', () => {
  it('should retrieve RSI value', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    const rsiValue = analyzer.getRsiValue(candles);

    expect(typeof rsiValue).toBe('number');
    expect(rsiValue).toBeGreaterThan(0);
    expect(rsiValue).toBeLessThanOrEqual(100);
  });

  it('should throw on insufficient candles for RSI', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 20, 'flat');

    expect(() => analyzer.getRsiValue(candles)).toThrow('[RSI_ANALYZER] Not enough candles for RSI calculation');
  });

  it('should have high RSI in uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const upCandles = createCandleSequence(100, 50, 'up');
    const upRsi = analyzer.getRsiValue(upCandles);

    const flatCandles = createCandleSequence(100, 50, 'flat');
    const flatRsi = analyzer.getRsiValue(flatCandles);

    expect(upRsi).toBeGreaterThan(flatRsi);
  });

  it('should have low RSI in downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const downCandles = createCandleSequence(100, 50, 'down');
    const downRsi = analyzer.getRsiValue(downCandles);

    const flatCandles = createCandleSequence(100, 50, 'flat');
    const flatRsi = analyzer.getRsiValue(flatCandles);

    expect(downRsi).toBeLessThan(flatRsi);
  });
});

describe('RsiAnalyzerNew - Overbought/Oversold Detection Tests', () => {
  it('should detect overbought with default threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');

    expect(analyzer.isOverbought(candles)).toBe(true);
  });

  it('should detect oversold with default threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'down');

    expect(analyzer.isOversold(candles)).toBe(true);
  });

  it('should respect custom overbought threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    const rsi = analyzer.getRsiValue(candles);

    // Test with threshold higher than actual RSI
    const highThreshold = rsi + 10;
    expect(analyzer.isOverbought(candles, highThreshold)).toBe(false);

    // Test with threshold lower than actual RSI
    const lowThreshold = rsi - 10;
    expect(analyzer.isOverbought(candles, lowThreshold)).toBe(true);
  });

  it('should respect custom oversold threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'down');
    const rsi = analyzer.getRsiValue(candles);

    // Test with threshold lower than actual RSI
    const lowThreshold = Math.max(0, rsi - 10);
    expect(analyzer.isOversold(candles, lowThreshold)).toBe(false);

    // Test with threshold higher than actual RSI
    const highThreshold = rsi + 10;
    expect(analyzer.isOversold(candles, highThreshold)).toBe(true);
  });
});

describe('RsiAnalyzerNew - Edge Cases Tests', () => {
  it('should handle very large prices', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100000, 50, 'up');
    const signal = analyzer.analyze(candles);

    expect(signal).toBeDefined();
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });

  it('should handle very small prices', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(0.001, 50, 'up');
    const signal = analyzer.analyze(candles);

    expect(signal).toBeDefined();
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });

  it('should handle zero weight', () => {
    const config = { ...createDefaultConfig(), weight: 0 };
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    const signal = analyzer.analyze(candles);

    expect(signal.score).toBe(0); // (confidence / 100) * 0 = 0
  });

  it('should handle minimum maxConfidence', () => {
    const config = { ...createDefaultConfig(), maxConfidence: 0.01 };
    const analyzer = new RsiAnalyzerNew(config);

    const candles = createCandleSequence(100, 50, 'up');
    const signal = analyzer.analyze(candles);

    // Confidence will be clamped to MIN_CONFIDENCE (0.1 = 10%) even if maxConfidence is lower
    expect(signal.confidence).toBeGreaterThanOrEqual(10); // MIN_CONFIDENCE = 0.1 = 10%
  });
});

describe('RsiAnalyzerNew - Multiple Analysis Tests', () => {
  it('should handle sequential analyses with different trends', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // First analysis: downtrend
    const downCandles = createCandleSequence(100, 50, 'down');
    const downSignal = analyzer.analyze(downCandles);
    expect(downSignal.direction).toBe(SignalDirection.LONG);

    // Second analysis: uptrend
    const upCandles = createCandleSequence(100, 50, 'up');
    const upSignal = analyzer.analyze(upCandles);
    expect(upSignal.direction).toBe(SignalDirection.SHORT);

    // Last signal should be updated
    expect(analyzer.getLastSignal()).toBe(upSignal);
  });

  it('should maintain consistent config across multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    const candles1 = createCandleSequence(100, 50, 'up');
    analyzer.analyze(candles1);

    const candles2 = createCandleSequence(200, 50, 'down');
    analyzer.analyze(candles2);

    const retrievedConfig = analyzer.getConfig();
    expect(retrievedConfig.period).toBe(config.period);
    expect(retrievedConfig.oversold).toBe(config.oversold);
    expect(retrievedConfig.overbought).toBe(config.overbought);
    expect(retrievedConfig.maxConfidence).toBe(config.maxConfidence);
  });
});
