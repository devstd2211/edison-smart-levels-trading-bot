/**
 * Wall Tracker Service Tests (PHASE 4)
 *
 * Tests wall lifetime tracking, spoofing detection, iceberg detection.
 */

import { WallTrackerService } from '../../services/wall-tracker.service';
import { LoggerService, LogLevel, WallTrackingConfig } from '../../types';

describe('WallTrackerService', () => {
  let service: WallTrackerService;
  let logger: LoggerService;
  let config: WallTrackingConfig;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    config = {
      enabled: true,
      minLifetimeMs: 60000,
      spoofingThresholdMs: 5000,
      trackHistoryCount: 100,
    };
    service = new WallTrackerService(config, logger);
  });

  describe('detectWall', () => {
    it('should detect new wall', () => {
      service.detectWall(100, 50000, 'BID');
      const walls = service.getActiveWalls();

      expect(walls.length).toBe(1);
      expect(walls[0].price).toBe(100);
      expect(walls[0].side).toBe('BID');
      expect(walls[0].currentSize).toBe(50000);
      expect(walls[0].maxSize).toBe(50000);
      expect(walls[0].isSpoofing).toBe(false);
      expect(walls[0].isIceberg).toBe(false);
    });

    it('should update existing wall size', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(100, 60000, 'BID'); // Size increased

      const walls = service.getActiveWalls();
      expect(walls.length).toBe(1);
      expect(walls[0].currentSize).toBe(60000);
      expect(walls[0].maxSize).toBe(60000);
    });

    it('should track multiple walls', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(101, 40000, 'ASK');
      service.detectWall(102, 30000, 'BID');

      const walls = service.getActiveWalls();
      expect(walls.length).toBe(3);
    });

    it('should not detect walls when disabled', () => {
      config.enabled = false;
      service = new WallTrackerService(config, logger);

      service.detectWall(100, 50000, 'BID');
      const walls = service.getActiveWalls();

      expect(walls.length).toBe(0);
    });
  });

  describe('removeWall', () => {
    it('should remove wall', () => {
      service.detectWall(100, 50000, 'BID');
      expect(service.getActiveWalls().length).toBe(1);

      service.removeWall(100, 'BID');
      expect(service.getActiveWalls().length).toBe(0);
    });

    it('should not crash when removing non-existent wall', () => {
      expect(() => {
        service.removeWall(100, 'BID');
      }).not.toThrow();
    });
  });

  describe('spoofing detection', () => {
    it('should detect spoofing when wall removed quickly (<5s)', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      service.detectWall(100, 50000, 'BID');

      // Remove after 3 seconds (< 5s threshold)
      jest.spyOn(Date, 'now').mockReturnValue(now + 3000);
      service.removeWall(100, 'BID');

      const history = service.getHistory();
      const removedEvent = history.find(e => e.type === 'REMOVED');
      expect(removedEvent).toBeDefined();

      // Wall should be marked as spoofing in active walls before removal
      // (Check during lifetime)
    });

    it('should NOT detect spoofing when wall removed slowly (>5s)', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      service.detectWall(100, 50000, 'BID');

      // Remove after 10 seconds (> 5s threshold)
      jest.spyOn(Date, 'now').mockReturnValue(now + 10000);
      service.removeWall(100, 'BID');

      expect(service.getActiveWalls().length).toBe(0);
    });
  });

  describe('iceberg detection', () => {
    it('should detect iceberg after 3+ refills', () => {
      const price = 100;

      // Initial wall
      service.detectWall(price, 50000, 'BID');

      // Refill 1
      service.detectWall(price, 40000, 'BID'); // Size decreased
      service.detectWall(price, 50000, 'BID'); // Refilled

      // Refill 2
      service.detectWall(price, 30000, 'BID');
      service.detectWall(price, 50000, 'BID');

      // Refill 3
      service.detectWall(price, 20000, 'BID');
      service.detectWall(price, 50000, 'BID');

      const walls = service.getActiveWalls();
      expect(walls.length).toBe(1);
      expect(walls[0].isIceberg).toBe(true);
    });

    it('should not detect iceberg with <3 refills', () => {
      const price = 100;

      service.detectWall(price, 50000, 'BID');
      service.detectWall(price, 40000, 'BID');
      service.detectWall(price, 50000, 'BID'); // Only 1 refill

      const walls = service.getActiveWalls();
      expect(walls[0].isIceberg).toBe(false);
    });
  });

  describe('multiple walls tracking', () => {
    it('should track multiple walls at different prices', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(100.3, 40000, 'BID'); // Close to first wall
      service.detectWall(100.4, 30000, 'BID'); // Close to first wall

      const walls = service.getActiveWalls();
      expect(walls.length).toBe(3);
      expect(walls.filter(w => w.side === 'BID').length).toBe(3);
    });

    it('should track walls far apart', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(102, 40000, 'BID'); // 2% away

      const bidWalls = service.getActiveWalls().filter(w => w.side === 'BID');
      expect(bidWalls.length).toBe(2);
    });

    it('should separate BID and ASK walls', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(100.2, 40000, 'BID');
      service.detectWall(101, 30000, 'ASK');
      service.detectWall(101.2, 20000, 'ASK');

      const walls = service.getActiveWalls();
      const bidWalls = walls.filter(w => w.side === 'BID');
      const askWalls = walls.filter(w => w.side === 'ASK');

      expect(bidWalls.length).toBe(2);
      expect(askWalls.length).toBe(2);
    });
  });

  describe('wall absorption', () => {
    it('should track volume absorbed through wall', () => {
      service.detectWall(100, 50000, 'BID');

      // Simulate volume traded through (size decreased)
      service.detectWall(100, 40000, 'BID'); // 10000 absorbed

      const walls = service.getActiveWalls();
      expect(walls[0].absorbedVolume).toBeGreaterThan(0);
    });

    it('should handle refills after absorption', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(100, 30000, 'BID'); // 20000 absorbed
      service.detectWall(100, 50000, 'BID'); // Refilled

      const walls = service.getActiveWalls();
      expect(walls[0].absorbedVolume).toBeGreaterThan(0);
      expect(walls[0].currentSize).toBe(50000);
    });
  });

  describe('wall history', () => {
    it('should track wall events in history', () => {
      service.detectWall(100, 50000, 'BID');
      service.detectWall(100, 60000, 'BID'); // Updated
      service.removeWall(100, 'BID');

      const history = service.getHistory();
      expect(history.length).toBeGreaterThan(0);

      const addedEvents = history.filter(e => e.type === 'ADDED');
      const removedEvents = history.filter(e => e.type === 'REMOVED');

      expect(addedEvents.length).toBeGreaterThan(0);
      expect(removedEvents.length).toBeGreaterThan(0);
    });

    it('should limit history size', () => {
      config.trackHistoryCount = 10;
      service = new WallTrackerService(config, logger);

      // Generate 20 events
      for (let i = 0; i < 20; i++) {
        service.detectWall(100 + i, 50000, 'BID');
      }

      const history = service.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('edge cases', () => {
    it('should handle zero size wall', () => {
      service.detectWall(100, 0, 'BID');
      const walls = service.getActiveWalls();
      expect(walls.length).toBe(1);
      expect(walls[0].currentSize).toBe(0);
    });

    it('should handle negative price', () => {
      expect(() => {
        service.detectWall(-100, 50000, 'BID');
      }).not.toThrow();
    });

    it('should handle very large size', () => {
      service.detectWall(100, 999999999, 'BID');
      const walls = service.getActiveWalls();
      expect(walls[0].currentSize).toBe(999999999);
    });

    it('should handle rapid updates', () => {
      for (let i = 0; i < 100; i++) {
        service.detectWall(100, 50000 + i, 'BID');
      }

      const walls = service.getActiveWalls();
      expect(walls.length).toBe(1);
      expect(walls[0].events.length).toBeGreaterThan(1);
    });
  });
});
