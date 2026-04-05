/**
 * ML Feature Extractor Service Tests
 */

import { MLFeatureExtractorService } from '../../services/ml-feature-extractor.service';
import { Candle } from '../../types/legacy';
import {
  createMLFeatureCandleSequence,
  createManagedMLFeatureExtractorContext,
  createMLFeatureFlatCandleSequence,
  createMLFeatureUniformCandleSequence,
  createMLFeatureVolumeImbalanceSequence,
  type ManagedMLFeatureExtractorContext,
} from '../helpers/ml-feature-extractor-test.utils';

describe('MLFeatureExtractorService', () => {
  let service: MLFeatureExtractorService;

  type MLFeatureExtractorFixtures = Pick<ManagedMLFeatureExtractorContext, 'service'>;

  function bindMLFeatureExtractorFixtures() {
    let fixtures: MLFeatureExtractorFixtures;
    let cleanup: ManagedMLFeatureExtractorContext['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedMLFeatureExtractorContext();
      fixtures = {
        service: managedContext.service,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindMLFeatureExtractorFixtures();

  beforeEach(() => {
    ({ service } = getFixtures());
  });

  describe('extractFeatures', () => {
    it('should extract features from valid candle sequence', () => {
      const candles = createMLFeatureCandleSequence(50);
      const features = service.extractFeatures(candles, 'BULLISH_ENGULFING', 'WIN');

      expect(features).toBeDefined();
      expect(features.label).toBe('WIN');
      expect(features.patternType).toBe('BULLISH_ENGULFING');
      expect(features.timestamp).toBe(candles[candles.length - 1].timestamp);
    });

    it('should throw error for insufficient candles (< 5)', () => {
      const candles = createMLFeatureCandleSequence(3);

      expect(() => {
        service.extractFeatures(candles, 'PATTERN', 'WIN');
      }).toThrow('Need at least 5 candles');
    });

    it('should extract price action features', () => {
      const candles = createMLFeatureCandleSequence(20);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.priceAction).toBeDefined();
      expect(features.priceAction.highs.length).toBe(5);
      expect(features.priceAction.lows.length).toBe(5);
      expect(features.priceAction.closes.length).toBe(5);
      expect(features.priceAction.volumes.length).toBe(5);
      expect(features.priceAction.returns.length).toBe(5);
    });

    it('should extract technical indicators', () => {
      const candles = createMLFeatureCandleSequence(50);
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
      const candles = createMLFeatureCandleSequence(50);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.volatility).toBeDefined();
      expect(features.volatility.atrPercent).toBeGreaterThanOrEqual(0);
      expect(features.volatility.bollingerWidth).toBeGreaterThanOrEqual(0);
      expect(features.volatility.volatilityRegime).toMatch(/LOW|NORMAL|HIGH/);
    });

    it('should extract order flow features', () => {
      const candles = createMLFeatureCandleSequence(20);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.orderFlow).toBeDefined();
      expect(features.orderFlow.bidAskImbalance).toBeGreaterThanOrEqual(-1);
      expect(features.orderFlow.bidAskImbalance).toBeLessThanOrEqual(1);
      expect(features.orderFlow.bookDepth).toBeGreaterThan(0);
      expect(features.orderFlow.microStructure).toMatch(/BULLISH|BEARISH|NEUTRAL/);
    });

    it('should handle LOSS outcome', () => {
      const candles = createMLFeatureCandleSequence(20);
      const features = service.extractFeatures(candles, 'PATTERN', 'LOSS');

      expect(features.label).toBe('LOSS');
    });

    it('should handle different pattern types', () => {
      const candles = createMLFeatureCandleSequence(20);
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
      const candles = createMLFeatureCandleSequence(10, { startPrice: 100 });
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      const returns = features.priceAction.returns;
      expect(returns.length).toBe(5);
      expect(returns[0]).toBe(0);
    });

    it('should handle high volatility candles', () => {
      const candles = createMLFeatureCandleSequence(50, {
        swing: 5,
        wickSize: 5,
        volumeBase: 5_000,
        volumeStep: 100,
      });
      const features = service.extractFeatures(candles, 'VOLATILE', 'WIN');

      expect(features.volatility.atrPercent).toBeGreaterThanOrEqual(0);
      expect(features.volatility.volatilityRegime).toBeDefined();
    });

    it('should handle low volatility candles', () => {
      const candles = createMLFeatureCandleSequence(50, {
        swing: 0.05,
        drift: 0,
        wickSize: 0.01,
        volumeBase: 500,
        volumeStep: 0,
      });
      const features = service.extractFeatures(candles, 'STABLE', 'WIN');

      expect(features.volatility.atrPercent).toBeLessThan(0.5);
      expect(features.volatility.volatilityRegime).toMatch(/LOW|NORMAL/);
    });

    it('should extract last 5 candles only for price action', () => {
      const candles = createMLFeatureCandleSequence(100);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.priceAction.closes[4]).toBe(candles[candles.length - 1].close);
      expect(features.priceAction.closes[0]).toBe(candles[candles.length - 5].close);
    });

    it('should calculate RSI values in valid range', () => {
      const candles = createMLFeatureCandleSequence(50);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.technicalIndicators.rsi).toBeGreaterThanOrEqual(0);
      expect(features.technicalIndicators.rsi).toBeLessThanOrEqual(100);
    });

    it('should handle EMA calculation with limited data', () => {
      const candles = createMLFeatureCandleSequence(10);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.technicalIndicators.ema50).toBeGreaterThan(0);
      expect(features.technicalIndicators.ema20).toBeGreaterThan(0);
    });

    it('should detect bullish close position', () => {
      const candles: Candle[] = createMLFeatureUniformCandleSequence(20, {
        baseTimestamp: 1_700_300_000_000,
        intervalMs: 1_000,
        open: 100.5,
        high: 102,
        low: 100,
        close: 101.5,
        volume: 1_000,
      });

      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.orderFlow.microStructure).toBe('BULLISH');
    });

    it('should detect bearish close position', () => {
      const candles: Candle[] = createMLFeatureUniformCandleSequence(20, {
        baseTimestamp: 1_700_400_000_000,
        intervalMs: 1_000,
        open: 101.5,
        high: 102,
        low: 100,
        close: 100.5,
        volume: 1_000,
      });

      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features.orderFlow.microStructure).toBe('BEARISH');
    });

    it('should handle very long candle sequence', () => {
      const candles = createMLFeatureCandleSequence(1000);
      const features = service.extractFeatures(candles, 'TEST', 'WIN');

      expect(features).toBeDefined();
      expect(features.priceAction.closes.length).toBe(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exactly 5 candles (minimum)', () => {
      const candles = createMLFeatureCandleSequence(5);
      const features = service.extractFeatures(candles, 'MIN', 'WIN');

      expect(features).toBeDefined();
      expect(features.priceAction.closes.length).toBe(5);
    });

    it('should handle candles with identical prices', () => {
      const candles = createMLFeatureFlatCandleSequence({
        count: 20,
        price: 100,
        baseTimestamp: 1_700_500_000_000,
        volume: 1_000,
      });

      const features = service.extractFeatures(candles, 'FLAT', 'WIN');

      expect(features).toBeDefined();
      expect(features.volatility.atrPercent).toBe(0);
      expect(features.technicalIndicators.rsi).toBe(50);
    });

    it('should calculate volume imbalance correctly', () => {
      const candles: Candle[] = createMLFeatureVolumeImbalanceSequence({
        count: 20,
        baseTimestamp: 1_700_600_000_000,
        basePrice: 100,
        normalVolume: 1_000,
        spikeVolume: 5_000,
        spikeFromIndex: 18,
      });

      const features = service.extractFeatures(candles, 'VOLUME', 'WIN');

      expect(features.orderFlow.bidAskImbalance).toBeDefined();
      expect(Math.abs(features.orderFlow.bidAskImbalance)).toBeLessThanOrEqual(1);
    });
  });
});
