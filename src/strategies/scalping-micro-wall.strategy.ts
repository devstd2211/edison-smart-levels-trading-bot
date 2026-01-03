import { DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, PERCENTAGE_THRESHOLDS, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Scalping Micro Wall Strategy
 *
 * High-frequency scalping strategy that trades small orderbook wall breaks.
 * Unlike WhaleHunter (15-20% walls), this targets smaller 5-10% walls.
 *
 * Strategy:
 * - Detect micro walls (5-10% of orderbook volume)
 * - Wait for price to break through wall (with confirmation)
 * - Enter immediately with tight TP/SL
 * - Exit within 1-2 minutes (fast scalping)
 *
 * Risk Management:
 * - Very tight stop-loss (0.08%)
 * - Quick take-profit (0.15%)
 * - Max holding time: 2 minutes
 * - Cooldown: 1 minute between trades
 *
 * R/R Ratio: PERCENTAGE_THRESHOLDS.VERY_LOW% / 0.08% = 1.87:1
 *
 * IMPORTANT: Requires real-time WebSocket orderbook feed!
 */

import {
  IStrategy,
  StrategySignal,
  StrategyMarketData,
  SignalDirection,
  SignalType,
  LoggerService,
  ScalpingMicroWallConfig,
  TakeProfit,
  MicroWallDetectorService,
} from '../types';

// ============================================================================
// SCALPING MICRO WALL STRATEGY
// ============================================================================

export class ScalpingMicroWallStrategy implements IStrategy {
  readonly name = 'SCALPING_MICRO_WALL';
  readonly priority: number;

  private lastTradeTime: number = 0;

  constructor(
    private config: ScalpingMicroWallConfig,
    private microWallDetector: MicroWallDetectorService,
    private logger: LoggerService,
  ) {
    this.priority = config.priority;

    this.logger.info('📊 ScalpingMicroWallStrategy initialized', {
      priority: this.priority,
      minConfidence: config.minConfidence,
      takeProfitPercent: config.takeProfitPercent,
      stopLossPercent: config.stopLossPercent,
      maxHoldingTimeMs: config.maxHoldingTimeMs,
    });
  }

  /**
   * Evaluate scalping micro wall strategy
   *
   * @param marketData - Market data (must include orderbook)
   * @returns Strategy signal
   */
  async evaluate(marketData: StrategyMarketData): Promise<StrategySignal> {
    // Cleanup expired walls to prevent memory leak
    this.microWallDetector.cleanupExpiredWalls();

    // Check if strategy is enabled
    if (!this.config.enabled) {
      return this.noSignal('Strategy disabled');
    }

    // Check cooldown (avoid over-trading) - with historical time context for backtest
    if (this.isInCooldown(marketData.timestamp)) {
      return this.noSignal('In cooldown period');
    }

    // Check if we have orderbook data
    if (!marketData.orderbook) {
      this.logger.warn('ScalpingMicroWall: No orderbook data available');
      return this.noSignal('No orderbook data');
    }

    // Get current price
    const currentPrice = marketData.candles[marketData.candles.length - 1].close;

    // Detect micro walls (with historical time context for backtest)
    const microWalls = this.microWallDetector.detectMicroWalls(marketData.orderbook, marketData.timestamp);

    if (microWalls.length === 0) {
      return this.noSignal('No micro walls detected');
    }

    // Check for broken walls (with historical time context for backtest)
    let brokenWall = null;
    for (const wall of microWalls) {
      if (this.microWallDetector.isWallBroken(wall, currentPrice, marketData.timestamp)) {
        brokenWall = wall;
        break;
      }
    }

    if (!brokenWall) {
      return this.noSignal('No broken walls (waiting for break)');
    }

    // Calculate confidence
    const confidence = this.microWallDetector.calculateWallConfidence(brokenWall);

    // Check confidence threshold
    if (confidence < this.config.minConfidence) {
      return this.noSignal(
        `Confidence too low: ${confidence.toFixed(1)} < ${this.config.minConfidence}`,
      );
    }

    // Get signal direction
    const direction = this.microWallDetector.getSignalDirection(brokenWall);

    // Check if this wall was recently broken (prevent duplicate trades)
    if (this.microWallDetector.wasRecentlyBroken(brokenWall.side, brokenWall.price)) {
      return this.noSignal('Wall was recently broken (cooldown)');
    }

    // MICRO WALL SIGNAL CONFIRMED - Generate strategy signal
    this.logger.info('✅ ScalpingMicroWall signal generated', {
      direction,
      confidence: confidence.toFixed(1),
      wallSide: brokenWall.side,
      wallPrice: brokenWall.price,
      wallSize: brokenWall.size.toFixed(DECIMAL_PLACES.PERCENT),
      wallPercent: brokenWall.percentOfTotal.toFixed(DECIMAL_PLACES.PERCENT),
      currentPrice,
    });

    // Update last trade time (use historical time for backtest)
    this.lastTradeTime = marketData.timestamp;

    // Calculate TP/SL levels
    const { stopLossPrice, takeProfits } = this.calculateTpSlLevels(
      currentPrice,
      direction,
    );

    return {
      valid: true,
      strategyName: this.name,
      priority: this.priority,
      signal: {
        direction,
        type: SignalType.SCALPING_MICRO_WALL,
        confidence: confidence / PERCENT_MULTIPLIER, // ← FIX: Convert to 0-1 range
        price: currentPrice,
        stopLoss: stopLossPrice,
        takeProfits,
        reason: `Micro wall broken: ${brokenWall.side} at ${brokenWall.price} (${brokenWall.percentOfTotal.toFixed(1)}%)`,
        timestamp: Date.now(),
        marketData: {
          rsi: 50, // Not used in micro wall strategy
          atr: 0, // Not used in micro wall strategy
          trend: 'NEUTRAL',
          whaleMode: 'MICRO_WALL_BREAK',
          wallSize: brokenWall.size,
        },
      },
      reason: `Micro wall broken: ${brokenWall.side} at ${brokenWall.price} (${brokenWall.percentOfTotal.toFixed(1)}%)`,
    };
  }

  /**
   * Calculate TP/SL levels
   * @param entryPrice - Entry price
   * @param direction - Signal direction
   * @returns Stop loss and take profit levels
   */
  private calculateTpSlLevels(
    entryPrice: number,
    direction: SignalDirection,
  ): {
    stopLossPrice: number;
    takeProfits: TakeProfit[];
  } {
    const tpPercent = this.config.takeProfitPercent;
    const slPercent = this.config.stopLossPercent;

    if (direction === SignalDirection.LONG) {
      // LONG: TP above entry, SL below entry
      const stopLossPrice = entryPrice * (1 - slPercent / PERCENT_MULTIPLIER);
      const tp1Price = entryPrice * (1 + tpPercent / PERCENT_MULTIPLIER);

      return {
        stopLossPrice,
        takeProfits: [
          {
            level: 1,
            percent: tpPercent,
            sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Close 100% at TP1 (single TP for scalping)
            price: tp1Price,
            hit: false,
          },
        ],
      };
    } else {
      // SHORT: TP below entry, SL above entry
      const stopLossPrice = entryPrice * (1 + slPercent / PERCENT_MULTIPLIER);
      const tp1Price = entryPrice * (1 - tpPercent / PERCENT_MULTIPLIER);

      return {
        stopLossPrice,
        takeProfits: [
          {
            level: 1,
            percent: tpPercent,
            sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Close 100% at TP1
            price: tp1Price,
            hit: false,
          },
        ],
      };
    }
  }

  /**
   * Check if strategy is in cooldown period
   * @param currentTime - Current time reference (ms, default: Date.now() for live, override for backtest)
   * @returns True if in cooldown
   */
  private isInCooldown(currentTime: number = Date.now()): boolean {
    if (this.lastTradeTime === 0) {
      return false;
    }

    const timeSinceLastTrade = currentTime - this.lastTradeTime;
    const inCooldown = timeSinceLastTrade < this.config.cooldownMs;

    if (inCooldown) {
      const remainingMs = this.config.cooldownMs - timeSinceLastTrade;
      this.logger.debug('⏳ ScalpingMicroWall in cooldown', {
        remainingMs,
        remainingSec: (remainingMs / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(1),
      });
    }

    return inCooldown;
  }

  /**
   * Helper: Create no-signal response
   * @param reason - Reason for no signal
   * @returns No-signal strategy signal
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
   * Reset strategy state (for testing)
   */
  reset(): void {
    this.lastTradeTime = 0;
    this.logger.debug('🔄 ScalpingMicroWallStrategy reset');
  }
}
