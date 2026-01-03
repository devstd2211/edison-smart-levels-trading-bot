import { WedgePatternDetector, WedgePatternType } from '../../analyzers/wedge-pattern.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

describe('WedgePatternDetector', () => {
  let detector: WedgePatternDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new WedgePatternDetector(logger);
  });

  function createSwingPoint(minutesFromStart: number, price: number, type: SwingPointType): SwingPoint {
    const baseTime = Date.now() - 300 * 60000;
    return { price, timestamp: baseTime + minutesFromStart * 60000, type };
  }

  describe('Edge Cases', () => {
    it('should return no pattern when not enough swing points', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(10, 90, SwingPointType.LOW),
      ];
      const result = detector.detect(swingPoints);
      expect(result.detected).toBe(false);
    });
  });

  describe('Rising Wedge Detection', () => {
    it('should detect valid Rising Wedge pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),
        createSwingPoint(10, 100, SwingPointType.HIGH),
        createSwingPoint(20, 95, SwingPointType.LOW),
        createSwingPoint(30, 102, SwingPointType.HIGH),
        createSwingPoint(40, 98, SwingPointType.LOW),
        createSwingPoint(50, 103, SwingPointType.HIGH),
      ];
      const result = detector.detect(swingPoints);
      expect(result.detected).toBe(true);
      expect(result.type).toBe(WedgePatternType.RISING);
      expect(result.direction).toBe('SHORT');
    });

    it('should give bonus for trend exhaustion', () => {
      const swingPoints = [
        createSwingPoint(0, 90, SwingPointType.LOW),
        createSwingPoint(10, 100, SwingPointType.HIGH),
        createSwingPoint(20, 95, SwingPointType.LOW),
        createSwingPoint(30, 102, SwingPointType.HIGH),
        createSwingPoint(40, 98, SwingPointType.LOW),
        createSwingPoint(50, 103, SwingPointType.HIGH),
      ];
      const withTrend = detector.detect(swingPoints, 'BULLISH');
      const noTrend = detector.detect(swingPoints);
      if (withTrend.detected && noTrend.detected) {
        expect(withTrend.confidence).toBeGreaterThan(noTrend.confidence);
      }
    });
  });

  describe('Falling Wedge Detection', () => {
    it('should detect valid Falling Wedge pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 110, SwingPointType.HIGH),
        createSwingPoint(10, 100, SwingPointType.LOW),
        createSwingPoint(20, 105, SwingPointType.HIGH),
        createSwingPoint(30, 98, SwingPointType.LOW),
        createSwingPoint(40, 102, SwingPointType.HIGH),
        createSwingPoint(50, 97, SwingPointType.LOW),
      ];
      const result = detector.detect(swingPoints);
      expect(result.detected).toBe(true);
      expect(result.type).toBe(WedgePatternType.FALLING);
      expect(result.direction).toBe('LONG');
    });
  });
});
