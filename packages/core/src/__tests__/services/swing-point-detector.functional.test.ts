import { ICONS } from '../../cli/cli-runtime';
import { Candle, SwingPointType } from '../../types/legacy';
import {
  createManagedSwingPointDetectorContext,
  createSwingPointDetectorMockCandle,
} from '../helpers/swing-point-detector-test.utils';

function createSwingCandles(): Candle[] {
  const base = 1_700_000_000_000;

  return [
    createSwingPointDetectorMockCandle({ timestamp: base, high: 100, low: 90 }),
    createSwingPointDetectorMockCandle({ timestamp: base + 60_000, high: 105, low: 92 }),
    createSwingPointDetectorMockCandle({ timestamp: base + 120_000, high: 115, low: 95 }),
    createSwingPointDetectorMockCandle({ timestamp: base + 180_000, high: 103, low: 80 }),
    createSwingPointDetectorMockCandle({ timestamp: base + 240_000, high: 101, low: 88 }),
    createSwingPointDetectorMockCandle({ timestamp: base + 300_000, high: 107, low: 91 }),
  ];
}

describe('SwingPointDetectorService - Functional behavior', () => {
  it('detects swing highs and lows and logs them with shared icons', () => {
    const { service, logger, cleanup } = createManagedSwingPointDetectorContext();

    try {
      const result = service.detectSwingPoints(createSwingCandles());

      expect(result.highs.some((point) => point.type === SwingPointType.HIGH)).toBe(true);
      expect(result.lows.some((point) => point.type === SwingPointType.LOW)).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        `${ICONS.success} SwingPointDetectorService initialized`,
        expect.objectContaining({ lookbackPeriod: 2 }),
      );
      expect(logger.debug).toHaveBeenCalledWith(
        `${ICONS.chart} Swing point detection complete`,
        expect.objectContaining({
          swingHighsDetected: result.highs.length,
          swingLowsDetected: result.lows.length,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
