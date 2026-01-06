import { DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, MULTIPLIERS, PERCENT_MULTIPLIER, SIGNAL_CONSTANTS } from '../constants';
/**
 * Whale Hunter FOLLOW Strategy
 *
 * Philosophy: Trade WITH the whale (not against momentum)
 *
 * Uses WhaleDetectorFollowService with inverted WALL_BREAK logic:
 * - BID wall broken → SHORT (whale sold = distribution)
 * - ASK wall broken → LONG (whale bought = accumulation)
 *
 * Risk Management:
 * - Small position size (high risk)
 * - Tight stop-loss (whales can deceive)
 * - Quick take-profit (exit before whale changes mind)
 * - Time-based exit (if no movement in 30s)
 *
 * IMPORTANT: Requires frequent order book updates!
 * - WebSocket orderbook stream recommended
 * - REST API polling should be < 5 seconds
 */

import {
  IStrategy,
  StrategySignal,
  StrategyMarketData,
  SignalDirection,
  SignalType,
  LoggerService,
  WhaleHunterConfig,
  TakeProfit,
  OrderBookAnalysis,
  OrderbookLevel,
  WhaleDetectionService,
  OrderBookAnalyzer,
} from '../types';
import { WhaleSignal, WhaleDetectionMode } from '../services/whale-detection.service';
import { SessionDetector } from '../utils/session-detector';

// ============================================================================
// WHALE HUNTER STRATEGY
// ============================================================================

export class WhaleHunterFollowStrategy implements IStrategy {
  readonly name = 'WHALE_HUNTER_FOLLOW';
  readonly priority: number;

  private lastTradeTime: number = 0;
  private consecutiveSignals: number = 0;
  private lastSignalMode: WhaleDetectionMode | null = null;

  constructor(
    private config: WhaleHunterConfig,
    private whaleDetector: WhaleDetectionService,
    private orderbookAnalyzer: OrderBookAnalyzer,
    private logger: LoggerService,
  ) {
    this.priority = config.priority;
  }

  /**
   * Evaluate whale hunter strategy
   *
   * @param marketData - Market data (must include orderbook)
   * @returns Strategy signal
   */
  async evaluate(marketData: StrategyMarketData): Promise<StrategySignal> {
    // Check if strategy is enabled
    if (!this.config.enabled) {
      return this.noSignal('Strategy disabled');
    }

    // Check cooldown (avoid over-trading)
    if (this.isInCooldown()) {
      return this.noSignal('In cooldown period');
    }

    // Check if we have order book data
    if (!marketData.orderbook) {
      this.logger.warn('WhaleHunterStrategy: No orderbook data available');
      return this.noSignal('No orderbook data');
    }

    // Analyze order book
    const currentPrice = marketData.candles[marketData.candles.length - 1].close;

    // Convert OrderBook to OrderBookData format
    // Handle both tuple format [price, size] and object format {price, size}
    const getPrice = (level: OrderbookLevel): number => {
      return typeof level === 'object' && 'price' in level ? level.price : level[0];
    };
    const getSize = (level: OrderbookLevel): number => {
      return typeof level === 'object' && 'size' in level ? level.size : level[1];
    };

    const bids = marketData.orderbook.bids.map((b: OrderbookLevel) => ({
      price: getPrice(b),
      size: getSize(b),
    }));

    const asks = marketData.orderbook.asks.map((a: OrderbookLevel) => ({
      price: getPrice(a),
      size: getSize(a),
    }));

    const orderbookData = {
      bids,
      asks,
      timestamp: marketData.orderbook.timestamp,
    };

    const orderbookAnalysis = this.orderbookAnalyzer.analyze(orderbookData, currentPrice);

    // Detect whale activity
    const whaleSignal = this.whaleDetector.detectWhale(orderbookAnalysis, currentPrice);

    // Check if whale detected
    if (!whaleSignal.detected) {
      this.resetConsecutiveSignals();
      return this.noSignal('No whale detected');
    }

    // Check confidence threshold
    if (whaleSignal.confidence < this.config.minConfidence) {
      this.logger.debug('WhaleHunterStrategy: Confidence too low', {
        confidence: whaleSignal.confidence,
        threshold: this.config.minConfidence,
      });
      this.resetConsecutiveSignals();
      return this.noSignal(`Confidence too low: ${whaleSignal.confidence}`);
    }

    // Track consecutive signals
    this.trackConsecutiveSignals(whaleSignal);

    // Check if we need multiple signals
    if (this.config.requireMultipleSignals && this.consecutiveSignals < SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS) {
      this.logger.debug('WhaleHunterStrategy: Waiting for consecutive signal', {
        current: this.consecutiveSignals,
        required: SIGNAL_CONSTANTS.MIN_CONSECUTIVE_SIGNALS,
      });
      return this.noSignal('Waiting for consecutive signal');
    }

    // WHALE SIGNAL CONFIRMED - Generate strategy signal
    const strategySignal = this.generateStrategySignal(whaleSignal, marketData, orderbookAnalysis);

    // Mark trade time for cooldown
    this.lastTradeTime = Date.now();
    this.resetConsecutiveSignals();

    return strategySignal;
  }

  // ==========================================================================
  // PRIVATE METHODS - Signal Generation
  // ==========================================================================

  /**
   * Generate strategy signal from whale signal
   */
  private generateStrategySignal(
    whaleSignal: WhaleSignal,
    marketData: StrategyMarketData,
    orderbookAnalysis: OrderBookAnalysis,
  ): StrategySignal {
    const currentCandle = marketData.candles[marketData.candles.length - 1];
    const currentPrice = currentCandle.close;

    // Calculate risk/reward based on whale mode
    const { stopLossPercent, takeProfitPercent } = this.calculateRiskReward(whaleSignal.mode!);

    // Calculate entry, SL prices
    const direction = whaleSignal.direction!;
    const entryPrice = currentPrice;

    // Calculate base SL distance
    let stopLossDistance = entryPrice * (stopLossPercent / PERCENT_MULTIPLIER);

    // Apply session-based SL widening if enabled
    stopLossDistance = SessionDetector.applySessionBasedSL(
      stopLossDistance,
      this.config.sessionBasedSL,
      this.logger,
      this.name,
    );

    const stopLoss =
      direction === SignalDirection.LONG
        ? entryPrice - stopLossDistance
        : entryPrice + stopLossDistance;

    // Single TP for whale scalping (100% exit)
    const takeProfit =
      direction === SignalDirection.LONG
        ? entryPrice * (1 + takeProfitPercent / PERCENT_MULTIPLIER)
        : entryPrice * (1 - takeProfitPercent / PERCENT_MULTIPLIER);

    let takeProfits: TakeProfit[] = [
      {
        level: 1,
        percent: takeProfitPercent,
        sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Exit full position at TP1
        price: takeProfit,
        hit: false,
      },
    ];

    this.logger.debug('🎯 Whale Hunter Follow: Single TP mode', {
      mode: whaleSignal.mode,
      tpPercent: `${takeProfitPercent.toFixed(DECIMAL_PLACES.PERCENT)}%`,
      tpPrice: takeProfit.toFixed(DECIMAL_PLACES.PRICE),
    });

    // Apply dynamic TP multiplier based on market conditions
    const dynamicMultiplier = this.calculateDynamicTPMultiplier(orderbookAnalysis, marketData);
    if (dynamicMultiplier > 1.0) {
      takeProfits = takeProfits.map((tp) => {
        const adjustedPercent = tp.percent * dynamicMultiplier;
        const adjustedPrice =
          direction === SignalDirection.LONG
            ? entryPrice * (1 + adjustedPercent / PERCENT_MULTIPLIER)
            : entryPrice * (1 - adjustedPercent / PERCENT_MULTIPLIER);

        return {
          ...tp,
          percent: adjustedPercent,
          price: adjustedPrice,
        };
      });

      this.logger.info('🎯 Dynamic TP applied', {
        multiplier: dynamicMultiplier.toFixed(DECIMAL_PLACES.PERCENT),
        adjustedLevels: takeProfits.map(tp => `${tp.percent.toFixed(DECIMAL_PLACES.PERCENT)}%`),
      });
    }

    const signal = {
      type: SignalType.WHALE_HUNTER_FOLLOW,
      direction,
      price: entryPrice,
      confidence: whaleSignal.confidence / PERCENT_MULTIPLIER, // Convert to 0-1 range
      reason: `🐋 WHALE FOLLOW [${whaleSignal.mode}]: ${whaleSignal.reason}`,
      timestamp: Date.now(),
      entryPrice,
      stopLoss,
      takeProfits,
      marketData: {
        rsi: marketData.rsi,
        rsiTrend1: marketData.rsiTrend1,
        ema20: marketData.ema.fast,
        ema50: marketData.ema.slow,
        atr: marketData.atr || 1.0,
        trend: marketData.trend,
        whaleMode: whaleSignal.mode ?? undefined,
        wallSize: orderbookAnalysis.walls.length > 0
          ? Math.max(...orderbookAnalysis.walls.map(w => w.quantity))
          : undefined,
        imbalance: orderbookAnalysis.imbalance.ratio,
        stochastic: marketData.stochastic,
        bollingerBands: marketData.bollingerBands,
        breakoutPrediction: marketData.breakoutPrediction,
      },
    };

    return {
      valid: true,
      signal,
      strategyName: this.name,
      priority: this.priority,
      reason: signal.reason,
    };
  }

  /**
   * Calculate dynamic TP multiplier based on market conditions
   *
   * @param orderbookAnalysis - Current orderbook analysis
   * @param marketData - Market data (for ATR)
   * @returns Combined TP multiplier (1.0 = no adjustment)
   */
  private calculateDynamicTPMultiplier(
    orderbookAnalysis: OrderBookAnalysis,
    marketData: StrategyMarketData,
  ): number {
    // Check if dynamic TP is enabled
    if (!this.config.dynamicTakeProfit?.enabled) {
      return 1.0;
    }

    let multiplier = MULTIPLIERS.NEUTRAL;

    // 1. Wall size-based adjustment
    if (this.config.dynamicTakeProfit.wallSizeBased.enabled) {
      const wallThreshold = this.config.dynamicTakeProfit.wallSizeBased.threshold;
      const wallMultiplier = this.config.dynamicTakeProfit.wallSizeBased.multiplier;

      // Find largest wall (bid or ask) by percentOfTotal
      const maxWallSize = orderbookAnalysis.walls.length > 0
        ? Math.max(...orderbookAnalysis.walls.map(w => w.percentOfTotal))
        : 0;

      if (maxWallSize > wallThreshold) {
        multiplier *= wallMultiplier;
        this.logger.debug('📊 Dynamic TP: Wall size triggered', {
          wallSize: maxWallSize.toFixed(1),
          threshold: wallThreshold,
          multiplier: wallMultiplier,
        });
      }
    }

    // 2. ATR-based adjustment
    if (this.config.dynamicTakeProfit.atrBased.enabled && marketData.atr) {
      const atrThreshold = this.config.dynamicTakeProfit.atrBased.threshold;
      const atrMultiplier = this.config.dynamicTakeProfit.atrBased.multiplier;

      // Calculate ATR as percentage of current price
      const currentPrice = marketData.candles[marketData.candles.length - 1].close;
      const atrPercent = (marketData.atr / currentPrice) * PERCENT_MULTIPLIER;

      if (atrPercent > atrThreshold) {
        multiplier *= atrMultiplier;
        this.logger.debug('📊 Dynamic TP: ATR volatility triggered', {
          atrPercent: atrPercent.toFixed(DECIMAL_PLACES.PERCENT),
          threshold: atrThreshold,
          multiplier: atrMultiplier,
        });
      }
    }

    if (multiplier > 1.0) {
      this.logger.info('🎯 Dynamic TP multiplier activated', {
        totalMultiplier: multiplier.toFixed(DECIMAL_PLACES.PERCENT),
      });
    }

    return multiplier;
  }

  /**
   * Calculate risk/reward ratios based on whale detection mode
   *
   * Different modes have different reliability:
   * - IMBALANCE_SPIKE: Tight SL/TP (quick momentum play)
   * - WALL_BREAK: Medium SL/TP (breakout play)
   * - WALL_DISAPPEARANCE: Wider SL/TP (reversal play)
   */
  private calculateRiskReward(mode: WhaleDetectionMode): {
    stopLossPercent: number;
    takeProfitPercent: number;
  } {
    switch (mode) {
    case WhaleDetectionMode.IMBALANCE_SPIKE:
      return {
        stopLossPercent: MULTIPLIERS.HALF, // 0.5% SL (very tight)
        takeProfitPercent: MULTIPLIERS.THREE_QUARTER, // 0.75% TP (quick profit)
      };

    case WhaleDetectionMode.WALL_BREAK:
      return {
        stopLossPercent: MULTIPLIERS.HALF, // 0.8% SL (medium)
        takeProfitPercent: MULTIPLIERS.THREE_QUARTER, // 1.2% TP (medium profit)
      };

    case WhaleDetectionMode.WALL_DISAPPEARANCE:
      return {
        stopLossPercent: MULTIPLIERS.NEUTRAL, // 1.0% SL (wider)
        takeProfitPercent: MULTIPLIERS.ONE_AND_HALF, // 1.5% TP (larger profit)
      };

    default:
      return {
        stopLossPercent: MULTIPLIERS.ZERO_EIGHT,
        takeProfitPercent: MULTIPLIERS.THREE_QUARTER,
      };
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Signal Tracking
  // ==========================================================================

  /**
   * Track consecutive whale signals (same mode)
   */
  private trackConsecutiveSignals(whaleSignal: WhaleSignal): void {
    if (this.lastSignalMode === whaleSignal.mode) {
      this.consecutiveSignals++;
    } else {
      this.consecutiveSignals = 1;
      this.lastSignalMode = whaleSignal.mode;
    }
  }

  /**
   * Reset consecutive signals counter
   */
  private resetConsecutiveSignals(): void {
    this.consecutiveSignals = 0;
    this.lastSignalMode = null;
  }

  /**
   * Check if strategy is in cooldown period
   */
  private isInCooldown(): boolean {
    if (this.lastTradeTime === 0) {
      return false;
    }

    const timeSinceLastTrade = Date.now() - this.lastTradeTime;
    return timeSinceLastTrade < this.config.cooldownMs;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Get strategy statistics
   */
  getStats(): {
    name: string;
    enabled: boolean;
    priority: number;
    inCooldown: boolean;
    whaleDetectorStats: ReturnType<WhaleDetectionService['getStats']>;
    } {
    return {
      name: this.name,
      enabled: this.config.enabled,
      priority: this.priority,
      inCooldown: this.isInCooldown(),
      whaleDetectorStats: this.whaleDetector.getStats(),
    };
  }

  /**
   * Reset strategy state (useful for testing)
   */
  reset(): void {
    this.lastTradeTime = 0;
    this.resetConsecutiveSignals();
    this.whaleDetector.clear();
    this.logger.debug('WhaleHunterStrategy reset');
  }

  /**
   * Return no signal result
   */
  private noSignal(reason: string): StrategySignal {
    return {
      valid: false,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }
}
