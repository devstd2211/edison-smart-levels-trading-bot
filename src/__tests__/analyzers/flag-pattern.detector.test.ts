import { FlagPatternDetector } from '../../analyzers/flag-pattern.detector';
import { LoggerService, LogLevel, SwingPoint, SwingPointType } from '../../types';

describe('FlagPatternDetector', () => {
  let detector: FlagPatternDetector;
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    detector = new FlagPatternDetector(logger);
  });

  function createSwingPoint(minutesFromStart: number, price: number, type: SwingPointType): SwingPoint {
    const baseTime = Date.now() - 100 * 60000;
    return { price, timestamp: baseTime + minutesFromStart * 60000, type };
  }

  describe('Bull Flag Detection', () => {
    it('should detect valid Bull Flag pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.LOW),
        createSwingPoint(5, 105, SwingPointType.HIGH), // Pole: +5%
        createSwingPoint(10, 104, SwingPointType.LOW),
        createSwingPoint(15, 105, SwingPointType.HIGH),
        createSwingPoint(20, 104, SwingPointType.LOW),
        createSwingPoint(25, 105, SwingPointType.HIGH),
      ];
      const result = detector.detect(swingPoints);
      expect(result.detected).toBe(true);
      expect(result.direction).toBe('LONG');
    });
  });

  describe('Bear Flag Detection', () => {
    it('should detect valid Bear Flag pattern', () => {
      const swingPoints = [
        createSwingPoint(0, 100, SwingPointType.HIGH),
        createSwingPoint(5, 95, SwingPointType.LOW), // Pole: -5%
        createSwingPoint(10, 96, SwingPointType.HIGH),
        createSwingPoint(15, 95, SwingPointType.LOW),
        createSwingPoint(20, 96, SwingPointType.HIGH),
        createSwingPoint(25, 95, SwingPointType.LOW),
      ];
      const result = detector.detect(swingPoints);
      expect(result.detected).toBe(true);
      expect(result.direction).toBe('SHORT');
    });
  });
});
