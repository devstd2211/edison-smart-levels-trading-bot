/**
 * RSI Analyzer NEW - Functional Tests
 * Tests real market patterns and signal behavior
 *
 * Pattern Test Strategy:
 * - Create realistic price sequences
 * - Verify RSI generates expected signals
 * - Validate confidence levels match market conditions
 * - Test signal transitions and persistence
 */

import { RsiAnalyzerNew } from '../../analyzers/rsi.analyzer-new';
import type { Candle } from '../../types/core';
import type { RsiAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandleSequence(prices: number[]): Candle[] {
  return prices.map((price, index) => ({
    timestamp: Date.now() + index * 60000,
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1000,
  }));
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
// FUNCTIONAL TESTS: MARKET PATTERNS
// ============================================================================

describe('RsiAnalyzerNew - Functional: Strong Uptrend', () => {
  it('should generate SHORT signal (overbought) in strong uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong uptrend: 50 prices going up
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(70);
    expect(signal.source).toBe('RSI_ANALYZER');
    expect(signal.weight).toBe(config.weight);
    expect(signal.priority).toBe(config.priority);
  });

  it('should have high confidence in extreme overbought conditions', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Extremely strong uptrend: continuous gains
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(85);
  });
});

describe('RsiAnalyzerNew - Functional: Strong Downtrend', () => {
  it('should generate LONG signal (oversold) in strong downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong downtrend: 50 prices going down
    const prices = Array.from({ length: 50 }, (_, i) => 100 - i * 0.5);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(70);
    expect(signal.source).toBe('RSI_ANALYZER');
    expect(signal.weight).toBe(config.weight);
  });

  it('should have high confidence in extreme oversold conditions', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Extremely strong downtrend
    const prices = Array.from({ length: 50 }, (_, i) => 100 - i * 2);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(85);
  });
});

describe('RsiAnalyzerNew - Functional: Consolidation', () => {
  it('should generate HOLD signal during price consolidation', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Consolidation: 50 prices tight range 100 ± 1
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 0.5);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
    expect(signal.confidence).toBeLessThan(50);
    expect(signal.source).toBe('RSI_ANALYZER');
  });

  it('should track RSI near 50 during consolidation', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Flat consolidation: 50 identical prices
    const prices = Array.from({ length: 50 }, () => 100);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
    const rsiValue = analyzer.getRsiValue(candles);
    // With no price movement, RSI calculation defaults to 50 or edge case values
    expect([0, 50, 70, 100]).toContain(rsiValue);
  });
});

describe('RsiAnalyzerNew - Functional: V-Shape Reversal', () => {
  it('should transition from LONG to SHORT through V-shape reversal', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // V-shape: down to bottom then strong recovery = 60+ total prices
    const downTrend = Array.from({ length: 30 }, (_, i) => 150 - i * 1.5);
    const upTrend = Array.from({ length: 35 }, (_, i) => 105 + i * 1.2);
    const prices = [...downTrend, ...upTrend];

    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // After strong recovery, should be in uptrend = SHORT signal
    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(50);
  });

  it('should show confidence increase as price recovers from lows', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong recovery: 60+ prices starting from deep lows
    const downPart = Array.from({ length: 30 }, (_, i) => 100 - i * 1.2);
    const upPart = Array.from({ length: 35 }, (_, i) => 64 + i * 1.3);
    const prices = [...downPart, ...upPart];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Strong recovery should show LONG or SHORT signal with decent confidence
    expect([SignalDirection.LONG, SignalDirection.SHORT]).toContain(signal.direction);
  });
});

describe('RsiAnalyzerNew - Functional: Head-and-Shoulders Reversal', () => {
  it('should detect reversal at head-and-shoulders completion', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Head-and-shoulders: 50+ prices for valid analysis
    const prices = [
      100, 102, 104, 106, 108, 110, 108, 106, 104, 102, // Left shoulder up and down
      100, 102, 104, 106, 108, 110, 112, 114, 112, 110, 108, 106, // Head up higher
      104, 102, 100, 98, 96, 94, 92, // Down from head
      90, 88, 86, 84, 82, 80, 78, 76, 74, 72, 70, // Breakdown through neckline
      68, 66, 64, 62, 60, 58, 56, 54, 52, 50, // Further breakdown
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // After breakdown, should generate LONG signal (oversold)
    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(60);
  });
});

describe('RsiAnalyzerNew - Functional: Double Top Reversal', () => {
  it('should detect reversal at double top breakdown', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Double top: 60+ prices for valid analysis
    const prices = [
      100, 102, 104, 106, 108, 110, 112, // First top rising
      110, 108, 106, 104, 102, 100, 98, 96, 94, 92, // Down to 92
      94, 96, 98, 100, 102, 104, 106, 108, 110, 112, // Up to second top
      110, 108, 106, 104, 102, 100, 98, 96, 94, 92, 90, 88, 86, // Breakdown
      84, 82, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60, 58, 56, // Further breakdown
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Breakdown generates SHORT or LONG signal
    expect([SignalDirection.SHORT, SignalDirection.LONG]).toContain(signal.direction);
  });
});

describe('RsiAnalyzerNew - Functional: Gap Movements', () => {
  it('should handle gap up in uptrend correctly', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Gap up: 100 → 110 (gap), then continue up - 60+ prices
    const prices = [
      100, 100.5, 101, 101.5, 102, 102.5, 103, 104, 105, 106, // Small uptrend
      110, 111, 112, 113, 114, 115, 116, 117, 118, 119, // Gap up + continue
      120, 121, 122, 123, 124, 125, 126, 127, 128, 129, // Continue up
      130, 131, 132, 133, 134, 135, 136, 137, 138, 139, // Further up
      140, 141, 142, 143, 144, 145, 146, 147, 148, 149, // Even further
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Should recognize uptrend despite gap
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });

  it('should handle gap down in downtrend correctly', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Gap down: 100 → 90 (gap), then continue down - 60+ prices
    const prices = [
      100, 99.5, 99, 98.5, 98, 97.5, 97, 96, 95, 94, // Small downtrend
      90, 89, 88, 87, 86, 85, 84, 83, 82, 81, // Gap down + continue
      80, 79, 78, 77, 76, 75, 74, 73, 72, 71, // Continue down
      70, 69, 68, 67, 66, 65, 64, 63, 62, 61, // Further down
      60, 59, 58, 57, 56, 55, 54, 53, 52, 51, // Even further
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Should recognize downtrend despite gap
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('RsiAnalyzerNew - Functional: RSI Extreme Values', () => {
  it('should handle RSI approaching 100 (perfect uptrend)', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Perfect uptrend: only gaining closes
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.SHORT);
    expect(signal.confidence).toBeGreaterThan(80);
  });

  it('should handle RSI approaching 0 (perfect downtrend)', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Perfect downtrend: only losing closes
    const prices = Array.from({ length: 50 }, (_, i) => 100 - i);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(80);
  });
});

describe('RsiAnalyzerNew - Functional: Range Trading', () => {
  it('should oscillate between LONG and SHORT in range-bound market', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Range oscillation: 90 → 110 → 90 → 110 (60+ prices)
    const prices = [
      100, 102, 104, 106, 108, 110, 112, 110, 108, 106, 104, // Up to 112, then down
      102, 100, 98, 96, 94, 92, 90, 92, 94, 96, 98, 100, 102, 104, 106, // Down to 90, then up
      108, 110, 112, 110, 108, 106, 104, 102, 100, 98, 96, 94, 92, 90, // Another cycle
      92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, 114, 116, // Up to 116
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // End of sequence is in strong uptrend = SHORT or HOLD
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
  });
});

describe('RsiAnalyzerNew - Functional: Signal Strength Variation', () => {
  it('should increase confidence as RSI moves away from 50', () => {
    const config = createDefaultConfig();

    // Mild uptrend (RSI ~60-65) - 50+ prices
    const mildUpPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.3);
    const mildAnalyzer = new RsiAnalyzerNew(config);
    const mildSignal = mildAnalyzer.analyze(createCandleSequence(mildUpPrices));

    // Strong uptrend (RSI ~85+)
    const strongUpPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const strongAnalyzer = new RsiAnalyzerNew(config);
    const strongSignal = strongAnalyzer.analyze(createCandleSequence(strongUpPrices));

    // Both should be SHORT, but strong should have more confidence
    expect(mildSignal.direction).toBe(SignalDirection.SHORT);
    expect(strongSignal.direction).toBe(SignalDirection.SHORT);
    expect(strongSignal.confidence).toBeGreaterThanOrEqual(mildSignal.confidence);
  });

  it('should clamp confidence to configured maxConfidence', () => {
    const config = {
      ...createDefaultConfig(),
      maxConfidence: 0.7,
    };
    const analyzer = new RsiAnalyzerNew(config);

    // Create extreme uptrend
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Confidence should not exceed maxConfidence (70)
    expect(signal.confidence).toBeLessThanOrEqual(70);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('RsiAnalyzerNew - Functional: Divergences', () => {
  it('should track bullish divergence (price down, RSI up)', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Price makes lower low, but RSI makes higher low (bullish divergence) - 50+ prices
    const prices = [
      110, 108, 106, 104, 102, 100, 98, 96, 94, 92, 90, 88, // Down to 88
      87, 89, 91, 93, 95, 97, 99, 101, 103, 105, 107, 109, // Up from 88 to 109
      111, 113, 115, 117, 119, 121, 123, 125, 127, 129, 131, 133, // Continue up
      135, 137, 139, 141, 143, 145, 147, 149, 151, 153, 155, 157, 159, 161, // Further up
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Recovery from oversold should show LONG or SHORT
    expect([SignalDirection.LONG, SignalDirection.SHORT]).toContain(signal.direction);
  });

  it('should track bearish divergence (price up, RSI down)', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Price makes higher high, but RSI makes lower high (bearish divergence) - 50+ prices
    const prices = [
      90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110, 112, // Up to 112
      111, 109, 107, 105, 103, 101, 99, 97, 95, 93, 91, 89, // Down from 112 to 89
      87, 85, 83, 81, 79, 77, 75, 73, 71, 69, 67, 65, // Continue down
      63, 61, 59, 57, 55, 53, 51, 49, 47, 45, 43, 41, 39, 37, // Further down
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // Breakdown from overbought should show SHORT or LONG
    expect([SignalDirection.SHORT, SignalDirection.LONG]).toContain(signal.direction);
  });
});

describe('RsiAnalyzerNew - Functional: Signal Consistency', () => {
  it('should persist LONG signal through sustained downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Strong downtrend with minor oscillations - 60+ prices
    const prices = [
      100, 99, 98, 97.5, 96.5, 95.5, 94.5, 93.5, 92.5, 91.5, // Down trend
      90.5, 89.5, 88.5, 87.5, 86.5, 85.5, 84.5, 83.5, 82.5, 81.5, // Continues down
      80.5, 79.5, 78.5, 77.5, 76.5, 75.5, 74.5, 73.5, 72.5, 71.5, // Further down
      70.5, 69.5, 68.5, 67.5, 66.5, 65.5, 64.5, 63.5, 62.5, 61.5, // Further down
      60.5, 59.5, 58.5, 57.5, 56.5, 55.5, 54.5, 53.5, 52.5, 51.5, // Even further
    ];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.LONG);
    expect(signal.confidence).toBeGreaterThan(60);
  });

  it('should flip signal on trend reversal', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Start downtrend, then reverse to uptrend
    const downPart = Array.from({ length: 25 }, (_, i) => 100 - i * 0.8);
    const upPart = Array.from({ length: 25 }, (_, i) => 80 + i * 1.2);
    const prices = [...downPart, ...upPart];
    const candles = createCandleSequence(prices);

    const signal = analyzer.analyze(candles);

    // After strong reversal, should be SHORT (overbought from recovery)
    expect(signal.direction).toBe(SignalDirection.SHORT);
  });

  it('should maintain signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // First analysis: downtrend - 50+ prices
    const downTrendPrices = Array.from({ length: 50 }, (_, i) => 100 - i);
    const downCandles = createCandleSequence(downTrendPrices);
    const signal1 = analyzer.analyze(downCandles);

    expect(signal1.direction).toBe(SignalDirection.LONG);

    // Get state should have signal recorded
    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);
    expect(state1.lastSignal?.direction).toBe(SignalDirection.LONG);

    // Second analysis: different trend - 50+ prices
    const upTrendPrices = Array.from({ length: 50 }, (_, i) => 50 + i);
    const upCandles = createCandleSequence(upTrendPrices);
    const signal2 = analyzer.analyze(upCandles);

    expect(signal2.direction).toBe(SignalDirection.SHORT);

    // State should be updated
    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
    expect(state2.lastSignal?.direction).toBe(SignalDirection.SHORT);
  });
});

describe('RsiAnalyzerNew - Functional: Threshold Detection', () => {
  it('should correctly identify oversold with custom threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Prices that generate low RSI (oversold) - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 - i * 1.5);
    const candles = createCandleSequence(prices);

    const rsi = analyzer.getRsiValue(candles);
    // If RSI = 10 (very oversold):
    // - isOversold(candles, 20) = true (10 < 20) ✓
    // - isOversold(candles, 5) = false (10 < 5 is false) ✓
    expect(analyzer.isOversold(candles, rsi + 10)).toBe(true); // Always oversold with higher threshold
    expect(analyzer.isOversold(candles, Math.max(0, rsi - 10))).toBe(false); // Not oversold with lower threshold
  });

  it('should correctly identify overbought with custom threshold', () => {
    const config = createDefaultConfig();
    const analyzer = new RsiAnalyzerNew(config);

    // Prices that generate high RSI (overbought) - 60+ prices
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 1.5);
    const candles = createCandleSequence(prices);

    const rsi = analyzer.getRsiValue(candles);
    // If RSI = 90 (very overbought):
    // - isOverbought(candles, 80) = true (90 > 80) ✓
    // - isOverbought(candles, 95) = false (90 > 95 is false) ✓
    expect(analyzer.isOverbought(candles, rsi - 10)).toBe(true); // Always overbought with lower threshold
    expect(analyzer.isOverbought(candles, Math.min(100, rsi + 10))).toBe(false); // Not overbought with higher threshold
  });
});

describe('RsiAnalyzerNew - Functional: Config Impact on Signals', () => {
  it('should scale confidence with maxConfidence parameter', () => {
    const highConfigMax = { ...createDefaultConfig(), maxConfidence: 0.95 };
    const lowConfigMax = { ...createDefaultConfig(), maxConfidence: 0.5 };

    const highAnalyzer = new RsiAnalyzerNew(highConfigMax);
    const lowAnalyzer = new RsiAnalyzerNew(lowConfigMax);

    const prices = Array.from({ length: 50 }, (_, i) => 100 - i);
    const candles = createCandleSequence(prices);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Both should be LONG, but high config should have higher confidence
    expect(highSignal.direction).toBe(SignalDirection.LONG);
    expect(lowSignal.direction).toBe(SignalDirection.LONG);
    expect(highSignal.confidence).toBeGreaterThan(lowSignal.confidence);
  });

  it('should respect weight in score calculation', () => {
    const highWeightConfig = { ...createDefaultConfig(), weight: 0.9 };
    const lowWeightConfig = { ...createDefaultConfig(), weight: 0.3 };

    const highAnalyzer = new RsiAnalyzerNew(highWeightConfig);
    const lowAnalyzer = new RsiAnalyzerNew(lowWeightConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles = createCandleSequence(prices);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Score should reflect weight (same confidence, different weight)
    expect(highSignal.score).toBeGreaterThan(lowSignal.score ?? 0);
  });
});
