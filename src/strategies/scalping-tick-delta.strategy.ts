import { DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Scalping Tick Delta Strategy (Phase 4)
 *
 * Scalping strategy based on tick delta momentum analysis.
 *
 * Features:
 * - Analyzes buy/sell tick delta
 * - Detects momentum spikes (e.g., 2x more buys than sells)
 * - Fast scalping with tight TP/SL
 * - R/R Ratio: 2:1 (0.20% TP / 0.10% SL)
 *
 * Example:
 * - 40 buy ticks, 15 sell ticks → 2.67x ratio → LONG signal
 * - Entry: 1.0000, TP: 1.0020 (+0.20%), SL: 0.9990 (-0.10%)
 */

import {
  IStrategy,
  SignalDirection,
  StrategySignal,
  SignalType,
  StrategyMarketData,
  ScalpingTickDeltaConfig,
  LoggerService,
  Tick,
  TakeProfit,
  TickDeltaAnalyzerService,
} from '../types';

// ============================================================================
// SCALPING TICK DELTA STRATEGY
// ============================================================================

export class ScalpingTickDeltaStrategy implements IStrategy {
  readonly name = 'ScalpingTickDelta';
  readonly type = SignalType.SCALPING_TICK_DELTA;
  readonly priority: number;

  private analyzer: TickDeltaAnalyzerService;

  constructor(
    private config: ScalpingTickDeltaConfig,
    private logger: LoggerService,
  ) {
    this.priority = config.priority;

    // Initialize tick delta analyzer
    this.analyzer = new TickDeltaAnalyzerService(config.analyzer, logger);

    this.logger.info('✅ ScalpingTickDeltaStrategy initialized', {
      enabled: config.enabled,
      priority: config.priority,
      minDeltaRatio: config.analyzer.minDeltaRatio,
      takeProfitPercent: config.takeProfitPercent,
      stopLossPercent: config.stopLossPercent,
    });
  }

  // ==========================================================================
  // STRATEGY INTERFACE
  // ==========================================================================

  /**
   * Evaluate strategy - detect momentum spikes
   *
   * @param data - Market data
   * @returns Signal if momentum spike detected
   */
  async evaluate(data: StrategyMarketData): Promise<StrategySignal> {
    if (!this.config.enabled) {
      return this.noSignal('Strategy disabled');
    }

    // Detect momentum spike (pass current timestamp for backtest compatibility)
    const spike = this.analyzer.detectMomentumSpike(data.timestamp);

    if (!spike) {
      return this.noSignal('No momentum spike detected');
    }

    // Check minimum confidence
    if (spike.confidence < this.config.minConfidence) {
      return this.noSignal(
        `Momentum spike confidence too low (${spike.confidence.toFixed(1)} < ${this.config.minConfidence})`,
      );
    }

    // Generate signal
    const currentPrice = data.currentPrice;

    this.logger.info('📈 Tick delta momentum signal generated!', {
      direction: spike.direction,
      deltaRatio: spike.deltaRatio.toFixed(DECIMAL_PLACES.PERCENT),
      confidence: spike.confidence.toFixed(1),
      tickCount: spike.tickCount,
      volumeUSDT: spike.volumeUSDT.toFixed(DECIMAL_PLACES.PERCENT),
    });

    return {
      valid: true,
      signal: {
        direction: spike.direction,
        price: currentPrice,
        stopLoss: this.calculateStopLoss(currentPrice, spike.direction),
        takeProfits: this.calculateTakeProfits(currentPrice, spike.direction),
        confidence: spike.confidence / PERCENT_MULTIPLIER, // ← FIX: Convert to 0-1 range
        type: this.type,
        reason: `Tick delta momentum: ${spike.deltaRatio.toFixed(DECIMAL_PLACES.PERCENT)}x | Volume: ${spike.volumeUSDT.toFixed(0)} USDT | Ticks: ${spike.tickCount}`,
        timestamp: Date.now(),
      },
      strategyName: this.name,
      priority: this.priority,
      reason: `Momentum spike detected: ${spike.deltaRatio.toFixed(DECIMAL_PLACES.PERCENT)}x ratio`,
    };
  }

  // ==========================================================================
  // PUBLIC METHODS (for external tick feeding)
  // ==========================================================================

  /**
   * Feed ticks to analyzer (from websocket/external source)
   *
   * @param ticks - Array of ticks to process
   */
  feedTicks(ticks: Tick[]): void {
    for (const tick of ticks) {
      this.analyzer.addTick(tick);
    }
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
  getAnalyzer(): TickDeltaAnalyzerService {
    return this.analyzer;
  }
}
