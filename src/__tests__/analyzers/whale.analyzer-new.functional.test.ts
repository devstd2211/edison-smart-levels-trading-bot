import { WhaleAnalyzerNew } from '../../analyzers/whale.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.8, priority: 8 };
}

function createCandlesWithVolume(closes: number[], volumes: number[], opens?: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: opens ? opens[i] : close - 0.2,
    high: Math.max(close, opens ? opens[i] : close - 0.2) + 0.5,
    low: Math.min(close, opens ? opens[i] : close - 0.2) - 0.5,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('WhaleAnalyzerNew - Functional: Bullish Whale Activity', () => {
  it('should detect whale accumulation candle', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Normal trading
    const normal = Array.from({ length: 29 }, (_, i) => 100 + i * 0.1);
    // Whale buying candle (green with massive volume)
    const whale = [103];
    const closes = [...normal, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 29) return 15000; // Whale volume (> 3x average)
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 29) return 101; // Green candle (open < close)
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify whale during dip buying', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Uptrend
    const uptrend = Array.from({ length: 15 }, (_, i) => 100 + i * 0.5);
    // Sharp pullback
    const pullback = Array.from({ length: 10 }, (_, i) => 107.5 - i * 0.3);
    // Whale steps in
    const whale = [105, 106];
    const closes = [...uptrend, ...pullback, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 24) return 12000; // Whale volume
      return 1200;
    });

    const opens = closes.map((_, i) => {
      if (i === 24) return 104.5; // Green
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize whale at support level', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Fall to support
    const down = Array.from({ length: 22 }, (_, i) => 110 - i * 0.6);
    // Whale support
    const support = [90, 91, 92];
    const closes = [...down, ...support];

    const volumes = closes.map((_, i) => {
      if (i === 23) return 18000; // Massive whale volume
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 23) return 88; // Strong green
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WhaleAnalyzerNew - Functional: Bearish Whale Activity', () => {
  it('should detect whale distribution candle', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Normal trading
    const normal = Array.from({ length: 29 }, (_, i) => 100 + i * 0.1);
    // Whale selling candle (red with massive volume)
    const whale = [97];
    const closes = [...normal, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 29) return 15000; // Whale volume
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 29) return 103; // Red candle (open > close)
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify whale selling into strength', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Downtrend
    const downtrend = Array.from({ length: 15 }, (_, i) => 100 - i * 0.5);
    // Relief rally
    const rally = Array.from({ length: 10 }, (_, i) => 92.5 + i * 0.3);
    // Whale sells
    const whale = [95, 94];
    const closes = [...downtrend, ...rally, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 24) return 14000; // Whale volume
      return 1200;
    });

    const opens = closes.map((_, i) => {
      if (i === 24) return 96.5; // Red
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize whale at resistance level', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Rally to resistance
    const up = Array.from({ length: 22 }, (_, i) => 90 + i * 0.6);
    // Whale selling
    const selling = [111, 110, 109];
    const closes = [...up, ...selling];

    const volumes = closes.map((_, i) => {
      if (i === 23) return 16000; // Whale volume
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 23) return 113; // Strong red
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WhaleAnalyzerNew - Functional: Whale with Pattern Confirmation', () => {
  it('should identify bullish whale during reversal', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 13 }, () => 115);
    // Downtrend establishes
    const down = Array.from({ length: 8 }, (_, i) => 115 - i * 1.5);
    // Capitulation down
    const cap = [95];
    // Whale enters
    const whale = [98, 101, 105];
    const closes = [...initial, ...down, ...cap, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 22) return 20000; // Monster volume whale
      return 1100;
    });

    const opens = closes.map((_, i) => {
      if (i === 22) return 96; // Big green
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize bearish whale during reversal', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Initial consolidation
    const initial = Array.from({ length: 13 }, () => 85);
    // Uptrend establishes
    const up = Array.from({ length: 8 }, (_, i) => 85 + i * 1.5);
    // Spike up
    const spike = [113];
    // Whale exits
    const whale = [108, 103, 98];
    const closes = [...initial, ...up, ...spike, ...whale];

    const volumes = closes.map((_, i) => {
      if (i === 22) return 19000; // Monster volume
      return 1100;
    });

    const opens = closes.map((_, i) => {
      if (i === 22) return 115; // Big red
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WhaleAnalyzerNew - Functional: Whale Accumulation/Distribution', () => {
  it('should detect accumulation sequence', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Quiet market
    const quiet = Array.from({ length: 25 }, () => 100);
    // Whale enters gradually
    const accum = [99, 99.5, 99, 99.8, 100];
    const closes = [...quiet, ...accum];

    const volumes = closes.map((_, i) => {
      if (i >= 25 && i <= 27) return 12000;
      return 900;
    });

    const opens = closes.map((_, i) => {
      if (i >= 25 && i <= 27) return closes[i] - 0.5;
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify distribution sequence', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Quiet market
    const quiet = Array.from({ length: 25 }, () => 100);
    // Whale exits gradually
    const distrib = [100.5, 100, 100.5, 100.2, 100];
    const closes = [...quiet, ...distrib];

    const volumes = closes.map((_, i) => {
      if (i >= 25 && i <= 27) return 13000;
      return 900;
    });

    const opens = closes.map((_, i) => {
      if (i >= 25 && i <= 27) return closes[i] + 0.5;
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('WhaleAnalyzerNew - Functional: Whale in Extreme Conditions', () => {
  it('should handle whale during panic selling', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Sharp decline
    const panic = Array.from({ length: 23 }, (_, i) => 110 - i * 1);
    // Whale support
    const support = [92, 91];
    const closes = [...panic, ...support];

    const volumes = closes.map((_, i) => {
      if (i === 23) return 25000; // Huge whale buy
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 23) return 89;
      return closes[i] - 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect whale during euphoria selling', () => {
    const analyzer = new WhaleAnalyzerNew(createConfig());
    // Sharp rally
    const euphoria = Array.from({ length: 23 }, (_, i) => 90 + i * 1);
    // Whale resistance
    const resistance = [110, 111];
    const closes = [...euphoria, ...resistance];

    const volumes = closes.map((_, i) => {
      if (i === 23) return 22000; // Huge whale sell
      return 1000;
    });

    const opens = closes.map((_, i) => {
      if (i === 23) return 113;
      return closes[i] + 0.1;
    });

    const candles = createCandlesWithVolume(closes, volumes, opens);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
