import { PositionExitingService } from '../../services/position-exiting.service';
import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import {
  Config,
  ExitAction,
  ExitActionDTO,
  ExitType,
  Position,
  PositionSide,
  RiskManagementConfig,
  TakeProfit,
  TradingConfig,
} from '../../types/legacy';

export function createMockPositionExitingLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    getLogFilePath: jest.fn().mockReturnValue('/mock/log'),
  };
}

export function createMockPositionExitingExchange() {
  return {
    closePosition: jest.fn().mockResolvedValue(true),
    cancelAllConditionalOrders: jest.fn().mockResolvedValue(true),
    updateStopLoss: jest.fn().mockResolvedValue(true),
    placeTakeProfitLevels: jest.fn().mockResolvedValue(['TP1', 'TP2', 'TP3']),
    openPosition: jest.fn().mockResolvedValue('ORDER_123'),
    getCurrentPrice: jest.fn().mockResolvedValue(100),
  };
}

export function createMockPositionExitingTelegram() {
  return {
    sendAlert: jest.fn().mockResolvedValue(true),
    notifyPositionOpened: jest.fn().mockResolvedValue(true),
    notifyTakeProfitHit: jest.fn().mockResolvedValue(true),
    notifyPositionClosed: jest.fn().mockResolvedValue(true),
  };
}

export function createMockPositionExitingJournal() {
  return {
    recordTradeOpen: jest.fn().mockResolvedValue(true),
    recordTradeClose: jest.fn().mockResolvedValue({ rollback: () => undefined }),
    recordPositionClose: jest.fn().mockReturnValue({ rollback: jest.fn() }),
    getOpenPositionBySymbol: jest.fn().mockReturnValue(null),
    getTrade: jest.fn().mockReturnValue(null),
  };
}

export function createMockPositionExitingSessionStats() {
  return {
    updateTradeExit: jest.fn().mockResolvedValue(true),
  };
}

export function createMockTakeProfitManager() {
  return {
    recordPartialClose: jest.fn(),
    calculateFinalPnL: jest.fn().mockReturnValue({
      totalPnL: {
        pnlNet: 100,
        fees: 10,
      },
    }),
    getTpLevelsHit: jest.fn().mockReturnValue([1, 2]),
  };
}

export function createMockPositionExitingManager(takeProfitManager: unknown = null) {
  return {
    getTakeProfitManager: jest.fn().mockReturnValue(takeProfitManager),
  };
}

export function createMockPositionExitingTradingConfig(
  overrides: Partial<TradingConfig> = {},
): TradingConfig {
  return {
    leverage: 10,
    riskPercent: 2,
    maxPositions: 1,
    positionSizeUsdt: 100,
    tradingCycleIntervalMs: 1000,
    orderType: 'LIMIT' as unknown as TradingConfig['orderType'],
    tradingFeeRate: 0.0002,
    favorableMovementThresholdPercent: 0.1,
    ...overrides,
  };
}

export function createMockPositionExitingRiskConfig(
  overrides: Partial<RiskManagementConfig> = {},
): RiskManagementConfig {
  return {
    takeProfits: [
      { level: 1, percent: 5, sizePercent: 33 },
      { level: 2, percent: 10, sizePercent: 33 },
      { level: 3, percent: 15, sizePercent: 34 },
    ],
    stopLossPercent: 5,
    minStopLossPercent: 1.0,
    breakevenOffsetPercent: 0.3,
    trailingStopEnabled: true,
    trailingStopPercent: 2,
    trailingStopActivationLevel: 2,
    positionSizeUsdt: 100,
    ...overrides,
  };
}

export function createMockPositionExitingConfig(
  overrides: Partial<Config> = {},
  tradingOverrides: Partial<TradingConfig> = {},
  riskOverrides: Partial<RiskManagementConfig> = {},
): Config {
  return {
    exchange: { symbol: 'APEXUSDT' } as unknown as Config['exchange'],
    timeframes: {},
    trading: createMockPositionExitingTradingConfig(tradingOverrides),
    strategies: {} as unknown as Config['strategies'],
    strategy: {} as unknown as Config['strategy'],
    indicators: {} as unknown as Config['indicators'],
    riskManagement: createMockPositionExitingRiskConfig(riskOverrides),
    logging: {} as unknown as Config['logging'],
    system: {} as unknown as Config['system'],
    dataSubscriptions: {
      candles: { enabled: true, calculateIndicators: true },
      orderbook: { enabled: false, updateIntervalMs: 5000 },
      ticks: { enabled: false, calculateDelta: false },
    },
    entryConfig: {
      divergenceDetector: { minStrength: 0.3, priceDiffPercent: 0.2 },
      rsiPeriod: 14,
      rsiOversold: 30,
      rsiOverbought: 70,
      fastEmaPeriod: 9,
      slowEmaPeriod: 21,
      zigzagDepth: 2,
    },
    entryConfirmation: {} as unknown as Config['entryConfirmation'],
    ...overrides,
  };
}

export function createMockExitedPosition(overrides: Partial<Position> = {}): Position {
  return {
    id: 'APEXUSDT_Buy',
    journalId: 'APEXUSDT_Buy_123456',
    symbol: 'APEXUSDT',
    side: PositionSide.LONG,
    quantity: 10,
    entryPrice: 100,
    leverage: 10,
    marginUsed: 100,
    stopLoss: {
      price: 95,
      initialPrice: 95,
      orderId: undefined,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, percent: 5, sizePercent: 33, price: 105, hit: false } as TakeProfit,
      { level: 2, percent: 10, sizePercent: 33, price: 110, hit: false } as TakeProfit,
      { level: 3, percent: 15, sizePercent: 34, price: 115, hit: false } as TakeProfit,
    ],
    openedAt: Date.now() - 60000,
    unrealizedPnL: 0,
    orderId: 'ORD_123',
    reason: 'Position opened',
    protectionVerifiedOnce: true,
    status: 'OPEN' as const,
    ...overrides,
  };
}

export function createMockExitAction(overrides: Partial<ExitActionDTO> = {}): ExitActionDTO {
  return {
    action: ExitAction.CLOSE_ALL,
    ...overrides,
  } as ExitActionDTO;
}

export function createPositionExitRequest(overrides: {
  position?: Partial<Position>;
  action?: Partial<ExitActionDTO>;
  exitPrice?: number;
  exitReason?: string;
  exitType?: ExitType;
} = {}) {
  return {
    position: createMockExitedPosition(overrides.position),
    action: createMockExitAction(overrides.action),
    exitPrice: overrides.exitPrice ?? 105,
    exitReason: overrides.exitReason ?? 'TP1_HIT',
    exitType: overrides.exitType ?? ExitType.TAKE_PROFIT_1,
  };
}

export function createMockRacePosition(overrides: Partial<Position> = {}): Position {
  return createMockExitedPosition({
    id: 'XRPUSDT_Buy',
    journalId: 'j-123',
    symbol: 'XRPUSDT',
    side: 'Buy' as unknown as Position['side'],
    quantity: 52.9,
    entryPrice: 1.85,
    openedAt: Date.now() - 3600000,
    unrealizedPnL: 50,
    orderId: 'order-123',
    reason: 'Test position',
    takeProfits: [
      { level: 1, percent: 0.5, price: 1.859, sizePercent: 33, hit: false, orderId: 'tp1' } as TakeProfit,
      { level: 2, percent: 1.0, price: 1.869, sizePercent: 33, hit: false, orderId: 'tp2' } as TakeProfit,
      { level: 3, percent: 1.5, price: 1.879, sizePercent: 34, hit: false, orderId: 'tp3' } as TakeProfit,
    ],
    stopLoss: {
      price: 1.80,
      initialPrice: 1.80,
      orderId: undefined,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    ...overrides,
  });
}

export function createRealScenarioPosition(): Position {
  return {
    id: 'XRPUSDT_Buy',
    journalId: 'XRPUSDT_Buy_1769181601722',
    symbol: 'XRPUSDT',
    side: PositionSide.LONG,
    quantity: 52.85,
    entryPrice: 1.892,
    leverage: 10,
    marginUsed: 100,
    stopLoss: {
      price: 1.8732,
      initialPrice: 1.8732,
      orderId: undefined,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: [
      { level: 1, percent: 1.5, sizePercent: 33, price: 1.9203, hit: false } as TakeProfit,
      { level: 2, percent: 3, sizePercent: 33, price: 1.9488, hit: false } as TakeProfit,
      { level: 3, percent: 5, sizePercent: 34, price: 1.9866, hit: false } as TakeProfit,
    ],
    openedAt: Date.now() - 1800000,
    unrealizedPnL: 0,
    orderId: 'ORD_XRPUSDT',
    reason: 'Position opened',
    protectionVerifiedOnce: true,
    status: 'OPEN' as const,
  };
}

export function createFunctionalPositionExitingHarness() {
  return createPositionExitingHarness({
    withTakeProfitManager: false,
    riskConfig: {
      takeProfits: [
        { level: 1, percent: 1.5, sizePercent: 33 },
        { level: 2, percent: 3, sizePercent: 33 },
        { level: 3, percent: 5, sizePercent: 34 },
      ],
      stopLossPercent: 1,
      minStopLossPercent: 0.5,
      trailingStopPercent: 1,
    },
    fullConfig: {
      exchange: { symbol: 'XRPUSDT' } as never,
    },
  });
}

export function createBreakevenInspection(overrides: {
  entryPrice?: number;
  offsetPercent?: number;
} = {}) {
  const entryPrice =
    Object.prototype.hasOwnProperty.call(overrides, 'entryPrice')
      ? overrides.entryPrice
      : createRealScenarioPosition().entryPrice;
  const offsetPercent =
    Object.prototype.hasOwnProperty.call(overrides, 'offsetPercent')
      ? overrides.offsetPercent
      : createMockPositionExitingRiskConfig().breakevenOffsetPercent;
  const offset =
    entryPrice === undefined || offsetPercent === undefined
      ? undefined
      : (entryPrice * offsetPercent) / 10000;

  return {
    entryPrice,
    offsetPercent,
    offset,
    breakevenPrice:
      entryPrice === undefined || offset === undefined
        ? undefined
        : entryPrice + offset,
  };
}

export function createWebSocketEntryPriceScenario(overrides: {
  entryPrice?: number;
  avgPrice?: number;
  quantity?: number;
} = {}) {
  return {
    symbol: 'XRPUSDT',
    side: 'Buy',
    qty: overrides.quantity ?? 35.41,
    entryPrice: overrides.entryPrice ?? 0,
    avgPrice: overrides.avgPrice ?? 1.9203,
  };
}

export function parseWebSocketEntryPrice(entryPrice: string, avgPrice: string): number {
  if (entryPrice && entryPrice.trim()) {
    const parsedEntryPrice = parseFloat(entryPrice);
    if (!isNaN(parsedEntryPrice)) {
      return parsedEntryPrice;
    }
  }

  if (avgPrice && avgPrice.trim()) {
    const parsedAvgPrice = parseFloat(avgPrice);
    if (!isNaN(parsedAvgPrice)) {
      return parsedAvgPrice;
    }
  }

  return 0;
}

export function createWebSocketBugScenario() {
  return {
    entryPrice: '',
    avgPrice: '1.9203',
  };
}

export function createWebSocketUpdateSequence() {
  return [
    { entryPrice: '1.892', avgPrice: '1.892', label: 'Position Open' },
    { entryPrice: '', avgPrice: '1.9203', label: 'After TP1 Close (BUG)' },
  ];
}

export function createRealScenarioPartialClose(overrides: {
  tpLevel?: number;
  quantity?: number;
  exitPrice?: number;
} = {}) {
  return {
    tpLevel: overrides.tpLevel ?? 1,
    partialQuantity: overrides.quantity ?? (52.85 * 33) / 100,
    exitPrice: overrides.exitPrice ?? 1.9203,
  };
}

export function createTransactionalCloseHarness() {
  const rollback = jest.fn();
  const mockJournal = {
    recordTradeClose: jest.fn((_trade: unknown) => ({
      rollback,
    })),
  };
  const mockStats = {
    updateTradeExit: jest.fn((_trade: unknown) => undefined),
  };
  const mockLogger = {
    error: jest.fn(),
    info: jest.fn(),
  };

  return {
    mockJournal,
    mockStats,
    mockLogger,
    rollback,
  };
}

export function createBalanceTrackingHarness(initialBalance = 1000) {
  let currentBalance = initialBalance;

  return {
    initialBalance,
    getCurrentBalance: jest.fn(() => currentBalance),
    updateBalance: jest.fn((amount: number) => {
      currentBalance += amount;
    }),
  };
}

export function createRealScenarioTakeProfitManager(
  logger: ConstructorParameters<typeof TakeProfitManagerService>[1],
): TakeProfitManagerService {
  return new TakeProfitManagerService(
    {
      positionId: 'XRPUSDT_Buy',
      symbol: 'XRPUSDT',
      side: PositionSide.LONG,
      entryPrice: 1.892,
      totalQuantity: 52.85,
      leverage: 10,
    },
    logger,
  );
}

export function createRealScenarioPositionExitingHarness(
  loggerOverrides: Partial<ReturnType<typeof createMockPositionExitingLogger>> = {},
) {
  const mockLogger = createMockPositionExitingLogger();
  const mergedLogger = {
    ...mockLogger,
    ...loggerOverrides,
  };
  const takeProfitManager = createRealScenarioTakeProfitManager(
    mergedLogger as unknown as Parameters<typeof createRealScenarioTakeProfitManager>[0],
  );

  return createPositionExitingHarness({
    takeProfitManager,
    positionManager: {
      getTakeProfitManager: jest.fn().mockReturnValue(takeProfitManager),
    },
    tradingConfig: { positionSizeUsdt: 100 },
    riskConfig: {
      takeProfits: [
        { level: 1, percent: 0.5, sizePercent: 33 },
        { level: 2, percent: 1.0, sizePercent: 33 },
        { level: 3, percent: 1.5, sizePercent: 34 },
      ],
      stopLossPercent: 1,
      minStopLossPercent: 0.5,
      trailingStopPercent: 1,
    },
    fullConfig: {
      exchange: { symbol: 'XRPUSDT' } as never,
      entryConfig: {} as never,
    },
    loggerOverrides: mergedLogger,
  });
}

export function createRaceConditionPositionExitingHarness() {
  return createPositionExitingHarness({
    tradingConfig: createMockPositionExitingTradingConfig({
      tradingFeeRate: 0.0006,
    }),
    riskConfig: {
      maxRiskPercent: 2,
      maxPositionSize: 1000,
    } as never,
    fullConfig: {} as never,
    exchangeOverrides: {
      closePosition: jest.fn().mockResolvedValue({}),
      cancelAllConditionalOrders: jest.fn().mockResolvedValue({}),
      getCurrentPrice: jest.fn().mockResolvedValue(1.871),
    },
    telegramOverrides: {
      sendAlert: jest.fn().mockResolvedValue(undefined),
      notifyPositionClosed: jest.fn().mockResolvedValue(undefined),
    },
    journalOverrides: {
      recordPositionClose: jest.fn().mockReturnValue({
        rollback: jest.fn(),
      }),
      getTrade: jest.fn().mockReturnValue(null),
    },
    sessionStatsOverrides: {
      updateTradeExit: jest.fn().mockResolvedValue({}),
    },
  });
}

type PositionExitingHarness = {
  service: PositionExitingService;
  mockLogger: ReturnType<typeof createMockPositionExitingLogger>;
  mockBybit: ReturnType<typeof createMockPositionExitingExchange>;
  mockTelegram: ReturnType<typeof createMockPositionExitingTelegram>;
  mockJournal: ReturnType<typeof createMockPositionExitingJournal>;
  mockSessionStats: ReturnType<typeof createMockPositionExitingSessionStats>;
  mockTakeProfitManager: unknown;
  mockPositionManager: unknown;
  tradingConfig: TradingConfig;
  riskConfig: RiskManagementConfig;
  fullConfig: Config;
};

export function createPositionExitingService(
  dependencies: Omit<PositionExitingHarness, 'service'>,
): PositionExitingService {
  return new PositionExitingService(
    dependencies.mockBybit as unknown as ConstructorParameters<typeof PositionExitingService>[0],
    dependencies.mockTelegram as unknown as ConstructorParameters<typeof PositionExitingService>[1],
    dependencies.mockLogger as unknown as ConstructorParameters<typeof PositionExitingService>[2],
    dependencies.mockJournal as unknown as ConstructorParameters<typeof PositionExitingService>[3],
    dependencies.tradingConfig,
    dependencies.riskConfig,
    dependencies.fullConfig,
    dependencies.mockSessionStats as unknown as ConstructorParameters<typeof PositionExitingService>[7],
    dependencies.mockPositionManager as unknown as ConstructorParameters<typeof PositionExitingService>[8],
  );
}

export function createPositionExitingHarness(options: {
  withTakeProfitManager?: boolean;
  tradingConfig?: Partial<TradingConfig>;
  riskConfig?: Partial<RiskManagementConfig>;
  fullConfig?: Partial<Config>;
  loggerOverrides?: Partial<ReturnType<typeof createMockPositionExitingLogger>>;
  exchangeOverrides?: Partial<ReturnType<typeof createMockPositionExitingExchange>>;
  telegramOverrides?: Partial<ReturnType<typeof createMockPositionExitingTelegram>>;
  journalOverrides?: Partial<ReturnType<typeof createMockPositionExitingJournal>>;
  sessionStatsOverrides?: Partial<ReturnType<typeof createMockPositionExitingSessionStats>>;
  takeProfitManager?: ReturnType<typeof createMockTakeProfitManager> | null | unknown;
  positionManager?: ReturnType<typeof createMockPositionExitingManager> | unknown;
} = {}): PositionExitingHarness {
  const mockLogger = {
    ...createMockPositionExitingLogger(),
    ...options.loggerOverrides,
  };
  const mockBybit = {
    ...createMockPositionExitingExchange(),
    ...options.exchangeOverrides,
  };
  const mockTelegram = {
    ...createMockPositionExitingTelegram(),
    ...options.telegramOverrides,
  };
  const mockJournal = {
    ...createMockPositionExitingJournal(),
    ...options.journalOverrides,
  };
  const mockSessionStats = {
    ...createMockPositionExitingSessionStats(),
    ...options.sessionStatsOverrides,
  };
  const mockTakeProfitManager =
    options.takeProfitManager === undefined
      ? createMockTakeProfitManager()
      : options.takeProfitManager;
  const mockPositionManager =
    options.positionManager ??
    createMockPositionExitingManager(
      options.withTakeProfitManager === false ? null : mockTakeProfitManager,
    );
  const tradingConfig = createMockPositionExitingTradingConfig(options.tradingConfig);
  const riskConfig = createMockPositionExitingRiskConfig(options.riskConfig);
  const fullConfig = createMockPositionExitingConfig(
    options.fullConfig,
    options.tradingConfig,
    options.riskConfig,
  );

  return {
    service: createPositionExitingService({
      mockLogger,
      mockBybit,
      mockTelegram,
      mockJournal,
      mockSessionStats,
      mockTakeProfitManager,
      mockPositionManager,
      tradingConfig,
      riskConfig,
      fullConfig,
    }),
    mockLogger,
    mockBybit,
    mockTelegram,
    mockJournal,
    mockSessionStats,
    mockTakeProfitManager,
    mockPositionManager,
    tradingConfig,
    riskConfig,
    fullConfig,
  };
}
