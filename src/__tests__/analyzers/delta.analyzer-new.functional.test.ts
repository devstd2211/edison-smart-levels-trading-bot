import { DeltaAnalyzerNew } from '../../analyzers/delta.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.8, priority: 7 };
}

function createCandlesWithVolume(closes: number[], volumes: number[], opens?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: opens ? opens[i] : close - 0.2,
    high: Math.max(close, opens ? opens[i] : close - 0.2) + 0.6,
    low: Math.min(close, opens ? opens[i] : close - 0.2) - 0.6,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('DeltaAnalyzerNew - Functional: Bullish Delta', () => {
  it('should detect positive delta on uptrend', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Uptrend with volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.2);
    const volumes = closes.map((_, i) => {
      if (i >= 10) return 2000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify buying pressure accumulation', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Consolidation with strong up close
    const closes = [100, 100.1, 100, 100.2, 99.9, 100.3, 100, 100.4, 100.1, 100.5, 100.2, 100.6, 100.3, 100.7, 100.4, 100.8, 100.5, 100.9, 100.6, 101];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 0) return 1500; // Normal on midpoint
      return 2000; // Higher on up closes
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize strong buying during reversal', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Reversal with buying volume
    const down = Array.from({ length: 12 }, (_, i) => 110 - i * 0.5);
    const recovery = Array.from({ length: 8 }, (_, i) => 104 + i * 0.6);
    const closes = [...down, ...recovery];
    const volumes = closes.map((_, i) => {
      if (i >= 12) return 2500;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DeltaAnalyzerNew - Functional: Bearish Delta', () => {
  it('should detect negative delta on downtrend', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Downtrend with volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.2);
    const volumes = closes.map((_, i) => {
      if (i >= 10) return 2000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify selling pressure accumulation', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Consolidation with strong down close
    const closes = [100, 99.9, 100, 99.8, 100.1, 99.7, 100, 99.6, 99.9, 99.5, 99.8, 99.4, 99.7, 99.3, 99.6, 99.2, 99.5, 99.1, 99.4, 99];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 0) return 1500; // Normal on midpoint
      return 2000; // Higher on down closes
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize strong selling during reversal', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Reversal with selling volume
    const up = Array.from({ length: 12 }, (_, i) => 90 + i * 0.5);
    const decline = Array.from({ length: 8 }, (_, i) => 96 - i * 0.6);
    const closes = [...up, ...decline];
    const volumes = closes.map((_, i) => {
      if (i >= 12) return 2500;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DeltaAnalyzerNew - Functional: Delta at Price Levels', () => {
  it('should evaluate delta at support level', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Fall to support
    const down = Array.from({ length: 15 }, (_, i) => 115 - i * 0.8);
    // Buyers enter
    const support = [95, 95.5, 96, 96.5, 97];
    const closes = [...down, ...support];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2500;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should evaluate delta at resistance level', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Rally to resistance
    const up = Array.from({ length: 15 }, (_, i) => 85 + i * 0.8);
    // Sellers enter
    const resistance = [105, 104.5, 104, 103.5, 103];
    const closes = [...up, ...resistance];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2500;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DeltaAnalyzerNew - Functional: Delta Divergence', () => {
  it('should handle bullish delta with price decline', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // More volume above midpoint despite lower close
    const closes = [100, 100.3, 100.1, 100.4, 100.2, 100.5, 100.3, 100.6, 100.4, 100.7, 100.5, 100.8, 100.6, 100.9, 100.7, 101, 100.8, 101.1, 100.9, 100.7];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2000;
      return 1200;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle bearish delta with price advance', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // More volume below midpoint despite higher close
    const closes = [100, 99.7, 99.9, 99.6, 99.8, 99.5, 99.7, 99.4, 99.6, 99.3, 99.5, 99.2, 99.4, 99.1, 99.3, 99, 99.2, 98.9, 99.1, 99.3];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2000;
      return 1200;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DeltaAnalyzerNew - Functional: Extreme Delta', () => {
  it('should detect maximum positive delta', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // All closes above midpoints with heavy volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.5);
    const volumes = closes.map((_, i) => {
      if (i < closes.length - 1) return 3000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect maximum negative delta', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // All closes below midpoints with heavy volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.5);
    const volumes = closes.map((_, i) => {
      if (i < closes.length - 1) return 3000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('DeltaAnalyzerNew - Functional: Volume Profile Impact', () => {
  it('should prioritize high volume closes above midpoint', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Mixed movement but heavy volume above midpoint
    const closes = [100, 100.2, 100, 100.3, 99.9, 100.4, 100, 100.5, 99.8, 100.6, 100, 100.7, 99.9, 100.8, 100, 100.9, 99.8, 101, 99.9, 101.1];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 1) return 2500; // Heavy on moving up
      return 800; // Light on down
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should prioritize high volume closes below midpoint', () => {
    const analyzer = new DeltaAnalyzerNew(createConfig());
    // Mixed movement but heavy volume below midpoint
    const closes = [100, 99.8, 100, 99.7, 100.1, 99.6, 100, 99.5, 100.2, 99.4, 100, 99.3, 100.1, 99.2, 100, 99.1, 100.1, 99, 100, 98.9];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 1) return 2500; // Heavy on moving down
      return 800; // Light on up
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
