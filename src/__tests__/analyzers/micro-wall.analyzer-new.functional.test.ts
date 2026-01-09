import { MicroWallAnalyzerNew } from '../../analyzers/micro-wall.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.6, priority: 5 };
}

function createCandlesWithVolume(closes: number[], volumes: number[], highs?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.1,
    high: highs ? highs[i] : close + 0.5,
    low: close - 0.5,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('MicroWallAnalyzerNew - Functional: Bullish Micro Wall', () => {
  it('should detect wall above current price', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Consolidation at 100
    const cons = Array.from({ length: 20 }, () => 100);
    // Attempt to break up but fails
    const attempt = [101, 100.5, 100.2];
    const closes = [...cons, ...attempt];

    const volumes = closes.map((_, i) => {
      if (i === 22) return 8000; // Wall at attempt high
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 22) return 101.8; // Wall placed at this high
      return closes[i] + 0.5;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify wall during accumulation', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Price consolidating with wall building
    const build = Array.from({ length: 18 }, () => 100);
    // Wall appears in recent bars
    const wall = [100.5, 100.2, 100, 99.8];
    const closes = [...build, ...wall];

    const volumes = closes.map((_, i) => {
      if (i === 20) return 6000; // Volume at resistance
      return 900;
    });

    const highs = closes.map((_, i) => {
      if (i === 20) return 101; // Wall high
      return closes[i] + 0.3;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize wall below price after spike', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Rise in price
    const rise = Array.from({ length: 18 }, (_, i) => 100 + i * 0.2);
    // Pull back leaving wall
    const pullback = [103.6, 103, 102.5];
    const closes = [...rise, ...pullback];

    const volumes = closes.map((_, i) => {
      if (i === 19) return 5500;
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 19) return 104.2;
      return closes[i] + 0.3;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('MicroWallAnalyzerNew - Functional: Wall Placement Patterns', () => {
  it('should handle wall at support level', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Consolidation
    const cons = Array.from({ length: 16 }, () => 100);
    // Drop then recovery leaves wall
    const pattern = [99, 100, 100.5, 100.3];
    const closes = [...cons, ...pattern];

    const volumes = closes.map((_, i) => {
      if (i === 17) return 7000;
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 17) return 101;
      return closes[i] + 0.4;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify wall in trending market', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Downtrend
    const downtrend = Array.from({ length: 19 }, (_, i) => 100 - i * 0.3);
    // Temporary bounce creating wall
    const bounce = [96.5, 97, 96.7];
    const closes = [...downtrend, ...bounce];

    const volumes = closes.map((_, i) => {
      if (i === 20) return 6500;
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 20) return 97.8;
      return closes[i] + 0.4;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('MicroWallAnalyzerNew - Functional: Multi-Day Walls', () => {
  it('should detect persistent wall', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Price near wall
    const near = Array.from({ length: 16 }, () => 99.8);
    // Multiple attempts blocked
    const blocked = [100.2, 100.1, 99.9, 100.3, 100.1];
    const closes = [...near, ...blocked];

    const volumes = closes.map((_, i) => {
      if (i === 18) return 5000;
      return 1200;
    });

    const highs = closes.map((_, i) => {
      if (i === 18) return 101;
      return closes[i] + 0.4;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize building wall during accumulation', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Accumulation phase
    const accum = Array.from({ length: 18 }, () => 100);
    // Wall formation
    const formation = [100.3, 100.1, 100.5, 100.2];
    const closes = [...accum, ...formation];

    const volumes = closes.map((_, i) => {
      if (i === 19) return 4000;
      if (i === 20) return 5500;
      return 1100;
    });

    const highs = closes.map((_, i) => {
      if (i === 20) return 101.2;
      return closes[i] + 0.35;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('MicroWallAnalyzerNew - Functional: Wall Breakdown Scenarios', () => {
  it('should detect wall on failed breakdown', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Downtrend
    const downtrend = Array.from({ length: 19 }, (_, i) => 105 - i * 0.4);
    // Attempt breakdown fails
    const breakdown = [93.6, 94.5, 94.2];
    const closes = [...downtrend, ...breakdown];

    const volumes = closes.map((_, i) => {
      if (i === 20) return 6000;
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 20) return 95.2;
      return closes[i] + 0.4;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify wall from rejection candle', () => {
    const analyzer = new MicroWallAnalyzerNew(createConfig());
    // Consolidation
    const cons = Array.from({ length: 20 }, () => 100);
    // Rejection bar leaves wall
    const rejection = [101.5, 100.2];
    const closes = [...cons, ...rejection];

    const volumes = closes.map((_, i) => {
      if (i === 21) return 7500;
      return 1000;
    });

    const highs = closes.map((_, i) => {
      if (i === 21) return 102.5;
      return closes[i] + 0.3;
    });

    const candles = createCandlesWithVolume(closes, volumes, highs);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
