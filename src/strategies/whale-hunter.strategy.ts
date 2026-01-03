import { CONFIDENCE_BOUNDS, DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, MATH_OPS, MULTIPLIERS, PERCENT_MULTIPLIER, RISK_THRESHOLDS, SIGNAL_CONSTANTS } from '../constants';
/**
 * Whale Hunter Strategy
 *
 * Aggressive strategy that rides with whale movements detected in order book.
 *
 * Uses WhaleDetectorService with 3 detection modes:
 * - IMBALANCE_SPIKE: Highest priority (immediate momentum)
 * - WALL_BREAK: Medium priority (breakout momentum)
 * - WALL_DISAPPEARANCE: Lowest priority (reversal play)
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
  WhaleDetectorService,
  OrderBookAnalyzer,
  WallTrackerService,
} from '../types';
import { WhaleSignal, WhaleDetectionMode } from '../services/whale-detector.service';
import { SessionDetector } from '../utils/session-detector';

// ============================================================================
// WHALE HUNTER STRATEGY
// ============================================================================

export class WhaleHunterStrategy implements IStrategy {
  readonly name = 'WHALE_HUNTER';
  readonly priority: number;

  private lastTradeTime: number = 0;
  private consecutiveSignals: number = 0;
  private lastSignalMode: WhaleDetectionMode | null = null;

  constructor(
    private config: WhaleHunterConfig,
    private whaleDetector: WhaleDetectorService,
    private orderbookAnalyzer: OrderBookAnalyzer,
    private logger: LoggerService,
    private wallTracker?: WallTrackerService,
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

    // Extract BTC data for trend-aware filtering (if available)
    const btcMomentum = marketData.context?.btcAnalysis?.momentum;
    const btcDirection = marketData.context?.btcAnalysis?.direction;

    // Detect whale activity (pass BTC data for trend-aware logic)
    const whaleSignal = this.whaleDetector.detectWhale(
      orderbookAnalysis,
      currentPrice,
      btcMomentum,
      btcDirection,
    );

    // Check if whale detected
    if (!whaleSignal.detected) {
      this.resetConsecutiveSignals();
      return this.noSignal('No whale detected');
    }

    // Check if LONG/SHORT enabled
    if (whaleSignal.direction === SignalDirection.LONG && this.config.enableLong === false) {
      this.logger.info('❌ WhaleHunter BLOCKED', {
        blockedBy: ['LONG_DISABLED'],
        reason: 'LONG trades disabled in config',
        direction: 'LONG',
      });
      this.resetConsecutiveSignals();
      return this.noSignal('LONG trades disabled');
    }

    if (whaleSignal.direction === SignalDirection.SHORT && this.config.enableShort === false) {
      this.logger.info('❌ WhaleHunter BLOCKED', {
        blockedBy: ['SHORT_DISABLED'],
        reason: 'SHORT trades disabled in config',
        direction: 'SHORT',
      });
      this.resetConsecutiveSignals();
      return this.noSignal('SHORT trades disabled');
    }

    // Check confidence threshold (direction-specific)
    const minConfidenceThreshold =
      whaleSignal.direction === SignalDirection.LONG
        ? this.config.minConfidenceLong ?? this.config.minConfidence
        : this.config.minConfidenceShort ?? this.config.minConfidence;

    if (whaleSignal.confidence < minConfidenceThreshold) {
      this.logger.debug('WhaleHunterStrategy: Confidence too low', {
        confidence: whaleSignal.confidence,
        threshold: minConfidenceThreshold,
        direction: whaleSignal.direction,
      });
      this.resetConsecutiveSignals();
      return this.noSignal(
        `Confidence too low: ${whaleSignal.confidence} < ${minConfidenceThreshold} (${whaleSignal.direction})`,
      );
    }

    // Check ATR volatility threshold (block signals during extreme volatility)
    if (this.config.maxAtrPercent && marketData.context?.atrPercent) {
      const atrPercent = marketData.context.atrPercent;
      if (atrPercent > this.config.maxAtrPercent) {
        this.logger.info('❌ WhaleHunter BLOCKED', {
          blockedBy: ['HIGH_ATR_VOLATILITY'],
          reason: `ATR volatility too high: ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}% > ${this.config.maxAtrPercent}%`,
          atrPercent: atrPercent.toFixed(DECIMAL_PLACES.PERCENT),
          threshold: this.config.maxAtrPercent,
          whaleMode: whaleSignal.mode,
        });
        this.resetConsecutiveSignals();
        return this.noSignal(`ATR volatility too high: ${atrPercent.toFixed(DECIMAL_PLACES.PERCENT)}%`);
      }
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

    // Block LONG trades in downtrend (if enabled)
    if (
      this.config.blockLongInDowntrend &&
      whaleSignal.direction === SignalDirection.LONG &&
      marketData.trend === 'BEARISH'
    ) {
      this.logger.info('❌ WhaleHunter BLOCKED', {
        blockedBy: ['LONG_IN_DOWNTREND'],
        reason: 'LONG signal blocked due to downtrend',
        direction: 'LONG',
        trend: marketData.trend,
        whaleMode: whaleSignal.mode,
      });
      this.resetConsecutiveSignals();
      return this.noSignal('LONG blocked in downtrend');
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
    const { stopLossPercent, takeProfitPercent: baseTakeProfitPercent } = this.calculateRiskReward(whaleSignal.mode!);

    // Determine final TP percent based on config and trend
    let takeProfitPercent = baseTakeProfitPercent;

    // Use config.takeProfitPercent if set (overrides mode-based values)
    if (this.config.takeProfitPercent !== undefined) {
      takeProfitPercent = this.config.takeProfitPercent;
    }

    // Use conservative TP for LONG trades in downtrend (if configured)
    if (
      this.config.takeProfitPercentLongDowntrend !== undefined &&
      whaleSignal.direction === SignalDirection.LONG &&
      marketData.trend === 'BEARISH'
    ) {
      takeProfitPercent = this.config.takeProfitPercentLongDowntrend;
      this.logger.info('🎯 Using conservative TP for LONG in downtrend', {
        normalTP: this.config.takeProfitPercent || baseTakeProfitPercent,
        conservativeTP: takeProfitPercent,
        trend: marketData.trend,
      });
    }

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

    this.logger.debug('🎯 Whale Hunter: Single TP mode', {
      mode: whaleSignal.mode,
      tpPercent: `${takeProfitPercent.toFixed(DECIMAL_PLACES.PERCENT)}%`,
      tpPrice: takeProfit.toFixed(DECIMAL_PLACES.PRICE),
    });

    // Apply dynamic TP multiplier based on market conditions
    const dynamicMultiplier = this.calculateDynamicTPMultiplier(orderbookAnalysis, marketData);
    if (dynamicMultiplier > 1.0) {
      takeProfits = takeProfits.map((tp) => {
        let adjustedPercent = tp.percent * dynamicMultiplier;

        // Apply maxTPPercent cap if configured
        if (this.config.dynamicTakeProfit?.maxTPPercent !== undefined) {
          const maxTP = this.config.dynamicTakeProfit.maxTPPercent;
          if (adjustedPercent > maxTP) {
            this.logger.info('⚠️ TP capped by maxTPPercent', {
              originalTP: adjustedPercent.toFixed(DECIMAL_PLACES.PERCENT),
              cappedTP: maxTP.toFixed(DECIMAL_PLACES.PERCENT),
              cap: `${maxTP}%`,
            });
            adjustedPercent = maxTP;
          }
        }

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

    // Apply WallTracker confidence adjustments (if available)
    let finalConfidence = whaleSignal.confidence;
    if (this.wallTracker && orderbookAnalysis.walls.length > 0) {
      const confidenceAdjustment = this.applyWallTrackingAdjustment(
        orderbookAnalysis,
        direction,
        currentPrice,
      );
      finalConfidence = Math.max(CONFIDENCE_BOUNDS.MINIMUM, Math.min(CONFIDENCE_BOUNDS.MAXIMUM, whaleSignal.confidence * confidenceAdjustment));

      if (confidenceAdjustment !== MATH_OPS.ONE) {
        this.logger.info('🧱 WallTracker confidence adjustment', {
          original: whaleSignal.confidence,
          adjusted: finalConfidence.toFixed(1),
          multiplier: confidenceAdjustment.toFixed(DECIMAL_PLACES.PERCENT),
        });
      }
    }

    const signal = {
      type: SignalType.WHALE_HUNTER,
      direction,
      price: entryPrice,
      confidence: finalConfidence / PERCENT_MULTIPLIER, // Convert to 0-1 range
      reason: `🐋 WHALE [${whaleSignal.mode}]: ${whaleSignal.reason}`,
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
        takeProfitPercent: MULTIPLIERS.THREE_QUARTER, // RISK_THRESHOLDS.SL_MODERATE% TP (medium profit)
      };

    case WhaleDetectionMode.WALL_DISAPPEARANCE:
      return {
        stopLossPercent: MULTIPLIERS.NEUTRAL, // 1.0% SL (wider)
        takeProfitPercent: RISK_THRESHOLDS.SL_CONSERVATIVE, // RISK_THRESHOLDS.SL_CONSERVATIVE% TP (larger profit)
      };

    default:
      return {
        stopLossPercent: MULTIPLIERS.ZERO_EIGHT,
        takeProfitPercent: MULTIPLIERS.THREE_QUARTER,
      };
    }
  }

  /**
   * Apply WallTracker confidence adjustments
   * Returns multiplier for confidence (e.g., RISK_THRESHOLDS.TP_SCALP = reduce by 70%, 1.3 = boost by 30%)
   */
  private applyWallTrackingAdjustment(
    orderbookAnalysis: OrderBookAnalysis,
    direction: SignalDirection,
    currentPrice: number,
  ): number {
    if (!this.wallTracker) {
      return 1.0;
    }

    let multiplier = MULTIPLIERS.NEUTRAL;

    // Find the largest wall in the direction of the trade
    // LONG = look for BID walls (support), SHORT = look for ASK walls (resistance)
    const relevantWalls = orderbookAnalysis.walls.filter((w) =>
      direction === SignalDirection.LONG ? w.side === 'BID' : w.side === 'ASK',
    );

    if (relevantWalls.length === 0) {
      return 1.0;
    }

    // Get the largest wall
    const largestWall = relevantWalls.reduce((max, wall) =>
      wall.percentOfTotal > max.percentOfTotal ? wall : max,
    );

    const side = largestWall.side; // Already 'BID' or 'ASK'
    const wallPrice = largestWall.price;

    // 1. Filter spoofing - heavily penalize
    if (!this.wallTracker.isWallReal(wallPrice, side)) {
      this.logger.debug('🚫 WallTracker: Spoofing detected', {
        price: wallPrice.toFixed(DECIMAL_PLACES.PRICE),
        side,
        adjustment: 'confidence × RISK_THRESHOLDS.TP_SCALP',
      });
      return RISK_THRESHOLDS.TP_SCALP; // Reduce confidence by 70%
    }

    // 2. Boost for strong walls (iceberg, long lifetime)
    const wallStrength = this.wallTracker.getWallStrength(wallPrice, side);
    if (wallStrength > RISK_THRESHOLDS.TP_CONSERVATIVE) {
      multiplier *= MULTIPLIERS.NEUTRAL + wallStrength * RISK_THRESHOLDS.TP_SCALP; // Up to +30% boost
      this.logger.debug('💪 WallTracker: Strong wall detected', {
        price: wallPrice.toFixed(DECIMAL_PLACES.PRICE),
        side,
        strength: wallStrength.toFixed(DECIMAL_PLACES.PERCENT),
        boost: `+${((multiplier - 1.0) * PERCENT_MULTIPLIER).toFixed(0)}%`,
      });
    }

    // 3. Boost for wall clusters (multiple walls at same level)
    const cluster = this.wallTracker.getClusterAt(wallPrice, side);
    if (cluster && cluster.totalSize > largestWall.quantity * RISK_THRESHOLDS.SL_CONSERVATIVE) {
      multiplier *= RISK_THRESHOLDS.SL_MODERATE; // +20% boost for clusters
      this.logger.debug('🏔️ WallTracker: Wall cluster detected', {
        price: wallPrice.toFixed(DECIMAL_PLACES.PRICE),
        side,
        clusterSize: cluster.totalSize.toFixed(DECIMAL_PLACES.PERCENT),
        wallCount: cluster.wallCount,
        boost: '+20%',
      });
    }

    return multiplier;
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
    whaleDetectorStats: ReturnType<WhaleDetectorService['getStats']>;
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
