import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
import { MAX_FLOW_HISTORY, THRESHOLD_VALUES } from '../constants/technical.constants';
/**
 * Order Flow Analyzer Service (Phase 5)
 *
 * Analyzes order flow imbalance by tracking aggressive buy/sell activity
 * from orderbook changes.
 *
 * Logic:
 * - Aggressive Buy: Price moved UP + asks removed → buyers taking liquidity
 * - Aggressive Sell: Price moved DOWN + bids removed → sellers taking liquidity
 * - Flow Ratio: aggressive_buy_volume / aggressive_sell_volume
 * - Threshold: 3.0x (buy:sell or sell:buy)
 *
 * Detection Window: 3000ms (3 seconds)
 * Min Volume: 5000 USDT
 */

import {
  OrderFlowAnalyzerConfig,
  AggressiveFlow,
  FlowImbalance,
  SignalDirection,
  LoggerService,
  OrderBook,
  OrderbookLevel,
} from '../types';

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
  ) {
    this.logger.info('✅ OrderFlowAnalyzerService initialized', {
      aggressiveBuyThreshold: config.aggressiveBuyThreshold,
      detectionWindow: config.detectionWindow,
      minVolumeUSDT: config.minVolumeUSDT,
    });
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Process orderbook update and detect aggressive flow
   *
   * @param orderbook - Current orderbook snapshot
   */
  processOrderbookUpdate(orderbook: OrderBook): void {
    if (!this.lastOrderbook || !this.lastMidPrice) {
      // First update - just store
      this.lastOrderbook = orderbook;
      this.lastMidPrice = this.calculateMidPrice(orderbook);
      return;
    }

    const currentMidPrice = this.calculateMidPrice(orderbook);
    const priceChangePercent = ((currentMidPrice - this.lastMidPrice) / this.lastMidPrice) * PERCENT_MULTIPLIER;

    // Detect aggressive buy (price up + asks removed)
    if (priceChangePercent > THRESHOLD_VALUES.ONE_PERCENT) {
      const removedAsksVolume = this.calculateRemovedVolume(
        this.lastOrderbook.asks,
        orderbook.asks,
        'asks',
      );

      if (removedAsksVolume > 0) {
        const flow: AggressiveFlow = {
          direction: 'BUY',
          volumeUSDT: removedAsksVolume * currentMidPrice,
          timestamp: Date.now(),
          price: currentMidPrice,
        };
        this.addFlow(flow);

        this.logger.debug('🟢 Aggressive BUY detected', {
          priceChange: priceChangePercent.toFixed(DECIMAL_PLACES.STRENGTH),
          volumeRemoved: removedAsksVolume.toFixed(DECIMAL_PLACES.PERCENT),
          volumeUSDT: flow.volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
        });
      }
    }

    // Detect aggressive sell (price down + bids removed)
    if (priceChangePercent < -THRESHOLD_VALUES.ONE_PERCENT) {
      const removedBidsVolume = this.calculateRemovedVolume(
        this.lastOrderbook.bids,
        orderbook.bids,
        'bids',
      );

      if (removedBidsVolume > 0) {
        const flow: AggressiveFlow = {
          direction: 'SELL',
          volumeUSDT: removedBidsVolume * currentMidPrice,
          timestamp: Date.now(),
          price: currentMidPrice,
        };
        this.addFlow(flow);

        this.logger.debug('🔴 Aggressive SELL detected', {
          priceChange: priceChangePercent.toFixed(DECIMAL_PLACES.STRENGTH),
          volumeRemoved: removedBidsVolume.toFixed(DECIMAL_PLACES.PERCENT),
          volumeUSDT: flow.volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
        });
      }
    }

    // Update last snapshot
    this.lastOrderbook = orderbook;
    this.lastMidPrice = currentMidPrice;
  }

  /**
   * Detect flow imbalance (aggressive buy/sell ratio)
   *
   * @returns FlowImbalance if detected, null otherwise
   */
  detectFlowImbalance(): FlowImbalance | null {
    const cutoffTime = Date.now() - this.config.detectionWindow;
    const recentFlow = this.flowHistory.filter((f) => f.timestamp >= cutoffTime);

    if (recentFlow.length === 0) {
      return null;
    }

    // Calculate buy/sell volumes
    let buyVolume = 0;
    let sellVolume = 0;

    for (const flow of recentFlow) {
      if (flow.direction === 'BUY') {
        buyVolume += flow.volumeUSDT;
      } else {
        sellVolume += flow.volumeUSDT;
      }
    }

    const totalVolume = buyVolume + sellVolume;

    // Check minimum volume
    if (totalVolume < this.config.minVolumeUSDT) {
      return null;
    }

    // Calculate flow ratio
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

    // Calculate confidence (ratio-based, capped at max)
    const baseConfidence = Math.min((flowRatio / this.config.aggressiveBuyThreshold) * 70, INTEGER_MULTIPLIERS.ONE_HUNDRED);
    const volumeBoost = Math.min((totalVolume / this.config.minVolumeUSDT) * 10, 20);
    const confidence = Math.min(baseConfidence + volumeBoost, this.config.maxConfidence);

    return {
      direction,
      ratio: flowRatio,
      confidence,
      totalVolumeUSDT: totalVolume,
    };
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
   * Calculate mid price from orderbook
   * Supports both OrderbookManagerService format {price, size} and tuple format [price, qty]
   */
  private calculateMidPrice(orderbook: OrderBook): number {
    const firstBid = orderbook.bids[0];
    const firstAsk = orderbook.asks[0];
    const bestBid = (typeof firstBid === 'object' && 'price' in firstBid ? firstBid.price : firstBid?.[0] || 0) as number;
    const bestAsk = (typeof firstAsk === 'object' && 'price' in firstAsk ? firstAsk.price : firstAsk?.[0] || 0) as number;
    return (bestBid + bestAsk) / INTEGER_MULTIPLIERS.TWO;
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
