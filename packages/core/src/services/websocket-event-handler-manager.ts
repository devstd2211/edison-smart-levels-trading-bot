import { DECIMAL_PLACES, INTEGER_MULTIPLIERS } from '../constants';
import {
  Candle,
  TimeframeRole,
  OrderBook,
  OrderbookUpdateEvent,
  StopLossHitEvent,
  TakeProfitHitEvent,
  TimeBasedExitEvent,
  TradeTickEvent,
  Position,
  OrderFilledEvent,
  StopLossFilledEvent,
  TakeProfitFilledEvent,
  Config,
} from '../types/legacy';
import type { IWebSocketEventHandlerServices } from '../interfaces';
import { RealTimeWhaleDetector } from './realtime-whale-detector';
import { type OrderbookUpdate } from './orderbook-manager.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { OrderValidationError } from '../errors/DomainErrors';
import { getErrorMessage } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

/**
 * WebSocket Event Handler Manager
 *
 * Manages all WebSocket event handlers for:
 * - Position Monitor events (stopLoss, takeProfit, etc.)
 * - Private WebSocket events (orders, positions)
 * - Public WebSocket events (candles, orderbook, trades)
 *
 * This extracts 200+ lines of event handling logic from TradingBot,
 * keeping the bot class focused on orchestration.
 */
export class WebSocketEventHandlerManager {
  private logger: IWebSocketEventHandlerServices['coreServices']['logger'];
  private lastOrderbookAnalysis: number = 0;
  private whaleDetector: RealTimeWhaleDetector;

  // Track event listeners for cleanup
  private eventListeners: Array<{
    emitter: { on(event: string, listener: (data?: unknown) => void): void; off(event: string, listener: (data?: unknown) => void): void };
    event: string;
    handler: (data?: unknown) => void;
  }> = [];

  constructor(private services: IWebSocketEventHandlerServices, private config: Config) {
    this.logger = services.coreServices.logger;
    this.whaleDetector = new RealTimeWhaleDetector({
      logger: services.coreServices.logger,
      tradingOrchestrator: services.executionServices.tradingOrchestrator,
    }, config);
  }

  /**
   * Validate candle data for required fields and valid values
   * @private
   */
  private validateCandleData(candle: Candle | undefined | null): boolean {
    if (!candle) return false;
    if (typeof candle.close !== 'number' || isNaN(candle.close) || candle.close <= 0) return false;
    if (typeof candle.timestamp !== 'number' || candle.timestamp <= 0) return false;
    return true;
  }

  /**
   * Validate orderbook data for required structure and valid values
   * Handles both snapshot (full orderbook) and delta (partial updates)
   * @private
   */
  private validateOrderbookData(update: unknown): boolean {
    if (!update) return false;
    const candidate = update as Partial<OrderbookUpdateEvent>;

    // Both bids and asks must exist as arrays (but can be empty for delta updates)
    if (!Array.isArray(candidate.bids)) return false;
    if (!Array.isArray(candidate.asks)) return false;

    // For delta updates, at least ONE of bids or asks must have data
    if (candidate.bids.length === 0 && candidate.asks.length === 0) return false;

    // Validate first bid if present
    if (candidate.bids.length > 0) {
      const firstBid = candidate.bids[0];
      if (!Array.isArray(firstBid) || firstBid.length < 2) return false;
      const bidPrice = parseFloat(String(firstBid[0]));
      if (isNaN(bidPrice) || bidPrice <= 0) return false;
    }

    // Validate first ask if present
    if (candidate.asks.length > 0) {
      const firstAsk = candidate.asks[0];
      if (!Array.isArray(firstAsk) || firstAsk.length < 2) return false;
      const askPrice = parseFloat(String(firstAsk[0]));
      if (isNaN(askPrice) || askPrice <= 0) return false;
    }

    return true;
  }

  /**
   * Validate trade data for required fields and valid values
   * @private
   */
  private validateTradeData(trade: unknown): boolean {
    if (!trade) return false;
    const candidate = trade as Partial<TradeTickEvent>;
    if (typeof candidate.price !== 'number' || isNaN(candidate.price) || candidate.price <= 0) return false;
    if (typeof candidate.quantity !== 'number' || isNaN(candidate.quantity) || candidate.quantity <= 0) return false;
    if (!candidate.side || (candidate.side !== 'Buy' && candidate.side !== 'Sell' && candidate.side !== 'BUY' && candidate.side !== 'SELL')) return false;
    if (typeof candidate.timestamp !== 'number' || candidate.timestamp <= 0) return false;
    return true;
  }

  private skipInvalidPublicPayload(params: {
    message: string;
    context: string;
    warnMessage: string;
    metadata: ConstructorParameters<typeof OrderValidationError>[1];
  }): void {
    void ErrorHandler.handle(
      new OrderValidationError(params.message, params.metadata),
      {
        strategy: RecoveryStrategy.SKIP,
        logger: this.logger,
        context: params.context,
        onRecover: () => {
          this.logger.warn(params.warnMessage);
        },
      }
    );
  }

  /**
   * Register all WebSocket and Position Monitor event handlers
   * Called from TradingBot.start() after WebSocket connections
   *
   */
  registerAllHandlers(): void {
    this.registerPositionMonitorHandlers();
    this.registerPrivateWebSocketHandlers();
    this.registerPublicWebSocketHandlers();

    this.logger.debug(
      `${ICONS.success} Registered ${this.eventListeners.length} event handlers (Position Monitor + WebSockets)`,
    );
  }

  /**
   * Clean up all tracked event listeners to prevent memory leaks
   */
  cleanupAllListeners(): void {
    const count = this.eventListeners.length;
    for (const listener of this.eventListeners) {
      listener.emitter.off(listener.event, listener.handler);
    }
    this.eventListeners = [];
    this.logger.debug(`${ICONS.success} Cleaned up ${count} event listeners`);
  }

  /**
   * Private: Register Position Monitor event handlers
   */
  private registerPositionMonitorHandlers(): void {
    const { positionEventHandler } = this.services.eventHandlerServices;
    const { positionMonitor } = this.services.executionServices;

    // Position Monitor Events
    this.registerListener(positionMonitor, 'stopLossHit', (event) => {
      void positionEventHandler.handleStopLossHit(event as StopLossHitEvent);
    });

    this.registerListener(positionMonitor, 'takeProfitHit', (event) => {
      void positionEventHandler.handleTakeProfitHit(event as TakeProfitHitEvent);
    });

    this.registerListener(positionMonitor, 'positionClosedExternally', (position) => {
      void positionEventHandler.handlePositionClosedExternally(position as Position);
    });

    this.registerListener(positionMonitor, 'timeBasedExit', (event) => {
      void positionEventHandler.handleTimeBasedExit(event as TimeBasedExitEvent);
    });

    this.registerListener(positionMonitor, 'error', (error) => {
      void positionEventHandler.handleMonitorError(error as Error);
    });

    this.logger.debug(`${ICONS.success} Position Monitor handlers registered`);
  }

  /**
   * Private: Register Private WebSocket event handlers
   */
  private registerPrivateWebSocketHandlers(): void {
    const { webSocketEventHandler } = this.services.eventHandlerServices;
    const { webSocketManager } = this.services.marketDataServices;

    // WebSocket Events
    this.registerListener(webSocketManager, 'positionUpdate', (position) => {
      void webSocketEventHandler.handlePositionUpdate(position as Position);
    });

    this.registerListener(webSocketManager, 'positionClosed', () => {
      void webSocketEventHandler.handlePositionClosed();
    });

    this.registerListener(webSocketManager, 'orderFilled', (order) => {
      void webSocketEventHandler.handleOrderFilled(order as OrderFilledEvent);
    });

    this.registerListener(webSocketManager, 'takeProfitFilled', (event) => {
      void webSocketEventHandler.handleTakeProfitFilled(event as TakeProfitFilledEvent);
    });

    this.registerListener(webSocketManager, 'stopLossFilled', (event) => {
      void webSocketEventHandler.handleStopLossFilled(event as StopLossFilledEvent);
    });

    this.registerListener(webSocketManager, 'error', (error) => {
      void webSocketEventHandler.handleError(error as Error);
    });

    this.logger.debug(`${ICONS.success} Private WebSocket handlers registered`);
  }

  /**
   * Private: Register Public WebSocket event handlers
   */
  private registerPublicWebSocketHandlers(): void {
    const { tradingOrchestrator } = this.services.executionServices;
    const { publicWebSocket, orderbookManager, candleProvider } =
      this.services.marketDataServices;

    // Candle closed - update cache and trigger trading cycle
    this.registerListener(
      publicWebSocket,
      'candleClosed',
      async (payload) => {
        const data = payload as { role?: TimeframeRole; candle?: Candle };
        const role = data.role ?? TimeframeRole.PRIMARY;
        const candle = data.candle;
        // Validate candle data
        if (!this.validateCandleData(candle)) {
          this.skipInvalidPublicPayload({
            message: 'Invalid candle data from WebSocket',
            context: 'WebSocketEventHandlerManager.handleCandleClosed',
            warnMessage: `${ICONS.warning} Invalid candle data, skipping update`,
            metadata: {
              field: 'candle',
              value: candle?.close || 0,
              reason: 'Missing close price or timestamp',
              role,
              hasClose: candle?.close !== undefined,
              hasTimestamp: candle?.timestamp !== undefined,
            }
          });
          return; // SKIP
        }

        const safeCandle = candle as Candle;

        this.logger.info(`${ICONS.chart} Candle closed`, {
          role,
          timestamp: new Date(safeCandle.timestamp).toISOString(),
          close: safeCandle.close,
        });

        try {
          // Update candle cache for this timeframe
          candleProvider.onCandleClosed(role, safeCandle);

          // Log cache metrics
          const metrics = candleProvider.getCacheMetrics(role);
          if (metrics) {
            this.logger.debug(`Cache metrics for ${role}`, {
              hits: metrics.hits,
              misses: metrics.misses,
              hitRate: `${(metrics.hitRate * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(DECIMAL_PLACES.PERCENT)}%`,
            });
          }

          // [Phase 10.2] Route to StrategyOrchestrator if multi-strategy mode is enabled
          // Otherwise use TradingOrchestrator for single-strategy mode
          if (this.services.strategyOrchestrator) {
            // Multi-strategy mode: route only to active strategy
            await this.services.strategyOrchestrator.onCandleClosed(role, safeCandle);
          } else {
            // Single-strategy mode: use legacy flow
            await tradingOrchestrator.onCandleClosed(role, safeCandle);
          }
        } catch (error) {
          await ErrorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            logger: this.logger,
            context: 'WebSocketEventHandlerManager.handleCandleClosed',
            onRecover: () => {
              this.logger.warn(`${ICONS.warning} Candle processing failed, skipping`, { role });
            },
          });
        }
      },
    );

    // WebSocket connected
    this.registerListener(publicWebSocket, 'connected', () => {
      this.logger.info('Public WebSocket connected successfully');
    });

    // WebSocket disconnected
    this.registerListener(publicWebSocket, 'disconnected', () => {
      this.logger.warn('Public WebSocket disconnected');
    });

    // Orderbook update
    this.registerListener(publicWebSocket, 'orderbookUpdate', (update) => {
      this.handleOrderbookUpdate(update as OrderbookUpdateEvent);
    });

    // Trade update
    this.registerListener(publicWebSocket, 'trade', (trade) => {
      this.handleTradeUpdate(trade as TradeTickEvent);
    });

    // WebSocket errors
    this.registerListener(publicWebSocket, 'error', (error) => {
      this.logger.error('Public WebSocket error', { error: getErrorMessage(error) });
    });

    this.logger.debug(`${ICONS.success} Public WebSocket handlers registered`);
  }

  /**
   * Private: Handle orderbook update event
   */
  private handleOrderbookUpdate(update: unknown): void {
    // Validate orderbook data
    if (!this.validateOrderbookData(update)) {
      const candidate = update as Partial<OrderbookUpdateEvent>;
      this.skipInvalidPublicPayload({
        message: 'Invalid orderbook data from WebSocket',
        context: 'WebSocketEventHandlerManager.handleOrderbookUpdate',
        warnMessage: `${ICONS.warning} Invalid orderbook data, skipping update`,
        metadata: {
          field: 'orderbook',
          value: 0,
          reason: 'Invalid bids/asks structure',
          hasBids: Array.isArray(candidate.bids),
          hasAsks: Array.isArray(candidate.asks),
        },
      });
      return; // SKIP
    }

    try {
      // Convert OrderbookUpdateEvent to OrderbookUpdate for processing
      const orderbookEvent = update as OrderbookUpdateEvent;
      const orderbookUpdate: OrderbookUpdate = {
        type: orderbookEvent.type || 'delta',
        bids: (orderbookEvent.bids || []).map((b) => [String(b[0]), String(b[1])]),
        asks: (orderbookEvent.asks || []).map((a) => [String(a[0]), String(a[1])]),
        updateId: orderbookEvent.updateId || 0,
        timestamp: orderbookEvent.timestamp || Date.now(),
      };

      // OrderbookManager ALWAYS maintains the snapshot (no throttling)
      this.services.marketDataServices.orderbookManager.processUpdate(orderbookUpdate);

      // THROTTLE analysis to avoid CPU overload
      const now = Date.now();
      const orderbookThrottle = this.config.dataSubscriptions.orderbook.updateIntervalMs;
      if (now - this.lastOrderbookAnalysis < orderbookThrottle) {
        return; // Skip analysis, too soon
      }

      this.lastOrderbookAnalysis = now;

      // Get full snapshot and pass to whale detector
      const snapshot = this.services.marketDataServices.orderbookManager.getSnapshot();
      if (snapshot) {
        // Analyze orderbook imbalance
        if (this.services.orderbookImbalanceService) {
          this.services.orderbookImbalanceService.analyze({
            bids: snapshot.bids.map((b) => [b.price, b.size] as [number, number]),
            asks: snapshot.asks.map((a) => [a.price, a.size] as [number, number]),
          });
        }

        // Phase 10.1: Feed orderbook snapshot to Advanced Order Flow Service
        if (this.services.advancedOrderFlowService) {
          this.services.advancedOrderFlowService.processOrderbook({
            bids: snapshot.bids.map((b) => [b.price, b.size]),
            asks: snapshot.asks.map((a) => [a.price, a.size]),
          });
        }

        const orderbookSnapshot: OrderBook = {
          symbol: orderbookEvent.symbol || this.config.exchange.symbol,
          bids: snapshot.bids,
          asks: snapshot.asks,
          timestamp: snapshot.timestamp,
          updateId: snapshot.updateId,
        };

        this.services.executionServices.tradingOrchestrator.onOrderbookUpdate(orderbookSnapshot);

        // Check for whale signals in real-time (throttled via RealTimeWhaleDetector)
        void this.whaleDetector.checkWhaleSignalRealtime(orderbookSnapshot);

      }
    } catch (error) {
      this.logger.error('Error handling orderbook update', {
        error,
        errorMessage: getErrorMessage(error),
      });
    }
  }

  /**
   * Private: Handle trade update event
   */
  private handleTradeUpdate(trade: unknown): void {
    // Validate trade data
    if (!this.validateTradeData(trade)) {
      const candidate = trade as Partial<TradeTickEvent>;
      this.skipInvalidPublicPayload({
        message: 'Invalid trade tick data from WebSocket',
        context: 'WebSocketEventHandlerManager.handleTradeUpdate',
        warnMessage: `${ICONS.warning} Invalid trade data, skipping update`,
        metadata: {
          field: 'trade',
          value: 0,
          reason: 'Invalid price, quantity, or side',
          hasPrice: typeof candidate.price === 'number',
          hasQuantity: typeof candidate.quantity === 'number',
        },
      });
      return; // SKIP
    }

    try {
      // Normalize side
      const tradeEvent = trade as TradeTickEvent;
      const normalizedSide = tradeEvent.side === 'Buy' || tradeEvent.side === 'BUY' ? 'BUY' : 'SELL';

      if (this.services.deltaAnalyzerService) {
        this.services.deltaAnalyzerService.addTick({
          timestamp: tradeEvent.timestamp,
          price: tradeEvent.price,
          quantity: tradeEvent.quantity,
          side: normalizedSide as 'BUY' | 'SELL',
        });
      }

      // Phase 10.1: Feed ticks to Advanced Order Flow Service
      if (this.services.advancedOrderFlowService) {
        this.services.advancedOrderFlowService.addTick({
          timestamp: tradeEvent.timestamp,
          price: tradeEvent.price,
          size: tradeEvent.quantity,
          side: normalizedSide as 'BUY' | 'SELL',
        });
      }

      // REMOVED: Legacy strategy-based tick feeding
      // New architecture uses JSON-based strategies loaded at startup
    } catch (error) {
      this.logger.error('Error handling trade update', {
        error,
        errorMessage: getErrorMessage(error),
      });
    }
  }

  /**
   * Private: Register event listener with tracking for cleanup
   */
  private registerListener(
    emitter: { on(event: string, listener: (data?: unknown) => void): void; off(event: string, listener: (data?: unknown) => void): void },
    event: string,
    handler: (data?: unknown) => void,
  ): void {
    emitter.on(event, handler);
    this.eventListeners.push({ emitter, event, handler });
  }
}

