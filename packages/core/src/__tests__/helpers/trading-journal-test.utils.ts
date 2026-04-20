import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ErrorHandler } from '../../errors/ErrorHandler';
import { TradingJournalService } from '../../services/trading-journal.service';
import {
  EntryCondition,
  ExitCondition,
  ExitType,
  PositionSide,
  LoggerService,
  LogLevel,
  SignalDirection,
  SignalType,
  TakeProfit,
} from '../../types/legacy';

export function createTradingJournalLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createTradingJournalTempDir(prefix: string = 'trading-journal-test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function cleanupTradingJournalTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function createJournalTakeProfit(
  level: number,
  price: number,
  percent: number = 1.0,
  sizePercent: number = 100,
): TakeProfit {
  return {
    level,
    price,
    percent,
    sizePercent,
    hit: false,
  };
}

export function createJournalExitCondition(
  exitType: ExitType,
  price: number,
  pnlPercent: number,
  realizedPnL: number,
  holdingTimeMinutes: number,
  tpLevelsHit: number[] = [],
  stoppedOut: boolean = false,
): ExitCondition {
  const timestamp = Date.now();
  return {
    exitType,
    price,
    timestamp,
    reason: `${exitType} hit`,
    pnlUsdt: realizedPnL,
    pnlPercent,
    realizedPnL,
    tpLevelsHit,
    tpLevelsHitCount: tpLevelsHit.length,
    holdingTimeMs: holdingTimeMinutes * 60 * 1000,
    holdingTimeMinutes,
    holdingTimeHours: holdingTimeMinutes / 60,
    stoppedOut,
    slMovedToBreakeven: false,
    trailingStopActivated: false,
  };
}

export function createJournalEntryCondition(): EntryCondition {
  return {
    signal: {
      price: 100,
      confidence: 75,
      type: SignalType.LEVEL_BASED,
      direction: SignalDirection.LONG,
      stopLoss: 90,
      takeProfits: [{ level: 1, percent: 50 }] as TakeProfit[],
      reason: 'test signal',
      timestamp: Date.now(),
    },
  };
}

export function createTradingJournalHarness(options: {
  logger?: LoggerService;
  dataDir?: string;
  withErrorHandler?: boolean;
  tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
  baseDeposit?: number;
} = {}) {
  const logger = options.logger ?? createTradingJournalLogger();
  const dataDir = options.dataDir ?? createTradingJournalTempDir();
  const errorHandler = new ErrorHandler(logger);
  const journal = createTradingJournalService({
    logger,
    dataDir,
    tradeHistoryConfig: options.tradeHistoryConfig,
    baseDeposit: options.baseDeposit,
    errorHandler,
    withErrorHandler: options.withErrorHandler,
  });

  return {
    journal,
    logger,
    dataDir,
    errorHandler,
  };
}

export interface ManagedTradingJournalContext {
  journal: TradingJournalService;
  logger: LoggerService;
  dataDir: string;
  errorHandler: ErrorHandler;
  createStandardService: (options?: {
    tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
    baseDeposit?: number;
    errorHandler?: ErrorHandler;
  }) => TradingJournalService;
  createLegacyService: (options?: {
    tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
    baseDeposit?: number;
  }) => TradingJournalService;
  createService: (options?: {
    tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
    baseDeposit?: number;
    withErrorHandler?: boolean;
    errorHandler?: ErrorHandler;
  }) => TradingJournalService;
  createServiceWithoutErrorHandler: (options?: {
    tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
    baseDeposit?: number;
  }) => TradingJournalService;
  cleanup: () => void;
}

export type TradingJournalManagedRuntime = Pick<
  ManagedTradingJournalContext,
  'dataDir' | 'journal' | 'logger' | 'errorHandler'
>;

export type TradingJournalManagedFactories = Pick<
  ManagedTradingJournalContext,
  'cleanup' | 'createService'
>;

export type TradingJournalManagedLegacyFactories = Pick<
  ManagedTradingJournalContext,
  'cleanup' | 'createLegacyService'
>;

export type TradingJournalManagedServiceFactories = Pick<
  ManagedTradingJournalContext,
  'cleanup' | 'createService'
>;

export function createManagedTradingJournalContext(options: {
  withErrorHandler?: boolean;
} = {}): ManagedTradingJournalContext {
  jest.clearAllMocks();

  const harness = createTradingJournalHarness({
    withErrorHandler: options.withErrorHandler,
  });

  return {
    journal: harness.journal,
    logger: harness.logger,
    dataDir: harness.dataDir,
    errorHandler: harness.errorHandler,
    createStandardService: (serviceOptions = {}) =>
      createStandardTradingJournalService({
        logger: harness.logger,
        dataDir: harness.dataDir,
        tradeHistoryConfig: serviceOptions.tradeHistoryConfig,
        baseDeposit: serviceOptions.baseDeposit,
        errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
      }),
    createLegacyService: (serviceOptions = {}) =>
      createLegacyTradingJournalService({
        logger: harness.logger,
        dataDir: harness.dataDir,
        tradeHistoryConfig: serviceOptions.tradeHistoryConfig,
        baseDeposit: serviceOptions.baseDeposit,
      }),
    createService: (serviceOptions = {}) =>
      (serviceOptions.withErrorHandler === false
        ? createLegacyTradingJournalService({
            logger: harness.logger,
            dataDir: harness.dataDir,
            tradeHistoryConfig: serviceOptions.tradeHistoryConfig,
            baseDeposit: serviceOptions.baseDeposit,
          })
        : createStandardTradingJournalService({
            logger: harness.logger,
            dataDir: harness.dataDir,
            tradeHistoryConfig: serviceOptions.tradeHistoryConfig,
            baseDeposit: serviceOptions.baseDeposit,
            errorHandler: serviceOptions.errorHandler ?? harness.errorHandler,
          })),
    createServiceWithoutErrorHandler: (serviceOptions = {}) =>
      createLegacyTradingJournalService({
        logger: harness.logger,
        dataDir: harness.dataDir,
        tradeHistoryConfig: serviceOptions.tradeHistoryConfig,
        baseDeposit: serviceOptions.baseDeposit,
      }),
    cleanup: () => {
      cleanupTradingJournalTempDir(harness.dataDir);
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}

export function createStandardTradingJournalService(options: {
  logger?: LoggerService;
  dataDir?: string;
  tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
  baseDeposit?: number;
  errorHandler?: ErrorHandler;
} = {}) {
  return createTradingJournalService({
    ...options,
    withErrorHandler: true,
  });
}

export function createLegacyTradingJournalService(options: {
  logger?: LoggerService;
  dataDir?: string;
  tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
  baseDeposit?: number;
} = {}) {
  return createTradingJournalService({
    ...options,
    withErrorHandler: false,
  });
}

export function createTradingJournalService(options: {
  logger?: LoggerService;
  dataDir?: string;
  tradeHistoryConfig?: ConstructorParameters<typeof TradingJournalService>[2];
  baseDeposit?: number;
  errorHandler?: ErrorHandler;
  withErrorHandler?: boolean;
} = {}) {
  const logger = options.logger ?? createTradingJournalLogger();
  const dataDir = options.dataDir ?? createTradingJournalTempDir();

  return new TradingJournalService(
    logger,
    dataDir,
    options.tradeHistoryConfig,
    options.baseDeposit,
    undefined,
    options.withErrorHandler === false ? undefined : options.errorHandler,
  );
}

export function createJournalOpenParams(overrides: Partial<{
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  leverage: number;
  entryCondition: EntryCondition;
}> = {}) {
  return {
    id: 'TRADE_1',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    entryPrice: 100,
    quantity: 1,
    leverage: 1,
    entryCondition: createJournalEntryCondition(),
    ...overrides,
  };
}

export function createJournalCloseParams(overrides: Partial<{
  id: string;
  exitPrice: number;
  exitCondition: ExitCondition;
  realizedPnL: number;
}> = {}) {
  return {
    id: 'TRADE_1',
    exitPrice: 110,
    exitCondition: createJournalExitCondition(
      ExitType.TAKE_PROFIT_1,
      110,
      10,
      10,
      10,
      [1],
      false,
    ),
    realizedPnL: 10,
    ...overrides,
  };
}
