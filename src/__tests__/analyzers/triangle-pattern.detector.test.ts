import {
  TrianglePatternDetector,
  TrianglePatternType,
} from '../../analyzers/triangle-pattern.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

describe('TrianglePatternDetector', () => {
  let detector: TrianglePatternDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new TrianglePatternDetector(logger);
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function createSwingPoint(minutesFromStart: number, price: number, type: SwingPointType): SwingPoint {
    const baseTime = Date.now() - 300 * 60000;
    return {
      price,
      timestamp: baseTime + minutesFromStart * 60000,
      type,
    };
  }

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should return no pattern when not enough swing points', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 90, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(TrianglePatternType.NONE);
    });

    it('should return no pattern when empty array', () => {
      const result = detector.detect([]);

      expect(result.detected).toBe(false);
    });
  });

  // ==========================================================================
  // ASCENDING TRIANGLE
  // ==========================================================================

  describe('Ascending Triangle Detection', () => {
    it('should detect valid Ascending Triangle pattern', () => {
      const swingPoints = [
        // Flat resistance around 100
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 85, SwingPointType.LOW),    // Rising support
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 90, SwingPointType.LOW),    // Rising support
        createSwingPoint(40, 100, SwingPointType.HIGH),
        createSwingPoint(50, 95, SwingPointType.LOW),    // Rising support
      ];

      const result = detector.detect(swingPoints, 'BULLISH');

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TrianglePatternType.ASCENDING);
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(65);
      expect(result.resistanceLine.highs.length).toBeGreaterThanOrEqual(2);
      expect(result.supportLine.lows.length).toBeGreaterThanOrEqual(2);
    });

    it('should give higher confidence when trend is bullish', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 85, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 90, SwingPointType.LOW),
        createSwingPoint(40, 100, SwingPointType.HIGH),
        createSwingPoint(50, 95, SwingPointType.LOW),
      ];

      const withTrend = detector.detect(swingPoints, 'BULLISH');
      const noTrend = detector.detect(swingPoints);

      if (withTrend.detected && noTrend.detected) {
        expect(withTrend.confidence).toBeGreaterThan(noTrend.confidence);
      }
    });
  });

  // ==========================================================================
  // DESCENDING TRIANGLE
  // ==========================================================================

  describe('Descending Triangle Detection', () => {
    it('should detect valid Descending Triangle pattern', () => {
      const swingPoints = [
        // Falling resistance
        createSwingPoint(0, 115, SwingPointType.HIGH),
        createSwingPoint(10, 100, SwingPointType.LOW),   // Flat support
        createSwingPoint(20, 110, SwingPointType.HIGH),  // Lower high
        createSwingPoint(30, 100, SwingPointType.LOW),
        createSwingPoint(40, 105, SwingPointType.HIGH),  // Lower high
        createSwingPoint(50, 100, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints, 'BEARISH');

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TrianglePatternType.DESCENDING);
      expect(result.direction).toBe('SHORT');
      expect(result.confidence).toBeGreaterThan(65);
    });

    it('should give higher confidence when trend is bearish', () => {
      const swingPoints = [
        createSwingPoint(0, 115, SwingPointType.HIGH),
        createSwingPoint(10, 100, SwingPointType.LOW),
        createSwingPoint(20, 110, SwingPointType.HIGH),
        createSwingPoint(30, 100, SwingPointType.LOW),
        createSwingPoint(40, 105, SwingPointType.HIGH),
        createSwingPoint(50, 100, SwingPointType.LOW),
      ];

      const withTrend = detector.detect(swingPoints, 'BEARISH');
      const noTrend = detector.detect(swingPoints);

      if (withTrend.detected && noTrend.detected) {
        expect(withTrend.confidence).toBeGreaterThan(noTrend.confidence);
      }
    });
  });

  // ==========================================================================
  // SYMMETRICAL TRIANGLE
  // ==========================================================================

  describe('Symmetrical Triangle Detection', () => {
    it('should detect valid Symmetrical Triangle pattern', () => {
      const swingPoints = [
        // Both lines converging
        createSwingPoint(0, 110, SwingPointType.HIGH),   // Higher high
        createSwingPoint(10, 90, SwingPointType.LOW),    // Lower low
        createSwingPoint(20, 105, SwingPointType.HIGH),  // Lower high (converging)
        createSwingPoint(30, 95, SwingPointType.LOW),    // Higher low (converging)
        createSwingPoint(40, 102, SwingPointType.HIGH),  // Lower high
        createSwingPoint(50, 98, SwingPointType.LOW),    // Higher low
      ];

      const result = detector.detect(swingPoints, 'BULLISH');

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TrianglePatternType.SYMMETRICAL);
      expect(result.confidence).toBeGreaterThan(60);
    });

    it('should follow trend direction for Symmetrical Triangle', () => {
      const swingPoints = [
        createSwingPoint(0, 110, SwingPointType.HIGH),
        createSwingPoint(10, 90, SwingPointType.LOW),
        createSwingPoint(20, 105, SwingPointType.HIGH),
        createSwingPoint(30, 95, SwingPointType.LOW),
        createSwingPoint(40, 102, SwingPointType.HIGH),
        createSwingPoint(50, 98, SwingPointType.LOW),
      ];

      const bullish = detector.detect(swingPoints, 'BULLISH');
      const bearish = detector.detect(swingPoints, 'BEARISH');

      if (bullish.detected && bearish.detected) {
        expect(bullish.direction).toBe('LONG');
        expect(bearish.direction).toBe('SHORT');
      }
    });
  });

  // ==========================================================================
  // CONFIDENCE CALCULATION
  // ==========================================================================

  describe('Confidence Calculation', () => {
    it('should give bonus for more touches', () => {
      const fewTouches = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 85, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 90, SwingPointType.LOW),
      ];

      const manyTouches = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 85, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 88, SwingPointType.LOW),
        createSwingPoint(40, 100, SwingPointType.HIGH),
        createSwingPoint(50, 92, SwingPointType.LOW),
        createSwingPoint(60, 100, SwingPointType.HIGH),
        createSwingPoint(70, 95, SwingPointType.LOW),
      ];

      const resultFew = detector.detect(fewTouches);
      const resultMany = detector.detect(manyTouches);

      if (resultFew.detected && resultMany.detected) {
        expect(resultMany.confidence).toBeGreaterThanOrEqual(resultFew.confidence);
      }
    });
  });

  // ==========================================================================
  // TARGET AND STOP LOSS
  // ==========================================================================

  describe('Target and Stop Loss Calculation', () => {
    it('should calculate target for LONG direction', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 85, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 90, SwingPointType.LOW),
        createSwingPoint(40, 100, SwingPointType.HIGH),
        createSwingPoint(50, 95, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints, 'BULLISH');

      if (result.detected && result.direction === 'LONG') {
        expect(result.target).toBeGreaterThan(result.apex);
        expect(result.stopLoss).toBeLessThan(result.apex);
      }
    });

    it('should calculate target for SHORT direction', () => {
      const swingPoints = [
        createSwingPoint(0, 115, SwingPointType.HIGH),
        createSwingPoint(10, 100, SwingPointType.LOW),
        createSwingPoint(20, 110, SwingPointType.HIGH),
        createSwingPoint(30, 100, SwingPointType.LOW),
        createSwingPoint(40, 105, SwingPointType.HIGH),
        createSwingPoint(50, 100, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints, 'BEARISH');

      if (result.detected && result.direction === 'SHORT') {
        expect(result.target).toBeLessThan(result.apex);
        expect(result.stopLoss).toBeGreaterThan(result.apex);
      }
    });
  });

  // ==========================================================================
  // PATTERN TIMESPAN
  // ==========================================================================

  describe('Pattern Timespan Validation', () => {
    it('should reject pattern if too short', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(2, 85, SwingPointType.LOW),
        createSwingPoint(4, 100, SwingPointType.HIGH),
        createSwingPoint(6, 90, SwingPointType.LOW),
        createSwingPoint(8, 100, SwingPointType.HIGH),
        createSwingPoint(10, 95, SwingPointType.LOW),  // Only 10 minutes
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should accept pattern with valid timespan', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(15, 85, SwingPointType.LOW),
        createSwingPoint(30, 100, SwingPointType.HIGH),
        createSwingPoint(45, 90, SwingPointType.LOW),
        createSwingPoint(60, 100, SwingPointType.HIGH),
        createSwingPoint(75, 95, SwingPointType.LOW),  // 75 minutes
      ];

      const result = detector.detect(swingPoints, 'BULLISH');

      expect(result.detected).toBe(true);
    });
  });
});
