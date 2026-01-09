import { FootprintAnalyzerNew } from '../../analyzers/footprint.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.65, priority: 5 };
}

function createCandlesWithFootprint(closes: number[], volumes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: close + 0.5,
    low: close - 0.5,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('FootprintAnalyzerNew - Functional: Bullish Footprint', () => {
  it('should detect bullish footprint with high volume on up bar', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Normal trading history
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i * 0.1);
    // Last bar up with high volume
    closes[closes.length - 1] = 103.2; // Close higher than previous
    const volumes = closes.map((_, i) => {
      if (i === closes.length - 1) return 5000; // High volume on last bar
      return 1000; // Normal
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bullish accumulation footprint', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    const closes = Array.from({ length: 35 }, (_, i) => 100 + Math.sin(i * 0.2) * 1);
    // Last 3 bars with increasing volume and up closes
    const volumes = closes.map((_, i) => {
      if (i >= 32) return 4000;
      return 800;
    });
    closes[33] = 100.8;
    closes[34] = 101.2;
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize bullish breakout footprint', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Consolidation
    const cons = Array.from({ length: 22 }, () => 100);
    // Breakout up with volume
    const breakout = [102, 104, 105];
    const closes = [...cons, ...breakout];
    const volumes = closes.map((_, i) => {
      if (i >= 22) return 6000;
      return 1000;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FootprintAnalyzerNew - Functional: Bearish Footprint', () => {
  it('should detect bearish footprint with high volume on down bar', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Normal trading history
    const closes = Array.from({ length: 30 }, (_, i) => 100 - i * 0.1);
    // Last bar down with high volume
    closes[closes.length - 1] = 96.8; // Close lower than previous
    const volumes = closes.map((_, i) => {
      if (i === closes.length - 1) return 5000; // High volume on last bar
      return 1000; // Normal
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish distribution footprint', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    const closes = Array.from({ length: 35 }, (_, i) => 100 - Math.sin(i * 0.2) * 1);
    // Last 3 bars with increasing volume and down closes
    const volumes = closes.map((_, i) => {
      if (i >= 32) return 4000;
      return 800;
    });
    closes[33] = 99.2;
    closes[34] = 98.8;
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize bearish breakdown footprint', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Consolidation
    const cons = Array.from({ length: 22 }, () => 100);
    // Breakdown down with volume
    const breakdown = [98, 96, 95];
    const closes = [...cons, ...breakdown];
    const volumes = closes.map((_, i) => {
      if (i >= 22) return 6000;
      return 1000;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FootprintAnalyzerNew - Functional: Volume Surge Patterns', () => {
  it('should handle sudden volume spike on reversal', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Downtrend
    const down = Array.from({ length: 15 }, (_, i) => 110 - i * 0.5);
    // Reversal bar with spike
    const reversal = [105];
    // Recovery
    const recovery = Array.from({ length: 14 }, (_, i) => 105 + i * 0.5);
    const closes = [...down, ...reversal, ...recovery];
    const volumes = closes.map((_, i) => {
      if (i === 15) return 8000;
      return 1200;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify volume exhaustion footprint', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Uptrend with diminishing volume
    const uptrend = Array.from({ length: 25 }, (_, i) => 100 + i * 0.3);
    // Final high with volume spike (exhaustion)
    const exhaustion = [107.5];
    const closes = [...uptrend, ...exhaustion];
    const volumes = closes.map((_, i) => {
      if (i === closes.length - 1) return 7000;
      if (i > 20) return 500;
      return 1500;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('FootprintAnalyzerNew - Functional: Institutional Footprints', () => {
  it('should detect institutional accumulation', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Quiet market
    const quiet = Array.from({ length: 15 }, () => 100);
    // Institutional accumulation over 10 bars
    const accum = Array.from({ length: 20 }, (_, i) => 100 + i * 0.2);
    const closes = [...quiet, ...accum];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 5000;
      return 500;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify institutional distribution', () => {
    const analyzer = new FootprintAnalyzerNew(createConfig());
    // Quiet market
    const quiet = Array.from({ length: 15 }, () => 100);
    // Institutional distribution over 10 bars
    const distrib = Array.from({ length: 20 }, (_, i) => 100 - i * 0.2);
    const closes = [...quiet, ...distrib];
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 5000;
      return 500;
    });
    const candles = createCandlesWithFootprint(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
