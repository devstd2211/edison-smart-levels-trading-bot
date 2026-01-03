import { DECIMAL_PLACES, PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Retest Entry Service
 *
 * Enter on Fibonacci retest after missing initial impulse.
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

import { RetestConfig, RetestZone, Signal, Candle, LoggerService, SignalDirection } from '../types';

export class RetestEntryService {
  private retestZones: Map<string, RetestZone> = new Map();

  constructor(
    private config: RetestConfig,
    private logger: LoggerService,
  ) {
    this.logger.info('RetestEntryService initialized', {
      enabled: config.enabled,
      minImpulse: `${config.minImpulsePercent}%`,
      fibZone: `${config.retestZoneFibStart}%-${config.retestZoneFibEnd}%`,
      maxWait: `${config.maxRetestWaitMs / INTEGER_MULTIPLIERS.ONE_THOUSAND}s`,
    });
  }

  /**
   * Detect if impulse already happened
   *
   * Looks back at recent candles (last 5) to check for large price move
   */
  detectImpulse(
    symbol: string,
    currentPrice: number,
    candles: Candle[],
  ): { hasImpulse: boolean; impulseStart: number; impulseEnd: number } {
    if (!this.config.enabled) {
      return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
    }

    // Look back 5 candles for impulse
    const lookback = Math.min(5, candles.length);
    if (lookback === 0) {
      return { hasImpulse: false, impulseStart: 0, impulseEnd: 0 };
    }

    const recentCandles = candles.slice(-lookback);
    const startPrice = recentCandles[0].open;
    const endPrice = currentPrice;

    const priceChange = Math.abs((endPrice - startPrice) / startPrice) * PERCENT_MULTIPLIER;

    const hasImpulse = priceChange >= this.config.minImpulsePercent;

    if (hasImpulse) {
      this.logger.info('📊 Impulse detected!', {
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
  }

  /**
   * Create Fibonacci retest zone
   *
   * Zone = CONFIDENCE_THRESHOLDS.MODERATE-61.8% retracement of impulse
   */
  createRetestZone(
    symbol: string,
    signal: Signal,
    impulseStart: number,
    impulseEnd: number,
  ): RetestZone {
    const impulseRange = Math.abs(impulseEnd - impulseStart);

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

    this.logger.info('🎯 Retest zone created', {
      symbol,
      direction: signal.direction,
      impulseRange: `${impulseStart.toFixed(DECIMAL_PLACES.PRICE)} → ${impulseEnd.toFixed(DECIMAL_PLACES.PRICE)}`,
      zoneRange: `${zoneLow.toFixed(DECIMAL_PLACES.PRICE)} - ${zoneHigh.toFixed(DECIMAL_PLACES.PRICE)}`,
      fibLevels: `${this.config.retestZoneFibStart}% - ${this.config.retestZoneFibEnd}%`,
      expiresIn: `${this.config.maxRetestWaitMs / INTEGER_MULTIPLIERS.ONE_THOUSAND}s`,
    });

    return zone;
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
      this.logger.debug('Retest zone expired', {
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

    this.logger.debug('Price in retest zone!', {
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

    this.logger.info('✅ Retest entry conditions met!', {
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
   */
  clearZone(symbol: string): void {
    const zone = this.retestZones.get(symbol);
    if (zone) {
      this.logger.debug('Retest zone cleared', {
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
      this.logger.debug(`Cleaned ${cleaned} expired retest zones`);
    }
  }

  /**
   * Get config
   */
  getConfig(): RetestConfig {
    return { ...this.config };
  }
}
