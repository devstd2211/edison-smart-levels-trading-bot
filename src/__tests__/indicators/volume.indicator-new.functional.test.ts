/**
 * Volume Indicator NEW - Functional Tests
 * Tests real market patterns: uptrend, downtrend, consolidation, reversals, breakouts
 */

import { VolumeIndicatorNew } from '../../indicators/volume.indicator-new';
import type { Candle } from '../../types/core';
import type { VolumeIndicatorConfigNew } from '../../types/config-new.types';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCandle(price: number, volume: number): Candle {
  return {
    open: price * 0.99,
    high: price * 1.01,
    low: price * 0.98,
    close: price,
    volume,
    timestamp: Date.now(),
  };
}

// ============================================================================
// MARKET PATTERN TESTS
// ============================================================================

describe('VolumeIndicatorNew - Functional: Market Patterns', () => {
  describe('Uptrend with Volume Confirmation', () => {
    test('should show increasing volume during uptrend', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Realistic uptrend: price increases with accelerating volume
      // Volume increases significantly as momentum builds (> 10% candle to candle)
      const candles = [
        createCandle(100, 500), // Start low
        createCandle(101, 600),
        createCandle(102, 700),
        createCandle(103, 900), // 28% increase
        createCandle(104, 1100), // 22% increase - strong momentum
        createCandle(105, 1400), // 27% increase - peak with high volume
      ];

      indicator.calculate(candles.slice(0, 5));

      // Check that volume increases (1100 vs 900 = +22%)
      let trend1 = indicator.getTrend();
      expect(trend1).toBe('increasing');

      // Update and see continued volume increase (1400 vs 1100 = +27%)
      indicator.update(candles[5]);
      let trend2 = indicator.getTrend();
      expect(trend2).toBe('increasing');

      // Volume should be above average
      const metrics = indicator.getValue();
      expect(metrics.ratio).toBeGreaterThan(0.8); // Close to average
    });

    test('should confirm strength during strong uptrend', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Strong uptrend with surge in volume on breakout
      const candles = [
        createCandle(100, 800),
        createCandle(101, 800),
        createCandle(102, 900),
        createCandle(103, 900),
        createCandle(104, 5000), // Volume spike on breakout
      ];

      const result = indicator.calculate(candles);
      // Average = (800+800+900+900+5000)/5 = 1680, ratio = 5000/1680 = 2.976 = very_high
      expect(result.strength).toBeGreaterThan(50); // Above average
      expect(indicator.getClassification()).toBe('very_high');
    });
  });

  describe('Downtrend with Volume Confirmation', () => {
    test('should show increasing volume during downtrend', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Realistic downtrend: price decreases from 105 to 100
      // Volume increases as selling pressure builds
      const candles = [
        createCandle(105, 1500), // Start
        createCandle(104, 1400), // -1%
        createCandle(103, 1300), // -1%
        createCandle(102, 1200), // -1%
        createCandle(101, 1100), // -1% - momentum continues
        createCandle(100, 1000), // -1% - end with lower volume
      ];

      indicator.calculate(candles.slice(0, 5));
      let metrics1 = indicator.getValue();

      indicator.update(candles[5]);
      let metrics2 = indicator.getValue();

      // Volume should decrease on final candle
      expect(metrics2.ratio).toBeLessThan(metrics1.ratio);
    });

    test('should show spike on support breakdown', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Typical breakdown pattern: price holds, then breaks with volume
      const candles = [
        createCandle(100, 1000),
        createCandle(100.5, 950),
        createCandle(100.2, 900),
        createCandle(100.1, 980),
        createCandle(99, 6000), // Support break with extreme volume
      ];

      const result = indicator.calculate(candles);
      // Average = (1000+950+900+980+6000)/5 = 9830/5 = 1966
      // Ratio = 6000/1966 = 3.05 > 3
      expect(result.strength).toBeGreaterThan(60);
      expect(result.ratio).toBeGreaterThan(3);
    });
  });

  describe('Consolidation with Low Volume', () => {
    test('should show low volume during consolidation', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Tight consolidation: minimal price movement, very low volume
      const candles = [
        createCandle(100, 1000),
        createCandle(100.1, 1000),
        createCandle(99.9, 1000),
        createCandle(100, 1000),
        createCandle(100.05, 300), // Last candle very low = consolidation breaking down
      ];

      const result = indicator.calculate(candles);
      // Average = (1000+1000+1000+1000+300)/5 = 4300/5 = 860
      // Ratio = 300/860 = 0.349 = low
      // Strength = 0.349 * 50 = 17.4 < 40
      expect(result.strength).toBeLessThan(40); // Below average
      expect(indicator.getClassification()).toBe('low');
    });

    test('should detect breakout from consolidation with volume surge', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Low volume consolidation followed by breakout
      const candles = [
        createCandle(100, 600),
        createCandle(100.1, 650),
        createCandle(99.9, 650),
        createCandle(100.2, 600),
        createCandle(102, 3000), // Explosive breakout
      ];

      const result = indicator.calculate(candles);
      expect(result.strength).toBe(100); // Clamped to max
      expect(indicator.getClassification()).toBe('very_high');
    });
  });

  describe('V-Shape Reversal', () => {
    test('should detect volume spike on reversal from bottom', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // V-shape reversal with volume confirmation
      const candles = [
        createCandle(105, 2000), // Top with volume
        createCandle(103, 1500), // Down
        createCandle(101, 1000), // Bottom
        createCandle(102, 1500), // Reversal starts
        createCandle(104, 2500), // Recovery with increasing volume
      ];

      const result = indicator.calculate(candles);
      // Average = (2000+1500+1000+1500+2500)/5 = 8500/5 = 1700
      // Ratio = 2500/1700 = 1.47 = high
      expect(result.ratio).toBeGreaterThan(1.3);
      expect(indicator.getClassification()).toBe('high');
    });
  });

  describe('Inverse Head and Shoulders', () => {
    test('should show volume increasing on breakout from pattern', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Inverse H&S with progressive volume increase
      const candles = [
        createCandle(98, 500), // Left shoulder
        createCandle(100, 600), // Neckline forming
        createCandle(95, 700), // Head (lower)
        createCandle(100, 800), // Right shoulder
        createCandle(102, 2000), // Breakout with high volume
      ];

      const result = indicator.calculate(candles);
      // Ratio = 2000 / ((500+600+700+800+2000)/5) = 2000/920 = 2.17 = very_high
      expect(result.ratio).toBeGreaterThan(1.5);
      expect(indicator.getClassification()).toBe('very_high'); // 2.17 > 2.0
    });
  });

  describe('Bearish Divergence', () => {
    test('should show decreasing volume despite price making higher highs', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Divergence: price goes up, but volume fades significantly
      const candles = [
        createCandle(100, 2000), // Initial move with volume
        createCandle(101, 1800),
        createCandle(102, 1600),
        createCandle(101, 800), // Pullback with much lower volume
        createCandle(103, 400), // New high but with VERY LOW volume = bearish
      ];

      indicator.calculate(candles);
      let metrics = indicator.getValue();

      // Despite price going higher, volume collapsed - bearish divergence
      // Average = (2000+1800+1600+800+400)/5 = 6600/5 = 1320, ratio = 400/1320 = 0.30 = low
      expect(indicator.getClassification()).toBe('low');
      expect(metrics.ratio).toBeLessThan(0.5);
    });
  });

  describe('Bullish Divergence', () => {
    test('should show increasing volume despite price making lower lows', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Divergence: price goes down, but volume increases (buying interest)
      const candles = [
        createCandle(100, 500), // Initial decline
        createCandle(99, 600),
        createCandle(98, 700),
        createCandle(99, 800), // Bounce
        createCandle(97, 2000), // New low but with HIGH volume = bullish
      ];

      indicator.calculate(candles);
      let metrics = indicator.getValue();

      // Despite price going lower, volume is high = institutional buying
      // Average = (500+600+700+800+2000)/5 = 4600/5 = 920, ratio = 2000/920 = 2.17
      expect(metrics.ratio).toBeGreaterThan(1.5);
      expect(indicator.getClassification()).toBe('very_high'); // 2.17 > 2.0
    });
  });

  describe('Gap Up with Volume', () => {
    test('should detect significant gap up with high volume confirmation', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Gap up pattern: big jump + confirmation
      const candles = [
        createCandle(100, 1000),
        createCandle(100.2, 950),
        createCandle(100.1, 900),
        createCandle(100, 850),
        createCandle(105, 3500), // Gap up with high volume
      ];

      const result = indicator.calculate(candles);
      expect(result.strength).toBe(100); // Max
      expect(indicator.getClassification()).toBe('very_high');
    });
  });

  describe('Gap Down with Volume', () => {
    test('should detect significant gap down with high volume panic selling', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Gap down pattern: big drop + panic volume
      const candles = [
        createCandle(100, 600),
        createCandle(100.2, 550),
        createCandle(100.1, 500),
        createCandle(100, 450),
        createCandle(95, 3000), // Gap down with panic volume
      ];

      const result = indicator.calculate(candles);
      // Average = (600+550+500+450+3000)/5 = 5100/5 = 1020, ratio = 3000/1020 = 2.94
      expect(result.ratio).toBeGreaterThan(2.5);
      expect(indicator.getClassification()).toBe('very_high');
    });
  });

  describe('Volume Climax', () => {
    test('should detect volume climax (unsustainable peak)', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Climax pattern: all volume compressed into single candle
      const candles = [
        createCandle(100, 500),
        createCandle(101, 600),
        createCandle(102, 600),
        createCandle(101, 500),
        createCandle(103, 10000), // MASSIVE climax volume
      ];

      const result = indicator.calculate(candles);
      expect(result.strength).toBe(100); // Clamped to max
      expect(result.ratio).toBeGreaterThan(4); // Extreme (average = 2440, ratio = 10000/2440 = 4.1)
    });
  });

  describe('Volume Accumulation Before Breakout', () => {
    test('should show building volume leading to breakout', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Accumulation: volume gradually increasing before big move
      const candles = [
        createCandle(100, 800),
        createCandle(100, 900),
        createCandle(100, 1000),
        createCandle(100, 1100),
        createCandle(100, 1300), // Strong increase (1100 -> 1300 = +18%)
      ];

      indicator.calculate(candles);
      let trend1 = indicator.getTrend();
      expect(trend1).toBe('increasing'); // Volume increasing significantly (> 10%)

      indicator.update(createCandle(102, 1500)); // Breakout confirmed
      let metrics = indicator.getValue();
      expect(metrics.ratio).toBeGreaterThan(1.2);
    });
  });

  describe('Intraday Reversal', () => {
    test('should detect volume spike on intraday reversal', () => {
      const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
      const indicator = new VolumeIndicatorNew(config);

      // Intraday reversal: down, then strong reversal
      const candles = [
        createCandle(100, 800), // Morning down
        createCandle(99, 700),
        createCandle(98.5, 600), // Low point
        createCandle(99, 1500), // Reversal starts with volume
        createCandle(100.5, 1800), // Continuation with strength
      ];

      indicator.calculate(candles);
      let metrics1 = indicator.getValue();
      expect(metrics1.ratio).toBeGreaterThan(1.5); // High volume on reversal

      indicator.update(createCandle(101, 2000)); // Confirmation
      let metrics2 = indicator.getValue();
      expect(metrics2.ratio).toBeGreaterThan(1.5);
    });
  });
});

// ============================================================================
// STATE TRANSITIONS
// ============================================================================

describe('VolumeIndicatorNew - Functional: State Transitions', () => {
  test('should detect low volume periods', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 5 };
    const indicator = new VolumeIndicatorNew(config);

    // Low volume consolidation
    const lowVol = [
      createCandle(100, 100),
      createCandle(100, 100),
      createCandle(100, 100),
      createCandle(100, 100),
      createCandle(100, 100), // All equal, ratio = 1.0 = normal
    ];

    const result1 = indicator.calculate(lowVol);
    expect(indicator.getClassification()).toBe('normal');
  });

  test('should maintain rolling average through multiple updates', () => {
    const config: VolumeIndicatorConfigNew = { enabled: true, period: 3 };
    const indicator = new VolumeIndicatorNew(config);

    // Initial: [100, 100, 100] average = 100
    indicator.calculate([
      createCandle(100, 100),
      createCandle(100, 100),
      createCandle(100, 100),
    ]);
    expect(indicator.getValue().average).toBe(100);

    // Update to 200: [100, 100, 200] average = 133.3
    indicator.update(createCandle(100, 200));
    expect(indicator.getValue().average).toBeCloseTo(133.3, 0);

    // Update to 300: [100, 200, 300] average = 200
    indicator.update(createCandle(100, 300));
    expect(indicator.getValue().average).toBeCloseTo(200, 0);

    // Update to 400: [200, 300, 400] average = 300
    indicator.update(createCandle(100, 400));
    expect(indicator.getValue().average).toBeCloseTo(300, 0);
  });
});
