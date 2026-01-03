import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Delta Analyzer Service
 *
 * Analyzes buy/sell pressure from tick-by-tick trades.
 *
 * Delta = Cumulative Buy Volume - Cumulative Sell Volume
 *
 * Use Cases:
 * - Entry confirmation (delta matches signal direction)
 * - Divergence detection (price up, delta down = weak rally)
 * - Reversal signals (delta flip)
 *
 * Data Source: Bybit publicTrade WebSocket stream
 * - Aggressor side (Buy/Sell) identifies taker direction
 * - Buy = aggressive buyer taking ask liquidity (bullish)
 * - Sell = aggressive seller hitting bid liquidity (bearish)
 */

import { DeltaConfig, DeltaTick, DeltaAnalysis, Signal, LoggerService } from '../types';

export class DeltaAnalyzerService {
  private ticks: DeltaTick[] = [];

  constructor(
    private config: DeltaConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('DeltaAnalyzerService initialized', {
      enabled: config.enabled,
      windowMs: config.windowSizeMs,
      threshold: config.minDeltaThreshold,
    });
  }

  /**
   * Add trade tick from WebSocket publicTrade stream
   *
   * @param tick - Trade tick with aggressor side (BUY/SELL)
   */
  addTick(tick: DeltaTick): void {
    if (!this.config.enabled) {
      return;
    }

    this.ticks.push(tick);

    // Remove old ticks outside rolling window
    const cutoff = Date.now() - this.config.windowSizeMs;
    this.ticks = this.ticks.filter((t) => t.timestamp >= cutoff);

    // this.logger.debug('Delta tick added', {
    //   side: tick.side,
    //   qty: tick.quantity.toFixed(DECIMAL_PLACES.PERCENT),
    //   price: tick.price.toFixed(DECIMAL_PLACES.PRICE),
    //   ticksCount: this.ticks.length,
    // });
  }

  /**
   * Analyze current delta from recent ticks
   *
   * @returns Delta analysis with trend and strength
   */
  analyze(): DeltaAnalysis {
    const cutoff = Date.now() - this.config.windowSizeMs;
    const recentTicks = this.ticks.filter((t) => t.timestamp >= cutoff);

    if (recentTicks.length === 0) {
      // No data - return neutral
      return {
        timestamp: Date.now(),
        buyVolume: 0,
        sellVolume: 0,
        delta: 0,
        deltaPercent: 0,
        trend: 'NEUTRAL',
        strength: 0,
      };
    }

    let buyVolume = 0;
    let sellVolume = 0;

    for (const tick of recentTicks) {
      if (tick.side === 'BUY') {
        buyVolume += tick.quantity;
      } else {
        sellVolume += tick.quantity;
      }
    }

    const totalVolume = buyVolume + sellVolume;
    const delta = buyVolume - sellVolume;
    const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * PERCENT_MULTIPLIER : 0;

    // Trend determination
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (Math.abs(delta) < this.config.minDeltaThreshold) {
      trend = 'NEUTRAL';
    } else if (delta > 0) {
      trend = 'BULLISH';
    } else {
      trend = 'BEARISH';
    }

    // Strength (0-100) based on delta percentage
    const strength = Math.min(Math.abs(deltaPercent), INTEGER_MULTIPLIERS.ONE_HUNDRED);

    const analysis: DeltaAnalysis = {
      timestamp: Date.now(),
      buyVolume,
      sellVolume,
      delta,
      deltaPercent,
      trend,
      strength,
    };

    this.logger.debug('Delta analyzed', {
      buyVol: buyVolume.toFixed(0),
      sellVol: sellVolume.toFixed(0),
      delta: delta.toFixed(0),
      deltaPercent: deltaPercent.toFixed(1) + '%',
      trend,
      strength: strength.toFixed(0),
    });

    return analysis;
  }

  /**
   * Check if delta confirms signal direction
   *
   * @param signal - Trading signal to confirm
   * @returns True if delta trend matches signal direction
   */
  confirmSignal(signal: Signal): boolean {
    const analysis = this.analyze();

    const confirms =
      (signal.direction === 'LONG' && analysis.trend === 'BULLISH') ||
      (signal.direction === 'SHORT' && analysis.trend === 'BEARISH');

    if (confirms) {
      this.logger.info('✅ Delta confirms signal', {
        direction: signal.direction,
        delta: analysis.delta.toFixed(0),
        deltaPercent: analysis.deltaPercent.toFixed(1) + '%',
        strength: analysis.strength.toFixed(0),
      });
    } else {
      this.logger.warn('⚠️ Delta contradicts signal', {
        direction: signal.direction,
        deltaTrend: analysis.trend,
        delta: analysis.delta.toFixed(0),
      });
    }

    return confirms;
  }

  /**
   * Get current tick count in window
   */
  getTickCount(): number {
    const cutoff = Date.now() - this.config.windowSizeMs;
    return this.ticks.filter((t) => t.timestamp >= cutoff).length;
  }

  /**
   * Clear all ticks (for testing)
   */
  reset(): void {
    this.ticks = [];
    this.logger.debug('Delta analyzer reset');
  }
}
