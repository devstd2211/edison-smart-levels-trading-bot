import { PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
import { ErrorHandler } from '../errors/ErrorHandler';
import { RecoveryStrategy } from '../errors/ErrorHandler';

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
    private errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation
    this.validateConfig(config);

    this.safeLog(() => {
      this.logger.info('DeltaAnalyzerService initialized', {
        enabled: config.enabled,
        windowMs: config.windowSizeMs,
        threshold: config.minDeltaThreshold,
      });
    });
  }

  /**
   * Safe logging wrapper - SKIP strategy for logger errors
   */
  private safeLog(logFn: () => void): void {
    try {
      logFn();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Validate config on construction
   * THROW on invalid configuration
   *
   * @param config - The delta analyzer configuration
   * @throws If configuration is invalid
   */
  private validateConfig(config: DeltaConfig): void {
    // THROW: null/undefined config
    if (!config) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('DeltaConfig cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('DeltaConfig cannot be null or undefined');
    }

    // THROW: Invalid windowSizeMs
    if (typeof config.windowSizeMs !== 'number' || config.windowSizeMs <= 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`windowSizeMs must be > 0 (got ${config.windowSizeMs})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`windowSizeMs must be > 0 (got ${config.windowSizeMs})`);
    }

    // THROW: Invalid minDeltaThreshold
    if (typeof config.minDeltaThreshold !== 'number' || config.minDeltaThreshold < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`minDeltaThreshold must be >= 0 (got ${config.minDeltaThreshold})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`minDeltaThreshold must be >= 0 (got ${config.minDeltaThreshold})`);
    }
  }

  /**
   * Validate tick data
   * THROW on invalid tick
   *
   * @param tick - The delta tick to validate
   * @throws If tick is invalid
   */
  private validateTick(tick: DeltaTick): void {
    // THROW: null/undefined tick
    if (!tick) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('DeltaTick cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('DeltaTick cannot be null or undefined');
    }

    // THROW: Invalid side
    if (!tick.side || (tick.side !== 'BUY' && tick.side !== 'SELL')) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick side must be BUY or SELL (got ${tick.side})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick side must be BUY or SELL (got ${tick.side})`);
    }

    // THROW: Invalid quantity
    if (!Number.isFinite(tick.quantity) || tick.quantity < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick quantity must be >= 0 and finite (got ${tick.quantity})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick quantity must be >= 0 and finite (got ${tick.quantity})`);
    }

    // THROW: Invalid price
    if (!Number.isFinite(tick.price) || tick.price < 0) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Tick price must be >= 0 and finite (got ${tick.price})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Tick price must be >= 0 and finite (got ${tick.price})`);
    }
  }

  /**
   * Add trade tick from WebSocket publicTrade stream
   *
   * @param tick - Trade tick with aggressor side (BUY/SELL)
   * @throws If tick validation fails
   */
  addTick(tick: DeltaTick): void {
    // Validation happens outside try-catch to propagate THROW errors
    this.validateTick(tick);

    if (!this.config.enabled) {
      return;
    }

    try {
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
    } catch (error) {
      // GRACEFUL_DEGRADE: Tick addition failed, skip this tick
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Analyze current delta from recent ticks
   *
   * @returns Delta analysis with trend and strength
   */
  analyze(): DeltaAnalysis {
    try {
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

      // GRACEFUL_DEGRADE: Handle NaN/Infinity in volume calculations
      if (!Number.isFinite(buyVolume) || !Number.isFinite(sellVolume)) {
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

      const totalVolume = buyVolume + sellVolume;
      const delta = buyVolume - sellVolume;
      const deltaPercent = totalVolume > 0 ? (delta / totalVolume) * PERCENT_MULTIPLIER : 0;

      // GRACEFUL_DEGRADE: Handle NaN/Infinity in deltaPercent
      if (!Number.isFinite(deltaPercent)) {
        return {
          timestamp: Date.now(),
          buyVolume,
          sellVolume,
          delta,
          deltaPercent: 0,
          trend: 'NEUTRAL',
          strength: 0,
        };
      }

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

      this.safeLog(() => {
        this.logger.debug('Delta analyzed', {
          buyVol: buyVolume.toFixed(0),
          sellVol: sellVolume.toFixed(0),
          delta: delta.toFixed(0),
          deltaPercent: deltaPercent.toFixed(1) + '%',
          trend,
          strength: strength.toFixed(0),
        });
      });

      return analysis;
    } catch (error) {
      // GRACEFUL_DEGRADE: Analysis failed, return neutral
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
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
  }

  /**
   * Check if delta confirms signal direction
   *
   * @param signal - Trading signal to confirm
   * @returns True if delta trend matches signal direction
   * @throws If signal validation fails
   */
  confirmSignal(signal: Signal): boolean {
    // THROW: null/undefined signal
    if (!signal) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error('Signal cannot be null or undefined'),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error('Signal cannot be null or undefined');
    }

    // THROW: Invalid direction
    if (!signal.direction || (signal.direction !== 'LONG' && signal.direction !== 'SHORT')) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          new Error(`Signal direction must be LONG or SHORT (got ${signal.direction})`),
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw new Error(`Signal direction must be LONG or SHORT (got ${signal.direction})`);
    }

    const analysis = this.analyze();

    const confirms =
      (signal.direction === 'LONG' && analysis.trend === 'BULLISH') ||
      (signal.direction === 'SHORT' && analysis.trend === 'BEARISH');

    this.safeLog(() => {
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
    });

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
    this.safeLog(() => {
      this.logger.debug('Delta analyzer reset');
    });
  }
}
