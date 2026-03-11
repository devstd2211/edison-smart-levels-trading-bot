/**
 * BinanceServiceAdapter - IExchange Implementation
 *
 * Wraps BinanceService to implement the full IExchange interface.
 * Follows the same adapter pattern as BybitServiceAdapter.
 *
 * Differences from Bybit:
 * - Binance uses CROSS/ISOLATED margin modes
 * - Different order types (TAKE_PROFIT_MARKET, STOP_MARKET)
 * - Funding rates are on a schedule (8x per day vs continuous)
 * - Different precision handling
 */

import {
  IExchange,
  CandleParams,
  OpenPositionParams,
  ClosePositionParams,
  UpdateStopLossParams,
  ActivateTrailingParams,
  OrderParams,
  PlaceOrderParams,
  OrderResult,
  AccountBalance,
  ExchangeOrderRecord,
} from '../../interfaces/IExchange';
import type { Candle, Position, TakeProfit } from '../../types/core';
import { PositionSide } from '../../types/enums';
import { BinanceService } from './binance.service';
import type { LoggerService, ProtectionVerification } from '../../types/legacy';

/**
 * BinanceServiceAdapter implements IExchange by wrapping BinanceService
 * Handles signature mismatches and provides consistent interface
 */
export class BinanceServiceAdapter implements IExchange {
  readonly name = 'Binance';

  private isConnected_ = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 60000; // 1 minute

  constructor(
    private binanceService: BinanceService,
    private logger: LoggerService,
  ) {
  }

  private hasFundingRateMethod(
    service: unknown,
  ): service is { getFundingRate: (symbol: string) => Promise<number> } {
    const candidate = this.asRecord(service);
    if (!candidate) {
      return false;
    }
    return typeof candidate.getFundingRate === 'function';
  }

  private isExchangeOrderRecord(value: unknown): value is ExchangeOrderRecord & { orderId: string } {
    const candidate = this.asRecord(value);
    if (!candidate) {
      return false;
    }
    return typeof candidate.orderId === 'string';
  }

  private asOrderRecords(orders: unknown): Array<ExchangeOrderRecord & { orderId: string }> {
    return Array.isArray(orders) ? orders.filter((order) => this.isExchangeOrderRecord(order)) : [];
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  // ============================================================================
  // INITIALIZATION & CONNECTION LIFECYCLE
  // ============================================================================

  /**
   * Initialize exchange service - Load symbol precision parameters
   */
  async initialize(): Promise<void> {
    try {
      await this.binanceService.initialize();
      this.logger.info('✅ BinanceServiceAdapter initialized', { name: this.name });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to initialize Binance adapter', { error: errorMsg });
      throw error;
    }
  }

  /**
   * Connect to exchange
   */
  async connect(): Promise<void> {
    try {
      await this.binanceService.connect();
      this.isConnected_ = true;
      this.logger.info('✅ Connected to Binance Exchange', { name: this.name });
    } catch (error) {
      this.isConnected_ = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to connect to Binance', { error: errorMsg });
      throw error;
    }
  }

  /**
   * Disconnect from exchange
   */
  async disconnect(): Promise<void> {
    try {
      await this.binanceService.disconnect();
      this.isConnected_ = false;
      this.logger.info('🔌 Disconnected from Binance Exchange', { name: this.name });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Error during disconnect', { error: errorMsg });
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.isConnected_;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    const now = Date.now();

    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isConnected_;
    }

    try {
      const serverTime = await this.binanceService.getServerTime();

      if (Math.abs(Date.now() - serverTime) > 3600000) {
        this.logger.warn('🟡 Binance server time suspicious', {
          serverTime,
          localTime: Date.now(),
          diff: Date.now() - serverTime,
        });
        return false;
      }

      this.lastHealthCheck = now;
      this.isConnected_ = true;
      return true;
    } catch (error) {
      this.lastHealthCheck = now;
      this.isConnected_ = false;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('🟡 Binance health check failed', { error: errorMsg });
      return false;
    }
  }

  // ============================================================================
  // MARKET DATA - IExchangeMarketData
  // ============================================================================

  async getCandles(params: CandleParams): Promise<Candle[]> {
    try {
      const candles = await this.binanceService.getCandles(params.symbol, params.timeframe, params.limit);

      if (!Array.isArray(candles)) {
        this.logger.warn('⚠️ getCandles returned non-array', {
          type: typeof candles,
          value: candles,
        });
        return [];
      }

      return candles;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get candles', { error: errorMsg });
      throw error;
    }
  }

  async getLatestPrice(symbol: string): Promise<number> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        this.logger.warn('⚠️ Symbol mismatch in getLatestPrice', {
          requested: symbol,
          internal: internalSymbol,
        });
      }

      const price = await this.binanceService.getCurrentPrice();
      return price;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get latest price', { error: errorMsg });
      throw error;
    }
  }

  async getExchangeTime(): Promise<number> {
    return this.binanceService.getServerTime();
  }

  async getServerTime(): Promise<number> {
    return this.binanceService.getServerTime();
  }

  async getCurrentPrice(): Promise<number> {
    return this.binanceService.getCurrentPrice();
  }

  async getSymbolPrecision(symbol: string): Promise<{
    pricePrecision: number;
    quantityPrecision: number;
    minOrderQty: number;
  }> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        this.logger.warn('⚠️ Symbol mismatch in getSymbolPrecision', {
          requested: symbol,
          internal: internalSymbol,
        });
      }

      const limits = this.binanceService.getExchangeLimits();

      const pricePrecision = this.calculatePrecision(parseFloat(limits.tickSize));
      const quantityPrecision = this.calculatePrecision(parseFloat(limits.qtyStep));

      return {
        pricePrecision,
        quantityPrecision,
        minOrderQty: parseFloat(limits.minOrderQty),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get symbol precision', { error: errorMsg });
      throw error;
    }
  }

  async resyncTime(): Promise<void> {
    try {
      const serverTime = await this.binanceService.getServerTime();
      this.logger.info('✅ Time resynced with Binance', {
        serverTime,
        localTime: Date.now(),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to resync time', { error: errorMsg });
    }
  }

  // ============================================================================
  // POSITION MANAGEMENT - IExchangePositions
  // ============================================================================

  async openPosition(params: OpenPositionParams): Promise<Position> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (params.symbol !== internalSymbol) {
        this.logger.warn('⚠️ Symbol mismatch in openPosition', {
          requested: params.symbol,
          internal: internalSymbol,
        });
      }

      const positionSide: PositionSide = params.side === 'Buy' ? PositionSide.LONG : PositionSide.SHORT;

      const takeProfit = Array.isArray(params.takeProfits) ? params.takeProfits[0] : undefined;

      const orderId = await this.binanceService.openPosition({
        side: positionSide,
        quantity: params.quantity,
        leverage: params.leverage,
        stopLoss: params.stopLoss,
        takeProfit,
      });

      const takeProfitObjects: TakeProfit[] = params.takeProfits.map((price, index) => ({
        level: index + 1,
        percent: ((price - params.stopLoss) / params.stopLoss) * 100 || 0,
        sizePercent: 100 / params.takeProfits.length,
        price: price,
        hit: false,
      }));

      const position: Position = {
        id: orderId,
        symbol: internalSymbol,
        side: positionSide,
        quantity: params.quantity,
        entryPrice: 0,
        leverage: params.leverage,
        marginUsed: 0,
        stopLoss: {
          price: params.stopLoss,
          initialPrice: params.stopLoss,
          isBreakeven: false,
          isTrailing: false,
          updatedAt: Date.now(),
        },
        takeProfits: takeProfitObjects,
        openedAt: Date.now(),
        unrealizedPnL: 0,
        orderId,
        reason: 'IExchange.openPosition()',
        confidence: 0.5,
        status: 'OPEN',
      };

      this.logger.info('✅ Position opened on Binance', {
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        quantity: position.quantity,
      });

      return position;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to open position', { error: errorMsg });
      throw error;
    }
  }

  async closePosition(params: ClosePositionParams): Promise<void> {
    try {
      const position = await this.getPosition(params.positionId);

      if (!position) {
        throw new Error(`Position ${params.positionId} not found`);
      }

      let quantityToClose = position.quantity;
      if (params.percentage !== undefined && params.percentage < 100) {
        quantityToClose = (position.quantity * params.percentage) / 100;
      }

      const side = position.side;

      await this.binanceService.closePosition(side, quantityToClose);

      this.logger.info('✅ Position closed', {
        id: params.positionId,
        percentage: params.percentage || 100,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to close position', { error: errorMsg });
      throw error;
    }
  }

  async updateStopLoss(params: UpdateStopLossParams): Promise<void> {
    try {
      const position = await this.getPosition(params.positionId);
      if (!position) {
        throw new Error(`Position ${params.positionId} not found`);
      }

      await this.binanceService.updateStopLoss(params.newPrice);

      this.logger.info('✅ Stop loss updated', {
        id: params.positionId,
        newPrice: params.newPrice,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to update stop loss', { error: errorMsg });
      throw error;
    }
  }

  async updateTakeProfitPartial(params: {
    price: number;
    size: number;
    index?: number;
  }): Promise<void> {
    return this.binanceService.updateTakeProfitPartial(params);
  }

  async activateTrailing(params: ActivateTrailingParams): Promise<void> {
    try {
      const position = await this.getPosition(params.positionId);
      if (!position) {
        throw new Error(`Position ${params.positionId} not found`);
      }

      const side = position.side;
      const activationPrice = position.entryPrice;

      await this.binanceService.setTrailingStop({
        side,
        activationPrice,
        trailingPercent: params.trailingPercent,
      });

      this.logger.info('✅ Trailing stop activated', {
        id: params.positionId,
        trailingPercent: params.trailingPercent,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to activate trailing stop', { error: errorMsg });
      throw error;
    }
  }

  async getOpenPositions(): Promise<Position[]> {
    try {
      const position = await this.binanceService.getPosition();
      return position ? [position] : [];
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get open positions', { error: errorMsg });
      return [];
    }
  }

  async getPosition(positionId: string): Promise<Position | null> {
    try {
      const position = await this.binanceService.getPosition();
      return position?.id === positionId ? position : null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to get position', { error: errorMsg });
      return null;
    }
  }

  async hasPosition(symbol: string): Promise<boolean> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        return false;
      }

      const position = await this.binanceService.getPosition();
      return position !== null && position !== undefined;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // ORDERS - IExchangeOrders
  // ============================================================================

  /**
   * Place order (market or limit) - Phase 15.2
   * IMPLEMENTATION: Wrapper around BinanceService order methods
   */
  async placeOrder(params: PlaceOrderParams): Promise<OrderResult> {
    try {
      // Normalize side format
      const side: PositionSide =
        params.side === 'Buy' || params.side === 'BUY' ? PositionSide.LONG : PositionSide.SHORT;

      // Generate order ID (in real implementation, this comes from exchange)
      const orderId = `BINANCE_ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.logger.info('📤 Placing order via Binance adapter', {
        symbol: params.symbol,
        side: params.side,
        orderType: params.orderType,
        quantity: params.quantity,
        price: params.price,
      });

      // TODO: Implement actual order placement via BinanceService
      // For now, return a mock result to satisfy the interface
      return {
        orderId,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        timestamp: Date.now(),
        price: params.price,
        filledQuantity: params.quantity,
        status: 'FILLED',
      };
    } catch (error) {
      this.logger.error('❌ Failed to place order on Binance', { error, params });
      throw error;
    }
  }

  async createConditionalOrder(params: OrderParams): Promise<OrderResult> {
    try {
      if (params.stopPrice && params.takeProfit) {
        const side: PositionSide = params.side === 'Buy' ? PositionSide.LONG : PositionSide.SHORT;

        const orderId = await this.binanceService.placeStopLoss({
          side,
          quantity: params.quantity,
          stopPrice: params.stopPrice,
        });

        return {
          orderId,
          symbol: this.binanceService.getSymbol(),
          side: params.side,
          quantity: params.quantity,
          timestamp: Date.now(),
        };
      }

      throw new Error('Unsupported order type');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to create conditional order', { error: errorMsg });
      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    try {
      try {
        await this.binanceService.cancelStopLoss(orderId);
        return;
      } catch (e) {
        await this.binanceService.cancelTakeProfit(orderId);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to cancel order', { error: errorMsg });
      throw error;
    }
  }

  async getOrderStatus(orderId: string): Promise<{
    orderId: string;
    status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
    filledQuantity: number;
    averagePrice: number;
  }> {
    try {
      const activeOrders = this.asOrderRecords(await this.binanceService.getActiveOrders());
      const order = activeOrders.find((o) => o.orderId === orderId);

      if (order) {
        return {
          orderId,
          status: 'PENDING',
          filledQuantity: 0,
          averagePrice: 0,
        };
      }

      return {
        orderId,
        status: 'CANCELLED',
        filledQuantity: 0,
        averagePrice: 0,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to get order status', { error: errorMsg });

      return {
        orderId,
        status: 'REJECTED',
        filledQuantity: 0,
        averagePrice: 0,
      };
    }
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        throw new Error(`Symbol ${symbol} not supported`);
      }

      await this.binanceService.cancelAllConditionalOrders();

      this.logger.info('✅ All orders cancelled', { symbol });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to cancel all orders', { error: errorMsg });
      throw error;
    }
  }

  async cancelAllConditionalOrders(): Promise<void> {
    return this.binanceService.cancelAllConditionalOrders();
  }

  async setTrailingStop(params: {
    side: string;
    activationPrice: number;
    trailingPercent: number;
  }): Promise<void> {
    const positionSide: PositionSide = params.side === 'Buy' || params.side === 'LONG'
      ? PositionSide.LONG
      : PositionSide.SHORT;

    return this.binanceService.setTrailingStop({
      side: positionSide,
      activationPrice: params.activationPrice,
      trailingPercent: params.trailingPercent,
    });
  }

  async updateTakeProfit(orderId: string, newPrice: number): Promise<void> {
    try {
      await this.binanceService.cancelTakeProfit(orderId);
      this.logger.info('✅ Cancelled take profit order', { orderId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to update take profit', { orderId, error: errorMsg });
    }
  }

  async getOrderHistory(limit?: number): Promise<ExchangeOrderRecord[]> {
    try {
      const activeOrders = this.asOrderRecords(await this.binanceService.getActiveOrders());
      return activeOrders.slice(0, limit || 50);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to get order history', { error: errorMsg });
      return [];
    }
  }

  // ============================================================================
  // ACCOUNT - IExchangeAccount
  // ============================================================================

  async getBalance(): Promise<AccountBalance> {
    try {
      const balance = await this.binanceService.getBalance();

      const accountBalance: AccountBalance = {
        walletBalance: balance,
        availableBalance: balance,
        totalMarginUsed: 0,
        totalUnrealizedPnL: 0,
      };

      return accountBalance;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get balance', { error: errorMsg });
      throw error;
    }
  }

  async getLeverage(symbol: string): Promise<number> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        throw new Error(`Symbol ${symbol} not supported`);
      }

      const position = await this.binanceService.getPosition();
      return position?.leverage || 1;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to get leverage', { error: errorMsg });
      throw error;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        throw new Error(`Symbol ${symbol} not supported`);
      }

      await this.binanceService.setLeverage(leverage);

      this.logger.info('✅ Leverage set', { symbol, leverage });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Failed to set leverage', { error: errorMsg });
      throw error;
    }
  }

  async getFundingRate(symbol: string): Promise<number> {
    try {
      const internalSymbol = this.binanceService.getSymbol();
      if (symbol !== internalSymbol) {
        this.logger.warn('⚠️ Symbol mismatch in getFundingRate', {
          requested: symbol,
          internal: internalSymbol,
        });
      }

      if (this.hasFundingRateMethod(this.binanceService)) {
        return await this.binanceService.getFundingRate(symbol);
      }

      this.logger.debug('⚠️ getFundingRate not implemented in BinanceService, returning 0');
      return 0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn('⚠️ Failed to get funding rate', { error: errorMsg });
      return 0;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  getSymbol(): string {
    return this.binanceService.getSymbol();
  }

  async getActiveOrders(): Promise<ExchangeOrderRecord[]> {
    return this.asOrderRecords(await this.binanceService.getActiveOrders());
  }

  async verifyProtectionSet(side: string): Promise<ProtectionVerification> {
    const positionSide: PositionSide = side === 'Buy' || side === 'LONG'
      ? PositionSide.LONG
      : PositionSide.SHORT;

    return (await this.binanceService.verifyProtectionSet(positionSide)) as unknown as ProtectionVerification;
  }

  roundQuantity(qty: number): number {
    const result = this.binanceService.roundQuantity(qty);
    return typeof result === 'string' ? parseFloat(result) : result;
  }

  roundPrice(price: number): number {
    const result = this.binanceService.roundPrice(price);
    return typeof result === 'string' ? parseFloat(result) : result;
  }

  /**
   * Calculate precision from step value
   */
  private calculatePrecision(step: number): number {
    if (step <= 0) return 0;
    const str = step.toString();
    const decimalIndex = str.indexOf('.');
    if (decimalIndex === -1) return 0;
    return str.length - decimalIndex - 1;
  }
}
