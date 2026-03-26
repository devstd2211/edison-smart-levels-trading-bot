import { PositionExitingService } from '../../services/position-exiting.service';
import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors';
import { LoggerService } from '../../services';
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

export function createMockExitedPositionWithStopLoss(
  positionOverrides: Partial<Position> = {},
  stopLossOverrides: Partial<Position['stopLoss']> = {},
): Position {
  const position = createMockExitedPosition(positionOverrides);

  return {
    ...position,
    stopLoss: {
      ...position.stopLoss,
      ...stopLossOverrides,
    },
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

export function createPositionExitingRetryConfig(overrides: {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
} = {}) {
  return {
    maxAttempts: overrides.maxAttempts ?? 3,
    initialDelayMs: overrides.initialDelayMs ?? 100,
    backoffMultiplier: overrides.backoffMultiplier ?? 2,
    maxDelayMs: overrides.maxDelayMs ?? 1000,
  };
}

export function calculatePositionExitingRetryDelays(
  options: Parameters<typeof createPositionExitingRetryConfig>[0] = {},
): number[] {
  const retryConfig = createPositionExitingRetryConfig(options);
  const delays: number[] = [];

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    delays.push(
      Math.min(
        retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
        retryConfig.maxDelayMs,
      ),
    );
  }

  return delays;
}

export function createTransactionalTradeCloseRequest(overrides: {
  id?: string;
  exitPrice?: number;
  realizedPnL?: number;
  exitCondition?: Record<string, unknown>;
} = {}) {
  return {
    id: overrides.id ?? 'trade-123',
    exitPrice: overrides.exitPrice ?? 51000,
    realizedPnL: overrides.realizedPnL ?? 1000,
    exitCondition: overrides.exitCondition ?? {},
  };
}

export function createThrowingTradeCloseRecorder(message = 'Journal file I/O failed') {
  return {
    recordTradeClose: jest.fn((_trade: unknown) => {
      throw new Error(message);
    }),
  };
}

export async function executeRetrySequence(
  operation: (attempt: number) => Promise<unknown>,
  options: Parameters<typeof createPositionExitingRetryConfig>[0] = {},
) {
  const retryConfig = createPositionExitingRetryConfig(options);
  let finalAttempt = 0;

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    try {
      await operation(attempt);
      finalAttempt = attempt;
      break;
    } catch (error) {
      if (attempt < retryConfig.maxAttempts) {
        const delayMs = Math.min(
          retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
          retryConfig.maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 50)));
      }
    }
  }

  return {
    retryConfig,
    finalAttempt,
  };
}

export async function executePositionExitRequest(
  service: Pick<PositionExitingService, 'executeExitAction'>,
  overrides: {
    position?: Partial<Position>;
    action?: Partial<ExitActionDTO>;
    exitPrice?: number;
    exitReason?: string;
    exitType?: ExitType;
  } = {},
) {
  const request = createPositionExitRequest(overrides);
  const result = await service.executeExitAction(
    request.position,
    request.action,
    request.exitPrice,
    request.exitReason,
    request.exitType,
  );

  return {
    ...request,
    result,
  };
}

export async function executePositionExitActionDirect(
  service: Pick<PositionExitingService, 'executeExitAction'>,
  position: Position | null | undefined,
  action: Partial<ExitActionDTO> = {},
  overrides: {
    exitPrice?: number;
    exitReason?: string;
    exitType?: ExitType;
  } = {},
) {
  return await service.executeExitAction(
    position as Position,
    createMockExitAction(action),
    overrides.exitPrice ?? 105,
    overrides.exitReason ?? 'TP1_HIT',
    overrides.exitType ?? ExitType.TAKE_PROFIT_1,
  );
}

export async function executePositionExitSequence(
  service: Pick<PositionExitingService, 'executeExitAction'>,
  steps: Array<{
    action: Partial<ExitActionDTO>;
    exitPrice?: number;
    exitReason?: string;
    exitType?: ExitType;
  }>,
  positionOverrides: Partial<Position> = {},
) {
  const position = createMockExitedPosition(positionOverrides);
  const results: boolean[] = [];

  for (const step of steps) {
    const result = await service.executeExitAction(
      position,
      createMockExitAction(step.action),
      step.exitPrice ?? 105,
      step.exitReason ?? 'TP1_HIT',
      step.exitType ?? ExitType.TAKE_PROFIT_1,
    );
    results.push(result);
  }

  return {
    position,
    results,
  };
}

export async function handlePositionExitingError(
  error: unknown,
  options: {
    strategy: RecoveryStrategy;
    logger: LoggerService | ReturnType<typeof createMockPositionExitingLogger>;
    context: string;
    retryConfig?: Parameters<typeof createPositionExitingRetryConfig>[0];
    onRecover?: (strategy: RecoveryStrategy, attempt: number) => void;
  },
) {
  return await ErrorHandler.handle(error, {
    strategy: options.strategy,
    logger: options.logger,
    context: options.context,
    retryConfig: options.retryConfig
      ? createPositionExitingRetryConfig(options.retryConfig)
      : undefined,
    onRecover: options.onRecover,
  });
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

export function createPositionExitingErrorHandlingHarness() {
  const mockTradingConfig = createMockPositionExitingTradingConfig();
  const mockRiskConfig = createMockPositionExitingRiskConfig({
    trailingStopActivationLevel: 2,
  });
  const mockConfig = createMockPositionExitingConfig(
    { exchange: { name: 'bybit', testnet: true } as never },
    mockTradingConfig,
    mockRiskConfig,
  );
  const mockPosition = createMockExitedPosition({
    id: 'POS1',
    symbol: 'BTCUSDT',
    entryPrice: 40000,
    quantity: 0.1,
    leverage: 10,
    status: 'OPEN',
    openedAt: Date.now() - 60000,
    journalId: 'JOURNAL1',
    marginUsed: 400,
    orderId: 'ORDER1',
    reason: 'ENTRY_SIGNAL',
    stopLoss: {
      price: 39000,
      initialPrice: 39000,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
      orderId: undefined,
    },
    takeProfits: [
      { level: 1, price: 41000, percent: 0.5, sizePercent: 50, hit: false },
      { level: 2, price: 42000, percent: 1, sizePercent: 30, hit: false },
      { level: 3, price: 43000, percent: 1.5, sizePercent: 20, hit: false },
    ],
    unrealizedPnL: 1000,
  });

  return {
    mockTradingConfig,
    mockRiskConfig,
    mockConfig,
    mockPosition,
  };
}

export function createAtomicCloseGuard() {
  const closeLock = new Map<string, Promise<void>>();

  return {
    closeLock,
    simulateAtomicClose: async (positionId: string, delayMs = 50): Promise<boolean> => {
      if (closeLock.has(positionId)) {
        return false;
      }

      const closePromise = new Promise<void>((resolve) => setTimeout(resolve, delayMs));
      closeLock.set(positionId, closePromise);

      try {
        await closePromise;
        return true;
      } finally {
        closeLock.delete(positionId);
      }
    },
  };
}

export function createRaceConditionCloseRequest(overrides: {
  position?: Partial<Position>;
  exitPrice?: number;
  exitReason?: string;
  exitType?: ExitType;
} = {}) {
  return {
    position: createMockRacePosition(overrides.position),
    exitPrice: overrides.exitPrice ?? 1.871,
    exitReason: overrides.exitReason ?? 'Test close',
    exitType: overrides.exitType ?? ExitType.STOP_LOSS,
  };
}

export async function executeRaceConditionClose(
  service: Pick<PositionExitingService, 'closeFullPosition'>,
  overrides: {
    position?: Partial<Position>;
    exitPrice?: number;
    exitReason?: string;
    exitType?: ExitType;
  } = {},
) {
  const request = createRaceConditionCloseRequest(overrides);
  const result = await service.closeFullPosition(
    request.position,
    request.exitPrice,
    request.exitReason,
    request.exitType,
  );

  return {
    ...request,
    result,
  };
}

export async function executeNilRaceConditionClose(
  service: Pick<PositionExitingService, 'closeFullPosition'>,
  position: null | undefined,
  overrides: {
    exitPrice?: number;
    exitReason?: string;
    exitType?: ExitType;
  } = {},
) {
  return await service.closeFullPosition(
    position,
    overrides.exitPrice ?? 1.871,
    overrides.exitReason ?? 'Test close',
    overrides.exitType ?? ExitType.STOP_LOSS,
  );
}

export async function executeConcurrentRaceConditionCloses(
  service: Pick<PositionExitingService, 'closeFullPosition'>,
  reasons: string[],
  overrides: {
    position?: Partial<Position>;
    exitPrice?: number;
    exitType?: ExitType;
  } = {},
) {
  const request = createRaceConditionCloseRequest({
    position: overrides.position,
    exitPrice: overrides.exitPrice,
    exitType: overrides.exitType,
  });
  const operations = reasons.map((reason) =>
    service.closeFullPosition(
      request.position,
      request.exitPrice,
      reason,
      request.exitType,
    ),
  );
  const results = await Promise.all(operations);

  return {
    ...request,
    reasons,
    results,
  };
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

export function createEntryPriceState(position: Pick<Position, 'entryPrice'>) {
  return {
    entryPrice: position.entryPrice,
    isValid: !isNaN(position.entryPrice),
  };
}

export function createEntryPriceTransitionState(before: number, after: number) {
  return {
    entryPriceBefore: before,
    entryPriceAfter: after,
    entryPriceValid: !isNaN(before),
    isSame: before === after,
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

export function analyzeWebSocketEntryPriceUpdates(
  sequence = createWebSocketUpdateSequence(),
) {
  return sequence.map((update) => ({
    ...update,
    parsed: parseWebSocketEntryPrice(update.entryPrice, update.avgPrice),
  }));
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

export function createEntryPriceLifecycleSnapshot(position: Position) {
  const tp1Level = position.takeProfits[0];
  const initialEntryPrice = position.entryPrice;
  const partialCloseQty = (position.quantity * tp1Level.sizePercent) / 100;
  const remainingQuantity = position.quantity - partialCloseQty;
  const corruptedEntryPrice =
    (initialEntryPrice * position.quantity - tp1Level.price * partialCloseQty) / remainingQuantity;

  return {
    initialEntryPrice,
    tp1Level,
    partialCloseQty,
    remainingQuantity,
    corruptedEntryPrice,
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

export function createJournalSkipTracker() {
  return {
    recordTradeClose: jest.fn(),
  };
}

export function invokeRollbackMultipleTimes(
  rollback: jest.Mock,
  times: number,
): jest.Mock {
  for (let index = 0; index < times; index++) {
    rollback();
  }

  return rollback;
}

export function writeTransactionalRollbackLog(
  logger: Pick<ReturnType<typeof createTransactionalCloseHarness>['mockLogger'], 'info'>,
  message: string = 'Journal rollback complete',
): string {
  logger.info(message);
  return message;
}

export function formatPositionExitingTrace(
  title: string,
  details: Array<[string, unknown]>,
): string {
  return [
    '',
    `${title}:`,
    ...details.map(([label, value]) => `- ${label}: ${String(value)}`),
    '',
  ].join('\n');
}

export function executeTransactionalCloseFlow(options: {
  tradeCloseOverrides?: Parameters<typeof createTransactionalTradeCloseRequest>[0];
  statsImplementation?: (trade: unknown) => undefined;
} = {}) {
  const harness = createTransactionalCloseHarness();
  if (options.statsImplementation) {
    harness.mockStats.updateTradeExit.mockImplementation(options.statsImplementation);
  }

  const tradeCloseRequest = createTransactionalTradeCloseRequest(options.tradeCloseOverrides);
  const journalResult = harness.mockJournal.recordTradeClose(tradeCloseRequest);

  let statsError: unknown;
  try {
    harness.mockStats.updateTradeExit({});
  } catch (error) {
    statsError = error;
    journalResult.rollback();
  }

  return {
    ...harness,
    tradeCloseRequest,
    journalResult,
    statsError,
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

export function createCloseStatusGuard(initialStatus: 'OPEN' | 'CLOSED' = 'OPEN') {
  let positionStatus = initialStatus;

  return {
    getStatus: () => positionStatus,
    closePosition: () => {
      if (positionStatus === 'CLOSED') {
        return false;
      }
      positionStatus = 'CLOSED';
      return true;
    },
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

export type PositionExitingHarness = {
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

type PositionExitingHarnessOptions = Parameters<typeof createPositionExitingHarness>[0];

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

export interface ManagedPositionExitingContext extends PositionExitingHarness {
  createHarness: (options?: PositionExitingHarnessOptions) => PositionExitingHarness;
  cleanup: () => void;
}

export function createManagedPositionExitingContext(
  options: PositionExitingHarnessOptions = {},
): ManagedPositionExitingContext {
  const trackedHarnesses: PositionExitingHarness[] = [];

  const createHarness = (overrides: PositionExitingHarnessOptions = {}) => {
    const harness = createPositionExitingHarness({
      ...options,
      ...overrides,
    });
    trackedHarnesses.push(harness);
    return harness;
  };

  const harness = createHarness();

  return {
    ...harness,
    createHarness,
    cleanup: () => {
      trackedHarnesses.length = 0;
      jest.clearAllMocks();
    },
  };
}

export interface ManagedPositionExitingErrorHandlingContext {
  mockTradingConfig: TradingConfig;
  mockRiskConfig: RiskManagementConfig;
  mockConfig: Config;
  mockPosition: Position;
  mockExchange: jest.Mocked<import('../../interfaces/IExchange').IExchange>;
  mockTelegram: jest.Mocked<import('../../services').TelegramService>;
  mockLogger: jest.Mocked<LoggerService>;
  mockJournal: jest.Mocked<import('../../services').TradingJournalService>;
  mockSessionStats: jest.Mocked<import('../../services').SessionStatsService>;
  cleanup: () => void;
}

export function createManagedPositionExitingErrorHandlingContext():
  ManagedPositionExitingErrorHandlingContext {
  const harness = createPositionExitingErrorHandlingHarness();
  const mockExchange = {
    ...createMockPositionExitingExchange(),
    getCandles: jest.fn(),
  } as unknown as jest.Mocked<import('../../interfaces/IExchange').IExchange>;
  const mockTelegram =
    createMockPositionExitingTelegram() as unknown as jest.Mocked<import('../../services').TelegramService>;
  const mockLogger =
    createMockPositionExitingLogger() as unknown as jest.Mocked<LoggerService>;
  const mockJournal =
    createMockPositionExitingJournal() as unknown as jest.Mocked<import('../../services').TradingJournalService>;
  const mockSessionStats =
    createMockPositionExitingSessionStats() as unknown as jest.Mocked<import('../../services').SessionStatsService>;

  return {
    ...harness,
    mockExchange,
    mockTelegram,
    mockLogger,
    mockJournal,
    mockSessionStats,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

export interface ManagedFunctionalPositionExitingContext extends PositionExitingHarness {
  cleanup: () => void;
}

export function createManagedFunctionalPositionExitingContext():
  ManagedFunctionalPositionExitingContext {
  const harness = createFunctionalPositionExitingHarness();

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

export interface ManagedRealScenarioPositionExitingContext extends PositionExitingHarness {
  cleanup: () => void;
}

export function createManagedRealScenarioPositionExitingContext(
  loggerOverrides: Partial<ReturnType<typeof createMockPositionExitingLogger>> = {},
): ManagedRealScenarioPositionExitingContext {
  const harness = createRealScenarioPositionExitingHarness(loggerOverrides);

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

export interface ManagedTransactionalCloseContext {
  harness: ReturnType<typeof createTransactionalCloseHarness>;
  cleanup: () => void;
}

export function createManagedTransactionalCloseContext(): ManagedTransactionalCloseContext {
  return {
    harness: createTransactionalCloseHarness(),
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

export interface ManagedRaceConditionPositionExitingContext extends PositionExitingHarness {
  cleanup: () => void;
}

export function createManagedRaceConditionPositionExitingContext():
  ManagedRaceConditionPositionExitingContext {
  const harness = createRaceConditionPositionExitingHarness();

  return {
    ...harness,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}
