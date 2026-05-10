import { ICONS } from '../cli/cli-runtime';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Retest Entry Service (Phase 8.9.51 ErrorHandler Integration)
 *
 * Enter on Fibonacci retest after missing initial impulse.
 *
 * Error Handling Strategies:
 * - THROW: Config validation (impulse %, Fibonacci levels, maxWaitMs)
 * - THROW: Input validation (null candles/signal, invalid prices)
 * - GRACEFUL_DEGRADE: Calculation failures (NaN in price calc, division by zero)
 * - SKIP: Logging failures (non-blocking)
 *
 * Problem:
 * - Signal generated but price already moved (impulse happened before signal)
 * - Example: Price breaks resistance at 10:00, bot generates signal at 10:02 when price already +0.5%
 *   → Enter late at worse price → Often hit SL immediately
 *
 * Solution:
 * - Detect if impulse already happened (>0.5% move in recent candles)
 * - Create Fibonacci retest zone (50-61.8% retracement)
 * - Wait for price to return to zone
 * - Enter on calm retest (low volume + structure intact)
 *
 * Benefits:
 * - Better entry price (closer to impulse start)
 * - +10-15% more trades (captures retests)
 * - Higher win rate (structured entries)
 */

import { RetestConfig, RetestZone, Signal, Candle, LoggerService, SignalDirection } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  buildFallbackRetestZone,
  buildRetestZone,
  calculateRetestImpulse,
  createNeutralRetestImpulse,
  evaluateRetestZone,
  getRetestZoneAgeSeconds,
  validateRetestConfig,
  validateRetestImpulseInput,
  validateRetestZoneInput,
} from './retest-entry/retest-entry-state.utils';

export class RetestEntryService {
  private retestZones: Map<string, RetestZone> = new Map();

  constructor(
    private config: RetestConfig,
    private logger: LoggerService,
    private errorHandler?: ErrorHandler,
  ) {
    // Constructor validation: THROW on invalid config
    this.validateConfig(config);

    this.safeLog('info', 'RetestEntryService initialized', {
      enabled: config.enabled,
      minImpulse: `${config.minImpulsePercent}%`,
      fibZone: `${config.retestZoneFibStart}%-${config.retestZoneFibEnd}%`,
      maxWait: `${config.maxRetestWaitMs / INTEGER_MULTIPLIERS.ONE_THOUSAND}s`,
    });
  }

  /**
   * Validate configuration at construction time
   * THROW strategy for config errors
   */
  private validateConfig(config: RetestConfig): void {
    validateRetestConfig(config);
  }

  /**
   * Safe logging wrapper: SKIP strategy for logging failures (non-blocking)
   */
  private safeLog(level: 'info' | 'debug' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // SKIP: Non-critical logging failure
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Detect if impulse already happened
   * THROW on input validation, GRACEFUL_DEGRADE on calculation failures
   *
   * Looks back at recent candles (last 5) to check for large price move
   */
  detectImpulse(
    symbol: string,
    currentPrice: number,
    candles: Candle[],
  ): { hasImpulse: boolean; impulseStart: number; impulseEnd: number } {
    // THROW strategy: Input validation
    validateRetestImpulseInput(candles, currentPrice);

    if (!this.config.enabled) {
      return createNeutralRetestImpulse();
    }

    try {
      const result = calculateRetestImpulse(candles, currentPrice, this.config.minImpulsePercent);
      if (!result) {
        this.safeLog('warn', 'Invalid start price in impulse detection', {
          startPrice: candles[candles.length - Math.min(5, candles.length)]?.open,
        });
        return createNeutralRetestImpulse();
      }

      if (result.hasImpulse) {
        const priceChange = Math.abs((result.impulseEnd - result.impulseStart) / result.impulseStart) * PERCENT_MULTIPLIER;
        this.safeLog('info', `${ICONS.chart} Impulse detected!`, {
          symbol,
          startPrice: result.impulseStart.toFixed(DECIMAL_PLACES.PRICE),
          endPrice: result.impulseEnd.toFixed(DECIMAL_PLACES.PRICE),
          change: `${priceChange.toFixed(DECIMAL_PLACES.PERCENT)}%`,
          direction: result.impulseEnd > result.impulseStart ? 'UP' : 'DOWN',
          candlesAgo: Math.min(5, candles.length),
        });
      }

      return result;
    } catch (error) {
      // GRACEFUL_DEGRADE: Unexpected calculation error
      this.safeLog('error', 'Impulse detection calculation failed', { error });
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return createNeutralRetestImpulse();
    }
  }

  /**
   * Create Fibonacci retest zone
   * THROW on input validation, GRACEFUL_DEGRADE on calculation failures
   *
   * Zone = 50-61.8% retracement of impulse
   */
  createRetestZone(
    symbol: string,
    signal: Signal,
    impulseStart: number,
    impulseEnd: number,
  ): RetestZone {
    // THROW strategy: Input validation
    validateRetestZoneInput(symbol, signal, impulseStart, impulseEnd);

    try {
      const zone = buildRetestZone(symbol, signal, impulseStart, impulseEnd, this.config);

      this.retestZones.set(symbol, zone);

      this.safeLog('info', `${ICONS.target} Retest zone created`, {
        symbol,
        direction: signal.direction,
        impulseRange: `${impulseStart.toFixed(DECIMAL_PLACES.PRICE)} → ${impulseEnd.toFixed(DECIMAL_PLACES.PRICE)}`,
        zoneRange: `${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
        fibLevels: `${this.config.retestZoneFibStart}% - ${this.config.retestZoneFibEnd}%`,
        expiresIn: `${this.config.maxRetestWaitMs / INTEGER_MULTIPLIERS.ONE_THOUSAND}s`,
      });

      return zone;
    } catch (error) {
      // GRACEFUL_DEGRADE: Unexpected calculation error
      this.safeLog('error', 'Zone creation calculation failed', { error });
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      // Return minimal zone on error (GRACEFUL_DEGRADE)
      return buildFallbackRetestZone(
        symbol,
        signal,
        impulseStart,
        impulseEnd,
        this.config.maxRetestWaitMs,
      );
    }
  }

  /**
   * Check if price in retest zone and conditions met
   */
  checkRetest(
    symbol: string,
    currentPrice: number,
    currentVolume: number,
    avgVolume: number,
    ema20: number,
    seniorTFTrend: 'UP' | 'DOWN' | 'NEUTRAL',
  ): { inZone: boolean; shouldEnter: boolean; reason: string } {
    const zone = this.retestZones.get(symbol);

    if (!zone) {
      return { inZone: false, shouldEnter: false, reason: 'No retest zone' };
    }

    // Check expiry
    if (Date.now() > zone.expiresAt) {
      this.safeLog('debug', 'Retest zone expired', {
        symbol,
        age: `${getRetestZoneAgeSeconds(zone)}s`,
      });
      this.retestZones.delete(symbol);
      return { inZone: false, shouldEnter: false, reason: 'Retest zone expired' };
    }

    const result = evaluateRetestZone(
      zone,
      currentPrice,
      currentVolume,
      avgVolume,
      ema20,
      seniorTFTrend,
      this.config,
    );

    if (result.inZone) {
      this.safeLog('debug', 'Price in retest zone!', {
        symbol,
        price: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
        zone: `${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
      });
    }

    if (result.shouldEnter) {
      this.safeLog('info', `${ICONS.success} Retest entry conditions met!`, {
        symbol,
        price: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
        zone: `${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
        volume: currentVolume.toFixed(0),
        volumeRatio: (currentVolume / avgVolume).toFixed(DECIMAL_PLACES.PERCENT) + 'x',
        ema20: ema20.toFixed(DECIMAL_PLACES.PRICE),
        seniorTF: seniorTFTrend,
      });
    }

    return result;
  }

  /**
   * Get retest zone
   */
  getRetestZone(symbol: string): RetestZone | undefined {
    return this.retestZones.get(symbol);
  }

  /**
   * Check if retest zone exists
   */
  hasRetestZone(symbol: string): boolean {
    return this.retestZones.has(symbol);
  }

  /**
   * Clear retest zone
   * SKIP on logging failure (non-blocking)
   */
  clearZone(symbol: string): void {
    const zone = this.retestZones.get(symbol);
    if (zone) {
      this.safeLog('debug', 'Retest zone cleared', {
        symbol,
        reason: 'Entry executed or zone invalidated',
      });
    }
    this.retestZones.delete(symbol);
  }

  /**
   * Get all active retest zones
   */
  getAllZones(): RetestZone[] {
    return Array.from(this.retestZones.values());
  }

  /**
   * Clean expired zones (call periodically)
   * SKIP on logging failure (non-blocking)
   */
  cleanExpiredZones(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [symbol, zone] of this.retestZones.entries()) {
      if (now > zone.expiresAt) {
        this.retestZones.delete(symbol);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.safeLog('debug', `Cleaned ${cleaned} expired retest zones`);
    }
  }

  /**
   * Get config
   */
  getConfig(): RetestConfig {
    return { ...this.config };
  }
}
