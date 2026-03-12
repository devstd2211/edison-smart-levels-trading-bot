import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { ErrorHandler } from '../../errors/ErrorHandler';
import { TradingJournalService } from '../../services/trading-journal.service';
import {
  EntryCondition,
  ExitCondition,
  ExitType,
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
} = {}) {
  const logger = options.logger ?? createTradingJournalLogger();
  const dataDir = options.dataDir ?? createTradingJournalTempDir();
  const errorHandler = new ErrorHandler(logger);
  const journal = new TradingJournalService(
    logger,
    dataDir,
    undefined,
    undefined,
    undefined,
    options.withErrorHandler === false ? undefined : errorHandler,
  );

  return {
    journal,
    logger,
    dataDir,
    errorHandler,
  };
}
