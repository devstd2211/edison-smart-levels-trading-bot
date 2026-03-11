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
    if (!config) {
      throw new Error('RetestEntryService: config is required');
    }

    if (typeof config.minImpulsePercent !== 'number' || config.minImpulsePercent <= 0 || config.minImpulsePercent > 100) {
      throw new Error('RetestEntryService: minImpulsePercent must be between 0 and 100');
    }

    if (typeof config.retestZoneFibStart !== 'number' || config.retestZoneFibStart <= 0 || config.retestZoneFibStart > 100) {
      throw new Error('RetestEntryService: retestZoneFibStart must be between 0 and 100');
    }

    if (typeof config.retestZoneFibEnd !== 'number' || config.retestZoneFibEnd <= 0 || config.retestZoneFibEnd > 100) {
      throw new Error('RetestEntryService: retestZoneFibEnd must be between 0 and 100');
    }

    if (config.retestZoneFibStart >= config.retestZoneFibEnd) {
      throw new Error('RetestEntryService: retestZoneFibStart must be < retestZoneFibEnd');
    }

    if (typeof config.maxRetestWaitMs !== 'number' || config.maxRetestWaitMs <= 0) {
      throw new Error('RetestEntryService: maxRetestWaitMs must be > 0');
    }

    if (typeof config.volumeMultiplier !== 'number' || config.volumeMultiplier <= 0) {
      throw new Error('RetestEntryService: volumeMultiplier must be > 0');
    }

    if (typeof config.enabled !== 'boolean') {
      throw new Error('RetestEntryService: enabled must be boolean');
    }

    if (typeof config.requireStructureIntact !== 'boolean') {
      throw new Error('RetestEntryService: requireStructureIntact must be boolean');
    }
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
    if (!Array.isArray(candles)) {
      throw new Error('RetestEntryService.detectImpulse: candles must be an array');
    }

    if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      throw new Error('RetestEntryService.detectImpulse: currentPrice must be a positive number');
    }

    if (!this.config.enabled) {
      return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
    }

    // Look back 5 candles for impulse
    const lookback = Math.min(5, candles.length);
    if (lookback === 0) {
      return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
    }

    try {
      const recentCandles = candles.slice(-lookback);
      const startPrice = recentCandles[0].open;
      const endPrice = currentPrice;

      // GRACEFUL_DEGRADE: Validate numeric prices
      if (!Number.isFinite(startPrice) || startPrice <= 0) {
        this.safeLog('warn', 'Invalid start price in impulse detection', { startPrice });
        return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
      }

      // GRACEFUL_DEGRADE: Price change calculation
      const priceChange = Math.abs((endPrice - startPrice) / startPrice) * PERCENT_MULTIPLIER;

      if (!Number.isFinite(priceChange)) {
        this.safeLog('warn', 'Invalid priceChange calculation', { startPrice, endPrice, priceChange });
        return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
      }

      const hasImpulse = priceChange >= this.config.minImpulsePercent;

      if (hasImpulse) {
        this.safeLog('info', '📊 Impulse detected!', {
          symbol,
          startPrice: startPrice.toFixed(DECIMAL_PLACES.PRICE),
          endPrice: endPrice.toFixed(DECIMAL_PLACES.PRICE),
          change: `${priceChange.toFixed(DECIMAL_PLACES.PERCENT)}%`,
          direction: endPrice > startPrice ? 'UP' : 'DOWN',
          candlesAgo: lookback,
        });
      }

      return {
        hasImpulse,
        impulseStart: startPrice,
        impulseEnd: endPrice,
      };
    } catch (error) {
      // GRACEFUL_DEGRADE: Unexpected calculation error
      this.safeLog('error', 'Impulse detection calculation failed', { error });
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
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
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('RetestEntryService.createRetestZone: symbol must be a non-empty string');
    }

    if (!signal) {
      throw new Error('RetestEntryService.createRetestZone: signal is required');
    }

    if (typeof impulseStart !== 'number' || !Number.isFinite(impulseStart) || impulseStart <= 0) {
      throw new Error('RetestEntryService.createRetestZone: impulseStart must be a positive number');
    }

    if (typeof impulseEnd !== 'number' || !Number.isFinite(impulseEnd) || impulseEnd <= 0) {
      throw new Error('RetestEntryService.createRetestZone: impulseEnd must be a positive number');
    }

    try {
      const impulseRange = Math.abs(impulseEnd - impulseStart);

      // GRACEFUL_DEGRADE: Validate impulseRange
      if (!Number.isFinite(impulseRange) || impulseRange <= 0) {
        this.safeLog('warn', 'Invalid impulseRange, cannot create zone', { impulseStart, impulseEnd, impulseRange });
        throw new Error('impulseRange is not valid');
      }

      // Fibonacci levels
      const fibStart = this.config.retestZoneFibStart / PERCENT_MULTIPLIER; // 0.50
      const fibEnd = this.config.retestZoneFibEnd / PERCENT_MULTIPLIER; // 0.618

      let zoneLow: number;
      let zoneHigh: number;

      if (signal.direction === SignalDirection.LONG) {
        // LONG: impulse UP, retest DOWN (back to zone)
        zoneLow = impulseEnd - (impulseRange * fibEnd); // 61.8% retrace
        zoneHigh = impulseEnd - (impulseRange * fibStart); // 50% retrace
      } else {
        // SHORT: impulse DOWN, retest UP (back to zone)
        zoneLow = impulseEnd + (impulseRange * fibStart); // 50% retrace
        zoneHigh = impulseEnd + (impulseRange * fibEnd); // 61.8% retrace
      }

      // GRACEFUL_DEGRADE: Validate zone calculations
      if (!Number.isFinite(zoneLow) || !Number.isFinite(zoneHigh)) {
        this.safeLog('warn', 'Invalid zone calculations', { zoneLow, zoneHigh });
        throw new Error('zone calculations resulted in non-finite values');
      }

      const zone: RetestZone = {
        symbol,
        direction: signal.direction,
        impulseStart,
        impulseEnd,
        zoneLow,
        zoneHigh,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.maxRetestWaitMs,
        originalSignal: signal,
      };

      this.retestZones.set(symbol, zone);

      this.safeLog('info', '🎯 Retest zone created', {
        symbol,
        direction: signal.direction,
        impulseRange: `${impulseStart.toFixed(DECIMAL_PLACES.PRICE)} → ${impulseEnd.toFixed(DECIMAL_PLACES.PRICE)}`,
        zoneRange: `${zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
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
      return {
        symbol,
        direction: signal.direction,
        impulseStart,
        impulseEnd,
        zoneLow: Math.min(impulseStart, impulseEnd),
        zoneHigh: Math.max(impulseStart, impulseEnd),
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.maxRetestWaitMs,
        originalSignal: signal,
      };
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
        age: `${(Date.now() - zone.createdAt) / INTEGER_MULTIPLIERS.ONE_THOUSAND}s`,
      });
      this.retestZones.delete(symbol);
      return { inZone: false, shouldEnter: false, reason: 'Retest zone expired' };
    }

    // Check if price in zone
    const inZone = currentPrice >= zone.zoneLow && currentPrice <= zone.zoneHigh;

    if (!inZone) {
      return {
        inZone: false,
        shouldEnter: false,
        reason: `Price ${currentPrice.toFixed(DECIMAL_PLACES.PRICE)} outside zone [${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)}, ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}]`,
      };
    }

    this.safeLog('debug', 'Price in retest zone!', {
      symbol,
      price: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
      zone: `${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
    });

    // Check volume (should be calm, not aggressive)
    const volumeThreshold = avgVolume * this.config.volumeMultiplier;

    if (currentVolume > avgVolume) {
      return {
        inZone: true,
        shouldEnter: false,
        reason: `Volume too high: ${currentVolume.toFixed(0)} > ${avgVolume.toFixed(0)} (aggressive, not calm retest)`,
      };
    }

    // Check structure (EMA + senior TF)
    if (this.config.requireStructureIntact) {
      // EMA structure
      const emaIntact = zone.direction === 'LONG'
        ? currentPrice > ema20
        : currentPrice < ema20;

      if (!emaIntact) {
        return {
          inZone: true,
          shouldEnter: false,
          reason: `EMA structure broken: price ${currentPrice.toFixed(DECIMAL_PLACES.PRICE)} ${zone.direction === 'LONG' ? '<' : '>'} EMA ${ema20.toFixed(DECIMAL_PLACES.PRICE)}`,
        };
      }

      // Senior TF alignment
      const seniorAligned = zone.direction === 'LONG'
        ? seniorTFTrend === 'UP'
        : seniorTFTrend === 'DOWN';

      if (!seniorAligned) {
        return {
          inZone: true,
          shouldEnter: false,
          reason: `Senior TF not aligned: ${seniorTFTrend} (expected ${zone.direction === 'LONG' ? 'UP' : 'DOWN'})`,
        };
      }
    }

    this.safeLog('info', '✅ Retest entry conditions met!', {
      symbol,
      price: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
      zone: `${zone.zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zone.zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
      volume: currentVolume.toFixed(0),
      volumeRatio: (currentVolume / avgVolume).toFixed(DECIMAL_PLACES.PERCENT) + 'x',
      ema20: ema20.toFixed(DECIMAL_PLACES.PRICE),
      seniorTF: seniorTFTrend,
    });

    return {
      inZone: true,
      shouldEnter: true,
      reason: 'Calm retest with structure intact',
    };
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
