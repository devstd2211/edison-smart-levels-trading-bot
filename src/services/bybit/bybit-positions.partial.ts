/**
 * Bybit Positions Partial
 *
 * Handles position management operations:
 * - Open positions (LONG/SHORT)
 * - Close positions
 * - Get position info
 * - Set leverage
 * - Set margin mode
 */

import { Position, PositionSide } from '../../types';
import { BybitBase, BYBIT_SUCCESS_CODE, POSITION_SIZE_ZERO, POSITION_IDX_ONE_WAY } from './bybit-base.partial';

// ============================================================================
// BYBIT POSITIONS PARTIAL
// ============================================================================

export class BybitPositions extends BybitBase {
  // ==========================================================================
  // MARGIN & LEVERAGE
  // ==========================================================================

  /**
   * Set margin mode to isolated
   * NOTE: Not supported on demo trading - skipped for demo accounts
   */
  async setMarginMode(): Promise<void> {
    // Skip for demo trading (not supported)
    if (this.demo) {
      this.logger.debug('Skipping setMarginMode (not supported on demo trading)');
      return;
    }

    return await this.retry(async () => {
      this.logger.debug('Setting margin mode to ISOLATED');

      const response = await this.restClient.switchIsolatedMargin({
        category: 'linear',
        symbol: this.symbol,
        tradeMode: 1, // 1 = Isolated margin
        buyLeverage: '10',
        sellLeverage: '10',
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        // Ignore if already in isolated mode
        if (response.retMsg?.includes('margin mode not modified') ||
            response.retMsg?.includes('already') ||
            response.retCode === 110026) { // Already in isolated mode
          this.logger.debug('Margin mode already set to ISOLATED');
          return;
        }
        this.logger.warn('Failed to set margin mode (non-critical)', {
          error: response.retMsg,
          code: response.retCode,
        });
        return; // Continue anyway - margin mode is not critical
      }

      this.logger.info('Margin mode set to ISOLATED', { symbol: this.symbol });
    });
  }

  /**
   * Set leverage for symbol
   */
  async setLeverage(leverage: number): Promise<void> {
    return await this.retry(async () => {
      // First ensure we're in isolated margin mode
      await this.setMarginMode();

      const response = await this.restClient.setLeverage({
        category: 'linear',
        symbol: this.symbol,
        buyLeverage: leverage.toString(),
        sellLeverage: leverage.toString(),
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        // Ignore "leverage not modified" error
        if (response.retMsg?.includes('leverage not modified')) {
          this.logger.debug('Leverage already set', { leverage });
          return;
        }
        throw new Error(`Failed to set leverage: ${response.retMsg}`);
      }

      this.logger.info('Leverage set', { symbol: this.symbol, leverage });
    });
  }

  // ==========================================================================
  // POSITION MANAGEMENT
  // ==========================================================================

  /**
   * Open futures position with limit order
   */
  async openPosition(params: {
    side: PositionSide;
    quantity: number;
    leverage: number;
  }): Promise<string> {
    return await this.retry(async () => {
      const { side, quantity, leverage } = params;

      // Set leverage first
      await this.setLeverage(leverage);

      // Round quantity to exchange precision
      const orderQty = this.roundQuantity(quantity);

      this.logger.info('📤 Submitting MARKET order to Bybit', {
        side,
        quantity,
        quantityString: orderQty,
        symbol: this.symbol,
        leverage,
      });

      // Place MARKET order for immediate execution
      const response = await this.restClient.submitOrder({
        category: 'linear',
        symbol: this.symbol,
        side: side === PositionSide.LONG ? 'Buy' : 'Sell',
        orderType: 'Market',
        qty: orderQty,
        positionIdx: POSITION_IDX_ONE_WAY,
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        throw new Error(`Failed to open position: ${response.retMsg}`);
      }

      const orderId = response.result.orderId;
      this.logger.info('Position MARKET order placed', { orderId, side, quantity: orderQty });

      return orderId;
    });
  }

  /**
   * Get current open position
   */
  async getPosition(): Promise<Position | null> {
    return await this.retry(async () => {
      const response = await this.restClient.getPositionInfo({
        category: 'linear',
        symbol: this.symbol,
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        throw new Error(`Bybit API error: ${response.retMsg} (code: ${response.retCode})`);
      }

      const positions = response.result.list;
      if (positions === undefined || positions.length === 0) {
        return null;
      }

      const pos = positions[0];
      const size = parseFloat(pos.size ?? '0');

      // No position if size is 0
      if (size === POSITION_SIZE_ZERO) {
        return null;
      }

      // Map to Position type
      return {
        id: `${this.symbol}_${pos.side}`,
        symbol: this.symbol,
        side: pos.side === 'Buy' ? PositionSide.LONG : PositionSide.SHORT,
        quantity: size,
        entryPrice: parseFloat(pos.avgPrice ?? '0'),
        leverage: parseFloat(pos.leverage ?? '1'),
        marginUsed: parseFloat(pos.positionIM ?? '0'), // Initial margin
        stopLoss: {
          price: 0,
          initialPrice: 0,
          isBreakeven: false,
          isTrailing: false,
          updatedAt: Date.now(),
        },
        takeProfits: [],
        openedAt: Date.now(),
        unrealizedPnL: parseFloat(pos.unrealisedPnl ?? '0'),
        orderId: '',
        reason: 'Existing position from API',
        status: 'OPEN', // Position restored from exchange is OPEN
      };
    });
  }

  /**
   * Close position completely
   */
  async closePosition(side: PositionSide, quantity: number): Promise<void> {
    return await this.retry(async () => {
      const closeSide = side === PositionSide.LONG ? 'Sell' : 'Buy';

      const response = await this.restClient.submitOrder({
        category: 'linear',
        symbol: this.symbol,
        side: closeSide,
        orderType: 'Market',
        qty: quantity.toString(),
        positionIdx: POSITION_IDX_ONE_WAY,
        reduceOnly: true,
      });

      if (response.retCode !== BYBIT_SUCCESS_CODE) {
        throw new Error(`Failed to close position: ${response.retMsg}`);
      }

      this.logger.info('Position closed', { side, quantity, orderId: response.result.orderId });
    });
  }
}
