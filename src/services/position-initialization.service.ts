/**
 * Position Initialization Service
 *
 * Handles creation and initialization of Position objects:
 * - Creates Position object with all required fields
 * - Records trade in journal
 * - Records entry in session stats
 * - Initializes take-profit tracking
 */

import {
  LoggerService,
  Position,
  PositionSide,
  Signal,
  ExitType,
  SessionEntryCondition,
  SessionTradeRecord,
} from '../types';
import { TradingJournalService } from './trading-journal.service';
import { SessionStatsService } from './session-stats.service';

/**
 * Position Initialization Service
 * Manages Position object creation and recording
 */
export class PositionInitializationService {
  constructor(
    private journal: TradingJournalService,
    private sessionStats: SessionStatsService | undefined,
    private logger: LoggerService,
  ) {}

  /**
   * Create Position object with all required fields
   *
   * @param signal - Trading signal with entry details
   * @param side - Position side (LONG/SHORT)
   * @param quantity - Position quantity
   * @param actualStopLoss - Stop loss price
   * @param tpOrderIds - Take profit order IDs
   * @param orderId - Main position order ID
   * @param symbol - Trading symbol
   * @returns Created Position object
   */
  createPosition(
    signal: Signal,
    side: PositionSide,
    quantity: number,
    actualStopLoss: number,
    tpOrderIds: (string | undefined)[],
    orderId: string,
    symbol: string,
    marginUsed: number,
  ): Position {
    const timestamp = Date.now();
    const sideName = side === PositionSide.LONG ? 'Buy' : 'Sell';
    const exchangeId = `${symbol}_${sideName}`;
    const journalId = `${exchangeId}_${timestamp}`;

    const position: Position = {
      id: exchangeId,
      journalId,
      symbol,
      side,
      quantity,
      entryPrice: signal.price,
      leverage: 0, // Will be set by caller if needed
      marginUsed,
      stopLoss: {
        price: actualStopLoss,
        initialPrice: actualStopLoss,
        orderId: undefined,
        isBreakeven: false,
        isTrailing: false,
        updatedAt: Date.now(),
      },
      takeProfits: signal.takeProfits.map((tp, i) => ({
        ...tp,
        orderId: tpOrderIds[i] || undefined,
        hit: false,
      })),
      openedAt: timestamp,
      unrealizedPnL: 0,
      orderId,
      reason: signal.reason,
      confidence: signal.confidence,
      strategy: signal.type,
      protectionVerifiedOnce: true,
      status: 'OPEN',
    };

    return position;
  }

  /**
   * Record position opening in trading journal
   */
  recordInJournal(position: Position, signal: Signal): void {
    this.journal.recordTradeOpen({
      id: position.journalId!,
      symbol: position.symbol,
      side: position.side,
      entryPrice: signal.price,
      quantity: position.quantity,
      leverage: position.leverage,
      entryCondition: {
        signal,
        marketData: (signal.marketData as Record<string, unknown>) || undefined,
        btcData: signal.btcData || undefined,
      },
    });

    this.logger.debug('Trade recorded in journal', { journalId: position.journalId });
  }

  /**
   * Record trade entry in session stats
   */
  recordInSessionStats(
    position: Position,
    signal: Signal,
    entrySnapshot: SessionEntryCondition,
    actualStopLoss: number,
  ): void {
    if (!this.sessionStats) {
      return; // Session stats not available
    }

    const timestamp = position.openedAt;
    const sessionTrade: SessionTradeRecord = {
      tradeId: position.journalId!,
      timestamp: new Date(timestamp).toISOString(),
      direction: signal.direction,
      entryPrice: signal.price,
      exitPrice: 0,
      quantity: position.quantity,
      pnl: 0,
      pnlPercent: 0,
      exitType: ExitType.MANUAL,
      tpHitLevels: [],
      holdingTimeMs: 0,
      entryCondition: entrySnapshot,
      stopLoss: {
        initial: actualStopLoss,
        final: actualStopLoss,
        movedToBreakeven: false,
        trailingActivated: false,
      },
    };

    this.sessionStats.recordTradeEntry(sessionTrade);
    this.logger.debug('Trade entry recorded in session stats', { tradeId: position.journalId });
  }
}
