import {
  TriplePatternDetector,
  TriplePatternType,
} from '../../analyzers/triple-pattern.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

describe('TriplePatternDetector', () => {
  let detector: TriplePatternDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new TriplePatternDetector(logger);
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function createSwingPoint(minutesFromStart: number, price: number, type: SwingPointType): SwingPoint {
    const baseTime = Date.now() - 200 * 60000; // 200 minutes ago as base
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
      expect(result.type).toBe(TriplePatternType.NONE);
      expect(result.explanation).toContain('Not enough swing points');
    });

    it('should return no pattern when empty array', () => {
      const result = detector.detect([]);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(TriplePatternType.NONE);
    });
  });

  // ==========================================================================
  // TRIPLE TOP
  // ==========================================================================

  describe('Triple Top Detection', () => {
    it('should detect valid Triple Top pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(10, 90, SwingPointType.LOW),    // Valley 1
        createSwingPoint(20, 101, SwingPointType.HIGH),  // Peak 2 (1% diff)
        createSwingPoint(30, 92, SwingPointType.LOW),    // Valley 2
        createSwingPoint(40, 99, SwingPointType.HIGH),   // Peak 3 (1% diff)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TriplePatternType.TRIPLE_TOP);
      expect(result.direction).toBe('SHORT');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.points.length).toBe(5);
      expect(result.neckline).toBeCloseTo((90 + 92) / 2, 1); // Average of valleys
      expect(result.explanation).toContain('Triple Top');
    });

    it('should reject Triple Top when peaks are too different (>3%)', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(10, 90, SwingPointType.LOW),    // Valley 1
        createSwingPoint(20, 105, SwingPointType.HIGH),  // Peak 2 (5% diff - too much)
        createSwingPoint(30, 92, SwingPointType.LOW),    // Valley 2
        createSwingPoint(40, 99, SwingPointType.HIGH),   // Peak 3
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(TriplePatternType.NONE);
    });

    it('should reject when valleys are not lower than peaks', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(10, 102, SwingPointType.LOW),   // Valley 1 (HIGHER than peak!)
        createSwingPoint(20, 100, SwingPointType.HIGH),  // Peak 2
        createSwingPoint(30, 101, SwingPointType.LOW),   // Valley 2
        createSwingPoint(40, 100, SwingPointType.HIGH),  // Peak 3
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should calculate correct TP/SL for Triple Top', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 90, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),
        createSwingPoint(30, 90, SwingPointType.LOW),
        createSwingPoint(40, 100, SwingPointType.HIGH),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const neckline = 90;
      const avgPeak = 100;
      const patternHeight = avgPeak - neckline; // 10
      const expectedTarget = neckline - patternHeight; // 90 - 10 = 80

      expect(result.neckline).toBeCloseTo(neckline, 1);
      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeGreaterThan(avgPeak);
    });

    it('should give higher confidence for perfectly aligned peaks', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(10, 90, SwingPointType.LOW),
        createSwingPoint(20, 100, SwingPointType.HIGH),  // Peak 2 (exact match!)
        createSwingPoint(30, 90, SwingPointType.LOW),
        createSwingPoint(40, 100, SwingPointType.HIGH),  // Peak 3 (exact match!)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(85); // High confidence for perfect alignment
    });
  });

  // ==========================================================================
  // TRIPLE BOTTOM
  // ==========================================================================

  describe('Triple Bottom Detection', () => {
    it('should detect valid Triple Bottom pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(10, 100, SwingPointType.HIGH),  // Peak 1
        createSwingPoint(20, 91, SwingPointType.LOW),    // Bottom 2 (1% diff)
        createSwingPoint(30, 98, SwingPointType.HIGH),   // Peak 2
        createSwingPoint(40, 89, SwingPointType.LOW),    // Bottom 3 (1% diff)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TriplePatternType.TRIPLE_BOTTOM);
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(70);
      expect(result.points.length).toBe(5);
      expect(result.neckline).toBeCloseTo((100 + 98) / 2, 1); // Average of peaks
      expect(result.explanation).toContain('Triple Bottom');
    });

    it('should reject Triple Bottom when bottoms are too different (>3%)', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(10, 100, SwingPointType.HIGH),  // Peak 1
        createSwingPoint(20, 85, SwingPointType.LOW),    // Bottom 2 (5.5% diff - too much)
        createSwingPoint(30, 98, SwingPointType.HIGH),   // Peak 2
        createSwingPoint(40, 90, SwingPointType.LOW),    // Bottom 3
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should reject when peaks are not higher than bottoms', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(10, 88, SwingPointType.HIGH),   // Peak 1 (LOWER than bottom!)
        createSwingPoint(20, 90, SwingPointType.LOW),    // Bottom 2
        createSwingPoint(30, 89, SwingPointType.HIGH),   // Peak 2
        createSwingPoint(40, 90, SwingPointType.LOW),    // Bottom 3
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should calculate correct TP/SL for Triple Bottom', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),
        createSwingPoint(10, 100, SwingPointType.HIGH),
        createSwingPoint(20, 90, SwingPointType.LOW),
        createSwingPoint(30, 100, SwingPointType.HIGH),
        createSwingPoint(40, 90, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const neckline = 100;
      const avgBottom = 90;
      const patternHeight = neckline - avgBottom; // 10
      const expectedTarget = neckline + patternHeight; // 100 + 10 = 110

      expect(result.neckline).toBeCloseTo(neckline, 1);
      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeLessThan(avgBottom);
    });

    it('should give higher confidence for perfectly aligned bottoms', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(10, 100, SwingPointType.HIGH),
        createSwingPoint(20, 90, SwingPointType.LOW),    // Bottom 2 (exact match!)
        createSwingPoint(30, 100, SwingPointType.HIGH),
        createSwingPoint(40, 90, SwingPointType.LOW),    // Bottom 3 (exact match!)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  // ==========================================================================
  // PATTERN TIMESPAN
  // ==========================================================================

  describe('Pattern Timespan Validation', () => {
    it('should reject pattern if too short (<20 bars)', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(2, 90, SwingPointType.LOW),    // Only 2 minutes apart
        createSwingPoint(4, 100, SwingPointType.HIGH),
        createSwingPoint(6, 90, SwingPointType.LOW),
        createSwingPoint(8, 100, SwingPointType.HIGH),  // Total: 8 minutes (too short)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should detect pattern if timespan is valid (20-150 bars)', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(15, 90, SwingPointType.LOW),
        createSwingPoint(30, 100, SwingPointType.HIGH),
        createSwingPoint(45, 90, SwingPointType.LOW),
        createSwingPoint(60, 100, SwingPointType.HIGH),  // Total: 60 minutes (valid)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(TriplePatternType.TRIPLE_TOP);
    });
  });
});
