import { DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Scalping Order Flow Strategy (Phase 5)
 *
 * Scalping strategy based on order flow imbalance analysis.
 *
 * Features:
 * - Analyzes aggressive buy/sell flow from orderbook changes
 * - Detects flow imbalance (e.g., 3x more buy flow than sell)
 * - Fast scalping with ultra-tight TP/SL
 * - R/R Ratio: 2:1 (0.10% TP / 0.05% SL)
 *
 * Example:
 * - Aggressive buy flow: 9000 USDT, sell flow: 3000 USDT → 3x ratio → LONG signal
 * - Entry: 1.0000, TP: 1.0010 (+0.10%), SL: 0.9995 (-0.05%)
 */

import {
  IStrategy,
  SignalDirection,
  StrategySignal,
  SignalType,
  StrategyMarketData,
  ScalpingOrderFlowConfig,
  LoggerService,
  OrderBook,
  TakeProfit,
  OrderFlowAnalyzerService,
} from '../types';

// ============================================================================
// SCALPING ORDER FLOW STRATEGY
// ============================================================================

export class ScalpingOrderFlowStrategy implements IStrategy {
  readonly name = 'ScalpingOrderFlow';
  readonly type = SignalType.SCALPING_ORDER_FLOW;
  readonly priority: number;

  private analyzer: OrderFlowAnalyzerService;

  constructor(
    private config: ScalpingOrderFlowConfig,
    private logger: LoggerService,
  ) {
    this.priority = config.priority;

    // Initialize order flow analyzer
    this.analyzer = new OrderFlowAnalyzerService(config.analyzer, logger);

    this.logger.info('✅ ScalpingOrderFlowStrategy initialized', {
      enabled: config.enabled,
      priority: config.priority,
      aggressiveBuyThreshold: config.analyzer.aggressiveBuyThreshold,
      takeProfitPercent: config.takeProfitPercent,
      stopLossPercent: config.stopLossPercent,
    });
  }

  // ==========================================================================
  // STRATEGY INTERFACE
  // ==========================================================================

  /**
   * Evaluate strategy - detect flow imbalance
   *
   * @param data - Market data
   * @returns Signal if flow imbalance detected
   */
  async evaluate(data: StrategyMarketData): Promise<StrategySignal> {
    if (!this.config.enabled) {
      return this.noSignal('Strategy disabled');
    }

    // CRITICAL FIX: Process orderbook update before detecting imbalance
    if (data.orderbook) {
      this.analyzer.processOrderbookUpdate(data.orderbook);
    } else {
      return this.noSignal('No orderbook data available');
    }

    // Cleanup old flow data to prevent memory leak
    this.analyzer.cleanupOldFlow();

    // Detect flow imbalance
    const imbalance = this.analyzer.detectFlowImbalance();

    if (!imbalance) {
      return this.noSignal('No flow imbalance detected');
    }

    // Check minimum confidence
    if (imbalance.confidence < this.config.minConfidence) {
      return this.noSignal(
        `Flow imbalance confidence too low (${imbalance.confidence.toFixed(1)} < ${this.config.minConfidence})`,
      );
    }

    // Generate signal
    const currentPrice = data.currentPrice;

    this.logger.info('📊 Order flow imbalance signal generated!', {
      direction: imbalance.direction,
      flowRatio: imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT),
      confidence: imbalance.confidence.toFixed(1),
      volumeUSDT: imbalance.totalVolumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
    });

    return {
      valid: true,
      signal: {
        direction: imbalance.direction,
        price: currentPrice,
        stopLoss: this.calculateStopLoss(currentPrice, imbalance.direction),
        takeProfits: this.calculateTakeProfits(currentPrice, imbalance.direction),
        confidence: imbalance.confidence / PERCENT_MULTIPLIER, // ← FIX: Convert to 0-1 range
        type: this.type,
        reason: `Order flow imbalance: ${imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT)}x | Volume: ${imbalance.totalVolumeUSDT.toFixed(0)} USDT | ${imbalance.direction === SignalDirection.LONG ? 'Aggressive BUY' : 'Aggressive SELL'}`,
        timestamp: Date.now(),
      },
      strategyName: this.name,
      priority: this.priority,
      reason: `Flow imbalance detected: ${imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT)}x ratio`,
    };
  }

  // ==========================================================================
  // PUBLIC METHODS (for external orderbook feeding)
  // ==========================================================================

  /**
   * Feed orderbook updates to analyzer (from websocket/external source)
   *
   * @param orderbook - Orderbook snapshot
   */
  feedOrderbookUpdate(orderbook: OrderBook): void {
    this.analyzer.processOrderbookUpdate(orderbook);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Calculate stop loss price
   *
   * @param entryPrice - Entry price
   * @param direction - Signal direction
   * @returns Stop loss price
   */
  private calculateStopLoss(entryPrice: number, direction: SignalDirection): number {
    if (direction === SignalDirection.LONG) {
      // LONG: SL below entry
      return entryPrice * (1 - this.config.stopLossPercent / PERCENT_MULTIPLIER);
    } else {
      // SHORT: SL above entry
      return entryPrice * (1 + this.config.stopLossPercent / PERCENT_MULTIPLIER);
    }
  }

  /**
   * Calculate take profit levels
   *
   * @param entryPrice - Entry price
   * @param direction - Signal direction
   * @returns Array of TP levels
   */
  private calculateTakeProfits(
    entryPrice: number,
    direction: SignalDirection,
  ): TakeProfit[] {
    const tpPrice =
      direction === SignalDirection.LONG
        ? entryPrice * (1 + this.config.takeProfitPercent / PERCENT_MULTIPLIER) // LONG: TP above entry
        : entryPrice * (1 - this.config.takeProfitPercent / PERCENT_MULTIPLIER); // SHORT: TP below entry

    return [
      {
        level: 1,
        percent: this.config.takeProfitPercent,
        sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Single TP (100% close)
        price: tpPrice,
        hit: false,
      },
    ];
  }

  /**
   * Return no signal
   */
  private noSignal(reason: string): StrategySignal {
    return {
      valid: false,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }

  /**
   * Check if strategy is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get analyzer instance (for testing)
   */
  getAnalyzer(): OrderFlowAnalyzerService {
    return this.analyzer;
  }
}
