import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import { ErrorHandler } from '../../errors';
import { LoggerService } from '../../services/logger.service';
import { PositionStateMachineService } from '../../services/position-state-machine.service';
import { PositionState } from '../../types/enums';
import type {
  PositionStateMachineState,
  StateTransitionRequest,
  StateTransitionResult,
} from '../../types/position-state-machine';

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

export function getStateMachineStateFilePath(baseDir: string): string {
  return createTestStateMachinePaths(baseDir).stateFilePath;
}

export function getStateMachineHistoryFilePath(baseDir: string): string {
  return createTestStateMachinePaths(baseDir).historyFilePath;
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
  baseDir?: string;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const service = new PositionStateMachineService(
    logger,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );

  if (options.baseDir) {
    const paths = createTestStateMachinePaths(options.baseDir);
    (service as unknown as { stateFilePath: string }).stateFilePath = paths.stateFilePath;
    (service as unknown as { historyFilePath: string }).historyFilePath = paths.historyFilePath;
  }

  return service;
}

export function createStandardPositionStateMachineService(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  baseDir?: string;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const errorHandler =
    options.errorHandler ?? createPositionStateMachineErrorHandler(logger);

  return createPositionStateMachineService({
    logger,
    errorHandler,
    baseDir: options.baseDir,
  });
}

export function createLegacyPositionStateMachineService(options: {
  logger?: LoggerService;
  baseDir?: string;
} = {}) {
  return createPositionStateMachineService({
    logger: options.logger,
    withErrorHandler: false,
    baseDir: options.baseDir,
  });
}

export function createPositionStateMachineServiceWithHarness(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  return createPositionStateMachineService(options);
}

export async function createInitializedPositionStateMachineHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  baseDir?: string;
} = {}) {
  const harness = createPositionStateMachineHarness(options);
  await harness.service.initialize();
  return harness;
}

export async function createInitializedPositionStateMachineService(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  baseDir?: string;
} = {}): Promise<PositionStateMachineService> {
  const harness = await createInitializedPositionStateMachineHarness(options);
  return harness.service;
}

export async function createInitializedStandardPositionStateMachineService(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  baseDir?: string;
} = {}): Promise<PositionStateMachineService> {
  const service = createStandardPositionStateMachineService(options);
  await service.initialize();
  return service;
}

export async function createInitializedLegacyPositionStateMachineService(options: {
  logger?: LoggerService;
  baseDir?: string;
} = {}): Promise<PositionStateMachineService> {
  const service = createLegacyPositionStateMachineService(options);
  await service.initialize();
  return service;
}

export function createPositionStateTransitionInput(
  overrides: Partial<{
    symbol: string;
    positionId: string;
    targetState: PositionState;
    reason: string;
    metadata: Record<string, unknown>;
  }> = {},
) {
  return {
    symbol: 'BTCUSDT',
    positionId: `pos-${Date.now()}`,
    targetState: PositionState.TP1_HIT,
    reason: 'Test transition',
    ...(overrides.symbol !== undefined ? { symbol: overrides.symbol } : {}),
    ...(overrides.positionId !== undefined ? { positionId: overrides.positionId } : {}),
    ...(overrides.targetState !== undefined ? { targetState: overrides.targetState } : {}),
    ...(overrides.reason !== undefined ? { reason: overrides.reason } : {}),
    ...(overrides.metadata !== undefined ? { metadata: overrides.metadata } : {}),
  };
}

export function createPositionStateMachinePersistedState(
  overrides: Partial<PositionStateMachineState> = {},
): PositionStateMachineState {
  const now = Date.now();

  return {
    symbol: 'BTCUSDT',
    positionId: createPositionStateMachinePositionId(),
    currentState: PositionState.OPEN,
    createdAt: now,
    stateChangedAt: now,
    ...overrides,
  };
}

export function createPositionStateMachineHistoryEntry(
  overrides: Partial<{
    request: StateTransitionRequest;
    result: StateTransitionResult;
    timestamp: number;
  }> = {},
) {
  return {
    request: createPositionStateTransitionInput(overrides.request),
    result: {
      allowed: true,
      currentState: overrides.request?.targetState ?? PositionState.TP1_HIT,
    },
    timestamp: overrides.timestamp ?? Date.now(),
    ...overrides,
  };
}

export async function seedStateMachineStatesFile(
  baseDir: string,
  states: PositionStateMachineState[],
): Promise<string> {
  const stateFilePath = getStateMachineStateFilePath(baseDir);
  await ensureParentDir(stateFilePath);
  await fsPromises.writeFile(
    stateFilePath,
    states.map((state) => JSON.stringify(state)).join('\n'),
  );
  return stateFilePath;
}

export async function seedStateMachineHistoryFile(
  baseDir: string,
  entries: Array<ReturnType<typeof createPositionStateMachineHistoryEntry> | string>,
): Promise<string> {
  const historyFilePath = getStateMachineHistoryFilePath(baseDir);
  await ensureParentDir(historyFilePath);
  await fsPromises.writeFile(
    historyFilePath,
    entries
      .map((entry) => (typeof entry === 'string' ? entry : JSON.stringify(entry)))
      .join('\n'),
  );
  return historyFilePath;
}

export function applyPositionStateSequence(
  service: PositionStateMachineService,
  options: {
    symbol?: string;
    positionId?: string;
    states: PositionState[];
    reasonPrefix?: string;
  },
) {
  transitionPositionStateSequence(service, options);
}

export function createPositionStateMachinePositionId(prefix = 'pos'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function transitionPositionStateSequence(
  service: PositionStateMachineService,
  options: {
    symbol?: string;
    positionId?: string;
    states: PositionState[];
    reasonPrefix?: string;
  },
) {
  const symbol = options.symbol ?? 'BTCUSDT';
  const positionId = options.positionId ?? createPositionStateMachinePositionId();

  return options.states.map((targetState, index) =>
    service.transitionState(
      createPositionStateTransitionInput({
        symbol,
        positionId,
        targetState,
        reason: `${options.reasonPrefix ?? 'Transition'} ${index + 1}`,
      }),
    ),
  );
}

export function transitionPositionState(
  service: PositionStateMachineService,
  options: {
    symbol?: string;
    positionId?: string;
    targetState: PositionState;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return service.transitionState(
    createPositionStateTransitionInput({
      symbol: options.symbol,
      positionId: options.positionId,
      targetState: options.targetState,
      reason: options.reason,
      metadata: options.metadata,
    }),
  );
}

export function closePositionState(
  service: PositionStateMachineService,
  options: {
    symbol?: string;
    positionId: string;
    reason: string;
    closureReason?: 'SL_HIT' | 'TP1_HIT' | 'TP2_HIT' | 'TP3_HIT' | 'TRAILING_STOP' | 'MANUAL' | 'OTHER';
    closurePrice?: number;
    closurePnL?: number;
  },
) {
  return service.closePosition(
    options.symbol ?? 'BTCUSDT',
    options.positionId,
    options.reason,
    {
      closureReason: options.closureReason,
      closurePrice: options.closurePrice,
      closurePnL: options.closurePnL,
    },
  );
}

export function getPositionStateSnapshot(
  service: PositionStateMachineService,
  positionId: string,
  symbol = 'BTCUSDT',
) {
  return service.getFullState(symbol, positionId);
}

export function createPositionStateMachineHarness(options: {
  logger?: LoggerService;
  withErrorHandler?: boolean;
  baseDir?: string;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const errorHandler =
    options.withErrorHandler === false
      ? undefined
      : createPositionStateMachineErrorHandler(logger);
  const testDataDir =
    options.baseDir ??
    path.join(process.cwd(), 'data', `test-state-machine-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const service = createPositionStateMachineService({
    logger,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
    baseDir: testDataDir,
  });
  const paths = createTestStateMachinePaths(testDataDir);

  return {
    service,
    logger,
    errorHandler,
    testDataDir,
    paths,
  };
}

export function createStandardPositionStateMachineHarness(options: {
  logger?: LoggerService;
  errorHandler?: ErrorHandler;
  baseDir?: string;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const errorHandler =
    options.errorHandler ?? createPositionStateMachineErrorHandler(logger);
  const testDataDir =
    options.baseDir ??
    path.join(process.cwd(), 'data', `test-state-machine-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const service = createStandardPositionStateMachineService({
    logger,
    errorHandler,
    baseDir: testDataDir,
  });
  const paths = createTestStateMachinePaths(testDataDir);

  return {
    service,
    logger,
    errorHandler,
    testDataDir,
    paths,
  };
}

export function createLegacyPositionStateMachineHarness(options: {
  logger?: LoggerService;
  baseDir?: string;
} = {}) {
  const logger = options.logger ?? createMockPositionStateMachineLogger();
  const testDataDir =
    options.baseDir ??
    path.join(process.cwd(), 'data', `test-state-machine-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const service = createLegacyPositionStateMachineService({
    logger,
    baseDir: testDataDir,
  });
  const paths = createTestStateMachinePaths(testDataDir);

  return {
    service,
    logger,
    errorHandler: undefined,
    testDataDir,
    paths,
  };
}

export async function waitForStateMachinePersistence(delayMs = 50): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
