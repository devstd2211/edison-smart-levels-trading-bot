import {
  EngulfingPatternDetector,
  EngulfingPatternType,
} from '../../analyzers/engulfing-pattern.detector';
import { LoggerService, LogLevel, Candle } from '../../types';

describe('EngulfingPatternDetector', () => {
  let detector: EngulfingPatternDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new EngulfingPatternDetector(logger);
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function createCandle(open: number, close: number, high?: number, low?: number): Candle {
    const h = high || Math.max(open, close);
    const l = low || Math.min(open, close);
    return {
      open,
      close,
      high: h,
      low: l,
      volume: 1000,
      timestamp: Date.now(),
    };
  }

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should return no pattern when not enough candles', () => {
      const candles = [createCandle(100, 105)];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(EngulfingPatternType.NONE);
      expect(result.explanation).toContain('Not enough candles');
    });

    it('should return no pattern when empty array', () => {
      const result = detector.detect([]);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(EngulfingPatternType.NONE);
    });
  });

  // ==========================================================================
  // BULLISH ENGULFING
  // ==========================================================================

  describe('Bullish Engulfing Detection', () => {
    it('should detect valid Bullish Engulfing pattern', () => {
      const candles = [
        createCandle(105, 100), // Red candle (bearish)
        createCandle(99, 106),  // Green candle (bullish) engulfs red
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(EngulfingPatternType.BULLISH_ENGULFING);
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.engulfingRatio).toBeGreaterThan(1.0);
      expect(result.explanation).toContain('Bullish Engulfing');
    });

    it('should reject when previous candle is not bearish', () => {
      const candles = [
        createCandle(100, 105), // Green candle (NOT bearish)
        createCandle(99, 110),  // Green candle
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(EngulfingPatternType.NONE);
    });

    it('should reject when current candle is not bullish', () => {
      const candles = [
        createCandle(105, 100), // Red candle
        createCandle(106, 99),  // Red candle (NOT bullish)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
    });

    it('should reject when current does not engulf previous', () => {
      const candles = [
        createCandle(105, 100), // Red candle (body: 100-105)
        createCandle(101, 104), // Green candle (body: 101-104) - does NOT engulf
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(EngulfingPatternType.NONE);
    });

    it('should calculate higher confidence for larger engulfing', () => {
      const candles1 = [
        createCandle(105, 100), // Red: 5 point body
        createCandle(99, 107),  // Green: 8 point body (1.6x)
      ];

      const candles2 = [
        createCandle(105, 100), // Red: 5 point body
        createCandle(98, 115),  // Green: 17 point body (3.4x)
      ];

      const result1 = detector.detect(candles1);
      const result2 = detector.detect(candles2);

      expect(result1.detected).toBe(true);
      expect(result2.detected).toBe(true);
      expect(result2.confidence).toBeGreaterThan(result1.confidence);
      expect(result2.engulfingRatio).toBeGreaterThan(result1.engulfingRatio);
    });

    it('should detect perfect engulfing (current.open = prev.close, current.close = prev.open)', () => {
      const candles = [
        createCandle(105, 100), // Red: 100-105
        createCandle(100, 105), // Green: 100-105 (perfect engulf)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(EngulfingPatternType.BULLISH_ENGULFING);
      expect(result.engulfingRatio).toBeCloseTo(1.0, 1);
    });
  });

  // ==========================================================================
  // BEARISH ENGULFING
  // ==========================================================================

  describe('Bearish Engulfing Detection', () => {
    it('should detect valid Bearish Engulfing pattern', () => {
      const candles = [
        createCandle(100, 105), // Green candle (bullish)
        createCandle(106, 99),  // Red candle (bearish) engulfs green
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(EngulfingPatternType.BEARISH_ENGULFING);
      expect(result.direction).toBe('SHORT');
      expect(result.confidence).toBeGreaterThan(60);
      expect(result.engulfingRatio).toBeGreaterThan(1.0);
      expect(result.explanation).toContain('Bearish Engulfing');
    });

    it('should reject when previous candle is not bullish', () => {
      const candles = [
        createCandle(105, 100), // Red candle (NOT bullish)
        createCandle(106, 95),  // Red candle
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
    });

    it('should reject when current candle is not bearish', () => {
      const candles = [
        createCandle(100, 105), // Green candle
        createCandle(99, 106),  // Green candle (NOT bearish)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
    });

    it('should reject when current does not engulf previous', () => {
      const candles = [
        createCandle(100, 105), // Green candle (body: 100-105)
        createCandle(104, 101), // Red candle (body: 101-104) - does NOT engulf
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(false);
    });

    it('should calculate higher confidence for larger engulfing', () => {
      const candles1 = [
        createCandle(100, 105), // Green: 5 point body
        createCandle(107, 99),  // Red: 8 point body (1.6x)
      ];

      const candles2 = [
        createCandle(100, 105), // Green: 5 point body
        createCandle(115, 98),  // Red: 17 point body (3.4x)
      ];

      const result1 = detector.detect(candles1);
      const result2 = detector.detect(candles2);

      expect(result1.detected).toBe(true);
      expect(result2.detected).toBe(true);
      expect(result2.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================

  describe('Confidence Calculation', () => {
    it('should give base confidence (60%) for 1:1 engulfing', () => {
      const candles = [
        createCandle(105, 100), // Red: 5 point body
        createCandle(100, 105), // Green: 5 point body (1.0x)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeCloseTo(60, 0);
      expect(result.engulfingRatio).toBeCloseTo(1.0, 1);
    });

    it('should give ~70% confidence for 1.5x engulfing', () => {
      const candles = [
        createCandle(104, 100), // Red: 4 point body
        createCandle(99, 105),  // Green: 6 point body (1.5x)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(68);
      expect(result.confidence).toBeLessThanOrEqual(72);
    });

    it('should give ~80% confidence for 2x engulfing', () => {
      const candles = [
        createCandle(103, 100), // Red: 3 point body
        createCandle(99, 105),  // Green: 6 point body (2.0x)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(78);
      expect(result.confidence).toBeLessThanOrEqual(82);
    });

    it('should cap confidence at 100%', () => {
      const candles = [
        createCandle(102, 100), // Red: 2 point body
        createCandle(98, 110),  // Green: 12 point body (6.0x)
      ];

      const result = detector.detect(candles);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBe(100);
      expect(result.engulfingRatio).toBeGreaterThan(5.0);
    });
  });
});
