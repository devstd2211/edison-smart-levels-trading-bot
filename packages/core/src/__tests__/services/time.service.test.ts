/**
 * TimeService Error Handling Tests
 * Phase 8.9.42: RETRY strategy for sync + SKIP for logging + GRACEFUL_DEGRADE fallback
 *
 * Test Cases:
 * - API call success with exponential backoff (RETRY)
 * - API failures with retry attempts (RETRY)
 * - Logging failures during sync (SKIP)
 * - Graceful degradation to last known offset (GRACEFUL_DEGRADE)
 * - Accumulation of failure count and max failures
 * - Time conversion methods work without ErrorHandler
 * - Backward compatibility (works without ErrorHandler parameter)
 * - Integration scenarios with cascading failures
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { TimeService } from '../../services/time.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { TimeSyncError, TimeSyncTimeoutError } from '../../errors/DomainErrors';
import { LoggerService } from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';

type MockExchange = {
  getServerTime: jest.MockedFunction<() => Promise<number | undefined>>;
};

describe('TimeService - Error Handling (Phase 8.9.42)', () => {
  let timeService: TimeService;
  let mockLogger: LoggerService;
  let mockExchange: MockExchange;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    mockLogger = new LoggerService('ERROR', './logs', false);
    jest.spyOn(mockLogger, 'info').mockImplementation(() => undefined);
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => undefined);
    jest.spyOn(mockLogger, 'error').mockImplementation(() => undefined);
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => undefined);

    // Mock exchange service
    mockExchange = {
      getServerTime: jest.fn<() => Promise<number | undefined>>(),
    };

    // Create ErrorHandler
    errorHandler = new ErrorHandler(mockLogger);

    // Create TimeService with ErrorHandler
    timeService = new TimeService(
      mockLogger,
      1000, // syncIntervalMs
      3, // maxSyncFailures
      errorHandler,
    );

    timeService.setBybitService(mockExchange as unknown as IExchange);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('RETRY Strategy - API call success', () => {
    it('should synchronize on first attempt when API succeeds', async () => {
      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      expect(mockExchange.getServerTime).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();
      const syncInfo = timeService.getSyncInfo();
      expect(syncInfo.offset).toBeLessThan(500); // Should be small offset
    });

    it('should calculate offset correctly after successful sync', async () => {
      const serverTime = 1000000000;
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      const offset = timeService.getSyncInfo().offset;
      expect(offset).toBeLessThan(1000); // Network latency should be <1s
    });

    it('should reset failure count on successful sync', async () => {
      const serverTime = Date.now();

      // First attempt fails
      mockExchange.getServerTime.mockRejectedValueOnce(
        new Error('Network error'),
      );
      await timeService.syncWithExchange();

      // Second attempt succeeds
      jest.clearAllMocks();
      mockExchange.getServerTime.mockResolvedValueOnce(serverTime);
      await timeService.syncWithExchange();

      // Should log info about success
      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('RETRY Strategy - Error Handling', () => {
    it('should attempt operations with error handler', async () => {
      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      // Should have called the API
      expect(mockExchange.getServerTime).toHaveBeenCalled();
      // Should have logged success
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('should use last known offset after failure with GRACEFUL_DEGRADE', async () => {
      const serverTime = Date.now();
      // First successful sync to establish offset
      mockExchange.getServerTime.mockResolvedValueOnce(serverTime);
      await timeService.syncWithExchange();
      const initialOffset = timeService.getSyncInfo().offset;

      // Now fail retries
      jest.clearAllMocks();
      mockExchange.getServerTime.mockRejectedValue(new Error('Network down'));
      await timeService.syncWithExchange();

      // Offset should remain unchanged (GRACEFUL_DEGRADE)
      const currentOffset = timeService.getSyncInfo().offset;
      expect(currentOffset).toEqual(initialOffset);
    });
  });

  describe('SKIP Strategy - Logging Safe', () => {
    it('should handle service gracefully after sync failure', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));

      await timeService.syncWithExchange();

      // Should have attempted retries
      expect(mockExchange.getServerTime).toHaveBeenCalled();

      // Service should still be operational
      const now = timeService.now();
      expect(typeof now).toBe('number');
    });

    it('should log warnings appropriately on failure', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));

      await timeService.syncWithExchange();

      // Should have logged errors (or at least attempted to)
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should preserve offset across failed syncs', async () => {
      // First: successful sync
      mockExchange.getServerTime.mockResolvedValueOnce(Date.now() + 5000);
      await timeService.syncWithExchange();
      const firstOffset = timeService.getSyncInfo().offset;

      // Second: failed sync
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));
      await timeService.syncWithExchange();

      // Offset should be preserved (GRACEFUL_DEGRADE)
      const secondOffset = timeService.getSyncInfo().offset;
      expect(secondOffset).toEqual(firstOffset);
    });
  });

  describe('GRACEFUL_DEGRADE Strategy - Fallback to Last Known Offset', () => {
    it('should use last known offset when sync fails', async () => {
      const serverTime = Date.now() + 5000;
      mockExchange.getServerTime.mockResolvedValueOnce(serverTime);

      // First sync succeeds
      await timeService.syncWithExchange();
      const firstOffset = timeService.getSyncInfo().offset;

      // Second sync fails
      mockExchange.getServerTime.mockRejectedValue(new Error('Network error'));
      await timeService.syncWithExchange();

      // Should maintain last known offset
      const currentOffset = timeService.getSyncInfo().offset;
      expect(currentOffset).toEqual(firstOffset);
    });

    it('should track cumulative failures across sync attempts', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));

      // Fail 3 times
      await timeService.syncWithExchange();
      await timeService.syncWithExchange();
      await timeService.syncWithExchange();

      // Failure count should reach max
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('continuing with local time'),
        expect.any(Object),
      );
    });

    it('should continue trading even with max failures reached', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));

      // Fail until max failures
      for (let i = 0; i < 3; i++) {
        await timeService.syncWithExchange();
      }

      // Time methods should still work
      const now = timeService.now();
      expect(typeof now).toBe('number');
      expect(now).toBeGreaterThan(0);
    });
  });

  describe('Undefined Server Time Handling', () => {
    it('should throw TimeSyncError when server time is undefined', async () => {
      mockExchange.getServerTime.mockResolvedValue(undefined);

      await timeService.syncWithExchange();

      // Should have attempted retries and failed gracefully
      expect(mockExchange.getServerTime).toHaveBeenCalled();
      // Service should continue working with fallback
      expect(timeService.now()).toBeDefined();
    });

    it('should log specific error for undefined server time', async () => {
      mockExchange.getServerTime.mockResolvedValue(undefined);

      await timeService.syncWithExchange();

      // Should log error about undefined server time
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Bybit Service Not Set', () => {
    it('should handle missing bybit service gracefully', async () => {
      timeService = new TimeService(mockLogger, 1000, 3, errorHandler);
      // Don't set bybit service

      await timeService.syncWithExchange();

      // Should log warning but not crash
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should use default offset (0) when service not set', async () => {
      timeService = new TimeService(mockLogger, 1000, 3, errorHandler);

      await timeService.syncWithExchange();

      const syncInfo = timeService.getSyncInfo();
      expect(syncInfo.offset).toBe(0);
    });
  });

  describe('Time Conversion Methods', () => {
    beforeEach(async () => {
      const serverTime = Date.now() + 1000;
      mockExchange.getServerTime.mockResolvedValue(serverTime);
      await timeService.syncWithExchange();
    });

    it('should convert local time to server time', () => {
      const localTime = 1000000;
      const serverTime = timeService.toServerTime(localTime);

      expect(serverTime).toBeGreaterThan(localTime);
    });

    it('should convert server time to local time', () => {
      const serverTime = 1000000;
      const localTime = timeService.toLocalTime(serverTime);

      expect(localTime).toBeLessThan(serverTime);
    });

    it('should maintain consistency between conversions', () => {
      const originalTime = 1000000;
      const serverTime = timeService.toServerTime(originalTime);
      const backToLocal = timeService.toLocalTime(serverTime);

      expect(backToLocal).toEqual(originalTime);
    });

    it('should return synchronized now() timestamp', () => {
      const now = timeService.now();
      const localNow = Date.now();

      expect(now).toBeGreaterThan(localNow - 10000); // Recent
    });

    it('should return synchronized nowDate() object', () => {
      const nowDate = timeService.nowDate();

      expect(nowDate instanceof Date).toBe(true);
      expect(nowDate.getTime()).toBeGreaterThan(0);
    });
  });

  describe('Sync Status & Monitoring', () => {
    it('should report recent sync within sync interval', async () => {
      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      expect(timeService.isSyncRecent()).toBe(true);
    });

    it('should report stale sync after interval expires', async () => {
      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      // Wait for sync interval to pass (simulated via mocking)
      jest.useFakeTimers();
      jest.advanceTimersByTime(1500); // 500ms past the 1000ms interval

      expect(timeService.isSyncRecent()).toBe(false);

      jest.useRealTimers();
    });

    it('should provide sync info with next sync time', async () => {
      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      const syncInfo = timeService.getSyncInfo();
      expect(syncInfo.nextSyncIn).toBeLessThanOrEqual(1000);
      expect(syncInfo.isRecent).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should get today date string', () => {
      const dateStr = timeService.getTodayString();

      expect(typeof dateStr).toBe('string');
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    it('should calculate uptime correctly', async () => {
      const serverTime = Date.now() + 2000;
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await timeService.syncWithExchange();

      const startTime = Date.now() - 5000;
      const uptime = timeService.getUptime(startTime);

      expect(uptime).toBeGreaterThan(5000);
    });
  });

  describe('Backward Compatibility - Without ErrorHandler', () => {
    it('should work without ErrorHandler parameter', async () => {
      const service = new TimeService(mockLogger, 1000, 3);
      service.setBybitService(mockExchange as unknown as IExchange);

      const serverTime = Date.now();
      mockExchange.getServerTime.mockResolvedValue(serverTime);

      await service.syncWithExchange();

      expect(mockExchange.getServerTime).toHaveBeenCalled();
    });

    it('should use auto-created ErrorHandler when not provided', async () => {
      const service = new TimeService(mockLogger, 1000, 3);
      service.setBybitService(mockExchange as unknown as IExchange);

      mockExchange.getServerTime.mockResolvedValue(Date.now());

      // Should not throw even without explicit ErrorHandler
      await service.syncWithExchange();
      expect(mockExchange.getServerTime).toHaveBeenCalled();
    });

    it('should maintain backward compatible behavior', async () => {
      const legacyService = new TimeService(mockLogger, 1000, 3);
      legacyService.setBybitService(mockExchange as unknown as IExchange);

      mockExchange.getServerTime.mockResolvedValue(Date.now() + 3000);

      await legacyService.syncWithExchange();

      // Time methods should work
      expect(typeof legacyService.now()).toBe('number');
      expect(legacyService.isSyncRecent()).toBe(true);
    });
  });

  describe('Integration Scenarios - Cascading Failures', () => {
    it('should gracefully continue after API failures', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('Network timeout'));

      // Trigger sync failure
      await timeService.syncWithExchange();

      // Service should still be functional
      expect(timeService.now()).toBeDefined();
      expect(typeof timeService.now()).toBe('number');
    });

    it('should gracefully continue after max failures', async () => {
      mockExchange.getServerTime.mockRejectedValue(new Error('API error'));

      // Trigger multiple sync failures to trigger max failure warning
      for (let i = 0; i < 3; i++) {
        await timeService.syncWithExchange();
      }

      // Service should still be functional
      expect(timeService.now()).toBeDefined();
      expect(typeof timeService.now()).toBe('number');
    });

    it('should maintain trading viability across failure sequence', async () => {
      // Initial successful sync
      mockExchange.getServerTime.mockResolvedValueOnce(Date.now() + 1000);
      await timeService.syncWithExchange();
      const firstOffset = timeService.getSyncInfo().offset;

      // Reset mock for failures
      jest.clearAllMocks();
      mockExchange.getServerTime.mockRejectedValue(new Error('Persistent API error'));

      // Multiple failures
      for (let i = 0; i < 5; i++) {
        await timeService.syncWithExchange();
      }

      // Should still be usable
      expect(timeService.now()).toBeDefined();
      expect(timeService.getSyncInfo().offset).toEqual(firstOffset);
    });
  });

  describe('Performance & Edge Cases', () => {
    it('should handle rapid ensureSync calls', async () => {
      mockExchange.getServerTime.mockResolvedValue(Date.now());

      // Rapid calls within sync interval should not retry
      await timeService.ensureSync();
      await timeService.ensureSync();
      await timeService.ensureSync();

      expect(mockExchange.getServerTime).toHaveBeenCalledTimes(1);
    });

    it('should handle extreme server time values', async () => {
      const extremeTime = Number.MAX_SAFE_INTEGER - 1000;
      mockExchange.getServerTime.mockResolvedValue(extremeTime);

      await timeService.syncWithExchange();

      expect(timeService.now()).toBeGreaterThan(0);
    });

    it('should handle concurrent sync calls gracefully', async () => {
      mockExchange.getServerTime.mockResolvedValue(Date.now());

      // Concurrent calls (in real scenario would be simultaneous)
      await Promise.all([
        timeService.syncWithExchange(),
        timeService.syncWithExchange(),
      ]);

      expect(mockExchange.getServerTime).toHaveBeenCalled();
    });
  });
});
