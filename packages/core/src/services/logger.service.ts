/**
 * Logger Service
 *
 * Centralized logging service with file and console support
 * Features:
 * - File logging with daily rotation
 * - Console logging with colors
 * - Async queue-based file writes
 * - 7-day log cleanup
 * - ErrorHandler integration (Phase 8.9.55)
 *
 * RULE: NO fallbacks, FAIL FAST (for validation), GRACEFUL_DEGRADE for file operations
 */

import { existsSync, mkdirSync } from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { LogEntry } from '../types/legacy';
import { LogLevel } from '../types/legacy';
import { TIME_INTERVALS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  formatLogEntry,
  getTodayString,
  normalizeLogLevel,
  shouldLogLevel,
  validateLogLevel,
} from './logger/logger-core.utils';

interface WriteQueueItem {
  filePath: string;
  content: string;
}

export class LoggerService {
  private readonly minLevel: LogLevel;
  private readonly logDir: string;
  private readonly logToFile: boolean;
  private logs: LogEntry[] = [];
  private writeQueue: WriteQueueItem[] = [];
  private isProcessingQueue: boolean = false;
  private enableConsoleOutput: boolean = true; // Can be disabled for dashboard
  private readonly errorHandler?: ErrorHandler;
  private initialized = false;

  constructor(
    minLevel: LogLevel | string = LogLevel.INFO,
    logDir: string = './logs',
    logToFile: boolean = true,
    errorHandler?: ErrorHandler,
  ) {
    // THROW: Validate minLevel (Phase 8.9.55)
    validateLogLevel(minLevel);

    // THROW: Validate logDir when logging to file
    if (logToFile && !this.isValidLogDir(logDir)) {
      throw new Error(`Invalid log directory: ${logDir}`);
    }

    // Normalize string to enum (for config compatibility)
    const normalizedLevel = normalizeLogLevel(minLevel);

    this.minLevel = normalizedLevel;
    this.logDir = logDir;
    this.logToFile = logToFile;
    this.errorHandler = errorHandler;
  }

  /**
   * Start logger initialization (explicit lifecycle)
   */
  start(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    if (this.logToFile) {
      this.ensureLogDirectory();
      // Start cleanup in background
      void this.cleanOldLogs();
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.start();
    }
  }

  /**
   * Validate that logDir is a valid directory path
   */
  private isValidLogDir(logDir: unknown): boolean {
    if (typeof logDir !== 'string') {
      return false;
    }
    if (logDir.length === 0) {
      return false;
    }
    return true;
  }

  /**
   * Ensure log directory exists (GRACEFUL_DEGRADE on creation failure)
   */
  private ensureLogDirectory(): void {
    try {
      if (!existsSync(this.logDir)) {
        mkdirSync(this.logDir, { recursive: true });
        this.safeLog(() => {
          console.log(`📁 Created log directory: ${this.logDir}`);
        });
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Log directory creation failure
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      } else {
        this.safeLog(() => {
          console.error(`Failed to create log directory: ${this.logDir}`, error);
        });
      }
      // Continue execution - logging can work without file system
    }
  }

  /**
   * Clean old log files (>7 days) - GRACEFUL_DEGRADE on failures
   */
  private async cleanOldLogs(): Promise<void> {
    try {
      const { readdir, stat, unlink } = await import('fs/promises');

      let files: string[];
      try {
        files = await readdir(this.logDir);
      } catch (error) {
        // GRACEFUL_DEGRADE: Cannot read directory
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
        } else {
          this.safeLog(() => {
            console.error(`Failed to read log directory: ${this.logDir}`, error);
          });
        }
        return;
      }

      const now = Date.now();
      const maxAge = TIME_INTERVALS.MS_PER_7_DAYS; // 7 days in milliseconds

      for (const file of files) {
        if (!file.endsWith('.log')) {
          continue;
        }

        try {
          const filePath = join(this.logDir, file);
          const stats = await stat(filePath);
          const age = now - stats.mtime.getTime();

          if (age > maxAge) {
            await unlink(filePath);
            const daysOld = Math.floor(age / TIME_INTERVALS.MS_PER_DAY);
            this.safeLog(() => {
              console.log(`🗑️ Deleted old log file: ${file} (${daysOld} days old)`);
            });
          }
        } catch (fileError) {
          // GRACEFUL_DEGRADE: Continue if individual file operations fail
          if (this.errorHandler) {
            this.errorHandler.handle(fileError, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
          } else {
            this.safeLog(() => {
              console.error(`Failed to process log file ${file}:`, fileError);
            });
          }
        }
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Cleanup failure should not block logging
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      } else {
        this.safeLog(() => {
          console.error('Failed to clean old log files:', error);
        });
      }
    }
  }

  /**
   * Write log entry to file (async queue)
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.logToFile) {
      return;
    }

    const today = getTodayString();
    const fileName = `trading-bot-${today}.log`;
    const filePath = join(this.logDir, fileName);
    const logLine = formatLogEntry(entry) + '\n';

    this.writeQueue.push({ filePath, content: logLine });
    void this.processWriteQueue();
  }

  /**
   * Process write queue asynchronously - GRACEFUL_DEGRADE on write failures
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue || this.writeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Group writes by file for efficiency
      const fileGroups = new Map<string, string[]>();

      // Process up to 10 entries at a time
      const batchSize = Math.min(10, this.writeQueue.length);
      const batch = this.writeQueue.splice(0, batchSize);

      for (const { filePath, content } of batch) {
        if (!fileGroups.has(filePath)) {
          fileGroups.set(filePath, []);
        }
        fileGroups.get(filePath)!.push(content);
      }

      // Write all groups in parallel
      const writePromises = Array.from(fileGroups.entries()).map(
        async ([filePath, contents]) => {
          try {
            const combinedContent = contents.join('');
            await appendFile(filePath, combinedContent);
          } catch (error) {
            // GRACEFUL_DEGRADE: Continue if individual file writes fail
            if (this.errorHandler) {
              this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
            } else {
              this.safeLog(() => {
                console.error(`Failed to write to log file ${filePath}:`, error);
              });
            }
          }
        },
      );

      await Promise.all(writePromises);
    } catch (error) {
      // GRACEFUL_DEGRADE: Queue processing failure should not block logging
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      } else {
        this.safeLog(() => {
          console.error('Failed to process write queue:', error);
        });
      }
    } finally {
      this.isProcessingQueue = false;

      // Process remaining queue
      if (this.writeQueue.length > 0) {
        setImmediate(() => void this.processWriteQueue());
      }
    }
  }

  /**
   * Safely log without triggering recursive errors (SKIP strategy)
   */
  private safeLog(logFn: () => void): void {
    try {
      logFn();
    } catch (error) {
      // SKIP: Console errors should not propagate
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
      // Silent fail for console operations
    }
  }

  /**
   * Write log entry to console with colors - SKIP on console errors
   */
  private writeToConsole(entry: LogEntry): void {
    // Skip console output if disabled (for dashboard mode)
    if (!this.enableConsoleOutput) {
      return;
    }

    this.safeLog(() => {
      const formattedMessage = formatLogEntry(entry);

      // Use template literals instead of %s formatting to avoid console wrapping issues
      switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(`\x1b[36m${formattedMessage}\x1b[0m`); // Cyan
        break;
      case LogLevel.INFO:
        console.info(`\x1b[32m${formattedMessage}\x1b[0m`); // Green
        break;
      case LogLevel.WARN:
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`); // Yellow
        break;
      case LogLevel.ERROR:
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`); // Red
        break;
      }
    });
  }

  /**
   * Disable console output (useful for dashboard mode)
   */
  public disableConsoleOutput(): void {
    this.enableConsoleOutput = false;
    this.safeLog(() => {
      console.log('[LOGGER] 🎨 Console output disabled (dashboard mode)');
    });
  }

  /**
   * Enable console output
   */
  public enableConsoleOutputMode(): void {
    this.enableConsoleOutput = true;
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.ensureInitialized();
    if (!shouldLogLevel(level, this.minLevel)) {
      return; // Skip logs below minimum level
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      context,
    };

    this.logs.push(entry);
    this.writeToConsole(entry);
    this.writeToFile(entry);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Set console output mode (for dashboard)
   * When false: logs only go to file, preventing interference with blessed UI
   * When true: logs go to both console and file
   */
  setConsoleOutputEnabled(enabled: boolean): void {
    this.enableConsoleOutput = enabled;
    this.safeLog(() => {
      if (!enabled) {
        console.log('[LOGGER] 🎨 Console output disabled - logs will be file-only (dashboard mode)');
      }
    });
  }

  /**
   * Get current log file path
   */
  getLogFilePath(): string | null {
    if (!this.logToFile) {
      return null;
    }
    const today = getTodayString();
    const fileName = `trading-bot-${today}.log`;
    return join(this.logDir, fileName);
  }
}
