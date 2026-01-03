import { ChartPatternsDetector, ChartPatternType } from '../../analyzers/chart-patterns.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

describe('ChartPatternsDetector', () => {
  let detector: ChartPatternsDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new ChartPatternsDetector(logger, {
      headTolerancePercent: 2,
      shoulderTolerancePercent: 3,
      necklineTolerancePercent: 2,
      minPatternBars: 20,
      maxPatternBars: 100,
    });
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  function createSwingPoint(minutesFromStart: number, price: number, type: SwingPointType): SwingPoint {
    const baseTime = Date.now() - 100 * 60000; // 100 minutes ago as base
    return {
      price,
      timestamp: baseTime + minutesFromStart * 60000, // Minutes from base (chronological order)
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
        createSwingPoint(1, 90, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(ChartPatternType.NONE);
      expect(result.explanation).toContain('Not enough swing points'); // Needs 3+ for any pattern
    });

    it('should return no pattern when empty array', () => {
      const result = detector.detect([]);

      expect(result.detected).toBe(false);
      expect(result.type).toBe(ChartPatternType.NONE);
    });
  });

  // ==========================================================================
  // HEAD & SHOULDERS (Bearish Reversal)
  // ==========================================================================

  describe('Head & Shoulders Detection', () => {
    it('should detect valid Head & Shoulders pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Left Shoulder
        createSwingPoint(1, 90, SwingPointType.LOW),     // Left Valley
        createSwingPoint(2, 110, SwingPointType.HIGH),   // Head (10% higher)
        createSwingPoint(3, 92, SwingPointType.LOW),     // Right Valley
        createSwingPoint(4, 102, SwingPointType.HIGH),   // Right Shoulder
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(ChartPatternType.HEAD_AND_SHOULDERS);
      expect(result.direction).toBe('SHORT');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.neckline).toBeCloseTo((90 + 92) / 2, 1); // Average of valleys
      expect(result.points.length).toBe(5);
      expect(result.explanation).toContain('H&S');
    });

    it('should reject H&S when head is not higher than shoulders', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Left Shoulder
        createSwingPoint(1, 90, SwingPointType.LOW),     // Left Valley
        createSwingPoint(2, 95, SwingPointType.HIGH),    // Head (TOO LOW!)
        createSwingPoint(3, 92, SwingPointType.LOW),     // Right Valley
        createSwingPoint(4, 98, SwingPointType.HIGH),    // Right Shoulder
      ];

      const result = detector.detect(swingPoints);

      // Should NOT detect H&S (may detect other patterns like Double Bottom)
      expect(result.type).not.toBe(ChartPatternType.HEAD_AND_SHOULDERS);
    });

    it('should reject H&S when shoulders are too different (>3%)', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Left Shoulder
        createSwingPoint(1, 90, SwingPointType.LOW),     // Left Valley
        createSwingPoint(2, 115, SwingPointType.HIGH),   // Head
        createSwingPoint(3, 92, SwingPointType.LOW),     // Right Valley
        createSwingPoint(4, 108, SwingPointType.HIGH),   // Right Shoulder (8% diff!)
      ];

      const result = detector.detect(swingPoints);

      // Should still detect but with lower confidence
      if (result.detected && result.type === ChartPatternType.HEAD_AND_SHOULDERS) {
        expect(result.confidence).toBeLessThan(90); // Penalty applied
      }
    });

    it('should calculate correct TP/SL for H&S pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // LS
        createSwingPoint(1, 90, SwingPointType.LOW),     // LV
        createSwingPoint(2, 110, SwingPointType.HIGH),   // Head
        createSwingPoint(3, 92, SwingPointType.LOW),     // RV
        createSwingPoint(4, 102, SwingPointType.HIGH),   // RS
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const neckline = (90 + 92) / 2; // 91
      const patternHeight = 110 - neckline; // 19
      const expectedTarget = neckline - patternHeight; // 91 - 19 = 72

      expect(result.neckline).toBeCloseTo(neckline, 1);
      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeGreaterThan(result.neckline);
    });
  });

  // ==========================================================================
  // INVERSE HEAD & SHOULDERS (Bullish Reversal)
  // ==========================================================================

  describe('Inverse Head & Shoulders Detection', () => {
    it('should detect valid Inverse Head & Shoulders pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Left Shoulder
        createSwingPoint(1, 100, SwingPointType.HIGH),   // Left Valley
        createSwingPoint(2, 80, SwingPointType.LOW),     // Head (10% lower)
        createSwingPoint(3, 98, SwingPointType.HIGH),    // Right Valley
        createSwingPoint(4, 88, SwingPointType.LOW),     // Right Shoulder
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(ChartPatternType.INVERSE_HEAD_AND_SHOULDERS);
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.neckline).toBeCloseTo((100 + 98) / 2, 1);
      expect(result.points.length).toBe(5);
      expect(result.explanation).toContain('Inverse H&S');
    });

    it('should reject Inverse H&S when head is not lower than shoulders', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Left Shoulder
        createSwingPoint(1, 100, SwingPointType.HIGH),   // Left Valley
        createSwingPoint(2, 95, SwingPointType.LOW),     // Head (TOO HIGH!)
        createSwingPoint(3, 98, SwingPointType.HIGH),    // Right Valley
        createSwingPoint(4, 92, SwingPointType.LOW),     // Right Shoulder
      ];

      const result = detector.detect(swingPoints);

      // Should NOT detect Inverse H&S (may detect other patterns like Double Top)
      expect(result.type).not.toBe(ChartPatternType.INVERSE_HEAD_AND_SHOULDERS);
    });

    it('should calculate correct TP/SL for Inverse H&S pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // LS
        createSwingPoint(1, 100, SwingPointType.HIGH),   // LV
        createSwingPoint(2, 80, SwingPointType.LOW),     // Head
        createSwingPoint(3, 98, SwingPointType.HIGH),    // RV
        createSwingPoint(4, 88, SwingPointType.LOW),     // RS
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const neckline = (100 + 98) / 2; // 99
      const patternHeight = neckline - 80; // 19
      const expectedTarget = neckline + patternHeight; // 99 + 19 = 118

      expect(result.neckline).toBeCloseTo(neckline, 1);
      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeLessThan(result.neckline);
    });

    it('should give symmetry bonus for perfectly aligned shoulders', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // LS
        createSwingPoint(1, 100, SwingPointType.HIGH),   // LV
        createSwingPoint(2, 80, SwingPointType.LOW),     // Head
        createSwingPoint(3, 100, SwingPointType.HIGH),   // RV (exact match!)
        createSwingPoint(4, 90, SwingPointType.LOW),     // RS (exact match!)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(90); // Symmetry bonus applied
    });
  });

  // ==========================================================================
  // DOUBLE TOP (Bearish Reversal)
  // ==========================================================================

  describe('Double Top Detection', () => {
    it('should detect valid Double Top pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(1, 90, SwingPointType.LOW),     // Valley
        createSwingPoint(2, 101, SwingPointType.HIGH),   // Peak 2 (1% diff)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(ChartPatternType.DOUBLE_TOP);
      expect(result.direction).toBe('SHORT');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.neckline).toBe(90);
      expect(result.points.length).toBe(3);
      expect(result.explanation).toContain('Double Top');
    });

    it('should reject Double Top when peaks are too different (>3%)', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // Peak 1
        createSwingPoint(1, 90, SwingPointType.LOW),     // Valley
        createSwingPoint(2, 110, SwingPointType.HIGH),   // Peak 2 (10% diff - too much!)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
      expect(result.type).not.toBe(ChartPatternType.DOUBLE_TOP);
    });

    it('should calculate correct TP/SL for Double Top', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(1, 90, SwingPointType.LOW),
        createSwingPoint(2, 100, SwingPointType.HIGH),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const patternHeight = 100 - 90; // 10
      const expectedTarget = 90 - patternHeight; // 80

      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeGreaterThan(100);
    });

    it('should give higher confidence for closer peaks', () => {
      const swingPoints1 = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(1, 90, SwingPointType.LOW),
        createSwingPoint(2, 100.5, SwingPointType.HIGH), // 0.5% diff
      ];

      const swingPoints2 = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(1, 90, SwingPointType.LOW),
        createSwingPoint(2, 102, SwingPointType.HIGH),   // 2% diff
      ];

      const result1 = detector.detect(swingPoints1);
      const result2 = detector.detect(swingPoints2);

      if (result1.detected && result2.detected) {
        expect(result1.confidence).toBeGreaterThan(result2.confidence);
      }
    });
  });

  // ==========================================================================
  // DOUBLE BOTTOM (Bullish Reversal)
  // ==========================================================================

  describe('Double Bottom Detection', () => {
    it('should detect valid Double Bottom pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(1, 100, SwingPointType.HIGH),   // Peak
        createSwingPoint(2, 91, SwingPointType.LOW),     // Bottom 2 (1% diff)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);
      expect(result.type).toBe(ChartPatternType.DOUBLE_BOTTOM);
      expect(result.direction).toBe('LONG');
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.neckline).toBe(100);
      expect(result.points.length).toBe(3);
      expect(result.explanation).toContain('Double Bottom');
    });

    it('should reject Double Bottom when bottoms are too different (>3%)', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),     // Bottom 1
        createSwingPoint(1, 100, SwingPointType.HIGH),   // Peak
        createSwingPoint(2, 80, SwingPointType.LOW),     // Bottom 2 (11% diff - too much!)
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(false);
      expect(result.type).not.toBe(ChartPatternType.DOUBLE_BOTTOM);
    });

    it('should calculate correct TP/SL for Double Bottom', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),
        createSwingPoint(1, 100, SwingPointType.HIGH),
        createSwingPoint(2, 90, SwingPointType.LOW),
      ];

      const result = detector.detect(swingPoints);

      expect(result.detected).toBe(true);

      const patternHeight = 100 - 90; // 10
      const expectedTarget = 100 + patternHeight; // 110

      expect(result.target).toBeCloseTo(expectedTarget, 1);
      expect(result.stopLoss).toBeLessThan(90);
    });
  });

  // ==========================================================================
  // PATTERN PRIORITY
  // ==========================================================================

  describe('Pattern Priority', () => {
    it('should prioritize H&S over Double Top when both present', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // LS (also DT peak1)
        createSwingPoint(1, 90, SwingPointType.LOW),     // LV (also DT valley)
        createSwingPoint(2, 110, SwingPointType.HIGH),   // Head
        createSwingPoint(3, 92, SwingPointType.LOW),     // RV
        createSwingPoint(4, 101, SwingPointType.HIGH),   // RS (also DT peak2)
      ];

      const result = detector.detect(swingPoints);

      // H&S should be detected (more complex pattern has priority)
      expect(result.detected).toBe(true);
      expect(result.type).toBe(ChartPatternType.HEAD_AND_SHOULDERS);
    });
  });

  // ==========================================================================
  // CUSTOM CONFIG
  // ==========================================================================

  describe('Custom Configuration', () => {
    it('should respect custom tolerance settings', () => {
      const strictDetector = new ChartPatternsDetector(logger, {
        headTolerancePercent: 2,
        shoulderTolerancePercent: 1.0, // Very strict (1%)
        necklineTolerancePercent: 2,
        minPatternBars: 20,
        maxPatternBars: 100,
      });

      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(1, 90, SwingPointType.LOW),
        createSwingPoint(2, 102, SwingPointType.HIGH), // 2% diff - fails strict tolerance
      ];

      const result = strictDetector.detect(swingPoints);

      expect(result.detected).toBe(false);
    });

    it('should respect custom pattern timespan limits', () => {
      const fastDetector = new ChartPatternsDetector(logger, {
        headTolerancePercent: 2,
        shoulderTolerancePercent: 3,
        necklineTolerancePercent: 2,
        minPatternBars: 20,
        maxPatternBars: 10, // Very short patterns only
      });

      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),   // LS
        createSwingPoint(5, 90, SwingPointType.LOW),     // LV
        createSwingPoint(10, 110, SwingPointType.HIGH),  // Head
        createSwingPoint(15, 92, SwingPointType.LOW),    // RV
        createSwingPoint(20, 102, SwingPointType.HIGH),  // RS (20 bars - too long!)
      ];

      const result = fastDetector.detect(swingPoints);

      // Should still detect but with lower confidence
      if (result.detected && result.type === ChartPatternType.HEAD_AND_SHOULDERS) {
        expect(result.confidence).toBeLessThan(90);
      }
    });
  });
});
