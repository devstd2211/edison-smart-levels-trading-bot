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

import { DeltaConfig, DeltaTick, DeltaAnalysis, Signal, LoggerService } from '../types/legacy';
import {
  analyzeDeltaTicks,
  createNeutralDeltaAnalysis,
  filterDeltaTicksByWindow,
  validateDeltaConfig,
  validateDeltaSignalDirection,
  validateDeltaTick,
} from './delta-analyzer/delta-analyzer-state.utils';

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

  private createNeutralAnalysis(): DeltaAnalysis {
    return createNeutralDeltaAnalysis();
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
    try {
      validateDeltaConfig(config);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          error as Error,
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw error;
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
    try {
      validateDeltaTick(tick);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          error as Error,
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw error;
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
      this.ticks = filterDeltaTicksByWindow(this.ticks, this.config.windowSizeMs);

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
      const recentTicks = filterDeltaTicksByWindow(this.ticks, this.config.windowSizeMs);
      const analysis = analyzeDeltaTicks(recentTicks, this.config.minDeltaThreshold);

      this.safeLog(() => {
        this.logger.debug('Delta analyzed', {
          buyVol: analysis.buyVolume.toFixed(0),
          sellVol: analysis.sellVolume.toFixed(0),
          delta: analysis.delta.toFixed(0),
          deltaPercent: analysis.deltaPercent.toFixed(1) + '%',
          trend: analysis.trend,
          strength: analysis.strength.toFixed(0),
        });
      });

      return analysis;
    } catch (error) {
      // GRACEFUL_DEGRADE: Analysis failed, return neutral
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return this.createNeutralAnalysis();
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

    try {
      validateDeltaSignalDirection(signal.direction);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(
          error as Error,
          { strategy: RecoveryStrategy.THROW }
        );
      }
      throw error;
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
    return filterDeltaTicksByWindow(this.ticks, this.config.windowSizeMs).length;
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
