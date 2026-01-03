/**
 * Position Sync Service
 *
 * Handles WebSocket synchronization and position state management:
 * - Restores positions after bot restart
 * - Syncs quantity and unrealized PnL updates
 * - Validates and updates entry prices
 * - Links positions with trading journal
 * - Cleans up orders on position close
 */

import { LoggerService, Position } from '../types';
import { BybitService } from './bybit';
import { TradingJournalService } from './trading-journal.service';

/**
 * Position Sync Service
 * Manages WebSocket synchronization and position state
 */
export class PositionSyncService {
  constructor(
    private bybitService: BybitService,
    private journal: TradingJournalService,
    private logger: LoggerService,
    private adaptiveTP3Service?: any, // Archived service, needed for reset
  ) {}

  /**
   * Sync position state with WebSocket update
   * Handles both position restoration and ongoing state updates
   *
   * @param currentPosition - Current position in memory (null if position needs restoration)
   * @param wsPosition - Position data from WebSocket
   * @returns Updated position object
   */
  syncWithWebSocket(currentPosition: Position | null, wsPosition: Position): Position {
    if (currentPosition === null) {
      return this.restorePositionFromWebSocket(wsPosition);
    }

    return this.updatePositionState(currentPosition, wsPosition);
  }

  /**
   * Restore position from WebSocket after bot restart
   * Attempts to link with trading journal for statistics tracking
   */
  private restorePositionFromWebSocket(position: Position): Position {
    // Try to find matching open trade in journal by symbol
    const openTrade = this.journal.getOpenPositionBySymbol(position.symbol);

    if (openTrade) {
      // Restore journalId from open trade
      position.journalId = openTrade.id;
      this.logger.info('✅ Position restored from WebSocket with journal ID', {
        exchangeId: position.id,
        journalId: position.journalId,
        symbol: position.symbol,
      });
    } else {
      // No open trade in journal - DO NOT create journal entry (Session #57 decision)
      // Position will be managed (TP/SL) but NOT tracked in journal statistics
      this.logger.warn('⚠️ Position restored from WebSocket but not found in journal - IGNORING from statistics', {
        exchangeId: position.id,
        symbol: position.symbol,
        entryPrice: position.entryPrice,
        quantity: position.quantity,
        note: 'This position will be managed (TP/SL) but NOT recorded in journal. Consider closing manually if unwanted.',
      });

      // Set journalId to undefined - this will prevent journal recording on close
      position.journalId = undefined;
    }

    // Initialize status for restored positions
    if (!position.status) {
      position.status = 'OPEN';
    }

    return position;
  }

  /**
   * Update existing position state with WebSocket data
   * Syncs quantity, unrealized PnL, and entry price
   */
  private updatePositionState(currentPosition: Position, wsPosition: Position): Position {
    // Update quantity and PnL from WebSocket
    currentPosition.quantity = wsPosition.quantity;
    currentPosition.unrealizedPnL = wsPosition.unrealizedPnL;

    // ⚠️ CRITICAL: Only update entryPrice if it's valid (> 0) and current is 0
    // Bybit sends entryPrice=0 for MARKET orders before they're filled
    // We must preserve the signal.price set during openPosition()
    if (wsPosition.entryPrice > 0 && currentPosition.entryPrice === 0) {
      currentPosition.entryPrice = wsPosition.entryPrice;
      this.logger.info('✅ Entry price updated from WebSocket', {
        positionId: currentPosition.id,
        entryPrice: wsPosition.entryPrice,
      });
    }
    // DO NOT overwrite entryPrice if we already have it from signal!

    return currentPosition;
  }

  /**
   * Clear position (called when WebSocket reports position closed)
   * Cancels remaining orders and cleans up state
   */
  async clearPosition(currentPosition: Position | null): Promise<void> {
    // Cancel any remaining conditional orders (SL/TP) when position closed via WebSocket
    this.logger.debug('🧹 Cancelling conditional orders after WebSocket position close...');
    await this.bybitService.cancelAllConditionalOrders();

    // Phase 3: Reset AdaptiveTP3 state if position exists
    if (this.adaptiveTP3Service && currentPosition) {
      this.adaptiveTP3Service.reset(currentPosition.id);
    }
  }
}
