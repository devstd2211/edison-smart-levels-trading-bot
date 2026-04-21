import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ErrorHandler } from '../../errors/ErrorHandler';
import { VirtualBalanceService } from '../../services/virtual-balance.service';
import type { LoggerService } from '../../services/logger.service';

export type VirtualBalanceLogger = {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
};

export function createVirtualBalanceMockLogger(): VirtualBalanceLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

export function asVirtualBalanceLogger(logger: VirtualBalanceLogger): LoggerService {
  return logger as unknown as LoggerService;
}

export function createVirtualBalanceTempDir(prefix: string = 'virtual-balance-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupVirtualBalanceTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function createVirtualBalanceHarness(options: {
  baseDeposit?: number;
  dataDir?: string;
  logger?: VirtualBalanceLogger;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createVirtualBalanceMockLogger();
  const dataDir = options.dataDir ?? createVirtualBalanceTempDir();
  const errorHandler = options.errorHandler ?? new ErrorHandler(asVirtualBalanceLogger(logger));
  const service = new VirtualBalanceService(
    asVirtualBalanceLogger(logger),
    errorHandler,
    options.baseDeposit ?? 100,
    dataDir,
  );

  return {
    service,
    logger,
    errorHandler,
    dataDir,
    statePath: path.join(dataDir, 'virtual-balance.json'),
  };
}

export interface ManagedVirtualBalanceContext {
  service: VirtualBalanceService;
  logger: VirtualBalanceLogger;
  errorHandler: ErrorHandler;
  dataDir: string;
  statePath: string;
  createService: (baseDeposit?: number) => VirtualBalanceService;
  cleanup: () => void;
}

export type VirtualBalanceManagedRuntime = Pick<
  ManagedVirtualBalanceContext,
  'dataDir' | 'statePath' | 'logger' | 'errorHandler'
>;

export type VirtualBalanceManagedFactories = Pick<
  ManagedVirtualBalanceContext,
  'cleanup' | 'createService'
>;

export type VirtualBalanceManagedState = Pick<
  ManagedVirtualBalanceContext,
  'dataDir' | 'statePath' | 'logger' | 'errorHandler' | 'cleanup' | 'createService'
>;

export type VirtualBalanceErrorHandlingState = Pick<
  ManagedVirtualBalanceContext,
  'dataDir' | 'statePath' | 'logger' | 'errorHandler' | 'cleanup' | 'createService'
>;

export function createStandardVirtualBalanceService(options: {
  baseDeposit?: number;
  dataDir?: string;
  logger?: VirtualBalanceLogger;
  errorHandler?: ErrorHandler;
} = {}): VirtualBalanceService {
  return createVirtualBalanceHarness(options).service;
}

export function createVirtualBalanceService(options: {
  baseDeposit?: number;
  dataDir?: string;
  logger?: VirtualBalanceLogger;
  errorHandler?: ErrorHandler;
} = {}): VirtualBalanceService {
  const logger = options.logger ?? createVirtualBalanceMockLogger();
  const dataDir = options.dataDir ?? createVirtualBalanceTempDir();
  const errorHandler = options.errorHandler ?? new ErrorHandler(asVirtualBalanceLogger(logger));

  return new VirtualBalanceService(
    asVirtualBalanceLogger(logger),
    errorHandler,
    options.baseDeposit ?? 100,
    dataDir,
  );
}

export function createVirtualBalanceBoundFactory(options: {
  baseDeposit?: number;
  dataDir?: string;
  logger?: VirtualBalanceLogger;
  errorHandler?: ErrorHandler;
} = {}) {
  const logger = options.logger ?? createVirtualBalanceMockLogger();
  const dataDir = options.dataDir ?? createVirtualBalanceTempDir();
  const errorHandler = options.errorHandler ?? new ErrorHandler(asVirtualBalanceLogger(logger));
  const baseDeposit = options.baseDeposit ?? 100;

  return {
    logger,
    dataDir,
    errorHandler,
    baseDeposit,
    createStandardService: (serviceOptions: {
      baseDeposit?: number;
      dataDir?: string;
      logger?: VirtualBalanceLogger;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createStandardVirtualBalanceService({
        baseDeposit: serviceOptions.baseDeposit ?? baseDeposit,
        dataDir: serviceOptions.dataDir ?? dataDir,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
    createService: (serviceOptions: {
      baseDeposit?: number;
      dataDir?: string;
      logger?: VirtualBalanceLogger;
      errorHandler?: ErrorHandler;
    } = {}) =>
      createVirtualBalanceService({
        baseDeposit: serviceOptions.baseDeposit ?? baseDeposit,
        dataDir: serviceOptions.dataDir ?? dataDir,
        logger: serviceOptions.logger ?? logger,
        errorHandler: serviceOptions.errorHandler ?? errorHandler,
      }),
  };
}

export function createManagedVirtualBalanceContext(options: {
  baseDeposit?: number;
  dataDirPrefix?: string;
} = {}): ManagedVirtualBalanceContext {
  jest.clearAllMocks();

  const dataDir = createVirtualBalanceTempDir(options.dataDirPrefix);
  const harness = createVirtualBalanceHarness({
    dataDir,
    baseDeposit: options.baseDeposit,
  });
  const factory = createVirtualBalanceBoundFactory({
    dataDir,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    baseDeposit: options.baseDeposit ?? 100,
  });

  return {
    service: harness.service,
    logger: harness.logger,
    errorHandler: harness.errorHandler,
    dataDir,
    statePath: harness.statePath,
    createService: (baseDeposit = options.baseDeposit ?? 100) =>
      factory.createStandardService({ baseDeposit }),
    cleanup: () => {
      cleanupVirtualBalanceTempDir(dataDir);
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
