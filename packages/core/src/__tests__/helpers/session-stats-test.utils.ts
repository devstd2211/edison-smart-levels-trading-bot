import * as fs from 'fs';
import * as path from 'path';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { SessionStatsService } from '../../services/session-stats.service';
import {
  Config,
  ExitType,
  LogLevel,
  SessionTradeRecord,
  SignalDirection,
  SignalType,
} from '../../types/legacy';

export class SessionStatsMockLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

export function createSessionStatsLogger(): SessionStatsMockLogger {
  return new SessionStatsMockLogger();
}

export function createSessionStatsTempDir(): string {
  return path.join(process.cwd(), `test-session-stats-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

export function ensureSessionStatsTempDir(tempDir: string): void {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

export function cleanupSessionStatsTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function createSessionStatsConfig(): Config {
  return {
    symbol: 'BTCUSDT',
    exchange: 'bybit',
    tradingMode: 'perpetual',
    leverage: 2,
    positionSize: 100,
    minBalance: 1000,
    maxDrawdown: 20,
    riskPercent: 1,
    stopLossPercent: 1.5,
    takeProfits: [
      { level: 1, percent: 0.5, quantity: 0.3 },
      { level: 2, percent: 1, quantity: 0.4 },
      { level: 3, percent: 1.5, quantity: 0.3 },
    ],
    entryConditions: {
      enableLevelBased: true,
      enableOscillator: true,
      enableBreakout: true,
    },
    strategies: [],
  } as unknown as Config;
}

export function createSessionStatsTrade(
  tradeId: string,
  overrides: Partial<SessionTradeRecord> = {},
): SessionTradeRecord {
  const entryCondition = {
    signal: {
      type: SignalType.LEVEL_BASED,
      direction: SignalDirection.LONG,
      price: 50000,
      confidence: 75,
      stopLoss: 49000,
      takeProfits: [{ level: 1, percent: 0.5 }],
      reason: 'test signal',
      timestamp: Date.now(),
    },
    indicators: {
      entry: {},
      primary: {},
      trend1: {},
    },
    patterns: {},
    levels: null,
    context: {},
  } as unknown as SessionTradeRecord['entryCondition'];

  const baseTrade: SessionTradeRecord = {
    tradeId,
    timestamp: new Date().toISOString(),
    direction: SignalDirection.LONG,
    entryPrice: 50000,
    exitPrice: 0,
    quantity: 1,
    pnl: 0,
    pnlPercent: 0,
    exitType: ExitType.TAKE_PROFIT_1,
    tpHitLevels: [],
    holdingTimeMs: 0,
    entryCondition,
    stopLoss: {
      initial: 49000,
      final: 49000,
      movedToBreakeven: false,
      trailingActivated: false,
    },
  };

  return {
    ...baseTrade,
    ...overrides,
    entryCondition: overrides.entryCondition ?? entryCondition,
    stopLoss: overrides.stopLoss ?? baseTrade.stopLoss,
  };
}

export function getSessionStatsFilePath(tempDir: string): string {
  return path.join(tempDir, 'session-stats.json');
}

export function getSessionStatsCorruptedBackupPath(tempDir: string): string {
  return `${getSessionStatsFilePath(tempDir)}.corrupted`;
}

export function createSessionStatsExitUpdate(
  overrides: Partial<
    Pick<
      SessionTradeRecord,
      'exitPrice' | 'pnl' | 'pnlPercent' | 'exitType' | 'tpHitLevels' | 'holdingTimeMs' | 'stopLoss'
    >
  > = {},
): Pick<
  SessionTradeRecord,
  'exitPrice' | 'pnl' | 'pnlPercent' | 'exitType' | 'tpHitLevels' | 'holdingTimeMs' | 'stopLoss'
> {
  return {
    exitPrice: 51000,
    pnl: 1000,
    pnlPercent: 2,
    exitType: ExitType.TAKE_PROFIT_1,
    tpHitLevels: [1],
    holdingTimeMs: 60000,
    stopLoss: {
      initial: 49000,
      final: 49000,
      movedToBreakeven: false,
      trailingActivated: false,
    },
    ...overrides,
  };
}

type SessionStatsHarnessOptions = {
  logger?: SessionStatsMockLogger;
  tempDir?: string;
  errorHandler?: ErrorHandler;
  autoStart?: boolean;
};

export interface ManagedSessionStatsContext {
  stats: SessionStatsService;
  errorHandler: ErrorHandler;
  logger: SessionStatsMockLogger;
  tempDir: string;
  createService: (
    overrides?: { errorHandler?: ErrorHandler; autoStart?: boolean },
  ) => SessionStatsService;
  cleanup: () => void;
}

export type SessionStatsManagedRuntime = Pick<
  ManagedSessionStatsContext,
  'stats' | 'errorHandler' | 'logger' | 'tempDir' | 'createService' | 'cleanup'
>;

export type SessionStatsErrorHandlingState = SessionStatsManagedRuntime;

export function createSessionStatsService(
  options: SessionStatsHarnessOptions = {},
): SessionStatsService {
  const service = new SessionStatsService(
    options.logger ?? createSessionStatsLogger(),
    undefined,
    options.tempDir ?? createSessionStatsTempDir(),
    options.errorHandler,
  );

  if (options.autoStart === true) {
    service.start();
  }

  return service;
}

export function createSessionStatsHarness(
  options: SessionStatsHarnessOptions = {},
) {
  const logger = options.logger ?? createSessionStatsLogger();
  const tempDir = options.tempDir ?? createSessionStatsTempDir();
  ensureSessionStatsTempDir(tempDir);
  const errorHandler = options.errorHandler ?? new ErrorHandler(logger);
  const createService = (
    overrides: Omit<SessionStatsHarnessOptions, 'logger' | 'tempDir'> = {},
  ): SessionStatsService =>
    createSessionStatsService({
      logger,
      tempDir,
      errorHandler,
      autoStart: overrides.autoStart,
      ...overrides,
    });

  return {
    logger,
    tempDir,
    errorHandler,
    createService,
    stats: createService({ autoStart: options.autoStart ?? true }),
  };
}

export function createManagedSessionStatsContext(
  options: SessionStatsHarnessOptions = {},
): ManagedSessionStatsContext {
  const harness = createSessionStatsHarness(options);

  return {
    ...harness,
    cleanup: () => {
      cleanupSessionStatsTempDir(harness.tempDir);
      jest.restoreAllMocks();
      jest.clearAllMocks();
    },
  };
}
