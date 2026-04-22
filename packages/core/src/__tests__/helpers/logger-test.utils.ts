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

type LoggerFactoryOptions = {
  minLevel?: LogLevel | string;
  logDir?: string;
  logToFile?: boolean;
};

export function createStandardLoggerService(
  options: LoggerServiceOptions = {},
): LoggerService {
  return createTestLoggerService(options);
}

export function createLegacyLoggerService(
  options: LoggerFactoryOptions = {},
): LoggerService {
  return createTestLoggerService({
    minLevel: options.minLevel,
    logDir: options.logDir,
    logToFile: options.logToFile,
  });
}

export function createStandardLoggerFactory(
  options: { errorHandler?: ErrorHandler } = {},
) {
  return (factoryOptions: LoggerFactoryOptions = {}) =>
    createStandardLoggerService({
      minLevel: factoryOptions.minLevel,
      logDir: factoryOptions.logDir,
      logToFile: factoryOptions.logToFile,
      errorHandler: options.errorHandler,
    });
}

export function createLegacyLoggerFactory() {
  return (factoryOptions: LoggerFactoryOptions = {}) =>
    createLegacyLoggerService(factoryOptions);
}

export interface ManagedLoggerTestContext {
  testLogDir: string;
  errorHandler: ErrorHandler;
  createLogger: ReturnType<typeof createStandardLoggerFactory>;
  createLegacyLogger: ReturnType<typeof createLegacyLoggerFactory>;
  createInvalidStandardService: (
    minLevel: ConstructorParameters<typeof LoggerService>[0],
    logDir?: ConstructorParameters<typeof LoggerService>[1],
    logToFile?: ConstructorParameters<typeof LoggerService>[2],
    errorHandler?: ConstructorParameters<typeof LoggerService>[3],
  ) => LoggerService;
  createStandardService: typeof createStandardLoggerService;
  createLegacyService: typeof createLegacyLoggerService;
  cleanup: () => void;
}

export type LoggerErrorHandlingRuntime = Pick<
  ManagedLoggerTestContext,
  | 'testLogDir'
  | 'errorHandler'
  | 'createLogger'
  | 'createLegacyLogger'
  | 'createInvalidStandardService'
  | 'createStandardService'
  | 'createLegacyService'
  | 'cleanup'
>;

export function createManagedLoggerTestContext(): ManagedLoggerTestContext {
  jest.clearAllMocks();

  const testLogDir = createLoggerTestDir();
  const errorHandler = createLoggerErrorHandler();

  return {
    testLogDir,
    errorHandler,
    createLogger: createStandardLoggerFactory({ errorHandler }),
    createLegacyLogger: createLegacyLoggerFactory(),
    createInvalidStandardService: (minLevel, logDir = './logs', logToFile = false, handler = errorHandler) =>
      new LoggerService(minLevel, logDir, logToFile, handler),
    createStandardService: createStandardLoggerService,
    createLegacyService: createLegacyLoggerService,
    cleanup: () => {
      cleanupLoggerTestDir(testLogDir);
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
