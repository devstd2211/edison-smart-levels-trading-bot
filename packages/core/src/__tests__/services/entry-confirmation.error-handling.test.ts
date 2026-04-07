/**
 * Entry Confirmation Manager - Error Handling Tests
 * Phase 8.9.21: ErrorHandler Integration with SKIP strategy for logger failures
 */

import { EntryConfirmationManager } from '../../services/entry-confirmation.service';
import { LoggerService, SignalDirection } from '../../types/legacy';
import { ErrorHandler } from '../../errors';
import {
  createEntryConfirmationConfig,
  createLegacyEntryConfirmationManager,
  createManagedEntryConfirmationContext,
  createLongPendingEntryInput,
  createPendingEntryInput,
  createShortPendingEntryInput,
} from '../helpers/entry-confirmation-test.utils';

type EntryConfirmationManagedFixtures = ReturnType<typeof createManagedEntryConfirmationContext>;
type EntryConfirmationRuntime = Pick<
  EntryConfirmationManagedFixtures,
  'manager' | 'logger' | 'errorHandler'
>;
type EntryConfirmationCleanup = EntryConfirmationManagedFixtures['cleanup'];

// ============================================================================
// HELPERS
// ============================================================================

const defaultConfig = createEntryConfirmationConfig();

// ============================================================================
// TESTS
// ============================================================================

describe('EntryConfirmationManager - Error Handling (Phase 8.9.21)', () => {
  let manager: EntryConfirmationManager;
  let logger: LoggerService;
  let errorHandler: ErrorHandler | undefined;

  function bindEntryConfirmationFixtures() {
    let runtime: EntryConfirmationRuntime;
    let cleanup: EntryConfirmationCleanup;

    beforeEach(() => {
      const managedContext = createManagedEntryConfirmationContext();
      runtime = {
        manager: managedContext.manager,
        logger: managedContext.logger,
        errorHandler: managedContext.errorHandler,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => runtime;
  }

  const getFixtures = bindEntryConfirmationFixtures();

  beforeEach(() => {
    ({ manager, logger, errorHandler } = getFixtures());
  });

  // TEST 1-3: Logger failure SKIP strategy
  describe('logger failures - SKIP strategy', () => {
    it('should SKIP logger failure when adding pending entry', () => {
      // Mock logger.info to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Should not throw - SKIP strategy for non-critical logging
      expect(() => {
        manager.addPending(createLongPendingEntryInput({
          keyLevel: 1.5,
          signalData: { type: 'LEVEL_BASED' },
        }));
      }).not.toThrow();

      // Entry should still be added despite logger failure
      expect(manager.getPendingCount()).toBe(1);
      loggerSpy.mockRestore();
    });

    it('should SKIP logger failure when checking confirmation (confirmed)', () => {
      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: { type: 'LEVEL_BASED' },
      }));

      // Mock logger.info to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Should not throw - SKIP strategy for non-critical logging
      // And confirmation should still work despite logger failure
      const result = manager.checkConfirmation(id, 1.5010);
      expect(result.confirmed).toBe(true);
      expect(result.reason).toContain('bounce confirmed');

      loggerSpy.mockRestore();
    });

    it('should SKIP logger failure when checking confirmation (rejected)', () => {
      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: { type: 'LEVEL_BASED' },
      }));

      // Mock logger.info to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Should not throw - SKIP strategy for non-critical logging
      const result = manager.checkConfirmation(id, 1.4990);
      expect(result.confirmed).toBe(false);

      loggerSpy.mockRestore();
    });

    it('should SKIP logger failure when cancelling entry', () => {
      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: { type: 'LEVEL_BASED' },
      }));

      // Mock logger.info to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Should not throw - SKIP strategy for non-critical logging
      // And cancel should still work despite logger failure
      const cancelled = manager.cancel(id);
      expect(cancelled).toBe(true);
      expect(manager.getPendingCount()).toBe(0);

      loggerSpy.mockRestore();
    });

    it('should SKIP logger failure when cleaning up expired entries', () => {
      const originalNow = Date.now;
      const startTime = 1000000;
      Date.now = jest.fn(() => startTime);

      manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        detectedAt: startTime,
      }));

      expect(manager.getPendingCount()).toBe(1);

      // Move time forward past expiry (120s default + 1s)
      Date.now = jest.fn(() => startTime + 121000);

      // Mock logger.debug to throw
      const loggerSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Should not throw - SKIP strategy for non-critical logging
      // Cleanup should still work despite logger failure
      const count = manager.cleanupExpired();
      expect(count).toBe(1);
      expect(manager.getPendingCount()).toBe(0);

      loggerSpy.mockRestore();
      Date.now = originalNow;
    });
  });

  // TEST 6-10: Integration with operations
  describe('logger failures - integration scenarios', () => {
    it('should complete full workflow with logger failures', () => {
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Add pending entry
      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: { type: 'LEVEL_BASED' },
      }));

      expect(manager.getPendingCount()).toBe(1);

      // Check confirmation
      const result = manager.checkConfirmation(id, 1.5010);

      expect(result.confirmed).toBe(true);
      expect(manager.getPendingCount()).toBe(0);

      loggerSpy.mockRestore();
    });

    it('should handle rapid successive operations with logger failures', () => {
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger service unavailable');
      });

      // Add multiple entries rapidly
      const ids = [];
      for (let i = 0; i < 5; i++) {
        const id = manager.addPending({
          ...createPendingEntryInput({
            symbol: `SYM${i}USDT`,
            direction: i % 2 === 0 ? SignalDirection.LONG : SignalDirection.SHORT,
            keyLevel: 100 + i,
          }),
        });
        ids.push(id);
      }

      expect(manager.getPendingCount()).toBe(5);

      // Confirm first 3
      manager.checkConfirmation(ids[0], 101);
      manager.checkConfirmation(ids[1], 99);
      manager.checkConfirmation(ids[2], 103);

      expect(manager.getPendingCount()).toBe(2);

      loggerSpy.mockRestore();
    });

    it('should handle mixed logger successes and failures', () => {
      let callCount = 0;

      // Mock logger to fail every other call
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Logger temporary failure');
        }
      });

      // Operations should all succeed despite mixed logger behavior
      const id = manager.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));

      expect(manager.getPendingCount()).toBe(1);

      const result = manager.checkConfirmation(id, 1.5010);
      expect(result.confirmed).toBe(true);

      loggerSpy.mockRestore();
    });

    it('should handle cascade failures across multiple operations', () => {
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger completely down');
      });

      const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {
        throw new Error('Logger completely down');
      });

      // All operations should complete without throwing
      const id1 = manager.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));

      const id2 = manager.addPending(createShortPendingEntryInput());

      manager.checkConfirmation(id1, 1.5010);
      manager.checkConfirmation(id2, 49900);
      manager.cancel(id1);
      manager.cleanupExpired();

      // State should be consistent
      expect(manager.getPendingCount()).toBe(0);

      loggerSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  // TEST 11-13: Backward compatibility
  describe('backward compatibility - optional ErrorHandler', () => {
    it('should work without ErrorHandler parameter', () => {
      const managerWithoutEH = createLegacyEntryConfirmationManager({
        config: defaultConfig,
        logger,
      });

      const id = managerWithoutEH.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: { type: 'LEVEL_BASED' },
      }));

      expect(managerWithoutEH.getPendingCount()).toBe(1);

      const result = managerWithoutEH.checkConfirmation(id, 1.5010);
      expect(result.confirmed).toBe(true);
    });

    it('should preserve existing behavior with logger failures (no ErrorHandler)', () => {
      const managerWithoutEH = createLegacyEntryConfirmationManager({
        config: defaultConfig,
        logger,
      });

      // Mock logger to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failure');
      });

      // With error handling, logger failures are caught and skipped
      const id = managerWithoutEH.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));

      // Entry should still be added
      expect(managerWithoutEH.getPendingCount()).toBe(1);

      loggerSpy.mockRestore();
    });

    it('should handle undefined ErrorHandler gracefully', () => {
      const managerWithoutEH = createLegacyEntryConfirmationManager({
        config: defaultConfig,
        logger,
      });

      const id = managerWithoutEH.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));

      expect(managerWithoutEH.getPendingCount()).toBe(1);
    });
  });

  // TEST 14-15: ErrorHandler integration verification
  describe('ErrorHandler integration', () => {
    it('should use ErrorHandler when provided', () => {
      if (!errorHandler) {
        throw new Error('Expected ErrorHandler to be defined in this test');
      }

      const handleSpy = jest.spyOn(errorHandler, 'handle');

      // Mock logger to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger unavailable');
      });

      manager.addPending({
        symbol: 'APEXUSDT',
        direction: SignalDirection.LONG,
        keyLevel: 1.5000,
        detectedAt: Date.now(),
        signalData: {},
      });

      // ErrorHandler should have been called
      expect(handleSpy).toHaveBeenCalled();

      handleSpy.mockRestore();
      loggerSpy.mockRestore();
    });

    it('should skip ErrorHandler when not provided', () => {
      const managerWithoutEH = createLegacyEntryConfirmationManager({
        config: defaultConfig,
        logger,
      });

      // Mock logger to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger unavailable');
      });

      // Should not throw even without ErrorHandler
      expect(() => {
        managerWithoutEH.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));
      }).not.toThrow();

      loggerSpy.mockRestore();
    });
  });

  // TEST 16-18: Edge cases
  describe('edge cases', () => {
    it('should handle logger failure during entry expiry check', () => {
      const originalNow = Date.now;
      const startTime = 1000000;
      Date.now = jest.fn(() => startTime);

      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        detectedAt: startTime,
      }));

      // Move time forward
      Date.now = jest.fn(() => startTime + 121000);

      // Mock logger to throw
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failure');
      });

      // Should not throw
      expect(() => {
        manager.checkConfirmation(id, 1.5010);
      }).not.toThrow();

      loggerSpy.mockRestore();
      Date.now = originalNow;
    });

    it('should handle logger error with non-standard error object', () => {
      // Mock logger to throw non-Error object
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw 'String error, not Error object';
      });

      // Should still not throw
      expect(() => {
        manager.addPending(createLongPendingEntryInput({ keyLevel: 1.5 }));
      }).not.toThrow();

      expect(manager.getPendingCount()).toBe(1);
      loggerSpy.mockRestore();
    });

    it('should handle logger failure with null/undefined context', () => {
      const loggerSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
        throw new Error('Logger failure');
      });

      // Operations with minimal context
      const id = manager.addPending(createLongPendingEntryInput({
        keyLevel: 1.5,
        signalData: null as unknown as Record<string, unknown>,
      }));

      expect(manager.getPendingCount()).toBe(1);

      manager.checkConfirmation(id, 1.5010);

      loggerSpy.mockRestore();
    });
  });
});
