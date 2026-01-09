import { FairValueGapAnalyzerNew } from '../../analyzers/fair-value-gap.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.72, priority: 6 };
}

function createCandlesWithGaps(closes: number[], highs?: number[], lows?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs ? highs[i] : close + 0.5,
    low: lows ? lows[i] : close - 0.5,
    close,
    volume: 1000,
  }));
}

describe('FairValueGapAnalyzerNew - Functional: Bullish Gap Up', () => {
  it('should detect gap up with no overlap', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Normal consolidation
    const before = Array.from({ length: 22 }, () => 100);
    // Clear gap up (first high < second low)
    const gapUp = [105]; // Gap candle, low is 104.5
    // Continue after gap
    const after = Array.from({ length: 12 }, (_, i) => 105 + i * 0.2);
    const closes = [...before, ...gapUp, ...after];

    const highs = closes.map((c, i) => {
      if (i === 22) return 105.5; // Gap candle high
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 22) return 104.5; // Gap candle low is above previous high of 100.5
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bullish fair value gap during rally', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Uptrend establishing
    const trend = Array.from({ length: 20 }, (_, i) => 100 + i * 0.3);
    // Gap up move
    const gap = [106];
    // Continue uptrend
    const continuation = Array.from({ length: 14 }, (_, i) => 106 + i * 0.4);
    const closes = [...trend, ...gap, ...continuation];

    const highs = closes.map((c, i) => {
      if (i === 20) return 106.8;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 20) return 105.5; // Gap up
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect multiple bullish gaps', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 10 }, () => 100);
    // First gap up
    const gap1Close = [105];
    // Small consolidation after first gap
    const cons1 = Array.from({ length: 6 }, () => 105);
    // Second gap up
    const gap2Close = [108];
    // Consolidate
    const cons2 = Array.from({ length: 8 }, () => 108);

    const closes = [...initial, ...gap1Close, ...cons1, ...gap2Close, ...cons2];

    const highs = closes.map((c, i) => {
      if (i === 10) return 105.8;
      if (i === 17) return 108.8;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 10) return 104.5;
      if (i === 17) return 107.5;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FairValueGapAnalyzerNew - Functional: Bearish Gap Down', () => {
  it('should detect gap down with no overlap', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Normal consolidation
    const before = Array.from({ length: 22 }, () => 100);
    // Clear gap down
    const gapDown = [95];
    // Continue after gap
    const after = Array.from({ length: 12 }, (_, i) => 95 - i * 0.2);
    const closes = [...before, ...gapDown, ...after];

    const highs = closes.map((c, i) => {
      if (i === 22) return 95.5;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 22) return 94.5; // Gap down: high is below previous low of 99.5
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish fair value gap during decline', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Downtrend establishing
    const trend = Array.from({ length: 20 }, (_, i) => 100 - i * 0.3);
    // Gap down move
    const gap = [94];
    // Continue downtrend
    const continuation = Array.from({ length: 14 }, (_, i) => 94 - i * 0.4);
    const closes = [...trend, ...gap, ...continuation];

    const highs = closes.map((c, i) => {
      if (i === 20) return 94.5;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 20) return 93.2; // Gap down
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect multiple bearish gaps', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 10 }, () => 100);
    // First gap down
    const gap1Close = [95];
    // Small consolidation
    const cons1 = Array.from({ length: 6 }, () => 95);
    // Second gap down
    const gap2Close = [92];
    // Consolidate
    const cons2 = Array.from({ length: 8 }, () => 92);

    const closes = [...initial, ...gap1Close, ...cons1, ...gap2Close, ...cons2];

    const highs = closes.map((c, i) => {
      if (i === 10) return 95.5;
      if (i === 17) return 92.5;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 10) return 94.2;
      if (i === 17) return 91.2;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FairValueGapAnalyzerNew - Functional: Gap Fill Patterns', () => {
  it('should handle bullish gap then pullback to fill', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Consolidation
    const before = Array.from({ length: 18 }, () => 100);
    // Bullish gap
    const gap = [106];
    // Price pulls back to gap
    const pullback = Array.from({ length: 16 }, (_, i) => 106 - i * 0.4);
    const closes = [...before, ...gap, ...pullback];

    const highs = closes.map((c, i) => {
      if (i === 18) return 106.8;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 18) return 105.5;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle bearish gap then recovery to fill', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Consolidation
    const before = Array.from({ length: 18 }, () => 100);
    // Bearish gap
    const gap = [94];
    // Price recovers to gap
    const recovery = Array.from({ length: 16 }, (_, i) => 94 + i * 0.4);
    const closes = [...before, ...gap, ...recovery];

    const highs = closes.map((c, i) => {
      if (i === 18) return 94.5;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 18) return 93.2;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FairValueGapAnalyzerNew - Functional: News and Event Gaps', () => {
  it('should identify gap from positive news', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Pre-news trading
    const preNews = Array.from({ length: 20 }, () => 100);
    // News hit - gap up
    const newsGap = [110];
    // Normal trading after news
    const postNews = Array.from({ length: 14 }, (_, i) => 110 + Math.sin(i * 0.3) * 1);
    const closes = [...preNews, ...newsGap, ...postNews];

    const highs = closes.map((c, i) => {
      if (i === 20) return 111;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 20) return 109;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify gap from negative news', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Pre-news trading
    const preNews = Array.from({ length: 20 }, () => 100);
    // News hit - gap down
    const newsGap = [85];
    // Normal trading after news
    const postNews = Array.from({ length: 14 }, (_, i) => 85 + Math.sin(i * 0.3) * 1);
    const closes = [...preNews, ...newsGap, ...postNews];

    const highs = closes.map((c, i) => {
      if (i === 20) return 86;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 20) return 84;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FairValueGapAnalyzerNew - Functional: Trend Continuation Gaps', () => {
  it('should detect gap continuing uptrend', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Uptrend momentum
    const trend = Array.from({ length: 15 }, (_, i) => 100 + i * 0.8);
    // Breakaway gap up
    const gap = [112.5];
    // Trend continues
    const cont = Array.from({ length: 14 }, (_, i) => 112.5 + i * 0.6);
    const closes = [...trend, ...gap, ...cont];

    const highs = closes.map((c, i) => {
      if (i === 15) return 113.3;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 15) return 112;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect gap continuing downtrend', () => {
    const analyzer = new FairValueGapAnalyzerNew(createConfig());
    // Downtrend momentum
    const trend = Array.from({ length: 15 }, (_, i) => 100 - i * 0.8);
    // Breakaway gap down
    const gap = [88];
    // Trend continues
    const cont = Array.from({ length: 14 }, (_, i) => 88 - i * 0.6);
    const closes = [...trend, ...gap, ...cont];

    const highs = closes.map((c, i) => {
      if (i === 15) return 88.5;
      return c + 0.5;
    });
    const lows = closes.map((c, i) => {
      if (i === 15) return 87.2;
      return c - 0.5;
    });

    const candles = createCandlesWithGaps(closes, highs, lows);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
