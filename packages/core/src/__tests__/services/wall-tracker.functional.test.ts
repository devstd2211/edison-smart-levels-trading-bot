import {
  createManagedWallTrackerContext,
  detectWallTrackerWalls,
} from '../helpers/wall-tracker-test.utils';

describe('WallTrackerService functional behavior', () => {
  it('tracks lifecycle, cluster detection, and strength scoring in one flow', () => {
    const { service, cleanup } = createManagedWallTrackerContext({
      withErrorHandler: true,
    });

    detectWallTrackerWalls(service, [
      { price: 100, size: 1000, side: 'BID' },
      { price: 100.2, size: 900, side: 'BID' },
      { price: 100.4, size: 800, side: 'BID' },
      { price: 100, size: 700, side: 'BID' },
      { price: 100, size: 1000, side: 'BID' },
      { price: 100, size: 600, side: 'BID' },
      { price: 100, size: 1000, side: 'BID' },
      { price: 100, size: 500, side: 'BID' },
      { price: 100, size: 1000, side: 'BID' },
    ]);

    expect(service.detectClusters()).toHaveLength(1);
    expect(service.isIceberg(100, 'BID')).toBe(true);
    expect(service.getWallStrength(100, 'BID')).toBeGreaterThan(0);

    service.removeWall(100, 'BID');
    expect(service.getHistory().some((event) => event.type === 'REMOVED')).toBe(true);

    cleanup();
  });
});
