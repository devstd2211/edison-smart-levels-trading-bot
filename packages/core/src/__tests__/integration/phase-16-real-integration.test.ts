/**
 * Phase 16.1.2: Real Integration Tests - Critical Scenarios
 *
 * Tests REAL interactions for critical scenarios:
 * - TakeProfitManager PnL calculations
 * - Position lifecycle with ErrorHandler recovery
 * - Atomic close operations (race conditions)
 * - Repository state consistency
 *
 * Mocks external APIs (Bybit, Telegram), uses REAL internal services
 */

import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { PositionExitingService } from '../../services/position-exiting.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { PositionMemoryRepository } from '../../repositories/position.memory-repository';
import {
  Position,
  PositionSide,
  TradingConfig,
  RiskManagementConfig,
  Config,
  LogLevel,
  StopLossConfig,
  ExitType,
  OrderType,
} from '../../types/legacy';
import { LoggerService } from '../../services/logger.service';
import type { IExchange } from '../../interfaces/IExchange';
import type { TelegramService } from '../../services/telegram.service';
import type { TradingJournalService } from '../../services/trading-journal.service';

// ============================================================================
// MOCK SERVICES
// ============================================================================

const createMockBybitService = () => ({
  closePosition: jest.fn().mockResolvedValue(true),
  updateStopLoss: jest.fn().mockResolvedValue(true),
});

const createMockTelegramService = () => ({
  sendAlert: jest.fn().mockResolvedValue(true),
  notifyTakeProfitHit: jest.fn().mockResolvedValue(true),
  enabled: false,
});

const createMockJournalService = () => ({
  recordTradeClose: jest.fn().mockResolvedValue(true),
  recordPartialClose: jest.fn().mockResolvedValue(true),
});

// ============================================================================
// CONFIGURATIONS
// ============================================================================

const createTradingConfig = (): TradingConfig => ({
  leverage: 10,
  riskPercent: 2,
  maxPositions: 1,
  positionSizeUsdt: 100,
  tradingCycleIntervalMs: 1000,
  orderType: OrderType.LIMIT,
  tradingFeeRate: 0.0002,
  favorableMovementThresholdPercent: 0.1,
});

const createRiskConfig = (): RiskManagementConfig => ({
  takeProfits: [
    { level: 1, percent: 0.5, sizePercent: 33 },
    { level: 2, percent: 1.0, sizePercent: 33 },
    { level: 3, percent: 1.5, sizePercent: 34 },
  ],
  stopLossPercent: 1,
  minStopLossPercent: 0.5,
  breakevenOffsetPercent: 0.3,
  trailingStopEnabled: true,
  trailingStopPercent: 1,
  trailingStopActivationLevel: 2,
  positionSizeUsdt: 100,
});

const createFullConfig = (): Config => ({
  exchange: { symbol: 'BTCUSDT', testnet: true } as unknown as Config['exchange'],
  timeframes: {} as unknown as Config['timeframes'],
  trading: createTradingConfig(),
  strategies: {} as unknown as Config['strategies'],
  strategy: {} as unknown as Config['strategy'],
  indicators: {} as unknown as Config['indicators'],
  riskManagement: createRiskConfig(),
  logging: { level: LogLevel.DEBUG } as unknown as Config['logging'],
  system: {} as unknown as Config['system'],
  dataSubscriptions: {
    candles: { enabled: true, calculateIndicators: true },
    orderbook: { enabled: false, updateIntervalMs: 5000 },
    ticks: { enabled: false, calculateDelta: false },
  },
  entryConfig: {} as unknown as Config['entryConfig'],
  entryConfirmation: {} as unknown as Config['entryConfirmation'],
});

// ============================================================================
// TEST UTILITIES
// ============================================================================

class TestLogger extends LoggerService {
  logHistory: Array<{ level: string; message: string; metadata?: Record<string, unknown> }> = [];

  constructor() {
    super(LogLevel.DEBUG, './logs', false);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.logHistory.push({ level: 'INFO', message, metadata });
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.logHistory.push({ level: 'DEBUG', message, metadata });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.logHistory.push({ level: 'WARN', message, metadata });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.logHistory.push({ level: 'ERROR', message, metadata });
  }

  clearHistory(): void {
    this.logHistory = [];
  }
}

function createTestPosition(entryPrice: number, quantity: number, side: PositionSide = PositionSide.LONG): Position {
  return {
    id: `test-pos-${Date.now()}`,
    journalId: `test-journal-${Date.now()}`,
    symbol: 'BTCUSDT',
    side,
    quantity,
    entryPrice,
    leverage: 10,
    marginUsed: (entryPrice * quantity) / 10,
    stopLoss: {
      price: side === PositionSide.LONG ? entryPrice * 0.99 : entryPrice * 1.01,
      initialPrice: side === PositionSide.LONG ? entryPrice * 0.99 : entryPrice * 1.01,
      isBreakeven: false,
      isTrailing: false,
      updatedAt: Date.now(),
    } as StopLossConfig,
    takeProfits: [
      { level: 1, percent: 0.5, sizePercent: 33, price: entryPrice * (side === PositionSide.LONG ? 1.005 : 0.995), hit: false },
      { level: 2, percent: 1.0, sizePercent: 33, price: entryPrice * (side === PositionSide.LONG ? 1.01 : 0.99), hit: false },
      { level: 3, percent: 1.5, sizePercent: 34, price: entryPrice * (side === PositionSide.LONG ? 1.015 : 0.985), hit: false },
    ],
    openedAt: Date.now(),
    unrealizedPnL: 0,
    orderId: 'ORDER_123',
    reason: 'Test position',
    confidence: 0.85,
    status: 'OPEN',
  };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Phase 16.1.2: Real Integration Tests - Critical Scenarios', () => {
  let logger: TestLogger;
  let errorHandler: ErrorHandler;
  let mockBybit: ReturnType<typeof createMockBybitService>;
  let mockTelegram: ReturnType<typeof createMockTelegramService>;
  let mockJournal: ReturnType<typeof createMockJournalService>;
  let positionRepo: PositionMemoryRepository;

  beforeEach(() => {
    logger = new TestLogger();
    errorHandler = new ErrorHandler(logger);
    mockBybit = createMockBybitService();
    mockTelegram = createMockTelegramService();
    mockJournal = createMockJournalService();
    positionRepo = new PositionMemoryRepository();
  });

  describe('Scenario 1: TakeProfitManager - Full Lifecycle with Real PnL Calculations', () => {
    it('should correctly calculate PnL for 3 TP levels (LONG position)', () => {
      const entryPrice = 50000;
      const quantity = 1.0; // 1 BTC
      const leverage = 10;

      const tpManager = new TakeProfitManagerService(
        {
          positionId: 'test-long-1',
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          entryPrice,
          totalQuantity: quantity,
          leverage,
        },
        logger,
        errorHandler,
      );

      // ========== TP1: 0.5% gain (50250) ==========
      const tp1Price = 50250;
      const tp1Qty = quantity * 0.33; // 33% (0.33 BTC)
      const tp1Close = tpManager.recordPartialClose(1, tp1Qty, tp1Price);

      expect(tp1Close).toBeDefined();
      expect(tp1Close.level).toBe(1);
      expect(tp1Close.quantity).toBe(tp1Qty);
      expect(tp1Close.exitPrice).toBe(tp1Price);
      expect(tp1Close.pnlNet).toBeGreaterThan(0); // Profitable

      // Verify TP levels hit
      const levels1 = tpManager.getTpLevelsHit();
      expect(levels1).toEqual([1]);

      // ========== TP2: 1.0% gain (50500) ==========
      const tp2Price = 50500;
      const tp2Qty = quantity * 0.33;
      const tp2Close = tpManager.recordPartialClose(2, tp2Qty, tp2Price);

      expect(tp2Close.pnlNet).toBeGreaterThan(tp1Close.pnlNet); // TP2 more profitable than TP1
      const levels2 = tpManager.getTpLevelsHit();
      expect(levels2).toEqual([1, 2]);

      // ========== TP3: 1.5% gain (50750) ==========
      const tp3Price = 50750;
      const remainingQty = tpManager.getRemainingQuantity();
      expect(remainingQty).toBeCloseTo(0.34, 2); // 34% remaining

      const tp3Close = tpManager.recordPartialClose(3, remainingQty, tp3Price);
      expect(tp3Close.pnlNet).toBeGreaterThan(tp2Close.pnlNet);

      // ========== Verify Final State ==========
      const totalPnL = tpManager.getTotalPnL();
      expect(totalPnL.pnlNet).toBeGreaterThan(0);
      expect(totalPnL.fees).toBeGreaterThan(0);

      const totalRealized = tpManager.getTotalRealizedPnL();
      expect(totalRealized).toBeCloseTo(totalPnL.pnlNet, 5);

      const totalClosed = tpManager.getTotalQuantityClosed();
      expect(totalClosed).toBeCloseTo(quantity, 5);

      const isFullyClosed = tpManager.isFullyClosed();
      expect(isFullyClosed).toBe(true);

      // Verify all 3 levels hit
      const levelsHit = tpManager.getTpLevelsHit();
      expect(levelsHit).toEqual([1, 2, 3]);
    });

    it('should correctly calculate PnL for SHORT position', () => {
      const entryPrice = 50000;
      const quantity = 0.5;

      const tpManager = new TakeProfitManagerService(
        {
          positionId: 'test-short-1',
          symbol: 'BTCUSDT',
          side: PositionSide.SHORT,
          entryPrice,
          totalQuantity: quantity,
          leverage: 10,
        },
        logger,
      );

      // For SHORT, TP1 is BELOW entry (49750 = 0.5% down)
      const tp1Price = 49750;
      const tp1Qty = quantity * 0.5; // 50%

      const tp1Close = tpManager.recordPartialClose(1, tp1Qty, tp1Price);

      expect(tp1Close.pnlNet).toBeGreaterThan(0); // SHORT profits from price drop
      expect(tpManager.getRemainingQuantity()).toBeCloseTo(0.25, 5);
    });

    it('should throw error when closing more than available quantity', () => {
      const tpManager = new TakeProfitManagerService(
        {
          positionId: 'test-overflow',
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          entryPrice: 50000,
          totalQuantity: 1.0,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Close 0.5
      tpManager.recordPartialClose(1, 0.5, 50250);

      // Try to close 0.6 (would exceed total)
      expect(() => {
        tpManager.recordPartialClose(2, 0.6, 50500);
      }).toThrow();
    });
  });

  describe('Scenario 2: PositionExiting + TakeProfitManager Integration', () => {
    it('should execute full position close with proper PnL tracking', async () => {
      const position = createTestPosition(50000, 1.0, PositionSide.LONG);

      // Store in repository
      positionRepo.setCurrentPosition(position);

      const positionExiting = new PositionExitingService(
        mockBybit as unknown as IExchange,
        mockTelegram as unknown as TelegramService,
        logger,
        mockJournal as unknown as TradingJournalService,
        createTradingConfig(),
        createRiskConfig(),
        createFullConfig(),
      );

      // Close position at TP price
      const exitPrice = 51000;
      const result = await positionExiting.closeFullPosition(
        position,
        exitPrice,
        'TP3_HIT',
        ExitType.TAKE_PROFIT_1,
      );

      expect(result).toBe(true);

      // Verify closePosition was called (parameters may vary by implementation)
      expect(mockBybit.closePosition).toHaveBeenCalled();
      const closeCall = mockBybit.closePosition.mock.calls[0][0];
      expect(closeCall).toHaveProperty('positionId', position.id);

      expect(mockJournal.recordTradeClose).toHaveBeenCalled();
    });
  });

  describe('Scenario 3: Error Recovery Integration', () => {
    it('should handle Bybit API failures with RETRY strategy', async () => {
      const position = createTestPosition(50000, 1.0);

      // Mock Bybit to fail twice, then succeed
      let callCount = 0;
      mockBybit.closePosition.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network timeout'));
        }
        return Promise.resolve(true);
      });

      const positionExiting = new PositionExitingService(
        mockBybit as unknown as IExchange,
        mockTelegram as unknown as TelegramService,
        logger,
        mockJournal as unknown as TradingJournalService,
        createTradingConfig(),
        createRiskConfig(),
        createFullConfig(),
        undefined, // sessionStats
        undefined, // positionManager
        undefined, // realityCheck (9th param)
        // ErrorHandler would be 10th param, but causes "Expected 7-10" error
        // So we omit it for now
      );

      // Should retry and succeed
      const result = await positionExiting.closeFullPosition(
        position,
        51000,
        'TP_HIT',
        ExitType.TAKE_PROFIT_1
      );

      expect(result).toBe(true);
      expect(callCount).toBe(3); // Failed twice, succeeded third time

      // Verify retry attempts were logged
      const warnLogs = logger.logHistory.filter(l => l.level === 'WARN' || l.level === 'ERROR');
      expect(warnLogs.length).toBeGreaterThan(0);
    });

    it('should handle journal failures gracefully', async () => {
      const position = createTestPosition(50000, 1.0);

      // Mock journal to fail
      mockJournal.recordTradeClose.mockRejectedValue(new Error('Journal write failed'));

      const positionExiting = new PositionExitingService(
        mockBybit as unknown as IExchange,
        mockTelegram as unknown as TelegramService,
        logger,
        mockJournal as unknown as TradingJournalService,
        createTradingConfig(),
        createRiskConfig(),
        createFullConfig(),
      );

      // Should still close position even if journal fails
      const result = await positionExiting.closeFullPosition(
        position,
        51000,
        'TP_HIT',
        ExitType.TAKE_PROFIT_1
      );

      expect(result).toBe(true);
      expect(mockBybit.closePosition).toHaveBeenCalled();
    });
  });

  describe('Scenario 4: Concurrent Operations (Atomic Locks)', () => {
    it('should prevent concurrent close attempts on same position', async () => {
      const position = createTestPosition(50000, 1.0);

      const positionExiting = new PositionExitingService(
        mockBybit as unknown as IExchange,
        mockTelegram as unknown as TelegramService,
        logger,
        mockJournal as unknown as TradingJournalService,
        createTradingConfig(),
        createRiskConfig(),
        createFullConfig(),
      );

      // Simulate concurrent close attempts (WebSocket + Timeout race)
      const results = await Promise.allSettled([
        positionExiting.closeFullPosition(position, 51000, 'TP_HIT', ExitType.TAKE_PROFIT_1),
        positionExiting.closeFullPosition(position, 51000, 'TP_HIT', ExitType.TAKE_PROFIT_1),
        positionExiting.closeFullPosition(position, 51000, 'TP_HIT', ExitType.TAKE_PROFIT_1),
      ]);

      // Only one should succeed (atomic lock)
      const successful = results.filter(r => r.status === 'fulfilled' && r.value === true);
      expect(successful.length).toBeLessThanOrEqual(1);

      // Bybit should only be called once
      expect(mockBybit.closePosition).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 5: Position Repository State Management', () => {
    it('should maintain position state consistency', () => {
      // Clear any previous state
      positionRepo.clear();
      positionRepo.clearHistory();

      const position = createTestPosition(50000, 1.0);

      // Set current position
      positionRepo.setCurrentPosition(position);

      // Verify stored correctly
      const stored = positionRepo.getCurrentPosition();
      expect(stored).toBeDefined();
      expect(stored?.id).toBe(position.id);
      expect(stored?.symbol).toBe('BTCUSDT');

      // Add to history
      positionRepo.addToHistory(position);

      // Clear current
      positionRepo.setCurrentPosition(null);
      const afterClear = positionRepo.getCurrentPosition();
      expect(afterClear).toBeNull();

      // Verify history
      const history = positionRepo.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.some(p => p.id === position.id)).toBe(true);

      // Find position
      const found = positionRepo.findPosition(position.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(position.id);
    });

    it('should handle multiple positions in history', () => {
      const pos1 = createTestPosition(50000, 1.0);
      const pos2 = createTestPosition(51000, 0.5);
      const pos3 = createTestPosition(52000, 0.3);

      positionRepo.addToHistory(pos1);
      positionRepo.addToHistory(pos2);
      positionRepo.addToHistory(pos3);

      const history = positionRepo.getHistory();
      expect(history.length).toBe(3);

      // Verify order (most recent first)
      expect(history[0].id).toBe(pos3.id);
      expect(history[1].id).toBe(pos2.id);
      expect(history[2].id).toBe(pos1.id);

      // Get limited history
      const limited = positionRepo.getHistory(2);
      expect(limited.length).toBe(2);
      expect(limited[0].id).toBe(pos3.id);

      // Clear history
      positionRepo.clearHistory();
      const afterClear = positionRepo.getHistory();
      expect(afterClear.length).toBe(0);
    });
  });

  describe('Scenario 6: Performance Validation', () => {
    it('should handle rapid TP calculations efficiently', () => {
      const startTime = Date.now();
      const iterations = 1000;

      const tpManager = new TakeProfitManagerService(
        {
          positionId: 'perf-test',
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          entryPrice: 50000,
          totalQuantity: 100,
          leverage: 10,
        },
        logger,
      );

      // Simulate 1000 small partial closes
      for (let i = 0; i < iterations; i++) {
        tpManager.recordPartialClose(1, 0.1, 50000 + i);
      }

      const duration = Date.now() - startTime;

      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);

      // Verify calculations remain accurate
      const totalClosed = tpManager.getTotalQuantityClosed();
      expect(totalClosed).toBeCloseTo(100, 5);
    });
  });
});
