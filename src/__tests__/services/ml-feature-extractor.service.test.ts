/**
 * ML Feature Extractor Service Tests
 */

import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { LoggerService, LogLevel, Candle } from '../../types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockCandle(close: number, high: number, low: number, volume: number = 1000): Candle {
  return {
    timestamp: Date.now(),
    open: close,
    high,
    low,
    close,
    volume,
  };
}

function createCandleSequence(length: number, startPrice: number = 100): Candle[] {
  const candles: Candle[] = [];
  let price = startPrice;

  for (let i = 0; i < length; i++) {
    const change = (Math.random() - 0.5) * 2; // ±1 price change
    price += change;
    const high = price + Math.random();
    const low = price - Math.random();

    candles.push(createMockCandle(price, high, low, 1000 + Math.random() * 500));
  }

  return candles;
}

// ============================================================================
// TESTS
// ============================================================================

describe('MLFeatureExtractorService', () => {
  let service: MLFeatureExtractorService;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    service = new MLFeatureExtractorService(logger);
  });

  describe('extractFeatures', () => {
    it('should extract features from valid candle sequence', () => {
      const candles = createCandleSequence(50);
      const features = service.extractFeatures(candles, 'BULLISH_ENGULFING', 'WIN');

      expect(features).toBeDefined();
      expect(features.label).toBe('WIN');
      expect(features.patternType).toBe('BULLISH_ENGULFING');
      expect(features.timestamp).toBe(candles[candles.length - 1].timestamp);
    });

    it('should throw error for insufficient candles (< 5)', () => {
      const candles = createCandleSequence(3);

      expect(() => {
        service.extractFeatures(candles, 'PATTERN', 'WIN');
      }).toThrow('Need at least 5 candles');
    });

    it('should extract price action features', () => {
      const candles = createCandleSequence(20);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.priceAction).toBeDefined();
      expect(features.priceAction.highs.length).toBe(5);
      expect(features.priceAction.lows.length).toBe(5);
      expect(features.priceAction.closes.length).toBe(5);
      expect(features.priceAction.volumes.length).toBe(5);
      expect(features.priceAction.returns.length).toBe(5);
    });

    it('should extract technical indicators', () => {
      const candles = createCandleSequence(50);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.technicalIndicators).toBeDefined();
      expect(features.technicalIndicators.rsi).toBeGreaterThanOrEqual(0);
      expect(features.technicalIndicators.rsi).toBeLessThanOrEqual(100);
      expect(features.technicalIndicators.rsiTrend).toMatch(/UP|DOWN/);
      expect(features.technicalIndicators.ema20).toBeGreaterThan(0);
      expect(features.technicalIndicators.ema50).toBeGreaterThan(0);
      expect(features.technicalIndicators.emaTrend).toMatch(/ABOVE|BELOW/);
      expect(features.technicalIndicators.macdHistogram).toBeDefined();
      expect(features.technicalIndicators.macdTrend).toMatch(/POSITIVE|NEGATIVE/);
    });

    it('should extract volatility features', () => {
      const candles = createCandleSequence(50);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.volatility).toBeDefined();
      expect(features.volatility.atrPercent).toBeGreaterThanOrEqual(0);
      expect(features.volatility.bollingerWidth).toBeGreaterThanOrEqual(0);
      expect(features.volatility.volatilityRegime).toMatch(/LOW|NORMAL|HIGH/);
    });

    it('should extract order flow features', () => {
      const candles = createCandleSequence(20);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.orderFlow).toBeDefined();
      expect(features.orderFlow.bidAskImbalance).toBeGreaterThanOrEqual(-1);
      expect(features.orderFlow.bidAskImbalance).toBeLessThanOrEqual(1);
      expect(features.orderFlow.bookDepth).toBeGreaterThan(0);
      expect(features.orderFlow.microStructure).toMatch(/BULLISH|BEARISH|NEUTRAL/);
    });

    it('should handle LOSS outcome', () => {
      const candles = createCandleSequence(20);
      const features = service.extractFeatures(candles, 'PATTERN', 'LOSS');

      expect(features.label).toBe('LOSS');
    });

    it('should handle different pattern types', () => {
      const candles = createCandleSequence(20);
      const patterns = [
        'BULLISH_ENGULFING',
        'BEARISH_ENGULFING',
        'HEAD_AND_SHOULDERS',
        'TRIANGLE',
        'FLAG',
      ];

      for (const pattern of patterns) {
        const features = service.extractFeatures(candles, pattern, 'WIN');
        expect(features.patternType).toBe(pattern);
      }
    });

    it('should calculate consistent returns', () => {
      const candles = createCandleSequence(10, 100);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      const returns = features.priceAction.returns;
      expect(returns.length).toBe(5);
      expect(returns[0]).toBe(0); // First candle has 0 return
    });

    it('should handle high volatility candles', () => {
      const candles: Candle[] = [];
      let price = 100;

      for (let i = 0; i < 50; i++) {
        const change = (Math.random() - 0.5) * 10; // ±5 price change (high volatility)
        price += change;
        const high = price + 5;
        const low = price - 5;

        candles.push(createMockCandle(price, high, low, 5000 + Math.random() * 1000));
      }

      const features = service.extractFeatures(candles, 'VOLATILE', 'WIN');

      expect(features.volatility.atrPercent).toBeGreaterThanOrEqual(0);
      expect(features.volatility.volatilityRegime).toBeDefined();
    });

    it('should handle low volatility candles', () => {
      const candles: Candle[] = [];
      let price = 100;

      for (let i = 0; i < 50; i++) {
        const change = (Math.random() - 0.5) * 0.1; // ±0.05 price change (low volatility)
        price += change;
        const high = price + 0.01;
        const low = price - 0.01;

        candles.push(createMockCandle(price, high, low, 500));
      }

      const features = service.extractFeatures(candles, 'STABLE', 'WIN');

      expect(features.volatility.atrPercent).toBeLessThan(0.5);
      expect(features.volatility.volatilityRegime).toMatch(/LOW|NORMAL/);
    });

    it('should extract last 5 candles only for price action', () => {
      const candles = createCandleSequence(100);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      // Verify that price action uses the last 5 candles
      expect(features.priceAction.closes[4]).toBe(candles[candles.length - 1].close);
      expect(features.priceAction.closes[0]).toBe(candles[candles.length - 5].close);
    });

    it('should calculate RSI values in valid range', () => {
      const candles = createCandleSequence(50);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.technicalIndicators.rsi).toBeGreaterThanOrEqual(0);
      expect(features.technicalIndicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should handle EMA calculation with limited data', () => {
      const candles = createCandleSequence(10);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      // EMA50 should be calculated as SMA when < 50 candles
      expect(features.technicalIndicators.ema50).toBeGreaterThan(0);
      expect(features.technicalIndicators.ema20).toBeGreaterThan(0);
    });

    it('should detect bullish close position', () => {
      const candles: Candle[] = [];

      // Create candles with close near the top (bullish)
      for (let i = 0; i < 20; i++) {
        const low = 100;
        const high = 102;
        const close = 101.5; // Near top
        candles.push({ timestamp: Date.now() + i * 1000, open: 100.5, high, low, close, volume: 1000 });
      }

      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      // Bullish close should produce positive bid/ask imbalance
      expect(features.orderFlow.microStructure).toBe('BULLISH');
    });

    it('should detect bearish close position', () => {
      const candles: Candle[] = [];

      // Create candles with close near the bottom (bearish)
      for (let i = 0; i < 20; i++) {
        const low = 100;
        const high = 102;
        const close = 100.5; // Near bottom
        candles.push({ timestamp: Date.now() + i * 1000, open: 101.5, high, low, close, volume: 1000 });
      }

      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      // Bearish close should produce negative bid/ask imbalance
      expect(features.orderFlow.microStructure).toBe('BEARISH');
    });

    it('should handle very long candle sequence', () => {
      const candles = createCandleSequence(1000);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features).toBeDefined();
      expect(features.priceAction.closes.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 5 candles (minimum)', () => {
      const candles = createCandleSequence(5);
      const features = service.extractFeatures(candles, 'MIN', 'WIN');

      expect(features).toBeDefined();
      expect(features.priceAction.closes.length).toBe(5);
    });

    it('should handle candles with identical prices', () => {
      const candles: Candle[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createMockCandle(100, 100, 100, 1000));
      }

      const features = service.extractFeatures(candles, 'FLAT', 'WIN');

      expect(features).toBeDefined();
      expect(features.volatility.atrPercent).toBe(0);
      expect(features.technicalIndicators.rsi).toBe(50); // Neutral RSI for flat market
    });

    it('should calculate volume imbalance correctly', () => {
      const candles: Candle[] = [];

      for (let i = 0; i < 20; i++) {
        const volume = i < 18 ? 1000 : 5000; // Last 2 candles have higher volume
        candles.push(createMockCandle(100 + i, 101 + i, 99 + i, volume));
      }

      const features = service.extractFeatures(candles, 'VOLUME', 'WIN');

      expect(features.orderFlow.bidAskImbalance).toBeDefined();
      expect(Math.abs(features.orderFlow.bidAskImbalance)).toBeLessThanOrEqual(1);
    });
  });
});
