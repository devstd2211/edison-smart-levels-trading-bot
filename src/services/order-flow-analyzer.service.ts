import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
import { MAX_FLOW_HISTORY, THRESHOLD_VALUES } from '../constants/technical.constants';
/**
 * Order Flow Analyzer Service (Phase 8.9.48)
 *
 * Analyzes order flow imbalance by tracking aggressive buy/sell activity
 * from orderbook changes with ErrorHandler integration.
 *
 * Logic:
 * - Aggressive Buy: Price moved UP + asks removed → buyers taking liquidity
 * - Aggressive Sell: Price moved DOWN + bids removed → sellers taking liquidity
 * - Flow Ratio: aggressive_buy_volume / aggressive_sell_volume
 * - Threshold: 3.0x (buy:sell or sell:buy)
 *
 * Detection Window: 3000ms (3 seconds)
 * Min Volume: 5000 USDT
 *
 * Error Handling:
 * - THROW: Config validation (invalid thresholds, windows, volumes)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN prices, division errors)
 * - SKIP: Logger failures (non-blocking)
 */

import {
  OrderFlowAnalyzerConfig,
  AggressiveFlow,
  FlowImbalance,
  SignalDirection,
  LoggerService,
  OrderBook,
  OrderbookLevel,
} from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

// ============================================================================
// CONSTANTS
// ============================================================================

// MAX_FLOW_HISTORY imported from technical.constants (max aggressive flow events)
// PRICE_MOVE_THRESHOLD = THRESHOLD_VALUES.ONE_PERCENT (0.01% price change detection)

// ============================================================================
// ORDER FLOW ANALYZER SERVICE
// ============================================================================

export class OrderFlowAnalyzerService {
  private flowHistory: AggressiveFlow[] = [];
  private lastOrderbook: OrderBook | null = null;
  private lastMidPrice: number | null = null;

  constructor(
    private config: OrderFlowAnalyzerConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // Validate config (THROW on invalid values)
    this.validateConfig(config);

    this.safeLog('info', '✅ OrderFlowAnalyzerService initialized', {
      aggressiveBuyThreshold: config.aggressiveBuyThreshold,
      detectionWindow: config.detectionWindow,
      minVolumeUSDT: config.minVolumeUSDT,
    });
  }

  // ==========================================================================
  // VALIDATION & HELPERS
  // ==========================================================================

  /**
   * Validate configuration (THROW strategy)
   */
  private validateConfig(config: OrderFlowAnalyzerConfig): void {
    if (!config) {
      throw new Error('OrderFlowAnalyzerService: Config is required');
    }

    if (!Number.isFinite(config.aggressiveBuyThreshold) || config.aggressiveBuyThreshold <= 0) {
      throw new Error(
        `OrderFlowAnalyzerService: Invalid aggressiveBuyThreshold: ${config.aggressiveBuyThreshold} (must be positive number)`,
      );
    }

    if (!Number.isFinite(config.detectionWindow) || config.detectionWindow <= 0) {
      throw new Error(`OrderFlowAnalyzerService: Invalid detectionWindow: ${config.detectionWindow} (must be positive number)`);
    }

    if (!Number.isFinite(config.minVolumeUSDT) || config.minVolumeUSDT < 0) {
      throw new Error(`OrderFlowAnalyzerService: Invalid minVolumeUSDT: ${config.minVolumeUSDT} (must be non-negative number)`);
    }

    if (!Number.isFinite(config.maxConfidence) || config.maxConfidence <= 0 || config.maxConfidence > 100) {
      throw new Error(`OrderFlowAnalyzerService: Invalid maxConfidence: ${config.maxConfidence} (must be 0-100)`);
    }
  }

  /**
   * Safe logging with SKIP strategy for logger failures (non-blocking)
   */
  private safeLog(level: 'info' | 'debug' | 'warn' | 'error', message: string, meta?: any): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // SKIP: Non-critical logging failure (never block service operation)
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Process orderbook update and detect aggressive flow (GRACEFUL_DEGRADE on calc errors)
   *
   * @param orderbook - Current orderbook snapshot
   */
  processOrderbookUpdate(orderbook: OrderBook): void {
    // Validate input (THROW on invalid orderbook)
    if (!orderbook || !Array.isArray(orderbook.bids) || !Array.isArray(orderbook.asks)) {
      throw new Error('OrderFlowAnalyzerService: Invalid orderbook (missing bids/asks)');
    }

    if (!this.lastOrderbook || !this.lastMidPrice) {
      // First update - just store
      this.lastOrderbook = orderbook;
      this.lastMidPrice = this.calculateMidPrice(orderbook);
      return;
    }

    try {
      const currentMidPrice = this.calculateMidPrice(orderbook);

      // Validate price calculation (GRACEFUL_DEGRADE on NaN/Infinity)
      if (!Number.isFinite(currentMidPrice) || !Number.isFinite(this.lastMidPrice!)) {
        if (this.errorHandler) {
          this.errorHandler.handle(new Error('Invalid price in orderbook'), {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          });
        }
        return;
      }

      const priceChangePercent = ((currentMidPrice - this.lastMidPrice) / this.lastMidPrice) * PERCENT_MULTIPLIER;

      // Detect aggressive buy (price up + asks removed)
      if (priceChangePercent > THRESHOLD_VALUES.ONE_PERCENT) {
        const removedAsksVolume = this.calculateRemovedVolume(this.lastOrderbook.asks, orderbook.asks, 'asks');

        if (removedAsksVolume > 0 && Number.isFinite(removedAsksVolume)) {
          const flowVolume = removedAsksVolume * currentMidPrice;
          if (Number.isFinite(flowVolume)) {
            const flow: AggressiveFlow = {
              direction: 'BUY',
              volumeUSDT: flowVolume,
              timestamp: Date.now(),
              price: currentMidPrice,
            };
            this.addFlow(flow);

            this.safeLog('debug', '🟢 Aggressive BUY detected', {
              priceChange: priceChangePercent.toFixed(DECIMAL_PLACES.STRENGTH),
              volumeRemoved: removedAsksVolume.toFixed(DECIMAL_PLACES.PERCENT),
              volumeUSDT: flowVolume.toFixed(DECIMAL_PLACES.PERCENT),
            });
          }
        }
      }

      // Detect aggressive sell (price down + bids removed)
      if (priceChangePercent < -THRESHOLD_VALUES.ONE_PERCENT) {
        const removedBidsVolume = this.calculateRemovedVolume(this.lastOrderbook.bids, orderbook.bids, 'bids');

        if (removedBidsVolume > 0 && Number.isFinite(removedBidsVolume)) {
          const flowVolume = removedBidsVolume * currentMidPrice;
          if (Number.isFinite(flowVolume)) {
            const flow: AggressiveFlow = {
              direction: 'SELL',
              volumeUSDT: flowVolume,
              timestamp: Date.now(),
              price: currentMidPrice,
            };
            this.addFlow(flow);

            this.safeLog('debug', '🔴 Aggressive SELL detected', {
              priceChange: priceChangePercent.toFixed(DECIMAL_PLACES.STRENGTH),
              volumeRemoved: removedBidsVolume.toFixed(DECIMAL_PLACES.PERCENT),
              volumeUSDT: flowVolume.toFixed(DECIMAL_PLACES.PERCENT),
            });
          }
        }
      }

      // Update last snapshot
      this.lastOrderbook = orderbook;
      this.lastMidPrice = currentMidPrice;
    } catch (error) {
      // GRACEFUL_DEGRADE: Continue with last known state on processing error
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      // Silently continue - keep last orderbook state
    }
  }

  /**
   * Detect flow imbalance (aggressive buy/sell ratio) with GRACEFUL_DEGRADE on calc errors
   *
   * @returns FlowImbalance if detected, null otherwise
   */
  detectFlowImbalance(): FlowImbalance | null {
    try {
      const cutoffTime = Date.now() - this.config.detectionWindow;
      const recentFlow = this.flowHistory.filter((f) => f.timestamp >= cutoffTime);

      if (recentFlow.length === 0) {
        return null;
      }

      // Calculate buy/sell volumes with NaN validation
      let buyVolume = 0;
      let sellVolume = 0;

      for (const flow of recentFlow) {
        if (!Number.isFinite(flow.volumeUSDT)) {
          if (this.errorHandler) {
            this.errorHandler.handle(new Error(`Invalid flow volume: ${flow.volumeUSDT}`), {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            });
          }
          continue;
        }

        if (flow.direction === 'BUY') {
          buyVolume += flow.volumeUSDT;
        } else {
          sellVolume += flow.volumeUSDT;
        }
      }

      const totalVolume = buyVolume + sellVolume;

      // Validate total volume calculation
      if (!Number.isFinite(totalVolume)) {
        if (this.errorHandler) {
          this.errorHandler.handle(new Error('Invalid total volume calculation'), {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          });
        }
        return null;
      }

      // Check minimum volume
      if (totalVolume < this.config.minVolumeUSDT) {
        return null;
      }

      // Calculate flow ratio with division by zero protection
      let flowRatio: number;
      let direction: SignalDirection;

      if (sellVolume === 0) {
        // Only buy flow
        flowRatio = buyVolume > 0 ? 999 : MULTIPLIERS.NEUTRAL;
        direction = SignalDirection.LONG;
      } else if (buyVolume === 0) {
        // Only sell flow
        flowRatio = 999;
        direction = SignalDirection.SHORT;
      } else {
        const buyToSellRatio = buyVolume / sellVolume;
        const sellToBuyRatio = sellVolume / buyVolume;

        if (!Number.isFinite(buyToSellRatio) || !Number.isFinite(sellToBuyRatio)) {
          if (this.errorHandler) {
            this.errorHandler.handle(new Error('Invalid flow ratio calculation'), {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            });
          }
          return null;
        }

        if (buyToSellRatio >= this.config.aggressiveBuyThreshold) {
          // Aggressive buy dominance
          flowRatio = buyToSellRatio;
          direction = SignalDirection.LONG;
        } else if (sellToBuyRatio >= this.config.aggressiveBuyThreshold) {
          // Aggressive sell dominance
          flowRatio = sellToBuyRatio;
          direction = SignalDirection.SHORT;
        } else {
          // No clear imbalance
          return null;
        }
      }

      // Calculate confidence (ratio-based, capped at max) with error handling
      try {
        const baseConfidence = Math.min((flowRatio / this.config.aggressiveBuyThreshold) * 70, INTEGER_MULTIPLIERS.ONE_HUNDRED);
        const volumeBoost = this.config.minVolumeUSDT > 0 ? Math.min((totalVolume / this.config.minVolumeUSDT) * 10, 20) : 0;
        const confidence = Math.min(baseConfidence + volumeBoost, this.config.maxConfidence);

        if (!Number.isFinite(confidence)) {
          if (this.errorHandler) {
            this.errorHandler.handle(new Error('Invalid confidence calculation'), {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            });
          }
          return null;
        }

        return {
          direction,
          ratio: flowRatio,
          confidence,
          totalVolumeUSDT: totalVolume,
        };
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error as Error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          });
        }
        return null;
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Return null on any unexpected error
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      return null;
    }
  }

  /**
   * Calculate flow ratio (for testing/debugging)
   *
   * @param windowMs - Time window (default: config.detectionWindow)
   * @returns Flow ratio (buy/sell or sell/buy)
   */
  calculateFlowRatio(windowMs: number = this.config.detectionWindow): number {
    const cutoffTime = Date.now() - windowMs;
    const recentFlow = this.flowHistory.filter((f) => f.timestamp >= cutoffTime);

    if (recentFlow.length === 0) {
      return 1.0; // Neutral
    }

    let buyVolume = 0;
    let sellVolume = 0;

    for (const flow of recentFlow) {
      if (flow.direction === 'BUY') {
        buyVolume += flow.volumeUSDT;
      } else {
        sellVolume += flow.volumeUSDT;
      }
    }

    if (sellVolume === 0) {
      return buyVolume > 0 ? 999 : MULTIPLIERS.NEUTRAL;
    }
    if (buyVolume === 0) {
      return 0.001;
    }

    return buyVolume / sellVolume;
  }

  /**
   * Cleanup old flow data (beyond 2x detection window)
   */
  cleanupOldFlow(): void {
    const cutoffTime = Date.now() - this.config.detectionWindow * INTEGER_MULTIPLIERS.TWO;
    this.flowHistory = this.flowHistory.filter((f) => f.timestamp >= cutoffTime);
  }

  /**
   * Clear all flow history (for testing)
   */
  clearHistory(): void {
    this.flowHistory = [];
    this.lastOrderbook = null;
    this.lastMidPrice = null;
  }

  /**
   * Get flow history (for testing)
   */
  getFlowHistory(): AggressiveFlow[] {
    return this.flowHistory;
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  /**
   * Add aggressive flow event to history
   */
  private addFlow(flow: AggressiveFlow): void {
    this.flowHistory.push(flow);

    // Limit history size
    if (this.flowHistory.length > MAX_FLOW_HISTORY) {
      this.flowHistory.shift();
    }
  }

  /**
   * Calculate mid price from orderbook with NaN validation (GRACEFUL_DEGRADE on invalid prices)
   * Supports both OrderbookManagerService format {price, size} and tuple format [price, qty]
   */
  private calculateMidPrice(orderbook: OrderBook): number {
    try {
      const firstBid = orderbook.bids[0];
      const firstAsk = orderbook.asks[0];
      const bestBid = (typeof firstBid === 'object' && 'price' in firstBid ? firstBid.price : firstBid?.[0] || 0) as number;
      const bestAsk = (typeof firstAsk === 'object' && 'price' in firstAsk ? firstAsk.price : firstAsk?.[0] || 0) as number;

      if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk)) {
        throw new Error(`Invalid prices in orderbook: bid=${bestBid}, ask=${bestAsk}`);
      }

      const midPrice = (bestBid + bestAsk) / INTEGER_MULTIPLIERS.TWO;
      if (!Number.isFinite(midPrice)) {
        throw new Error(`Mid price calculation resulted in NaN: ${midPrice}`);
      }

      return midPrice;
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        });
      }
      // Return last known price or 0 as fallback
      return this.lastMidPrice || 0;
    }
  }

  /**
   * Calculate volume removed from orderbook side
   *
   * Compares old and new orderbook to find removed volume
   * Supports both OrderbookManagerService format {price, size} and tuple format [price, qty]
   *
   * @param oldSide - Old orderbook side (bids or asks)
   * @param newSide - New orderbook side
   * @param side - 'bids' or 'asks'
   * @returns Total volume removed
   */
  private calculateRemovedVolume(
    oldSide: OrderbookLevel[],
    newSide: OrderbookLevel[],
    side: 'bids' | 'asks',
  ): number {
    // Helper to extract price and size from OrderbookLevel union type
    const getPrice = (level: OrderbookLevel): number => {
      return typeof level === 'object' && 'price' in level ? level.price : level[0];
    };
    const getSize = (level: OrderbookLevel): number => {
      return typeof level === 'object' && 'size' in level ? level.size : level[1];
    };

    // Build map of new prices → sizes
    const newPriceMap = new Map<number, number>();
    for (const level of newSide) {
      const price = getPrice(level);
      const size = getSize(level);
      newPriceMap.set(price, size);
    }

    let removedVolume = 0;

    // Check old levels that disappeared or reduced
    for (const oldLevel of oldSide) {
      const oldPrice = getPrice(oldLevel);
      const oldSize = getSize(oldLevel);
      const newSize = newPriceMap.get(oldPrice) || 0;

      if (newSize < oldSize) {
        // Volume was removed
        removedVolume += oldSize - newSize;
      }
    }

    return removedVolume;
  }
}
