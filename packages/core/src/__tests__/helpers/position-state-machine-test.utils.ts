import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { LoggerService } from '../../services/logger.service';

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
