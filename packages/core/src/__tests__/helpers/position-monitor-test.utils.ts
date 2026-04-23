import { IExchange } from '../../interfaces/IExchange';
import { POSITION_MONITOR_INTERVAL_MS } from '../../constants/technical.constants';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { ExitTypeDetectorService } from '../../services/exit-type-detector.service';
import { PositionLifecycleService } from '../../services/position-lifecycle.service';
import { PositionMonitorService } from '../../services/position-monitor.service';
import { PositionPnLCalculatorService } from '../../services/position-pnl-calculator.service';
import { PositionSyncService } from '../../services/position-sync.service';
import { TelegramService } from '../../services/telegram.service';
import {
  LogLevel,
  LoggerService,
  Position,
  PositionSide,
  RiskManagementConfig,
} from '../../types/legacy';

export function createMockMonitoredPosition(
  side: PositionSide = PositionSide.LONG,
  entryPrice: number = 50000,
  stopLossPrice: number = side === PositionSide.LONG ? entryPrice * 0.99 : entryPrice * 1.01,
  takeProfits: Array<{ level: number; price: number; hit?: boolean }> = [
    { level: 1, price: side === PositionSide.LONG ? entryPrice * 1.02 : entryPrice * 0.98, hit: false },
  ],
  openedAt: number = Date.now(),
  overrides: Partial<Position> = {},
): Position {
  return {
    id: 'test-pos-123',
    symbol: 'BTCUSDT',
    side,
    entryPrice,
    quantity: 0.01,
    leverage: 10,
    marginUsed: 50,
    stopLoss: {
      price: stopLossPrice,
      initialPrice: stopLossPrice,
      orderId: 'sl-123',
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    },
    takeProfits: takeProfits.map(tp => ({
      level: tp.level,
      price: tp.price,
      percent: 0.5,
      sizePercent: 33.33,
      orderId: `tp${tp.level}-123`,
      hit: tp.hit ?? false,
      hitAt: tp.hit ? Date.now() : undefined,
    })),
    openedAt,
    unrealizedPnL: 100,
    orderId: 'entry-123',
    reason: 'Test position',
    status: 'OPEN',
    protectionVerifiedOnce: false,
    ...overrides,
  };
}

export function createPositionMonitorScenarioPosition(
  side: PositionSide,
  entryPrice: number,
  stopLossPrice: number,
  takeProfits: Array<{ level: number; price: number; hit?: boolean }>,
  openedAt: number = Date.now(),
): Position {
  return createMockMonitoredPosition(side, entryPrice, stopLossPrice, takeProfits, openedAt, {
    id: 'test-position-123',
    symbol: 'APEXUSDT',
    quantity: 100,
    marginUsed: 10,
    orderId: 'entry-order-123',
  });
}

export function createPositionMonitorOpenedAtMinutesAgo(minutes: number): number {
  return Date.now() - minutes * 60 * 1000;
}

export function attachScenarioPosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager'>,
  options: {
    side: PositionSide;
    entryPrice: number;
    stopLossPrice: number;
    takeProfits?: Array<{ level: number; price: number; hit?: boolean }>;
    openedAt?: number;
  },
): Position {
  return attachCurrentPosition(
    harness,
    createPositionMonitorScenarioPosition(
      options.side,
      options.entryPrice,
      options.stopLossPrice,
      options.takeProfits ?? [],
      options.openedAt,
    ),
  );
}

export function attachScenarioExchangePosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager' | 'mockBybit'>,
  options: {
    side: PositionSide;
    entryPrice: number;
    stopLossPrice: number;
    takeProfits?: Array<{ level: number; price: number; hit?: boolean }>;
    openedAt?: number;
  },
): Position {
  return attachExchangePosition(
    harness,
    createPositionMonitorScenarioPosition(
      options.side,
      options.entryPrice,
      options.stopLossPrice,
      options.takeProfits ?? [],
      options.openedAt,
    ),
  );
}

export function createMockPositionMonitorExchange() {
  return {
    getPosition: jest.fn(),
    getCurrentPrice: jest.fn(),
    verifyProtectionSet: jest.fn().mockResolvedValue({
      verified: true,
      hasStopLoss: true,
      hasTakeProfit: true,
      hasTrailingStop: false,
      activeOrders: 3,
      stopLossPrice: 100,
      takeProfitPrices: [102, 104, 106],
    }),
    placeStopLoss: jest.fn().mockResolvedValue('sl-emergency'),
    placeTakeProfitLevels: jest.fn().mockResolvedValue(['tp-emergency']),
    closePosition: jest.fn().mockResolvedValue(undefined),
    getOrderHistory: jest.fn().mockResolvedValue([]),
    getActiveOrders: jest.fn().mockResolvedValue([]),
  };
}

export function createMockPositionMonitorManager() {
  return {
    getCurrentPosition: jest.fn(),
    clearPosition: jest.fn().mockResolvedValue(undefined),
    onTakeProfitHit: jest.fn(),
  };
}

export function createMockPositionMonitorTelegram() {
  return {
    notifyTakeProfitHit: jest.fn(),
    sendAlert: jest.fn().mockResolvedValue(undefined),
  };
}

export function createMockPositionMonitorLogger(): LoggerService {
  return new LoggerService(LogLevel.ERROR, './logs', false);
}

export function createMockPositionMonitorExitTypeDetector() {
  return {
    determineExitTypeFromHistory: jest.fn(),
    identifyTPLevel: jest.fn(),
  };
}

export function createMockPositionMonitorPnlCalculator() {
  return {
    calculatePnL: jest.fn((position: Position, currentPrice: number) => {
      if (position.side === PositionSide.LONG) {
        return ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      }

      return ((position.entryPrice - currentPrice) / position.entryPrice) * 100;
    }),
  };
}

export function createMockPositionMonitorSync() {
  return {
    syncClosedPosition: jest.fn().mockResolvedValue(undefined),
    deepSyncCheck: jest.fn().mockResolvedValue(undefined),
  };
}

export const defaultPositionMonitorRiskConfig: RiskManagementConfig = {
  positionSizeUsdt: 100,
  takeProfits: [],
  stopLossPercent: 1.0,
  minStopLossPercent: 1.0,
  breakevenOffsetPercent: 0.3,
  trailingStopEnabled: true,
  trailingStopPercent: 1.0,
  trailingStopActivationLevel: 2,
  timeBasedExitEnabled: false,
  timeBasedExitMinutes: 30,
  timeBasedExitMinPnl: 0.2,
};

type PositionMonitorDependencies = {
  monitor: PositionMonitorService;
  mockBybit: ReturnType<typeof createMockPositionMonitorExchange>;
  mockPositionManager: ReturnType<typeof createMockPositionMonitorManager>;
  mockTelegram: ReturnType<typeof createMockPositionMonitorTelegram>;
  mockExitTypeDetector: ReturnType<typeof createMockPositionMonitorExitTypeDetector>;
  mockPnLCalculator: ReturnType<typeof createMockPositionMonitorPnlCalculator>;
  mockPositionSync: ReturnType<typeof createMockPositionMonitorSync>;
  logger: LoggerService;
  errorHandler?: ErrorHandler;
};

export function createPositionMonitorService(
  dependencies: Omit<PositionMonitorDependencies, 'monitor'>,
  options: {
    riskConfig?: RiskManagementConfig;
    errorHandler?: ErrorHandler;
  } = {},
): PositionMonitorService {
  return new PositionMonitorService(
    dependencies.mockBybit as unknown as IExchange,
    dependencies.mockPositionManager as unknown as PositionLifecycleService,
    options.riskConfig ?? defaultPositionMonitorRiskConfig,
    dependencies.mockTelegram as unknown as TelegramService,
    dependencies.logger,
    dependencies.mockExitTypeDetector as unknown as ExitTypeDetectorService,
    dependencies.mockPnLCalculator as unknown as PositionPnLCalculatorService,
    dependencies.mockPositionSync as unknown as PositionSyncService,
    undefined,
    options.errorHandler,
  );
}

export function createStandardPositionMonitorService(
  dependencies: Omit<PositionMonitorDependencies, 'monitor'>,
  options: {
    riskConfig?: RiskManagementConfig;
    errorHandler?: ErrorHandler;
  } = {},
): PositionMonitorService {
  return createPositionMonitorService(dependencies, options);
}

export function createPositionMonitorServiceWithHarness(
  dependencies: Omit<PositionMonitorDependencies, 'monitor'>,
  options: {
    riskConfig?: RiskManagementConfig;
    errorHandler?: ErrorHandler;
  } = {},
): PositionMonitorService {
  return createPositionMonitorService(dependencies, options);
}

export function recreatePositionMonitorHarness(
  harness: PositionMonitorDependencies,
  options: {
    riskConfig?: RiskManagementConfig;
    errorHandler?: ErrorHandler;
  } = {},
): PositionMonitorDependencies {
  harness.monitor.stop();

  const errorHandler = options.errorHandler ?? harness.errorHandler;
  const dependencies = {
    mockBybit: harness.mockBybit,
    mockPositionManager: harness.mockPositionManager,
    mockTelegram: harness.mockTelegram,
    mockExitTypeDetector: harness.mockExitTypeDetector,
    mockPnLCalculator: harness.mockPnLCalculator,
    mockPositionSync: harness.mockPositionSync,
    logger: harness.logger,
    errorHandler,
  };

  return {
    ...dependencies,
    monitor: createStandardPositionMonitorService(dependencies, {
      riskConfig: options.riskConfig,
      errorHandler,
    }),
  };
}

export function createPositionMonitorRiskConfig(
  overrides: Partial<RiskManagementConfig> = {},
): RiskManagementConfig {
  return {
    ...defaultPositionMonitorRiskConfig,
    ...overrides,
  };
}

export function createTimeBasedExitRiskConfig(
  overrides: Partial<RiskManagementConfig> = {},
): RiskManagementConfig {
  return createPositionMonitorRiskConfig({
    positionSizeUsdt: 10,
    timeBasedExitEnabled: true,
    timeBasedExitMinutes: 30,
    timeBasedExitMinPnl: 0.2,
    ...overrides,
  });
}

export function createPositionMonitorHarness(
  options: {
    riskConfig?: RiskManagementConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  } = {},
): PositionMonitorDependencies {
  const mockBybit = createMockPositionMonitorExchange();
  const mockPositionManager = createMockPositionMonitorManager();
  const mockTelegram = createMockPositionMonitorTelegram();
  const mockExitTypeDetector = createMockPositionMonitorExitTypeDetector();
  const mockPnLCalculator = createMockPositionMonitorPnlCalculator();
  const mockPositionSync = createMockPositionMonitorSync();
  const logger = options.logger ?? createMockPositionMonitorLogger();
  const errorHandler = options.withErrorHandler === false
    ? undefined
    : options.errorHandler ?? new ErrorHandler(logger);

  return {
    monitor: createStandardPositionMonitorService(
      {
        mockBybit,
        mockPositionManager,
        mockTelegram,
        mockExitTypeDetector,
        mockPnLCalculator,
        mockPositionSync,
        logger,
      },
      {
        riskConfig: options.riskConfig,
        errorHandler,
      },
    ),
    mockBybit,
    mockPositionManager,
    mockTelegram,
    mockExitTypeDetector,
    mockPnLCalculator,
    mockPositionSync,
    logger,
    errorHandler,
  };
}

export interface ManagedPositionMonitorContext {
  harness: PositionMonitorDependencies;
  monitor: PositionMonitorService;
  mockBybit: ReturnType<typeof createMockPositionMonitorExchange>;
  mockPositionManager: ReturnType<typeof createMockPositionMonitorManager>;
  mockTelegram: ReturnType<typeof createMockPositionMonitorTelegram>;
  mockExitTypeDetector: ReturnType<typeof createMockPositionMonitorExitTypeDetector>;
  mockPnLCalculator: ReturnType<typeof createMockPositionMonitorPnlCalculator>;
  mockPositionSync: ReturnType<typeof createMockPositionMonitorSync>;
  logger: LoggerService;
  positionHarness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager'>;
  rebuildMonitor: (config: RiskManagementConfig) => PositionMonitorService;
  cleanup: () => void;
}

export type PositionMonitorManagedRuntime = Pick<
  ManagedPositionMonitorContext,
  | 'monitor'
  | 'mockBybit'
  | 'mockPositionManager'
  | 'mockTelegram'
  | 'mockPositionSync'
  | 'positionHarness'
  | 'rebuildMonitor'
  | 'cleanup'
>;

export type PositionMonitorSuiteState = PositionMonitorManagedRuntime;

export type PositionMonitorErrorHandlingRuntime = Pick<
  ManagedPositionMonitorContext,
  | 'monitor'
  | 'mockBybit'
  | 'mockPositionManager'
  | 'mockTelegram'
  | 'mockPositionSync'
  | 'positionHarness'
  | 'cleanup'
>;

export function createManagedPositionMonitorContext(
  options: {
    riskConfig?: RiskManagementConfig;
    logger?: LoggerService;
    errorHandler?: ErrorHandler;
    withErrorHandler?: boolean;
  } = {},
): ManagedPositionMonitorContext {
  jest.clearAllMocks();
  jest.useFakeTimers();

  const context = {} as ManagedPositionMonitorContext;

  const syncFromHarness = (harness: PositionMonitorDependencies): void => {
    context.harness = harness;
    context.monitor = harness.monitor;
    context.mockBybit = harness.mockBybit;
    context.mockPositionManager = harness.mockPositionManager;
    context.mockTelegram = harness.mockTelegram;
    context.mockExitTypeDetector = harness.mockExitTypeDetector;
    context.mockPnLCalculator = harness.mockPnLCalculator;
    context.mockPositionSync = harness.mockPositionSync;
    context.logger = harness.logger;
    context.positionHarness = { mockPositionManager: harness.mockPositionManager };
  };

  syncFromHarness(createPositionMonitorHarness(options));

  context.rebuildMonitor = (config: RiskManagementConfig): PositionMonitorService => {
    syncFromHarness(recreatePositionMonitorHarness(context.harness, { riskConfig: config }));
    return context.monitor;
  };

  context.cleanup = (): void => {
    context.monitor.stop();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  };

  return context;
}

export function attachCurrentPosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager'>,
  position: Position = createMockMonitoredPosition(),
): Position {
  harness.mockPositionManager.getCurrentPosition.mockReturnValue(position);
  return position;
}

export function attachExchangePosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager' | 'mockBybit'>,
  position: Position = createMockMonitoredPosition(),
): Position {
  attachCurrentPosition(harness, position);
  harness.mockBybit.getPosition.mockResolvedValueOnce(position);
  return position;
}

export function attachPersistentExchangePosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager' | 'mockBybit'>,
  position: Position = createMockMonitoredPosition(),
): Position {
  attachCurrentPosition(harness, position);
  harness.mockBybit.getPosition.mockResolvedValue(position);
  return position;
}

export function attachTimeBasedExitScenario(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager' | 'mockBybit'>,
  options: {
    side: PositionSide;
    entryPrice: number;
    stopLossPrice: number;
    openedMinutesAgo: number;
    currentPrice: number;
  },
): Position {
  const position = attachScenarioPosition(harness, {
    side: options.side,
    entryPrice: options.entryPrice,
    stopLossPrice: options.stopLossPrice,
    openedAt: createPositionMonitorOpenedAtMinutesAgo(options.openedMinutesAgo),
  });
  harness.mockBybit.getPosition.mockResolvedValue(position);
  harness.mockBybit.getCurrentPrice.mockResolvedValue(options.currentPrice);
  return position;
}

export function attachProtectedPosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager'>,
  overrides: Partial<Position> = {},
): Position {
  return attachCurrentPosition(
    harness,
    createMockMonitoredPosition(PositionSide.LONG, 50000, 49500, undefined, undefined, {
      protectionVerifiedOnce: true,
      ...overrides,
    }),
  );
}

export function attachUnprotectedPosition(
  harness: Pick<ReturnType<typeof createPositionMonitorHarness>, 'mockPositionManager' | 'mockBybit'>,
  overrides: Partial<Position> = {},
): Position {
  const position = attachExchangePosition(
    harness,
    createMockMonitoredPosition(undefined, undefined, undefined, undefined, undefined, overrides),
  );
  harness.mockBybit.verifyProtectionSet.mockResolvedValueOnce(
    createProtectionVerificationResult({
      verified: false,
      hasStopLoss: false,
      hasTakeProfit: false,
      activeOrders: 0,
    }),
  );
  return position;
}

export function createProtectionVerificationResult(overrides: {
  verified?: boolean;
  hasStopLoss?: boolean;
  hasTakeProfit?: boolean;
  hasTrailingStop?: boolean;
  activeOrders?: number;
} = {}) {
  return {
    verified: true,
    hasStopLoss: true,
    hasTakeProfit: true,
    hasTrailingStop: false,
    activeOrders: 3,
    ...overrides,
  };
}

export async function runPositionMonitorCycle(
  monitor: PositionMonitorService,
  delayMs: number = POSITION_MONITOR_INTERVAL_MS,
): Promise<void> {
  monitor.start();
  await jest.advanceTimersByTimeAsync(delayMs);
}

export async function runPositionMonitorCycles(
  monitor: PositionMonitorService,
  cycleCount: number,
  delayMs: number = POSITION_MONITOR_INTERVAL_MS,
): Promise<void> {
  monitor.start();

  for (let cycleIndex = 0; cycleIndex < cycleCount; cycleIndex++) {
    await jest.advanceTimersByTimeAsync(delayMs);
  }
}

export async function runPositionMonitorDeepSyncCycle(
  monitor: PositionMonitorService,
  delayMs: number = 30000,
): Promise<void> {
  monitor.start();
  await jest.advanceTimersByTimeAsync(delayMs);
}
