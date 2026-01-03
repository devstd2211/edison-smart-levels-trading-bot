/**
 * Tests for TradingJournalService
 *
 * Tests:
 * - Journal initialization (load existing / create new)
 * - Trade recording (open/close)
 * - Trade retrieval (by ID, all, filtered)
 * - Statistics calculation
 * - CSV export
 * - Error handling
 */

import { TradingJournalService } from '../../services/trading-journal.service';
import { LoggerService, LogLevel, PositionSide, SignalType, SignalDirection, TakeProfit, ExitCondition, ExitType } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createTakeProfit(level: number, price: number, percent: number = 1.0, sizePercent: number = 100): TakeProfit {
  return {
    level,
    price,
    percent,
    sizePercent,
    hit: false,
  };
}

function createExitCondition(
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

describe('TradingJournalService', () => {
  let journal: TradingJournalService;
  let logger: LoggerService;
  let testDataDir: string;

  beforeEach(() => {
    // Create temp directory for each test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trading-journal-test-'));
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    journal = new TradingJournalService(logger, testDataDir);
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================

  describe('Initialization', () => {
    it('should create data directory if not exists', () => {
      expect(fs.existsSync(testDataDir)).toBe(true);
    });

    it('should create empty journal if file does not exist', () => {
      const trades = journal.getAllTrades();
      expect(trades).toEqual([]);
    });

    it('should load existing journal from file', () => {
      // Create journal file with test data
      const journalPath = path.join(testDataDir, 'trade-journal.json');
      const testTrades = [
        {
          id: 'TEST_1',
          symbol: 'BTCUSDT',
          side: PositionSide.LONG,
          entryPrice: 50000,
          quantity: 0.1,
          leverage: 10,
          entryCondition: {
            signal: {
              type: SignalType.LEVEL_BASED,
              direction: SignalDirection.LONG,
              price: 50000,
              stopLoss: 49500,
              takeProfits: [createTakeProfit(1, 50500, 1.0, 50)],
              confidence: 0.8,
              reason: 'Test signal',
              timestamp: Date.now(),
            },
          },
          openedAt: Date.now(),
          status: 'OPEN',
        },
      ];

      fs.writeFileSync(journalPath, JSON.stringify(testTrades, null, 2));

      // Create new journal instance that should load the file
      const newJournal = new TradingJournalService(logger, testDataDir);
      const loaded = newJournal.getAllTrades();

      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('TEST_1');
      expect(loaded[0].symbol).toBe('BTCUSDT');
    });

    it('should handle corrupted journal file gracefully', () => {
      // Create corrupted journal file
      const journalPath = path.join(testDataDir, 'trade-journal.json');
      fs.writeFileSync(journalPath, 'not valid json {{{');

      // Should not throw, just log error
      const newJournal = new TradingJournalService(logger, testDataDir);
      const trades = newJournal.getAllTrades();

      expect(trades).toEqual([]); // Empty journal
    });
  });

  // ============================================================================
  // TRADE RECORDING TESTS
  // ============================================================================

  describe('recordTradeOpen', () => {
    it('should record new trade opening', () => {
      journal.recordTradeOpen({
        id: 'TRADE_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.5,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.5,
            stopLoss: 10.0,
            takeProfits: [createTakeProfit(1, 11.0, 1.0, 100)],
            confidence: 0.85,
            reason: 'Strong uptrend',
            timestamp: Date.now(),
          },
        },
      });

      const trade = journal.getTrade('TRADE_1');
      expect(trade).toBeDefined();
      expect(trade!.id).toBe('TRADE_1');
      expect(trade!.symbol).toBe('APTUSDT');
      expect(trade!.side).toBe(PositionSide.LONG);
      expect(trade!.entryPrice).toBe(10.5);
      expect(trade!.status).toBe('OPEN');
    });

    it('should throw error if trade ID is empty', () => {
      expect(() => {
        journal.recordTradeOpen({
          id: '',
          symbol: 'APTUSDT',
          side: PositionSide.LONG,
          entryPrice: 10.5,
          quantity: 100,
          leverage: 10,
          entryCondition: {
            signal: {
              type: SignalType.TREND_FOLLOWING,
              direction: SignalDirection.LONG,
              price: 10.5,
              stopLoss: 10.0,
              takeProfits: [createTakeProfit(1, 11.0, 1.0, 100)],
              confidence: 0.85,
              reason: 'Test',
              timestamp: Date.now(),
            },
          },
        });
      }).toThrow('Trade ID is required');
    });

    it('should throw error if trade ID already exists', () => {
      journal.recordTradeOpen({
        id: 'DUPLICATE',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.5,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.5,
            stopLoss: 10.0,
            takeProfits: [createTakeProfit(1, 11.0, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      expect(() => {
        journal.recordTradeOpen({
          id: 'DUPLICATE',
          symbol: 'APTUSDT',
          side: PositionSide.SHORT,
          entryPrice: 10.5,
          quantity: 100,
          leverage: 10,
          entryCondition: {
            signal: {
              type: SignalType.TREND_FOLLOWING,
              direction: SignalDirection.SHORT,
              price: 10.5,
              stopLoss: 11.0,
              takeProfits: [createTakeProfit(1, 10.0, 1.0, 100)],
              confidence: 0.85,
              reason: 'Test',
              timestamp: Date.now(),
            },
          },
        });
      }).toThrow('Trade DUPLICATE already exists');
    });

    it('should persist trade to file', () => {
      journal.recordTradeOpen({
        id: 'PERSIST_TEST',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.5,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.5,
            stopLoss: 10.0,
            takeProfits: [createTakeProfit(1, 11.0, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      // Create new journal instance and check if trade is loaded
      const newJournal = new TradingJournalService(logger, testDataDir);
      const trade = newJournal.getTrade('PERSIST_TEST');

      expect(trade).toBeDefined();
      expect(trade!.id).toBe('PERSIST_TEST');
    });
  });

  describe('recordTradeClose', () => {
    beforeEach(() => {
      // Open a trade first
      journal.recordTradeOpen({
        id: 'CLOSE_TEST',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });
    });

    it('should record trade closing with profit', () => {
      journal.recordTradeClose({
        id: 'CLOSE_TEST',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 15, [1], false),
        realizedPnL: 50.0,
      });

      const trade = journal.getTrade('CLOSE_TEST');
      expect(trade).toBeDefined();
      expect(trade!.status).toBe('CLOSED');
      expect(trade!.exitPrice).toBe(10.5);
      expect(trade!.realizedPnL).toBe(50.0);
      expect(trade!.exitCondition?.exitType).toBe('TAKE_PROFIT_1');
      expect(trade!.closedAt).toBeDefined();
    });

    it('should record trade closing with loss (stop loss)', () => {
      journal.recordTradeClose({
        id: 'CLOSE_TEST',
        exitPrice: 9.5,
        exitCondition: createExitCondition(ExitType.STOP_LOSS, 9.5, -5.0, -30.0, 5, [], true),
        realizedPnL: -30.0,
      });

      const trade = journal.getTrade('CLOSE_TEST');
      expect(trade).toBeDefined();
      expect(trade!.status).toBe('CLOSED');
      expect(trade!.realizedPnL).toBe(-30.0);
      expect(trade!.exitCondition?.stoppedOut).toBe(true);
    });

    it('should throw error if trade not found', () => {
      expect(() => {
        journal.recordTradeClose({
          id: 'NON_EXISTENT',
          exitPrice: 10.5,
          exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 15, [1], false),
          realizedPnL: 50.0,
        });
      }).toThrow('Trade NON_EXISTENT not found');
    });

    it('should persist closed trade to file', () => {
      journal.recordTradeClose({
        id: 'CLOSE_TEST',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 15, [1], false),
        realizedPnL: 50.0,
      });

      // Create new journal instance and verify
      const newJournal = new TradingJournalService(logger, testDataDir);
      const trade = newJournal.getTrade('CLOSE_TEST');

      expect(trade).toBeDefined();
      expect(trade!.status).toBe('CLOSED');
      expect(trade!.realizedPnL).toBe(50.0);
    });
  });

  // ============================================================================
  // TRADE RETRIEVAL TESTS
  // ============================================================================

  describe('Trade Retrieval', () => {
    beforeEach(() => {
      // Create mix of open and closed trades
      journal.recordTradeOpen({
        id: 'OPEN_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeOpen({
        id: 'CLOSED_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'CLOSED_1',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 15, [1], false),
        realizedPnL: 50.0,
      });
    });

    it('should get trade by ID', () => {
      const trade = journal.getTrade('OPEN_1');
      expect(trade).toBeDefined();
      expect(trade!.id).toBe('OPEN_1');
    });

    it('should return undefined for non-existent trade', () => {
      const trade = journal.getTrade('NON_EXISTENT');
      expect(trade).toBeUndefined();
    });

    it('should get all trades', () => {
      const trades = journal.getAllTrades();
      expect(trades).toHaveLength(2);
    });

    it('should get only open trades', () => {
      const openTrades = journal.getOpenTrades();
      expect(openTrades).toHaveLength(1);
      expect(openTrades[0].id).toBe('OPEN_1');
      expect(openTrades[0].status).toBe('OPEN');
    });

    it('should get only closed trades', () => {
      const closedTrades = journal.getClosedTrades();
      expect(closedTrades).toHaveLength(1);
      expect(closedTrades[0].id).toBe('CLOSED_1');
      expect(closedTrades[0].status).toBe('CLOSED');
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('getStatistics', () => {
    it('should return empty statistics for no trades', () => {
      const stats = journal.getStatistics();

      expect(stats.totalTrades).toBe(0);
      expect(stats.openTrades).toBe(0);
      expect(stats.closedTrades).toBe(0);
      expect(stats.winningTrades).toBe(0);
      expect(stats.losingTrades).toBe(0);
      expect(stats.totalPnL).toBe(0);
      expect(stats.winRate).toBe(0);
    });

    it('should calculate statistics correctly with mixed trades', () => {
      // Create winning trade
      journal.recordTradeOpen({
        id: 'WIN_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'WIN_1',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 20, [1], false),
        realizedPnL: 50.0,
      });

      // Create losing trade
      journal.recordTradeOpen({
        id: 'LOSS_1',
        symbol: 'APTUSDT',
        side: PositionSide.SHORT,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.SHORT,
            price: 10.0,
            stopLoss: 10.5,
            takeProfits: [createTakeProfit(1, 9.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'LOSS_1',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.STOP_LOSS, 10.5, -5.0, -30.0, 10, [], true),
        realizedPnL: -30.0,
      });

      // Create open trade
      journal.recordTradeOpen({
        id: 'OPEN_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      const stats = journal.getStatistics();

      expect(stats.totalTrades).toBe(3);
      expect(stats.openTrades).toBe(1);
      expect(stats.closedTrades).toBe(2);
      expect(stats.winningTrades).toBe(1);
      expect(stats.losingTrades).toBe(1);
      expect(stats.totalPnL).toBe(20.0); // 50 - 30
      expect(stats.averagePnL).toBe(10.0); // 20 / 2
      expect(stats.winRate).toBe(0.5); // 1 win / 2 closed
      expect(stats.averageHoldingTimeMinutes).toBe(15); // (20 + 10) / 2
    });

    it('should handle all winning trades', () => {
      journal.recordTradeOpen({
        id: 'WIN_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'WIN_1',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 20, [1], false),
        realizedPnL: 50.0,
      });

      const stats = journal.getStatistics();

      expect(stats.winRate).toBe(1.0); // 100% win rate
      expect(stats.losingTrades).toBe(0);
    });

    it('should handle all losing trades', () => {
      journal.recordTradeOpen({
        id: 'LOSS_1',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'LOSS_1',
        exitPrice: 9.5,
        exitCondition: createExitCondition(ExitType.STOP_LOSS, 9.5, -5.0, -30.0, 10, [], true),
        realizedPnL: -30.0,
      });

      const stats = journal.getStatistics();

      expect(stats.winRate).toBe(0); // 0% win rate
      expect(stats.winningTrades).toBe(0);
    });
  });

  // ============================================================================
  // CSV EXPORT TESTS
  // ============================================================================

  describe('exportToCSV', () => {
    it('should export trades to CSV file', () => {
      journal.recordTradeOpen({
        id: 'CSV_TEST',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test signal',
            timestamp: Date.now(),
          },
        },
      });

      journal.recordTradeClose({
        id: 'CSV_TEST',
        exitPrice: 10.5,
        exitCondition: createExitCondition(ExitType.TAKE_PROFIT_1, 10.5, 5.0, 50.0, 15, [1], false),
        realizedPnL: 50.0,
      });

      const csvPath = path.join(testDataDir, 'test-export.csv');
      journal.exportToCSV(csvPath);

      expect(fs.existsSync(csvPath)).toBe(true);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      expect(csvContent).toContain('ID,Symbol,Side');
      expect(csvContent).toContain('CSV_TEST');
      expect(csvContent).toContain('APTUSDT');
      expect(csvContent).toContain('LONG');
    });

    it('should export to default path if no path provided', () => {
      journal.recordTradeOpen({
        id: 'DEFAULT_CSV',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      journal.exportToCSV();

      const defaultCsvPath = path.join(testDataDir, 'trade-journal.csv');
      expect(fs.existsSync(defaultCsvPath)).toBe(true);
    });

    it('should handle empty journal export', () => {
      const csvPath = path.join(testDataDir, 'empty-export.csv');
      journal.exportToCSV(csvPath);

      expect(fs.existsSync(csvPath)).toBe(true);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.split('\n');
      expect(lines.length).toBe(1); // Only header
    });
  });

  // ============================================================================
  // UTILITY TESTS
  // ============================================================================

  describe('clear', () => {
    it('should clear all trades and persist to file', () => {
      journal.recordTradeOpen({
        id: 'CLEAR_TEST',
        symbol: 'APTUSDT',
        side: PositionSide.LONG,
        entryPrice: 10.0,
        quantity: 100,
        leverage: 10,
        entryCondition: {
          signal: {
            type: SignalType.TREND_FOLLOWING,
            direction: SignalDirection.LONG,
            price: 10.0,
            stopLoss: 9.5,
            takeProfits: [createTakeProfit(1, 10.5, 1.0, 100)],
            confidence: 0.85,
            reason: 'Test',
            timestamp: Date.now(),
          },
        },
      });

      expect(journal.getAllTrades()).toHaveLength(1);

      journal.clear();

      expect(journal.getAllTrades()).toHaveLength(0);

      // Verify persistence
      const newJournal = new TradingJournalService(logger, testDataDir);
      expect(newJournal.getAllTrades()).toHaveLength(0);
    });
  });
});
