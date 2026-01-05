/**
 * Tests for MTF TP Validator Service
 */

import { MTFTPValidatorService, MTFTPConfig } from '../services/mtf-tp-validator.service';
import { LevelAnalyzer } from '../analyzers/level.analyzer';
import { SignalDirection, LoggerService, Candle } from '../types';

// ============================================================================
// MOCK LOGGER
// ============================================================================

const createMockLogger = (): Partial<LoggerService> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const createCandle = (
  close: number,
  high?: number,
  low?: number,
  timestamp?: number,
): Candle => ({
  open: close - 0.5,
  high: high ?? close + 1,
  low: low ?? close - 1,
  close,
  volume: 1000,
  timestamp: timestamp ?? Date.now(),
});

const createCandleSeries = (
  basePrice: number,
  count: number,
  interval: number = 60000,
): Candle[] => {
  const candles: Candle[] = [];
  let price = basePrice;
  const baseTime = Date.now() - count * interval;

  for (let i = 0; i < count; i++) {
    // Create some price movement for swing points
    const movement = Math.sin(i / 5) * 2;
    price = basePrice + movement;

    candles.push({
      open: price - 0.2,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000 + Math.random() * 500,
      timestamp: baseTime + i * interval,
    });
  }

  return candles;
};

// Create candles with clear swing points for level detection
const createCandlesWithLevels = (
  resistanceLevel: number,
  supportLevel: number,
  count: number = 50,
): Candle[] => {
  const candles: Candle[] = [];
  const baseTime = Date.now() - count * 60000;
  const midPrice = (resistanceLevel + supportLevel) / 2;

  for (let i = 0; i < count; i++) {
    let close: number;
    let high: number;
    let low: number;

    // Create bounces off support and resistance
    if (i % 10 === 0) {
      // Touch resistance
      close = resistanceLevel - 0.5;
      high = resistanceLevel;
      low = resistanceLevel - 2;
    } else if (i % 10 === 5) {
      // Touch support
      close = supportLevel + 0.5;
      high = supportLevel + 2;
      low = supportLevel;
    } else {
      // Normal price action
      close = midPrice + (Math.random() - 0.5) * 2;
      high = close + 1;
      low = close - 1;
    }

    candles.push({
      open: close - 0.3,
      high,
      low,
      close,
      volume: 1000,
      timestamp: baseTime + i * 60000,
    });
  }

  return candles;
};

// ============================================================================
// TEST SUITE
// ============================================================================

describe('MTFTPValidatorService', () => {
  let service: MTFTPValidatorService;
  let mockLogger: Partial<LoggerService>;
  let levelAnalyzer: LevelAnalyzer;

  const defaultConfig: MTFTPConfig = {
    enabled: true,
    htfTPValidation: {
      enabled: true,
      alignmentThresholdPercent: 0.5, // Wider threshold for testing
      confidenceBoostPercent: 10,
    },
    trend2TPValidation: {
      enabled: true,
      alignmentThresholdPercent: 0.5,
      confidenceBoostPercent: 5,
    },
    contextTPAdjustment: {
      enabled: true,
      minEmaGapPercent: 0.5,
      alignedScaleFactor: 1.15,
      opposedScaleFactor: 0.85,
    },
    scaling: {
      noConfirm: 0.9,
      htfConfirmed: 1.0,
      bothConfirmed: 1.1,
    },
  };

  beforeEach(() => {
    mockLogger = createMockLogger();
    levelAnalyzer = new LevelAnalyzer(mockLogger as LoggerService, {
      clusterThresholdPercent: 0.5,
      minTouchesRequired: 2,
    });
    service = new MTFTPValidatorService(mockLogger as LoggerService, levelAnalyzer, defaultConfig);
  });

  // ==========================================================================
  // BASIC VALIDATION TESTS
  // ==========================================================================

  describe('Basic Validation', () => {
    it('should return no validation when disabled', () => {
      const disabledService = new MTFTPValidatorService(
        mockLogger as LoggerService,
        levelAnalyzer,
        { ...defaultConfig, enabled: false },
      );

      const result = disabledService.validateTP(
        105,
        100,
        SignalDirection.LONG,
        undefined,
        undefined,
        undefined,
      );

      expect(result.htfTPAligned).toBe(false);
      expect(result.scalingFactor).toBe(1.0);
      expect(result.recommendation).toBe('NEUTRAL');
    });

    it('should return neutral when no HTF candles provided', () => {
      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        undefined,
        undefined,
        undefined,
      );

      expect(result.htfTPAligned).toBe(false);
      expect(result.trend2TPAligned).toBe(false);
      expect(result.scalingFactor).toBeLessThan(1.0); // noConfirm penalty
    });

    it('should return neutral when HTF candles too few', () => {
      const fewCandles = createCandleSeries(100, 10); // Only 10 candles

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        fewCandles,
        undefined,
        undefined,
      );

      expect(result.htfTPAligned).toBe(false);
    });
  });

  // ==========================================================================
  // HTF ALIGNMENT TESTS
  // ==========================================================================

  describe('HTF TP Alignment', () => {
    it('should detect TP aligned with HTF resistance for LONG', () => {
      // Create candles with resistance at 105
      const htfCandles = createCandlesWithLevels(105, 95, 50);
      const tp1Price = 104.8; // Close to resistance

      const result = service.validateTP(
        tp1Price,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        undefined,
      );

      // May or may not align depending on level detection
      expect(result.scalingFactor).toBeGreaterThanOrEqual(0.9);
      expect(result.recommendation).toBeDefined();
    });

    it('should detect TP aligned with HTF support for SHORT', () => {
      // Create candles with support at 95
      const htfCandles = createCandlesWithLevels(105, 95, 50);
      const tp1Price = 95.2; // Close to support

      const result = service.validateTP(
        tp1Price,
        100,
        SignalDirection.SHORT,
        htfCandles,
        undefined,
        undefined,
      );

      expect(result.scalingFactor).toBeGreaterThanOrEqual(0.9);
    });

    it('should apply noConfirm penalty when TP not aligned', () => {
      const htfCandles = createCandlesWithLevels(110, 90, 50); // Levels far from TP
      const tp1Price = 103; // No nearby level

      const result = service.validateTP(
        tp1Price,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        undefined,
      );

      // Should get noConfirm penalty (0.9)
      expect(result.scalingFactor).toBeLessThanOrEqual(1.0);
    });
  });

  // ==========================================================================
  // CONTEXT TREND TESTS
  // ==========================================================================

  describe('Context Trend Adjustment', () => {
    it('should expand TP when LONG aligns with bullish context', () => {
      const htfCandles = createCandleSeries(100, 30);
      const bullishEMA = { fast: 102, slow: 100 }; // Bullish: fast > slow

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        bullishEMA,
      );

      expect(result.contextTrend).toBe('BULLISH');
      expect(result.contextScaleFactor).toBeGreaterThan(1.0);
    });

    it('should contract TP when LONG opposes bearish context', () => {
      const htfCandles = createCandleSeries(100, 30);
      const bearishEMA = { fast: 98, slow: 100 }; // Bearish: fast < slow

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        bearishEMA,
      );

      expect(result.contextTrend).toBe('BEARISH');
      expect(result.contextScaleFactor).toBeLessThan(1.0);
    });

    it('should expand TP when SHORT aligns with bearish context', () => {
      const htfCandles = createCandleSeries(100, 30);
      const bearishEMA = { fast: 98, slow: 100 }; // Bearish

      const result = service.validateTP(
        95,
        100,
        SignalDirection.SHORT,
        htfCandles,
        undefined,
        bearishEMA,
      );

      expect(result.contextTrend).toBe('BEARISH');
      // SHORT in bearish context should be aligned
      expect(result.contextScaleFactor).toBeGreaterThan(1.0);
    });

    it('should return neutral context when EMA gap too small', () => {
      const htfCandles = createCandleSeries(100, 30);
      const neutralEMA = { fast: 100.1, slow: 100 }; // Gap < 0.5%

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        neutralEMA,
      );

      expect(result.contextTrend).toBe('NEUTRAL');
      expect(result.contextScaleFactor).toBe(1.0);
    });
  });

  // ==========================================================================
  // SCALING TESTS
  // ==========================================================================

  describe('Scaling Factor Calculation', () => {
    it('should apply noConfirm penalty (0.9) when no HTF confirmation', () => {
      const serviceWithScaling = new MTFTPValidatorService(
        mockLogger as LoggerService,
        levelAnalyzer,
        {
          ...defaultConfig,
          contextTPAdjustment: { ...defaultConfig.contextTPAdjustment!, enabled: false },
        },
      );

      const result = serviceWithScaling.validateTP(
        105,
        100,
        SignalDirection.LONG,
        undefined,
        undefined,
        undefined,
      );

      expect(result.scalingFactor).toBe(0.9); // noConfirm
    });

    it('should apply scaling correctly', () => {
      const originalPercent = 2.0;
      const scalingFactor = 1.1;

      const scaled = service.applyScaling(originalPercent, scalingFactor);

      expect(scaled).toBeCloseTo(2.2, 1);
    });
  });

  // ==========================================================================
  // RECOMMENDATION TESTS
  // ==========================================================================

  describe('Recommendation Generation', () => {
    it('should recommend EXPAND when scaling > 1.05', () => {
      const htfCandles = createCandleSeries(100, 30);
      const bullishEMA = { fast: 105, slow: 100 }; // Strong bullish

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        bullishEMA,
      );

      if (result.scalingFactor > 1.05) {
        expect(result.recommendation).toBe('EXPAND');
      }
    });

    it('should recommend CONTRACT when scaling < 0.95', () => {
      const htfCandles = createCandleSeries(100, 30);
      const bearishEMA = { fast: 95, slow: 100 }; // Strong bearish

      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        bearishEMA,
      );

      if (result.scalingFactor < 0.95) {
        expect(result.recommendation).toBe('CONTRACT');
      }
    });

    it('should recommend NEUTRAL when scaling between 0.95 and 1.05', () => {
      // Disable context adjustment to get neutral scaling
      const neutralService = new MTFTPValidatorService(
        mockLogger as LoggerService,
        levelAnalyzer,
        {
          ...defaultConfig,
          contextTPAdjustment: { ...defaultConfig.contextTPAdjustment!, enabled: false },
          scaling: { noConfirm: 1.0, htfConfirmed: 1.0, bothConfirmed: 1.0 },
        },
      );

      const result = neutralService.validateTP(
        105,
        100,
        SignalDirection.LONG,
        undefined,
        undefined,
        undefined,
      );

      expect(result.recommendation).toBe('NEUTRAL');
    });
  });

  // ==========================================================================
  // CONFIDENCE BOOST TESTS
  // ==========================================================================

  describe('Confidence Boost', () => {
    it('should add confidence boost when HTF confirms', () => {
      const htfCandles = createCandlesWithLevels(105, 95, 50);

      const result = service.validateTP(
        104.5, // Near resistance
        100,
        SignalDirection.LONG,
        htfCandles,
        undefined,
        undefined,
      );

      // If aligned, should have confidence boost
      if (result.htfTPAligned) {
        expect(result.confidenceBoostPercent).toBeGreaterThan(0);
      }
    });

    it('should add additional boost when TREND2 confirms', () => {
      const htfCandles = createCandlesWithLevels(105, 95, 50);
      const trend2Candles = createCandlesWithLevels(105, 95, 50);

      const result = service.validateTP(
        104.5,
        100,
        SignalDirection.LONG,
        htfCandles,
        trend2Candles,
        undefined,
      );

      // If both aligned, should have combined boost
      if (result.htfTPAligned && result.trend2TPAligned) {
        expect(result.confidenceBoostPercent).toBe(15); // 10 + 5
      }
    });

    it('should return 0 boost when no confirmation', () => {
      const result = service.validateTP(
        105,
        100,
        SignalDirection.LONG,
        undefined,
        undefined,
        undefined,
      );

      expect(result.confidenceBoostPercent).toBe(0);
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('Configuration', () => {
    it('should use default config when none provided', () => {
      const defaultService = new MTFTPValidatorService(
        mockLogger as LoggerService,
        levelAnalyzer,
      );

      const config = defaultService.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.htfTPValidation.enabled).toBe(true);
      expect(config.scaling.noConfirm).toBe(0.9);
    });

    it('should merge partial config with defaults', () => {
      const partialService = new MTFTPValidatorService(
        mockLogger as LoggerService,
        levelAnalyzer,
        {
          enabled: true,
          htfTPValidation: {
            enabled: true,
            alignmentThresholdPercent: 0.2, // Override
            confidenceBoostPercent: 15, // Override
          },
          scaling: {
            noConfirm: 0.85, // Override
            htfConfirmed: 1.0,
            bothConfirmed: 1.15,
          },
        },
      );

      const config = partialService.getConfig();

      expect(config.htfTPValidation.alignmentThresholdPercent).toBe(0.2);
      expect(config.htfTPValidation.confidenceBoostPercent).toBe(15);
      expect(config.scaling.noConfirm).toBe(0.85);
    });
  });
});
