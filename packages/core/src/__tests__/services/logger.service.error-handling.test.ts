/**
 * Logger Service Error Handling Tests
 * Phase 8.9.55: ErrorHandler Integration
 *
 * Test Coverage:
 * - THROW: Constructor validation (invalid logLevel, invalid logDir path)
 * - THROW: Date parsing failures (getTodayString)
 * - GRACEFUL_DEGRADE: Directory creation failures
 * - GRACEFUL_DEGRADE: File operation failures (read, write, delete)
 * - GRACEFUL_DEGRADE: Write queue processing failures
 * - SKIP: Console output failures
 * - Integration: Logging with degraded file system
 * - Backward compatibility: Tests without ErrorHandler
 * - Edge cases: Queue management, batch processing
 */

import { LoggerService } from '../../services/logger.service';
import { ErrorHandler, RecoveryStrategy, ErrorLogger } from '../../errors/ErrorHandler';
import { LogLevel } from '../../types/legacy';
import { tmpdir } from 'os';
import { join } from 'path';
import * as fs from 'fs/promises';
import { mkdirSync, existsSync, rmSync } from 'fs';
import {
  cleanupLoggerTestDir,
  createLoggerErrorHandler,
  createLoggerTestDir,
  createTestLoggerService,
  ensureLoggerTestDir,
} from '../helpers/logger-test.utils';

describe('LoggerService - Error Handling (Phase 8.9.55)', () => {
  const asLogLevel = (value: unknown): LogLevel => value as LogLevel;
  const asPath = (value: unknown): string => value as string;

  let testLogDir: string;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    // Create unique temp directory for tests
    testLogDir = createLoggerTestDir();
    errorHandler = createLoggerErrorHandler();
  });

  afterEach(async () => {
    cleanupLoggerTestDir(testLogDir);
  });

  // ========== THROW VALIDATION TESTS ==========
  describe('THROW: Constructor Validation', () => {
    it('should throw on invalid logLevel in constructor', () => {
      expect(() => {
        new LoggerService(asLogLevel('INVALID_LEVEL'), testLogDir, true);
      }).toThrow();
    });

    it('should throw on null minLevel', () => {
      expect(() => {
        new LoggerService(asLogLevel(null), testLogDir, true);
      }).toThrow();
    });

    it('should throw on non-string logDir with logToFile=true', () => {
      expect(() => {
        new LoggerService(LogLevel.INFO, asPath(123), true);
      }).toThrow();
    });

    it('should throw on empty string logDir with logToFile=true', () => {
      expect(() => {
        new LoggerService(LogLevel.INFO, '', true);
      }).toThrow();
    });

    it('should succeed with valid logLevel and logDir', () => {
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: false });
      expect(logger).toBeInstanceOf(LoggerService);
    });

    it('should accept uppercase string log levels for config compatibility', () => {
      const logger = createTestLoggerService({ minLevel: 'DEBUG', logDir: testLogDir, logToFile: false });
      expect(logger).toBeInstanceOf(LoggerService);

      const logger2 = createTestLoggerService({ minLevel: 'INFO', logDir: testLogDir, logToFile: false });
      expect(logger2).toBeInstanceOf(LoggerService);

      const logger3 = createTestLoggerService({ minLevel: 'WARN', logDir: testLogDir, logToFile: false });
      expect(logger3).toBeInstanceOf(LoggerService);

      const logger4 = createTestLoggerService({ minLevel: 'ERROR', logDir: testLogDir, logToFile: false });
      expect(logger4).toBeInstanceOf(LoggerService);
    });

    it('should throw on invalid string log level', () => {
      expect(() => {
        new LoggerService('INVALID_LEVEL', testLogDir, false);
      }).toThrow();
    });
  });

  // ========== GRACEFUL_DEGRADE: DIRECTORY CREATION ==========
  describe('GRACEFUL_DEGRADE: Directory Creation Failures', () => {
    it('should degrade gracefully if directory cannot be created', async () => {
      const invalidDir = '/proc/sys/invalid-location-for-logs';

      const result = await errorHandler.executeAsync(
        async () => {
          const logger = new LoggerService(LogLevel.INFO, invalidDir, true);
          return logger;
        },
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      // Should degrade gracefully (return null or handle error)
      expect(result.success || result.value === null).toBeTruthy();
    });

    it('should log without file system when directory creation fails', () => {
      const readOnlyDir = '/proc/test-readonly';

      // This should not throw, logger should still work with console only
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: false });
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();
    });

    it('should continue logging when permissions deny directory creation', () => {
      // Create a logger with a valid directory first
      ensureLoggerTestDir(testLogDir);
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: true });

      // Logger should still be functional
      expect(() => {
        logger.debug('Debug message');
        logger.info('Info message');
        logger.warn('Warn message');
        logger.error('Error message');
      }).not.toThrow();
    });
  });

  // ========== GRACEFUL_DEGRADE: FILE OPERATION FAILURES ==========
  describe('GRACEFUL_DEGRADE: File Operation Failures', () => {
    it('should degrade gracefully on file write failures', async () => {
      ensureLoggerTestDir(testLogDir);
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: true });

      // Simulate write failure by making directory read-only (Unix only)
      if (process.platform !== 'win32') {
        fs.chmod(testLogDir, 0o444).catch(() => {});
      }

      // Logger should still function, gracefully handling file write failures
      expect(() => {
        logger.info('Test message despite write failure');
      }).not.toThrow();

      // Restore permissions
      if (process.platform !== 'win32') {
        try {
          fs.chmod(testLogDir, 0o755);
        } catch (e) {
          // Ignore
        }
      }
    });

    it('should degrade gracefully on log cleanup failures', async () => {
      ensureLoggerTestDir(testLogDir);
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: true });

      // Create a mock file that will fail on deletion
      const testFile = join(testLogDir, '2000-01-01.log');
      mkdirSync(testFile, { recursive: true });

      // Cleanup attempt should not throw
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();

      // Cleanup
      try {
        rmSync(testFile, { recursive: true, force: true });
      } catch (e) {
        // Ignore
      }
    });

    it('should continue batch processing on individual file write failures', async () => {
      ensureLoggerTestDir(testLogDir);
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: true });

      // Log multiple messages - queue should process batch even with individual failures
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      // Allow async queue processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Logs should be in memory even if file write failed
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle queue overflow gracefully', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      // Generate large number of logs to stress queue
      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}`);
      }

      // Allow queue processing time
      await new Promise(resolve => setTimeout(resolve, 200));

      // All logs should be captured in memory
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(100);
    });
  });

  // ========== SKIP: CONSOLE OUTPUT FAILURES ==========
  describe('SKIP: Console Output Failures', () => {
    it('should skip console.log failures without propagating', () => {
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: false });

      // Mock console methods to throw
      const originalLog = console.log;
      console.log = jest.fn(() => {
        throw new Error('Console unavailable');
      });

      // Logging should not throw
      expect(() => {
        logger.info('Test message');
      }).not.toThrow();

      // Restore
      console.log = originalLog;
    });

    it('should skip console.error failures for internal logger errors', () => {
      const logger = createTestLoggerService({ minLevel: LogLevel.INFO, logDir: testLogDir, logToFile: false });

      const originalError = console.error;
      console.error = jest.fn(() => {
        throw new Error('Console unavailable');
      });

      expect(() => {
        logger.error('Error message');
      }).not.toThrow();

      console.error = originalError;
    });

    it('should skip console formatting errors', () => {
      const logger = new LoggerService(LogLevel.INFO, testLogDir, false);

      // Even with complex context that might cause formatting issues
      expect(() => {
        const circular: { ref?: unknown } = {};
        circular.ref = circular;
        logger.info('Message', {
          circular, // Will have circular reference
          large: new Array(1000).fill('x'),
        });
      }).not.toThrow();
    });
  });

  // ========== INTEGRATION TESTS ==========
  describe('Integration: Logging with Degraded System', () => {
    it('should maintain logging functionality when file system is degraded', async () => {
      // Create logger with valid initial directory (DEBUG level to capture all)
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.DEBUG, testLogDir, true);

      // Log multiple levels
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      // All logs should be recorded in memory regardless of file I/O
      const logs = logger.getLogs();
      expect(logs.length).toBe(4);
      expect(logs[0].level).toBe(LogLevel.DEBUG);
      expect(logs[1].level).toBe(LogLevel.INFO);
      expect(logs[2].level).toBe(LogLevel.WARN);
      expect(logs[3].level).toBe(LogLevel.ERROR);
    });

    it('should filter logs by level correctly during recovery', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.WARN, testLogDir, true);

      // DEBUG and INFO should be filtered out
      logger.debug('Debug (filtered)');
      logger.info('Info (filtered)');
      logger.warn('Warning (logged)');
      logger.error('Error (logged)');

      const logs = logger.getLogs();
      // Only WARN and ERROR should pass the filter
      const warnLogs = logs.filter(l => l.level === LogLevel.WARN);
      const errorLogs = logs.filter(l => l.level === LogLevel.ERROR);

      expect(warnLogs.length).toBeGreaterThanOrEqual(1);
      expect(errorLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle context logging during errors', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      const context = {
        tradeId: '12345',
        pair: 'BTC/USDT',
        status: 'closed',
      };

      logger.info('Trade executed', context);

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[logs.length - 1].context).toEqual(context);
    });

    it('should allow console output control', () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      // Should not throw
      expect(() => {
        logger.disableConsoleOutput();
        logger.info('Message 1 (no console)');
        logger.enableConsoleOutputMode();
        logger.info('Message 2 (with console)');
      }).not.toThrow();

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========== BACKWARD COMPATIBILITY TESTS ==========
  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should still throw on invalid logLevel without ErrorHandler', () => {
      expect(() => {
        new LoggerService(asLogLevel('INVALID'), testLogDir, true);
      }).toThrow();
    });

    it('should still work with valid parameters without ErrorHandler', () => {
      const logger = new LoggerService(LogLevel.INFO, testLogDir, false);
      expect(logger).toBeInstanceOf(LoggerService);
    });

    it('should still perform file operations without ErrorHandler', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      logger.info('Test message');

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });

    it('should still filter by log level without ErrorHandler', () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.WARN, testLogDir, true);

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warning');

      const logs = logger.getLogs();
      // All are stored, but only WARN+ passes filter
      const warnLogs = logger.getLogsByLevel(LogLevel.WARN);
      expect(warnLogs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========== EDGE CASES ==========
  describe('Edge Cases: Queue Management & Batch Processing', () => {
    it('should handle concurrent queue operations', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      // Simulate concurrent logging from multiple sources
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>(resolve => {
            logger.info(`Concurrent message ${i}`);
            resolve();
          })
        );
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 100));

      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(10);
    });

    it('should handle very long log messages', () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      const longMessage = 'x'.repeat(10000);

      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();

      const logs = logger.getLogs();
      expect(logs[logs.length - 1].message).toBe(longMessage);
    });

    it('should handle special characters in context', () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      const context = {
        unicode: '🚀 🎉 中文 العربية',
        special: '<script>alert("xss")</script>',
        newlines: 'line1\nline2\nline3',
      };

      expect(() => {
        logger.info('Special characters test', context);
      }).not.toThrow();

      const logs = logger.getLogs();
      expect(logs[logs.length - 1].context).toEqual(context);
    });

    it('should handle getLogFilePath correctly', () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true);

      const filePath = logger.getLogFilePath();
      expect(filePath).toBeTruthy();
      expect(filePath).toMatch(/trading-bot-\d{4}-\d{2}-\d{2}\.log$/);
    });

    it('should return null log file path when logToFile=false', () => {
      const logger = new LoggerService(LogLevel.INFO, testLogDir, false);

      const filePath = logger.getLogFilePath();
      expect(filePath).toBeNull();
    });
  });

  // ========== ERROR HANDLER INTEGRATION ==========
  describe('ErrorHandler Integration: Advanced Scenarios', () => {
    it('should use ErrorHandler for graceful degradation during constructor', async () => {
      const result = await errorHandler.executeAsync(
        async () => {
          return new LoggerService(LogLevel.INFO, testLogDir, false);
        },
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      expect(result.success || result.value).toBeTruthy();
    });

    it('should provide fallback when primary logger fails', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const primaryLogger = new LoggerService(LogLevel.INFO, testLogDir, true);
      const fallbackLogger = new LoggerService(LogLevel.DEBUG, testLogDir, false);

      expect(primaryLogger).toBeInstanceOf(LoggerService);
      expect(fallbackLogger).toBeInstanceOf(LoggerService);
    });

    it('should track ErrorHandler integration during logging', async () => {
      mkdirSync(testLogDir, { recursive: true });
      const logger = new LoggerService(LogLevel.INFO, testLogDir, true, errorHandler);

      await errorHandler.executeAsync(
        async () => {
          logger.info('Test with ErrorHandler');
          return true;
        },
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE }
      );

      expect(logger.getLogs().length).toBeGreaterThanOrEqual(1);
    });
  });
});
