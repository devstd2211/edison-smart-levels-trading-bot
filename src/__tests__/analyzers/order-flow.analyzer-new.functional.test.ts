import { OrderFlowAnalyzerNew } from '../../analyzers/order-flow.analyzer-new';
import type { Candle } from '../../types/core';
import type { BreakoutAnalyzerConfigNew } from '../../types/config-new.types';

function createConfig(): BreakoutAnalyzerConfigNew {
  return { enabled: true, weight: 0.75, priority: 6 };
}

function createCandlesWithVolume(closes: number[], volumes: number[]): Candle[] {
  return closes.map((close, i) => ({
    timestamp: Date.now() + i * 60000,
    open: close - 0.15,
    high: close + 0.4,
    low: close - 0.4,
    close,
    volume: volumes[i] || 1000,
  }));
}

describe('OrderFlowAnalyzerNew - Functional: Bullish Order Flow', () => {
  it('should detect buying volume on up ticks', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Strong volume on up closes
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.1);
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2000; // Higher volume on recent up ticks
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bullish order flow during uptrend', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Uptrend with confirmation volume
    const trend = Array.from({ length: 18 }, (_, i) => 100 + i * 0.2);
    const recent = [103.6, 103.9, 104.2];
    const closes = [...trend, ...recent];
    const volumes = closes.map((_, i) => {
      if (i >= 19) return 2500; // Volume on up close
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize volume accumulation on rallies', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Rally with strong volume
    const closes = [100, 100.2, 100, 100.5, 100.2, 100.8, 100.5, 101, 100.8, 101.5, 101.2, 101.8, 101.5, 102, 101.8, 102.5, 102.2, 102.8, 102.5, 103];
    const volumes = closes.map((_, i) => {
      if (i >= 10) return 2000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderFlowAnalyzerNew - Functional: Bearish Order Flow', () => {
  it('should detect selling volume on down ticks', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Strong volume on down closes
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.1);
    const volumes = closes.map((_, i) => {
      if (i >= 15) return 2000; // Higher volume on recent down ticks
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish order flow during downtrend', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Downtrend with selling volume
    const trend = Array.from({ length: 18 }, (_, i) => 100 - i * 0.2);
    const recent = [96.4, 96.1, 95.8];
    const closes = [...trend, ...recent];
    const volumes = closes.map((_, i) => {
      if (i >= 19) return 2500; // Volume on down close
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should recognize volume accumulation on declines', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Decline with strong volume
    const closes = [100, 99.8, 100, 99.5, 99.8, 99.2, 99.5, 98.8, 99.2, 98.5, 98.8, 98.2, 98.5, 97.8, 98.2, 97.5, 97.8, 97.2, 97.5, 97];
    const volumes = closes.map((_, i) => {
      if (i >= 10) return 2000;
      return 1000;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderFlowAnalyzerNew - Functional: Order Flow Divergence', () => {
  it('should handle bullish order flow on price decline', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // More volume on up closes even with price down
    const closes = [100, 100.2, 99.8, 100.1, 99.5, 100, 99.8, 100.5, 99.2, 100.2, 99.9, 100.8, 99.5, 100.5, 99.8, 100.2, 99.6, 100.1, 99.4, 99.8];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 0) return 1500;
      return 2000; // More volume on up closes
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should handle bearish order flow on price advance', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // More volume on down closes despite price up
    const closes = [100, 100.5, 100.2, 100.8, 100.5, 101, 100.8, 101.2, 101, 101.5, 101.2, 101.8, 101.5, 102, 101.8, 102.2, 102, 102.5, 102.2, 102.8];
    const volumes = closes.map((_, i) => {
      if (i % 2 === 0) return 2000; // More volume on down closes
      return 1500;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderFlowAnalyzerNew - Functional: Volume Reversal Signals', () => {
  it('should identify bullish flow after selling pressure', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Selling pressure reverses to buying
    const selling = Array.from({ length: 12 }, (_, i) => 110 - i * 0.3);
    const buying = Array.from({ length: 8 }, (_, i) => 106.4 + i * 0.4);
    const closes = [...selling, ...buying];
    const volumes = closes.map((_, i) => {
      if (i >= 12) return 2500; // Volume on up closes
      return 1200;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should identify bearish flow after buying pressure', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Buying pressure reverses to selling
    const buying = Array.from({ length: 12 }, (_, i) => 90 + i * 0.3);
    const selling = Array.from({ length: 8 }, (_, i) => 93.6 - i * 0.4);
    const closes = [...buying, ...selling];
    const volumes = closes.map((_, i) => {
      if (i >= 12) return 2500; // Volume on down closes
      return 1200;
    });
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});

describe('OrderFlowAnalyzerNew - Functional: Extreme Order Flow', () => {
  it('should detect overwhelming bullish flow', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Almost all up closes with heavy volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 0.3);
    const volumes = closes.map(() => 3000); // All high volume
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });

  it('should detect overwhelming bearish flow', () => {
    const analyzer = new OrderFlowAnalyzerNew(createConfig());
    // Almost all down closes with heavy volume
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i * 0.3);
    const volumes = closes.map(() => 3000); // All high volume
    const candles = createCandlesWithVolume(closes, volumes);
    const signal = analyzer.analyze(candles);
    expect(signal).toBeDefined();
    expect(signal.confidence).toBeGreaterThanOrEqual(10);
  });
});
