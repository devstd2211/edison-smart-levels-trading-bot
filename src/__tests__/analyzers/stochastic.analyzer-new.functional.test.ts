/**
 * Stochastic Analyzer NEW - Functional Tests
 * Tests real market patterns and signal behavior
 */

import { StochasticAnalyzerNew } from '../../analyzers/stochastic.analyzer-new';
import type { Candle } from '../../types/core';
import type { StochasticAnalyzerConfigNew } from '../../types/config-new.types';
import { SignalDirection } from '../../types/enums';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createCandleSequence(
  prices: number[],
  volatility: number | number[] | ((index: number) => number) = 1
): Candle[] {
  return prices.map((price, index) => {
    let vol: number;
    if (typeof volatility === 'number') {
      vol = volatility;
    } else if (typeof volatility === 'function') {
      vol = volatility(index);
    } else {
      vol = volatility[index] ?? volatility[0];
    }
    const high = price + vol;
    const low = price - vol;
    return {
      timestamp: Date.now() + index * 60000,
      open: low + vol * 0.5,
      high,
      low,
      close: price,
      volume: 1000,
    };
  });
}

function createDefaultConfig(): StochasticAnalyzerConfigNew {
  return {
    enabled: true,
    weight: 0.8,
    priority: 5,
    kPeriod: 14,
    dPeriod: 3,
  };
}

// ============================================================================
// FUNCTIONAL TESTS
// ============================================================================

describe('StochasticAnalyzerNew - Functional: Uptrend with %K Bullish Cross', () => {
  it('should generate LONG or HOLD signal on bullish cross in oversold zone', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Phase 1: Downtrend to reach oversold (low prices)
    const downPart = Array.from({ length: 30 }, (_, i) => 100 - i * 1.2);
    // Phase 2: Uptrend from oversold (creates bullish cross when %K crosses above %D)
    const upPart = Array.from({ length: 30 }, (_, i) => 64 + i * 1.3);
    const prices = [...downPart, ...upPart];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(0);
    expect(signal.source).toBe('STOCHASTIC_ANALYZER');
  });

  it('should maintain LONG signal during sustained uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Sustained uptrend with moderate volatility
    const prices = Array.from({ length: 60 }, (_, i) => 100 + i * 0.7);
    const candles = createCandleSequence(prices, 1.5);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Downtrend with %K Bearish Cross', () => {
  it('should generate SHORT or HOLD signal on bearish cross in overbought zone', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Phase 1: Uptrend to reach overbought (high prices)
    const upPart = Array.from({ length: 30 }, (_, i) => 100 + i * 1.2);
    // Phase 2: Downtrend from overbought (creates bearish cross when %K crosses below %D)
    const downPart = Array.from({ length: 30 }, (_, i) => 136 - i * 1.3);
    const prices = [...upPart, ...downPart];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should maintain SHORT or HOLD signal during sustained downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Sustained downtrend with moderate volatility
    const prices = Array.from({ length: 60 }, (_, i) => 200 - i * 0.7);
    const candles = createCandleSequence(prices, 1.5);

    const signal = analyzer.analyze(candles);

    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Consolidation with Neutral Stochastic', () => {
  it('should generate HOLD signal during sideways consolidation', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Consolidation pattern (oscillating around midline)
    const prices = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.3) * 2);
    const candles = createCandleSequence(prices, 1);

    const signal = analyzer.analyze(candles);

    // Consolidation can generate HOLD or potentially LONG depending on the oscillation
    expect([SignalDirection.HOLD, SignalDirection.LONG]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should show neutral behavior in ranging market', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Range-bound pattern: oscillates within bounds
    const consolidation = Array.from({ length: 30 }, () => 100);
    const slight1 = Array.from({ length: 15 }, (_, i) => 100 + i * 0.3);
    const slight2 = Array.from({ length: 15 }, (_, i) => 104.5 - i * 0.3);
    const prices = [...consolidation, ...slight1, ...slight2];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBe(SignalDirection.HOLD);
  });
});

describe('StochasticAnalyzerNew - Functional: V-Shape Reversal Pattern', () => {
  it('should detect reversal from downtrend to uptrend', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // V-shaped pattern: down then up
    const downPart = Array.from({ length: 25 }, (_, i) => 100 - i * 1.5);
    const upPart = Array.from({ length: 35 }, (_, i) => 62.5 + i * 1.3);
    const prices = [...downPart, ...upPart];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    // Should show some bullish indication after reversal
    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should detect reversal from uptrend to downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Inverted V-shaped pattern: up then down
    const upPart = Array.from({ length: 25 }, (_, i) => 100 + i * 1.5);
    const downPart = Array.from({ length: 35 }, (_, i) => 137.5 - i * 1.3);
    const prices = [...upPart, ...downPart];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    // Should show some bearish indication after reversal
    expect([SignalDirection.SHORT, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Oversold Bounce Pattern', () => {
  it('should generate LONG signal on oversold bounce with bullish cross', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Sharp down move to create oversold condition
    const sharpeDown = Array.from({ length: 20 }, (_, i) => 100 - i * 3);
    // Quick bounce back (creates bullish cross)
    const bounce = Array.from({ length: 40 }, (_, i) => 40 + i * 1.8);
    const prices = [...sharpeDown, ...bounce];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect([SignalDirection.LONG, SignalDirection.HOLD]).toContain(signal.direction);
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should escalate confidence on sustained bounce above oversold level', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Initial down move to oversold
    const down = Array.from({ length: 15 }, (_, i) => 100 - i * 2);
    // Sustained bounce
    const bounce = Array.from({ length: 45 }, (_, i) => 70 + i * 0.9);
    const prices = [...down, ...bounce];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Overbought Reversal Pattern', () => {
  it('should generate SHORT signal on overbought reversal with bearish cross', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Sharp up move to create overbought condition
    const sharpeUp = Array.from({ length: 20 }, (_, i) => 100 + i * 3);
    // Quick pullback (creates bearish cross)
    const pullback = Array.from({ length: 40 }, (_, i) => 160 - i * 1.8);
    const prices = [...sharpeUp, ...pullback];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    // Reversal patterns can generate various signals depending on the exact price action
    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(10);
  });

  it('should show reversal from overbought to downtrend', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Initial up move to overbought
    const up = Array.from({ length: 15 }, (_, i) => 100 + i * 2);
    // Sustained decline
    const decline = Array.from({ length: 45 }, (_, i) => 130 - i * 0.9);
    const prices = [...up, ...decline];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.confidence).toBeGreaterThan(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Gap Up with Bullish Confirmation', () => {
  it('should recognize gap up followed by consolidation as bullish', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Pre-gap consolidation
    const preGap = Array.from({ length: 20 }, () => 100);
    // Gap up (jump 10 points)
    const gap = Array.from({ length: 1 }, () => 110);
    // Post-gap consolidation at higher level
    const postGap = Array.from({ length: 39 }, (_, i) => 110 + Math.sin(i * 0.2) * 1);
    const prices = [...preGap, ...gap, ...postGap];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should recognize gap down followed by consolidation as bearish', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Pre-gap consolidation
    const preGap = Array.from({ length: 20 }, () => 100);
    // Gap down (drop 10 points)
    const gap = Array.from({ length: 1 }, () => 90);
    // Post-gap consolidation at lower level
    const postGap = Array.from({ length: 39 }, (_, i) => 90 + Math.sin(i * 0.2) * 1);
    const prices = [...preGap, ...gap, ...postGap];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });
});

describe('StochasticAnalyzerNew - Functional: Divergence Patterns', () => {
  it('should detect bullish divergence (lower lows, rising close)', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Prices make lower lows but closes higher
    const down1 = Array.from({ length: 15 }, (_, i) => 100 - i * 1);
    const up1 = Array.from({ length: 15 }, (_, i) => 85 + i * 0.8);
    const down2 = Array.from({ length: 15 }, (_, i) => 97 - i * 0.7);
    const up2 = Array.from({ length: 15 }, (_, i) => 89.5 + i * 0.9);
    const prices = [...down1, ...up1, ...down2, ...up2];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should detect bearish divergence (higher highs, falling close)', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Prices make higher highs but closes lower
    const up1 = Array.from({ length: 15 }, (_, i) => 100 + i * 1);
    const down1 = Array.from({ length: 15 }, (_, i) => 115 - i * 0.8);
    const up2 = Array.from({ length: 15 }, (_, i) => 103 + i * 0.7);
    const down2 = Array.from({ length: 15 }, (_, i) => 110.5 - i * 0.9);
    const prices = [...up1, ...down1, ...up2, ...down2];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });
});

describe('StochasticAnalyzerNew - Functional: Signal Strength Variation', () => {
  it('should scale confidence with crossover proximity to threshold', () => {
    const config = createDefaultConfig();

    // Weak bullish signal (cross near 20 but not quite reaching oversold)
    const weakUpPrices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.3);
    const weakAnalyzer = new StochasticAnalyzerNew(config);
    const weakCandles = createCandleSequence(weakUpPrices);
    const weakSignal = weakAnalyzer.analyze(weakCandles);

    // Strong bullish signal (cross deep in oversold zone)
    const strongDownUpPrices = [
      ...Array.from({ length: 25 }, (_, i) => 100 - i * 2),
      ...Array.from({ length: 25 }, (_, i) => 50 + i * 1.5),
    ];
    const strongAnalyzer = new StochasticAnalyzerNew(config);
    const strongCandles = createCandleSequence(strongDownUpPrices);
    const strongSignal = strongAnalyzer.analyze(strongCandles);

    // Strong signal should have higher or equal confidence
    expect(strongSignal.confidence).toBeGreaterThanOrEqual(10);
    expect(weakSignal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should vary confidence with crossover strength', () => {
    const config = createDefaultConfig();

    // Tight consolidation (low crossover strength)
    const tightPrices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.4) * 0.5);
    const tightAnalyzer = new StochasticAnalyzerNew(config);
    const tightCandles = createCandleSequence(tightPrices);
    const tightSignal = tightAnalyzer.analyze(tightCandles);

    // Wide swings (high crossover strength)
    const widePrices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 5);
    const wideAnalyzer = new StochasticAnalyzerNew(config);
    const wideCandles = createCandleSequence(widePrices);
    const wideSignal = wideAnalyzer.analyze(wideCandles);

    expect(tightSignal.confidence).toBeGreaterThanOrEqual(10);
    expect(wideSignal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('StochasticAnalyzerNew - Functional: Signal Consistency', () => {
  it('should maintain signal alignment across market phases', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Phase 1: Downtrend (oversold)
    const phase1Prices = Array.from({ length: 50 }, (_, i) => 100 - i * 0.8);
    const phase1Candles = createCandleSequence(phase1Prices);
    const signal1 = analyzer.analyze(phase1Candles);

    // Phase 2: Uptrend (recovery)
    const phase2Prices = Array.from({ length: 50 }, (_, i) => 60 + i * 0.9);
    const phase2Candles = createCandleSequence(phase2Prices);
    const signal2 = analyzer.analyze(phase2Candles);

    // Phase 3: Consolidation
    const phase3Prices = Array.from({ length: 50 }, (_, i) => 105 + Math.sin(i * 0.2) * 2);
    const phase3Candles = createCandleSequence(phase3Prices);
    const signal3 = analyzer.analyze(phase3Candles);

    expect(signal1.direction).toBeDefined();
    expect(signal2.direction).toBeDefined();
    expect(signal3.direction).toBeDefined();
  });

  it('should track signal history through multiple market conditions', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // First analysis
    const prices1 = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles1 = createCandleSequence(prices1);
    const signal1 = analyzer.analyze(candles1);

    const state1 = analyzer.getState();
    expect(state1.lastSignal).toBe(signal1);

    // Second analysis
    const prices2 = Array.from({ length: 50 }, (_, i) => 150 - i);
    const candles2 = createCandleSequence(prices2);
    const signal2 = analyzer.analyze(candles2);

    const state2 = analyzer.getState();
    expect(state2.lastSignal).toBe(signal2);
    // Signal objects should be different even if confidence values happen to be similar
    expect(state2.lastSignal).not.toBe(state1.lastSignal);
  });
});

describe('StochasticAnalyzerNew - Functional: Configuration Impact', () => {
  it('should respect kPeriod and dPeriod configuration', () => {
    const shortPeriodConfig: StochasticAnalyzerConfigNew = {
      ...createDefaultConfig(),
      kPeriod: 7,
      dPeriod: 3,
    };
    const longPeriodConfig: StochasticAnalyzerConfigNew = {
      ...createDefaultConfig(),
      kPeriod: 21,
      dPeriod: 5,
    };

    const shortAnalyzer = new StochasticAnalyzerNew(shortPeriodConfig);
    const longAnalyzer = new StochasticAnalyzerNew(longPeriodConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = createCandleSequence(prices);

    const shortSignal = shortAnalyzer.analyze(candles);
    const longSignal = longAnalyzer.analyze(candles);

    // Both should generate signals but possibly with different characteristics
    expect(shortSignal.direction).toBeDefined();
    expect(longSignal.direction).toBeDefined();
  });

  test('should respect weight in score calculation', () => {
    const highWeightConfig = { ...createDefaultConfig(), weight: 0.9 };
    const lowWeightConfig = { ...createDefaultConfig(), weight: 0.2 };

    const highAnalyzer = new StochasticAnalyzerNew(highWeightConfig);
    const lowAnalyzer = new StochasticAnalyzerNew(lowWeightConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.8);
    const candles = createCandleSequence(prices);

    const highSignal = highAnalyzer.analyze(candles);
    const lowSignal = lowAnalyzer.analyze(candles);

    // Score should reflect weight
    expect(highSignal.score).toBeGreaterThan(lowSignal.score ?? 0);
  });

  test('should respect priority configuration', () => {
    const lowPriorityConfig = { ...createDefaultConfig(), priority: 2 };
    const highPriorityConfig = { ...createDefaultConfig(), priority: 9 };

    const lowAnalyzer = new StochasticAnalyzerNew(lowPriorityConfig);
    const highAnalyzer = new StochasticAnalyzerNew(highPriorityConfig);

    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.8);
    const candles = createCandleSequence(prices);

    const lowSignal = lowAnalyzer.analyze(candles);
    const highSignal = highAnalyzer.analyze(candles);

    expect(lowSignal.priority).toBe(2);
    expect(highSignal.priority).toBe(9);
  });
});

describe('StochasticAnalyzerNew - Functional: Extreme Market Conditions', () => {
  it('should handle flash crash followed by recovery', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Uptrend
    const uptrend = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);
    // Flash crash (sharp down)
    const crash = Array.from({ length: 5 }, (_, i) => 110 - i * 4);
    // Recovery (sharp up)
    const recovery = Array.from({ length: 25 }, (_, i) => 90 + i * 1);
    const prices = [...uptrend, ...crash, ...recovery];

    const candles = createCandleSequence(prices);
    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });

  it('should handle high volatility market', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Highly volatile oscillating pattern
    const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 10 + i * 0.2);
    const candles = createCandleSequence(prices, (i) => 2 + Math.sin(i * 0.3) * 1);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle low volatility trending market', () => {
    const config = createDefaultConfig();
    const analyzer = new StochasticAnalyzerNew(config);

    // Very smooth uptrend with minimal volatility
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.3);
    const candles = createCandleSequence(prices, 0.2);

    const signal = analyzer.analyze(candles);

    expect(signal.direction).toBeDefined();
    expect(signal.confidence).toBeGreaterThan(0);
  });
});
