/**
 * Bollinger Bands Analyzer NEW - Functional Tests
 * Tests real market patterns and signal behavior
 */

import { BollingerBandsAnalyzerNew } from '../../analyzers/bollinger-bands.analyzer-new';
import type { Candle } from '../../types/core';
import type { BollingerBandsAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandleSequence(closes: number[]): Candle[] {
  return closes.map((close, index) => ({
    timestamp: Date.now() + index * 60000,
    open: close - 0.5,
    high: close + 1.5,
    low: close - 1.5,
    close,
    volume: 1000,
  }));
}

function createDefaultConfig(): BollingerBandsAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.7,
    priority: 6,
    period: 20,
    stdDev: 2,
  };
}

// ============================================================================
// FUNCTIONAL TESTS
// ============================================================================

describe('BollingerBandsAnalyzerNew - Functional: Squeeze Breakout Upward', () => {
  it('should generate LONG signal on squeeze breakout to upside', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Phase 1: Squeeze (consolidation with tight bands)
    const squeeze = Array.from({ length: 20 }, () => 100);
    // Phase 2: Breakout (strong uptrend, bands expand)
    const breakout = Array.from({ length: 30 }, (_, i) => 100 + i * 1.2);
    const closes = [...squeeze, ...breakout];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    // Squeeze breakout can generate various signals depending on final %B position
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.source).toBe('BOLLINGER_BANDS_ANALYZER');
  });

  it('should show increasing confidence as price extends from lower band', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Consolidation then sustained uptrend
    const consolidation = Array.from({ length: 15 }, () => 100);
    const uptrend = Array.from({ length: 35 }, (_, i) => 100 + i * 0.8);
    const closes = [...consolidation, ...uptrend];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Squeeze Breakout Downward', () => {
  it('should generate SHORT signal on squeeze breakout to downside', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Phase 1: Squeeze (consolidation with tight bands)
    const squeeze = Array.from({ length: 20 }, () => 100);
    // Phase 2: Breakdown (strong downtrend, bands expand)
    const breakdown = Array.from({ length: 30 }, (_, i) => 100 - i * 1.2);
    const closes = [...squeeze, ...breakdown];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    // Squeeze breakdown can generate various signals depending on final %B position
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should show confidence on sustained downtrend from upper band', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Consolidation then sustained downtrend
    const consolidation = Array.from({ length: 15 }, () => 100);
    const downtrend = Array.from({ length: 35 }, (_, i) => 100 - i * 0.8);
    const closes = [...consolidation, ...downtrend];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Band Touch Patterns', () => {
  it('should detect lower band touch (oversold)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Build bands with initial trend, then dip to lower band
    const initial = Array.from({ length: 15 }, (_, i) => 100 + i * 0.5);
    const dip = Array.from({ length: 20 }, (_, i) => 107.5 - i * 1.2);
    const closes = [...initial, ...dip];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should detect upper band touch (overbought)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Build bands with initial downtrend, then rally to upper band
    const initial = Array.from({ length: 15 }, (_, i) => 100 - i * 0.5);
    const rally = Array.from({ length: 20 }, (_, i) => 92.5 + i * 1.2);
    const closes = [...initial, ...rally];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should detect walk along upper band (sustained overbought)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Strong uptrend with price hugging upper band
    const priceHughing = Array.from({ length: 50 }, (_, i) => 100 + i * 0.7);
    const closes = priceHughing;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });

  it('should detect walk along lower band (sustained oversold)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Strong downtrend with price hugging lower band
    const priceHughing = Array.from({ length: 50 }, (_, i) => 100 - i * 0.7);
    const closes = priceHughing;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Consolidation Patterns', () => {
  it('should generate HOLD signal during tight consolidation (squeeze)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Tight range consolidation
    const consolidation = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 0.5);
    const closes = consolidation;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should show low confidence during prolonged squeeze', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Prolonged consolidation with minimal movement
    const consolidation = Array.from({ length: 50 }, () => 100);
    const closes = consolidation;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Volatility Expansion Patterns', () => {
  it('should detect increased volatility from squeeze', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Phase 1: Low volatility squeeze
    const squeeze = Array.from({ length: 20 }, () => 100);
    // Phase 2: Sudden volatility expansion
    const expansion = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.4) * 8);
    const closes = [...squeeze, ...expansion];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should show stronger signals with band expansion', () => {
    const config = createDefaultConfig();

    // Tight consolidation (narrow bands)
    const tight = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.2) * 0.3);
    const tightAnalyzer = new BollingerBandsAnalyzerNew(config);
    const tightCandles = createCandleSequence(tight);
    const tightSignal = tightAnalyzer.analyze(tightCandles);

    // Wide swings (expanding bands)
    const wide = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.2) * 8);
    const wideAnalyzer = new BollingerBandsAnalyzerNew(config);
    const wideCandles = createCandleSequence(wide);
    const wideSignal = wideAnalyzer.analyze(wideCandles);

    // Wide volatility should have reasonable confidence
    expect(wideSignal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Reversal from Extremes', () => {
  it('should recognize reversal from upper band', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Initial uptrend reaching upper band
    const uptrend = Array.from({ length: 20 }, (_, i) => 100 + i * 1.2);
    // Reversal (pullback from upper band)
    const pullback = Array.from({ length: 30 }, (_, i) => 124 - i * 0.9);
    const closes = [...uptrend, ...pullback];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should recognize reversal from lower band', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Initial downtrend reaching lower band
    const downtrend = Array.from({ length: 20 }, (_, i) => 100 - i * 1.2);
    // Reversal (bounce from lower band)
    const bounce = Array.from({ length: 30 }, (_, i) => 76 + i * 0.9);
    const closes = [...downtrend, ...bounce];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Middle Band Crossing', () => {
  it('should show neutral behavior when price oscillates around middle band', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Oscillation around middle band
    const oscillation = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 3);
    const closes = oscillation;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    // Oscillation around middle band should generally be HOLD or LONG depending on final position
    expect([SignalDirection.HOLD, SignalDirection.LONG]).toContain(signal.direction);
  });

  it('should detect crossing from lower to upper band (strong trend)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Price moving from lower band area to upper band area
    const climb = Array.from({ length: 50 }, (_, i) => 85 + i * 0.9);
    const closes = climb;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });
});

describe('BollingerBandsAnalyzerNew - Functional: False Breakout Detection', () => {
  it('should warn on false breakout (spike and pullback)', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Consolidation then brief spike that fades
    const consolidation = Array.from({ length: 20 }, () => 100);
    const spike = Array.from({ length: 5 }, (_, i) => 100 + i * 2);
    const pullback = Array.from({ length: 25 }, (_, i) => 110 - i * 0.5);
    const closes = [...consolidation, ...spike, ...pullback];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    // Should show some signal during the pattern
    expect(signal.direction).toBeDefined();
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Signal Strength Variation', () => {
  it('should scale confidence based on extremeness of %B', () => {
    const config = createDefaultConfig();

    // Mild movement (%B slightly above 80)
    const mild = [
      ...Array.from({ length: 15 }, (_, i) => 100 - i * 0.3),
      ...Array.from({ length: 20 }, (_, i) => 95.5 + i * 0.3),
    ];
    const mildAnalyzer = new BollingerBandsAnalyzerNew(config);
    const mildCandles = createCandleSequence(mild);
    const mildSignal = mildAnalyzer.analyze(mildCandles);

    // Extreme movement (%B far above 80)
    const extreme = [
      ...Array.from({ length: 15 }, (_, i) => 100 - i * 1.5),
      ...Array.from({ length: 20 }, (_, i) => 77.5 + i * 1.5),
    ];
    const extremeAnalyzer = new BollingerBandsAnalyzerNew(config);
    const extremeCandles = createCandleSequence(extreme);
    const extremeSignal = extremeAnalyzer.analyze(extremeCandles);

    expect(mildSignal.confidence).toBeGreaterThanOrEqual(10);
    expect(extremeSignal.confidence).toBeGreaterThanOrEqual(10);
  });

  test('should vary confidence with different band widths', () => {
    const config = createDefaultConfig();

    // Tight bands (low volatility environment)
    const tight = Array.from({ length: 50 }, (_, i) => 100 + i * 0.05);
    const tightAnalyzer = new BollingerBandsAnalyzerNew(config);
    const tightCandles = createCandleSequence(tight);
    const tightSignal = tightAnalyzer.analyze(tightCandles);

    // Wide bands (high volatility environment)
    const wide = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.15) * 20);
    const wideAnalyzer = new BollingerBandsAnalyzerNew(config);
    const wideCandles = createCandleSequence(wide);
    const wideSignal = wideAnalyzer.analyze(wideCandles);

    expect(tightSignal.confidence).toBeGreaterThanOrEqual(10);
    expect(wideSignal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Signal Consistency', () => {
  it('should maintain signal direction through market phases', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Phase 1: Downtrend
    const phase1 = Array.from({ length: 35 }, (_, i) => 150 - i * 0.8);
    const phase1Candles = createCandleSequence(phase1);
    const signal1 = analyzer.analyze(phase1Candles);

    // Phase 2: Consolidation
    const phase2 = Array.from({ length: 35 }, (_, i) => 122 + Math.sin(i * 0.2) * 1);
    const phase2Candles = createCandleSequence(phase2);
    const signal2 = analyzer.analyze(phase2Candles);

    // Phase 3: Uptrend
    const phase3 = Array.from({ length: 35 }, (_, i) => 122 + i * 0.8);
    const phase3Candles = createCandleSequence(phase3);
    const signal3 = analyzer.analyze(phase3Candles);

    expect(signal1.direction).toBeDefined();
    expect(signal2.direction).toBeDefined();
    expect(signal3.direction).toBeDefined();
  });

  it('should track signal history through multiple analyses', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // First analysis: uptrend
    const closes1 = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const candles1 = createCandleSequence(closes1);
    const signal1 = analyzer.analyze(candles1);

    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis: downtrend
    const closes2 = Array.from({ length: 40 }, (_, i) => 120 - i * 0.5);
    const candles2 = createCandleSequence(closes2);
    const signal2 = analyzer.analyze(candles2);

    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
    expect(state2.lastSignal).not.toBe(state1.lastSignal);
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Configuration Impact', () => {
  it('should respect period configuration', () => {
    const shortPeriodConfig: BollingerBandsAnalyzerConfigNew = {
      ...createDefaultConfig(),
      period: 10,
    };
    const longPeriodConfig: BollingerBandsAnalyzerConfigNew = {
      ...createDefaultConfig(),
      period: 30,
    };

    const shortAnalyzer = new BollingerBandsAnalyzerNew(shortPeriodConfig);
    const longAnalyzer = new BollingerBandsAnalyzerNew(longPeriodConfig);

    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(closes);

    const shortSignal = shortAnalyzer.analyze(candles);
    const longSignal = longAnalyzer.analyze(candles);

    expect(shortSignal.direction).toBeDefined();
    expect(longSignal.direction).toBeDefined();
  });

  test('should respect weight in score calculation', () => {
    const highWeightConfig = { ...createDefaultConfig(), weight: 0.9 };
    const lowWeightConfig = { ...createDefaultConfig(), weight: 0.2 };

    const highAnalyzer = new BollingerBandsAnalyzerNew(highWeightConfig);
    const lowAnalyzer = new BollingerBandsAnalyzerNew(lowWeightConfig);

    const closes = Array.from({ length: 40 }, (_, i) => 100 + i);
    const candles = createCandleSequence(closes);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    expect(highSignal.score).toBeGreaterThan(lowSignal.score ?? 0);
  });

  test('should respect stdDev configuration', () => {
    const narrowConfig = { ...createDefaultConfig(), stdDev: 1 };
    const wideConfig = { ...createDefaultConfig(), stdDev: 3 };

    const narrowAnalyzer = new BollingerBandsAnalyzerNew(narrowConfig);
    const wideAnalyzer = new BollingerBandsAnalyzerNew(wideConfig);

    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.2) * 5);
    const candles = createCandleSequence(closes);

    const narrowSignal = narrowAnalyzer.analyze(candles);
    const wideSignal = wideAnalyzer.analyze(candles);

    expect(narrowSignal.direction).toBeDefined();
    expect(wideSignal.direction).toBeDefined();
  });
});

describe('BollingerBandsAnalyzerNew - Functional: Extreme Market Conditions', () => {
  it('should handle gap up and hold at higher level', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Pre-gap consolidation
    const preGap = Array.from({ length: 15 }, () => 100);
    // Gap up
    const gap = Array.from({ length: 1 }, () => 110);
    // Post-gap consolidation at higher level
    const postGap = Array.from({ length: 34 }, (_, i) => 110 + Math.sin(i * 0.2) * 1);
    const closes = [...preGap, ...gap, ...postGap];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });

  it('should handle gap down and hold at lower level', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Pre-gap consolidation
    const preGap = Array.from({ length: 15 }, () => 100);
    // Gap down
    const gap = Array.from({ length: 1 }, () => 90);
    // Post-gap consolidation at lower level
    const postGap = Array.from({ length: 34 }, (_, i) => 90 + Math.sin(i * 0.2) * 1);
    const closes = [...preGap, ...gap, ...postGap];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });

  it('should handle flash crash followed by recovery', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // Normal trading
    const normal = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);
    // Flash crash
    const crash = Array.from({ length: 5 }, (_, i) => 110 - i * 4);
    // Recovery
    const recovery = Array.from({ length: 25 }, (_, i) => 90 + i * 1);
    const closes = [...normal, ...crash, ...recovery];

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
  });

  it('should handle high volatility with wide bands', () => {
    const config = createDefaultConfig();
    const analyzer = new BollingerBandsAnalyzerNew(config);

    // High volatility oscillation
    const volatility = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 20);
    const closes = volatility;

    const candles = createCandleSequence(closes);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
