/**
 * Weight Matrix Calculator Service Tests
 * Tests gradient scoring system for signal confidence calculation
 */

import { WeightMatrixCalculatorService } from '../../services/weight-matrix-calculator.service';
import {
  WeightMatrixConfig,
  WeightMatrixInput,
  SignalDirection,
  LoggerService,
  LogLevel,
} from '../../types';

describe('WeightMatrixCalculatorService', () => {
  let calculator: WeightMatrixCalculatorService;
  let logger: LoggerService;
  let config: WeightMatrixConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);

    // Default config (all weights enabled)
    config = {
      enabled: true,
      minConfidenceToEnter: 65,
      minConfidenceForReducedSize: 50,
      reducedSizeMultiplier: 0.5,
      weights: {
        rsi: {
          enabled: true,
          maxPoints: 20,
          thresholds: { excellent: 20, good: 30, ok: 40, weak: 50 },
        },
        stochastic: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 15, good: 20, ok: 30 },
        },
        ema: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 0.5, good: 1.0, ok: 1.5 },
        },
        bollingerBands: {
          enabled: true,
          maxPoints: 20,
          thresholds: { excellent: 95, good: 85, ok: 75 },
        },
        atr: {
          enabled: true,
          maxPoints: 10,
          thresholds: { excellent: 2.0, good: 1.5, ok: 1.2 },
        },
        volume: {
          enabled: true,
          maxPoints: 25,
          thresholds: { excellent: 2.0, good: 1.5, ok: 1.2, weak: 1.0 },
        },
        delta: {
          enabled: false,
          maxPoints: 15,
          thresholds: { excellent: 2.0, good: 1.5, ok: 1.0 },
        },
        orderbook: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 20, good: 15, ok: 10 },
        },
        imbalance: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 60, good: 45, ok: 30 },
        },
        levelStrength: {
          enabled: true,
          maxPoints: 20,
          thresholds: { excellent: 4, good: 3, ok: 2 },
        },
        levelDistance: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 0.2, good: 0.5, ok: 1.0, weak: 1.5 },
        },
        swingPoints: {
          enabled: true,
          maxPoints: 10,
          thresholds: {},
        },
        chartPatterns: {
          enabled: true,
          maxPoints: 20,
          thresholds: { excellent: 90, good: 70, ok: 50 },
        },
        candlePatterns: {
          enabled: true,
          maxPoints: 15,
          thresholds: { excellent: 90, good: 70, ok: 50 },
        },
        seniorTFAlignment: {
          enabled: true,
          maxPoints: 20,
          thresholds: {},
        },
        btcCorrelation: {
          enabled: true,
          maxPoints: 15,
          thresholds: {},
        },
        tfAlignment: {
          enabled: true,
          maxPoints: 20,
          thresholds: { excellent: 90, good: 70, ok: 50 },
        },
        divergence: {
          enabled: true,
          maxPoints: 25,
          thresholds: {},
        },
        liquiditySweep: {
          enabled: true,
          maxPoints: 20,
          thresholds: {},
        },
      },
    };

    calculator = new WeightMatrixCalculatorService(config, logger);
  });

  // ========================================================================
  // DISABLED MODE
  // ========================================================================

  describe('disabled mode', () => {
    it('should return 100% confidence when disabled', () => {
      config.enabled = false;
      calculator = new WeightMatrixCalculatorService(config, logger);

      const input: WeightMatrixInput = {
        rsi: 50,
        volume: { current: 100, average: 100 },
      };

      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.confidence).toBe(100);
      expect(result.totalScore).toBe(100);
      expect(result.maxPossibleScore).toBe(100);
      expect(Object.keys(result.contributions).length).toBe(0);
    });
  });

  // ========================================================================
  // RSI SCORING
  // ========================================================================

  describe('RSI scoring', () => {
    it('should score LONG RSI excellent (< 20)', () => {
      const input: WeightMatrixInput = { rsi: 18 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi).toBeDefined();
      expect(result.contributions.rsi.points).toBe(20); // maxPoints
      expect(result.contributions.rsi.reason).toContain('excellent');
    });

    it('should score LONG RSI good (20-30)', () => {
      const input: WeightMatrixInput = { rsi: 25 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi.points).toBe(15); // 75% of 20
      expect(result.contributions.rsi.reason).toContain('good');
    });

    it('should score LONG RSI ok (30-40)', () => {
      const input: WeightMatrixInput = { rsi: 35 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi.points).toBe(10); // 50% of 20
      expect(result.contributions.rsi.reason).toContain('ok');
    });

    it('should score LONG RSI weak (40-50)', () => {
      const input: WeightMatrixInput = { rsi: 45 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi.points).toBe(5); // 25% of 20
      expect(result.contributions.rsi.reason).toContain('weak');
    });

    it('should score LONG RSI zero (> 50)', () => {
      const input: WeightMatrixInput = { rsi: 60 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi.points).toBe(0);
      expect(result.contributions.rsi.reason).toContain('not extreme');
    });

    it('should score SHORT RSI excellent (> 80)', () => {
      const input: WeightMatrixInput = { rsi: 85 };
      const result = calculator.calculateScore(input, SignalDirection.SHORT);

      expect(result.contributions.rsi.points).toBe(20); // maxPoints
      expect(result.contributions.rsi.reason).toContain('excellent');
    });

    it('should score SHORT RSI good (70-80)', () => {
      const input: WeightMatrixInput = { rsi: 75 };
      const result = calculator.calculateScore(input, SignalDirection.SHORT);

      expect(result.contributions.rsi.points).toBe(15); // 75% of 20
      expect(result.contributions.rsi.reason).toContain('good');
    });

    it('should handle RSI edge case (exactly 30)', () => {
      const input: WeightMatrixInput = { rsi: 30 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi.points).toBe(15); // good threshold
    });

    it('should skip RSI when not provided', () => {
      const input: WeightMatrixInput = { volume: { current: 100, average: 100 } };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi).toBeUndefined();
    });

    it('should skip RSI when disabled', () => {
      config.weights.rsi.enabled = false;
      calculator = new WeightMatrixCalculatorService(config, logger);

      const input: WeightMatrixInput = { rsi: 20 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.rsi).toBeUndefined();
    });
  });

  // ========================================================================
  // VOLUME SCORING
  // ========================================================================

  describe('volume scoring', () => {
    it('should score volume excellent (>= 2.0x)', () => {
      const input: WeightMatrixInput = {
        volume: { current: 200, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume.points).toBe(25); // maxPoints
      expect(result.contributions.volume.reason).toContain('excellent');
    });

    it('should score volume good (1.5x-2.0x)', () => {
      const input: WeightMatrixInput = {
        volume: { current: 175, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume.points).toBe(18.75); // 75% of 25
      expect(result.contributions.volume.reason).toContain('good');
    });

    it('should score volume ok (1.2x-1.5x)', () => {
      const input: WeightMatrixInput = {
        volume: { current: 130, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume.points).toBe(12.5); // 50% of 25
      expect(result.contributions.volume.reason).toContain('ok');
    });

    it('should score volume weak (1.0x-1.2x)', () => {
      const input: WeightMatrixInput = {
        volume: { current: 110, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume.points).toBe(6.25); // 25% of 25
      expect(result.contributions.volume.reason).toContain('weak');
    });

    it('should score volume zero (< 1.0x)', () => {
      const input: WeightMatrixInput = {
        volume: { current: 80, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume.points).toBe(0);
      expect(result.contributions.volume.reason).toContain('too low');
    });

    it('should handle zero average volume', () => {
      const input: WeightMatrixInput = {
        volume: { current: 100, average: 0 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Should not crash, but score will be very high (Infinity)
      expect(result.contributions.volume).toBeDefined();
    });

    it('should skip volume when not provided', () => {
      const input: WeightMatrixInput = { rsi: 20 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.volume).toBeUndefined();
    });
  });

  // ========================================================================
  // EMA SCORING
  // ========================================================================

  describe('EMA scoring', () => {
    it('should score LONG EMA excellent (aligned + distance <= 0.5%)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 95, price: 100.4 }, // 0.4% distance
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema.points).toBe(15); // maxPoints
      expect(result.contributions.ema.reason).toContain('excellent');
    });

    it('should score LONG EMA good (aligned + distance 0.5%-1.0%)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 95, price: 100.7 }, // 0.7% distance
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema.points).toBe(11.25); // 75% of 15
      expect(result.contributions.ema.reason).toContain('good');
    });

    it('should score LONG EMA ok (aligned + distance 1.0%-1.5%)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 95, price: 101.2 }, // 1.2% distance
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema.points).toBe(7.5); // 50% of 15
      expect(result.contributions.ema.reason).toContain('ok');
    });

    it('should score LONG EMA zero (distance > 1.5%)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 95, price: 102 }, // 2% distance
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema.points).toBe(0);
      expect(result.contributions.ema.reason).toContain('too far');
    });

    it('should score LONG EMA zero (not aligned)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 95, slow: 100, price: 100.4 }, // Wrong alignment (fast < slow)
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema.points).toBe(0);
      expect(result.contributions.ema.reason).toContain('not aligned');
    });

    it('should score SHORT EMA excellent (aligned + distance <= 0.5%)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 105, price: 99.6 }, // 0.4% distance below fast
      };
      const result = calculator.calculateScore(input, SignalDirection.SHORT);

      expect(result.contributions.ema.points).toBe(15); // maxPoints
      expect(result.contributions.ema.reason).toContain('excellent');
    });

    it('should score SHORT EMA zero (not aligned)', () => {
      const input: WeightMatrixInput = {
        ema: { fast: 100, slow: 95, price: 99.6 }, // Wrong alignment (fast > slow)
      };
      const result = calculator.calculateScore(input, SignalDirection.SHORT);

      expect(result.contributions.ema.points).toBe(0);
      expect(result.contributions.ema.reason).toContain('not aligned');
    });

    it('should skip EMA when not provided', () => {
      const input: WeightMatrixInput = { rsi: 20 };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.contributions.ema).toBeUndefined();
    });
  });

  // ========================================================================
  // COMBINED SCORING
  // ========================================================================

  describe('combined scoring', () => {
    it('should combine multiple excellent factors', () => {
      const input: WeightMatrixInput = {
        rsi: 18, // 20 pts (excellent)
        volume: { current: 200, average: 100 }, // 25 pts (excellent)
        ema: { fast: 100, slow: 95, price: 100.3 }, // 15 pts (excellent)
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.totalScore).toBe(60); // 20 + 25 + 15
      expect(result.maxPossibleScore).toBe(60);
      expect(result.confidence).toBe(1.0); // Perfect score (decimal 0-1, not percentage)
      expect(Object.keys(result.contributions).length).toBe(3);
    });

    it('should combine multiple weak factors to reach threshold', () => {
      const input: WeightMatrixInput = {
        rsi: 45, // 5 pts (weak = 25%)
        volume: { current: 110, average: 100 }, // 6.25 pts (weak = 25%)
        levelStrength: { touches: 2, strength: 0.5 }, // 10 pts (ok = 50%)
        levelDistance: { percent: 0.3 }, // 11.25 pts (good = 75%)
        swingPoints: { quality: 0.8 }, // 8 pts (80%)
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Total: 5 + 6.25 + 10 + 11.25 + 8 = 40.5
      // Max: 20 + 25 + 20 + 15 + 10 = 90
      // Confidence: 40.5 / 90 = 0.45 (45% as decimal)
      expect(result.totalScore).toBeCloseTo(40.5, 1);
      expect(result.maxPossibleScore).toBe(90);
      expect(result.confidence).toBeCloseTo(0.45, 2);
    });

    it('should handle all factors enabled', () => {
      const input: WeightMatrixInput = {
        rsi: 25,
        stochastic: { k: 18, d: 20 },
        ema: { fast: 100, slow: 95, price: 100.3 },
        bollingerBands: { position: 10 },
        atr: { current: 1.5, average: 1.0 },
        volume: { current: 150, average: 100 },
        orderbook: { wallStrength: 18 },
        levelStrength: { touches: 4, strength: 0.9 },
        levelDistance: { percent: 0.25 },
        swingPoints: { quality: 0.9 },
        chartPatterns: { type: 'DoubleBottom', strength: 85 },
        candlePatterns: { type: 'Engulfing', strength: 80 },
        seniorTFAlignment: { aligned: true, strength: 1.0 },
        btcCorrelation: { correlation: 0.8 },
        divergence: { type: 'BULLISH', strength: 0.9 },
        liquiditySweep: { detected: true, confidence: 0.85 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(Object.keys(result.contributions).length).toBe(16); // All except delta (disabled)
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.maxPossibleScore).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.70); // Should be high with all factors good (decimal 0-1)
    });

    it('should handle empty input (no factors)', () => {
      const input: WeightMatrixInput = {};
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      expect(result.totalScore).toBe(0);
      expect(result.maxPossibleScore).toBe(0);
      expect(result.confidence).toBe(0);
      expect(Object.keys(result.contributions).length).toBe(0);
    });
  });

  // ========================================================================
  // CONFIDENCE THRESHOLDS
  // ========================================================================

  describe('confidence thresholds', () => {
    it('should return true for shouldEnter when confidence >= 65%', () => {
      const result = calculator.shouldEnter(65);
      expect(result).toBe(true);

      const result2 = calculator.shouldEnter(80);
      expect(result2).toBe(true);
    });

    it('should return false for shouldEnter when confidence < 65%', () => {
      const result = calculator.shouldEnter(64);
      expect(result).toBe(false);

      const result2 = calculator.shouldEnter(50);
      expect(result2).toBe(false);
    });

    it('should return true for shouldEnterWithReducedSize when confidence 50-64%', () => {
      const result = calculator.shouldEnterWithReducedSize(50);
      expect(result).toBe(true);

      const result2 = calculator.shouldEnterWithReducedSize(60);
      expect(result2).toBe(true);
    });

    it('should return false for shouldEnterWithReducedSize when confidence >= 65%', () => {
      const result = calculator.shouldEnterWithReducedSize(65);
      expect(result).toBe(false);

      const result2 = calculator.shouldEnterWithReducedSize(80);
      expect(result2).toBe(false);
    });

    it('should return false for shouldEnterWithReducedSize when confidence < 50%', () => {
      const result = calculator.shouldEnterWithReducedSize(49);
      expect(result).toBe(false);

      const result2 = calculator.shouldEnterWithReducedSize(30);
      expect(result2).toBe(false);
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe('edge cases', () => {
    it('should handle NaN values gracefully', () => {
      const input: WeightMatrixInput = {
        rsi: NaN,
        volume: { current: NaN, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Should not crash
      expect(result).toBeDefined();
    });

    it('should handle negative values', () => {
      const input: WeightMatrixInput = {
        rsi: -10,
        volume: { current: -100, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Should not crash
      expect(result).toBeDefined();
    });

    it('should handle very high values', () => {
      const input: WeightMatrixInput = {
        rsi: 150,
        volume: { current: 10000, average: 100 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Should not crash
      expect(result).toBeDefined();
    });

    it('should handle zero values', () => {
      const input: WeightMatrixInput = {
        rsi: 0,
        volume: { current: 0, average: 0 },
        levelStrength: { touches: 0, strength: 0 },
      };
      const result = calculator.calculateScore(input, SignalDirection.LONG);

      // Should not crash
      expect(result).toBeDefined();
    });
  });
});
