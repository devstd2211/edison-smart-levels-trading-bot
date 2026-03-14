import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { ErrorHandler } from '../../errors';
import { LoggerService } from '../../services/logger.service';
import { PositionStateMachineService } from '../../services/position-state-machine.service';

export function createMockPositionStateMachineLogger(): LoggerService {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  } as unknown as LoggerService;
}

export function createTestStateMachinePaths(baseDir: string = path.join(process.cwd(), 'data')) {
  return {
    dataDir: baseDir,
    stateFilePath: path.join(baseDir, 'position-states.jsonl'),
    historyFilePath: path.join(baseDir, 'position-transitions.jsonl'),
  };
}

export async function ensureParentDir(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    await fsPromises.mkdir(dir, { recursive: true });
  }
}

export async function removeStateMachineArtifacts(baseDir: string): Promise<void> {
  try {
    if (fs.existsSync(baseDir)) {
      await fsPromises.rm(baseDir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors in tests.
  }
}

export function createPositionStateMachineErrorHandler(
  logger: LoggerService = createMockPositionStateMachineLogger(),
): ErrorHandler {
  return new ErrorHandler(logger);
}

export function createPositionStateMachineService(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();

  return new PositionStateMachineService(
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createPositionStateMachineHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createPositionStateMachineErrorHandler(logger);
  const service = createPositionStateMachineService({
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    service,
    logger,
    errorHandler,
  };
}
