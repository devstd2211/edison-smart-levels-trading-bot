import { SignalDirection } from '../../types/legacy';
import {
  createManagedMicroWallDetectorContext,
  createTrackedMicroWallOrderBook,
} from '../helpers/micro-wall-detector-test.utils';

describe('MicroWallDetectorService functional', () => {
  it('tracks a detected wall, confirms a break after the wait window, and exposes the re-entry guard', () => {
    const { detector, logger, cleanup } = createManagedMicroWallDetectorContext({
      withErrorHandler: false,
    });
    const infoSpy = jest.spyOn(logger, 'info');

    try {
      const [bidWall] = detector.detectMicroWalls(createTrackedMicroWallOrderBook());
      expect(bidWall).toBeDefined();

      bidWall.timestamp = Date.now() - 2000;

      const broken = detector.isWallBroken(bidWall, 0.999);
      expect(broken).toBe(true);
      expect(detector.getSignalDirection(bidWall)).toBe(SignalDirection.SHORT);
      expect(detector.wasRecentlyBroken('BID', bidWall.price)).toBe(true);
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining('MicroWall broken (BID, SHORT signal)'),
        expect.any(Object),
      );
    } finally {
      cleanup();
    }
  });
});
