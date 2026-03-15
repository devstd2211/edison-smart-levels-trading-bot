import { ErrorHandler } from '../../errors/ErrorHandler';
import { LoggerService } from '../../services/logger.service';
import { RiskManager } from '../../services/risk-manager.service';
import {
  LogLevel,
  Position,
  PositionSide,
  RiskManagerConfig,
  Signal,
  SignalDirection,
  SignalType,
  StopLossConfig,
  TakeProfit,
  TradeRecord,
} from '../../types/legacy';

export class MockRiskManagerLogger extends LoggerService {
  constructor() {
    super(LogLevel.INFO, './logs', false);
  }
}

export function createRiskManagerConfig(): RiskManagerConfig {
  return {
    dailyLimits: {
      maxDailyLossPercent: 5.0,
      maxDailyProfitPercent: 10.0,
      emergencyStopOnLimit: true,
    },
    lossStreak: {
      reductions: {
        after2Losses: 0.75,
        after3Losses: 0.5,
        after4Losses: 0.25,
      },
    },
    concurrentRisk: {
      enabled: true,
      maxPositions: 3,
      maxRiskPerPosition: 2.0,
      maxTotalExposurePercent: 100.0,
    },
    positionSizing: {
      riskPerTradePercent: 1.0,
      minPositionSizeUsdt: 5.0,
      maxPositionSizeUsdt: 1000.0,
      maxLeverageMultiplier: 2.0,
    },
  };
}

export function createRiskManagerSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    price: 100,
    confidence: 75,
    type: SignalType.LEVEL_BASED,
    direction: SignalDirection.LONG,
    stopLoss: 90,
    takeProfits: [{ level: 1, percent: 50 }] as TakeProfit[],
    reason: 'test signal',
    timestamp: Date.now(),
    ...overrides,
  };
}

export function createRiskManagerPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'pos-123',
    symbol: 'BTCUSDT',
    side: PositionSide.LONG,
    quantity: 1,
    entryPrice: 50000,
    leverage: 1,
    marginUsed: 50000,
    stopLoss: {
      price: 45000,
      initialPrice: 45000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    } as StopLossConfig,
    takeProfits: [{ level: 1, price: 55000, percent: 10 }] as TakeProfit[],
    openedAt: Date.now(),
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0,
    status: 'OPEN' as const,
    ...overrides,
  } as Position;
}

export function createRiskManagerTrade(overrides: Partial<TradeRecord> = {}): TradeRecord {
  const quantity = overrides.quantity !== undefined ? overrides.quantity : 1;
  const entryPrice = overrides.entryPrice !== undefined ? overrides.entryPrice : 100;
  const realizedPnL = overrides.realizedPnL !== undefined ? overrides.realizedPnL : 50;
  const exitPrice = overrides.exitPrice || (entryPrice + realizedPnL / quantity);

  return {
    id: `trade-${Date.now()}`,
    symbol: overrides.symbol || 'BTCUSDT',
    side: overrides.side || PositionSide.LONG,
    quantity,
    entryPrice,
    exitPrice,
    leverage: overrides.leverage || 1,
    entryCondition: overrides.entryCondition || { signal: createRiskManagerSignal(), indicators: {} },
    openedAt: overrides.openedAt || Date.now(),
    closedAt: overrides.closedAt || Date.now(),
    realizedPnL,
    status: overrides.status || 'CLOSED',
  } as TradeRecord;
}

export function createRiskManagerHarness(options: {
  config?: RiskManagerConfig;
  balance?: number;
  logger?: MockRiskManagerLogger;
  errorHandler?: ErrorHandler;
} = {}) {
  const mockLogger = options.logger ?? new MockRiskManagerLogger();
  const errorHandler = options.errorHandler ?? new ErrorHandler(mockLogger);
  const riskManager = createRiskManagerService({
    config: options.config,
    logger: mockLogger,
    errorHandler,
  });
  riskManager.setAccountBalance(options.balance ?? 1000);

  return {
    riskManager,
    mockLogger,
    errorHandler,
  };
}

export function createRiskManagerService(options: {
  config?: RiskManagerConfig;
  logger?: MockRiskManagerLogger;
  errorHandler?: ErrorHandler;
} = {}): RiskManager {
  const logger = options.logger ?? new MockRiskManagerLogger();
  return new RiskManager(
    options.config ?? createRiskManagerConfig(),
    logger,
    options.errorHandler ?? new ErrorHandler(logger),
  );
}
