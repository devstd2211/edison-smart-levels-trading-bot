import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { ErrorHandler, type ErrorLogger } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { LogLevel } from '../../types/legacy';

export function createLoggerTestDir(): string {
  return join(tmpdir(), `logger-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

export function cleanupLoggerTestDir(logDir: string): void {
  if (existsSync(logDir)) {
    rmSync(logDir, { recursive: true, force: true });
  }
}

export function ensureLoggerTestDir(logDir: string): void {
  mkdirSync(logDir, { recursive: true });
}

export function createLoggerErrorLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    getLogs: jest.fn(() => []),
    getLogsByLevel: jest.fn(() => []),
    clear: jest.fn(),
    disableConsoleOutput: jest.fn(),
    enableConsoleOutputMode: jest.fn(),
  } as ErrorLogger;
}

export function createLoggerErrorHandler(): ErrorHandler {
  return new ErrorHandler(createLoggerErrorLogger());
}

type LoggerServiceOptions = {
  minLevel?: LogLevel | string;
  logDir?: string;
  logToFile?: boolean;
  errorHandler?: ErrorHandler;
};

export function createTestLoggerService(
  options: LoggerServiceOptions = {},
): LoggerService {
  return new LoggerService(
    options.minLevel ?? LogLevel.INFO,
    options.logDir ?? './logs',
    options.logToFile ?? false,
    options.errorHandler,
  );
}
