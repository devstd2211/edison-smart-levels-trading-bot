import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { ValidationError, ConfigurationError } from '../errors/DomainErrors';

/**
 * Volume Profile Service (PHASE 4 Feature 3)
 *
 * Calculates volume distribution across price levels to find:
 * - POC (Point of Control) = Price with highest volume
 * - VAH (Value Area High) = Top of 70% volume range
 * - VAL (Value Area Low) = Bottom of 70% volume range
 *
 * Use Cases:
 * - Support/Resistance levels (POC acts as magnet)
 * - Entry zones (near VAL for LONG, VAH for SHORT)
 * - Breakout targets (above VAH = bullish, below VAL = bearish)
 *
 * Phase 8.9.47: ErrorHandler integration with THROW (validation) + GRACEFUL_DEGRADE (calculation) + SKIP (logging)
 */

import { LoggerService } from './logger.service';
import { VolumeProfileResult, VolumeNode } from '../types/legacy';
import { VolumeProfileConfig } from '../types/legacy';
import { Candle } from '../types/legacy';

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: VolumeProfileConfig = {
  enabled: true,
  lookbackCandles: 200,
  valueAreaPercent: 70,
  priceTickSize: 0.5,
};

// ============================================================================
// VOLUME PROFILE SERVICE
// ============================================================================

export class VolumeProfileService {
  private config: VolumeProfileConfig;

  constructor(
    private logger: LoggerService,
    config?: Partial<VolumeProfileConfig>,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.47
  ) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);

    // Validate config structure - Phase 8.9.47
    if (config) {
      if (!Number.isFinite(this.config.priceTickSize) || this.config.priceTickSize <= 0) {
        const error = new ValidationError(
          'VolumeProfileService: Invalid priceTickSize',
          {
            field: 'priceTickSize',
            value: this.config.priceTickSize,
            reason: 'Price tick size must be a valid positive number',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.THROW,
            context: 'VolumeProfileService.constructor',
          });
        }
        throw error;
      }

      if (!Number.isFinite(this.config.lookbackCandles) || this.config.lookbackCandles <= 0) {
        const error = new ValidationError(
          'VolumeProfileService: Invalid lookbackCandles',
          {
            field: 'lookbackCandles',
            value: this.config.lookbackCandles,
            reason: 'Lookback candles must be a valid positive number',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.THROW,
            context: 'VolumeProfileService.constructor',
          });
        }
        throw error;
      }

      if (!Number.isFinite(this.config.valueAreaPercent) || this.config.valueAreaPercent <= 0 || this.config.valueAreaPercent > 100) {
        const error = new ValidationError(
          'VolumeProfileService: Invalid valueAreaPercent',
          {
            field: 'valueAreaPercent',
            value: this.config.valueAreaPercent,
            reason: 'Value area percent must be between 0 and 100',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.THROW,
            context: 'VolumeProfileService.constructor',
          });
        }
        throw error;
      }
    }

    this.safeLog('info', '✅ VolumeProfileService initialized', {
      enabled: this.config.enabled,
      lookbackCandles: this.config.lookbackCandles,
      valueAreaPercent: this.config.valueAreaPercent,
      priceTickSize: this.config.priceTickSize,
    });
  }

  /**
   * Safe logging wrapper with SKIP strategy - Phase 8.9.47
   */
  private safeLog(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: `VolumeProfileService.${level}`,
        });
      }
      // Silently skip logging errors
    }
  }

  /**
   * Merge partial config with defaults
   */
  private mergeConfig(
    defaults: VolumeProfileConfig,
    overrides?: Partial<VolumeProfileConfig>,
  ): VolumeProfileConfig {
    if (!overrides) {
      return { ...defaults };
    }

    return {
      enabled: overrides.enabled ?? defaults.enabled,
      lookbackCandles: overrides.lookbackCandles ?? defaults.lookbackCandles,
      valueAreaPercent: overrides.valueAreaPercent ?? defaults.valueAreaPercent,
      priceTickSize: overrides.priceTickSize ?? defaults.priceTickSize,
    };
  }

  /**
   * Get current config
   */
  getConfig(): VolumeProfileConfig {
    return { ...this.config };
  }

  /**
   * Update config with validation - Phase 8.9.47
   */
  updateConfig(partial: Partial<VolumeProfileConfig>): void {
    try {
      const newConfig = this.mergeConfig(this.config, partial);

      // Validate before applying
      if (!Number.isFinite(newConfig.priceTickSize) || newConfig.priceTickSize <= 0) {
        throw new ValidationError('Invalid priceTickSize in config update', {
          field: 'priceTickSize',
          value: newConfig.priceTickSize,
        });
      }

      if (!Number.isFinite(newConfig.lookbackCandles) || newConfig.lookbackCandles <= 0) {
        throw new ValidationError('Invalid lookbackCandles in config update', {
          field: 'lookbackCandles',
          value: newConfig.lookbackCandles,
        });
      }

      if (!Number.isFinite(newConfig.valueAreaPercent) || newConfig.valueAreaPercent <= 0 || newConfig.valueAreaPercent > 100) {
        throw new ValidationError('Invalid valueAreaPercent in config update', {
          field: 'valueAreaPercent',
          value: newConfig.valueAreaPercent,
        });
      }

      this.config = newConfig;
      this.safeLog('info', '✅ VolumeProfileService config updated', { config: this.config });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'VolumeProfileService.updateConfig',
        });
      }
      // Keep existing config on failure
      this.safeLog('warn', '⚠️ Config update failed, keeping existing config', { error: (error as Error).message });
    }
  }

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Calculate volume profile from candles
   * Phase 8.9.47: Added ErrorHandler with THROW (validation) + GRACEFUL_DEGRADE (calculation)
   *
   * @param candles - Array of candles (oldest first)
   * @returns Volume profile with POC, VAH, VAL or null
   */
  calculate(candles: Candle[]): VolumeProfileResult | null {
    // ========================================================================
    // VALIDATION - Phase 8.9.47 (OUTSIDE try-catch to propagate THROW errors)
    // ========================================================================

    if (!Array.isArray(candles)) {
      const error = new ValidationError(
        'VolumeProfileService: Invalid candles input',
        {
          field: 'candles',
          value: candles,
          reason: 'Candles must be an array',
        }
      );

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'VolumeProfileService.calculate',
        });
      }
      throw error;
    }

    if (candles.length === 0) {
      const error = new ValidationError(
        'VolumeProfileService: Empty candles array',
        {
          field: 'candles',
          length: 0,
          reason: 'At least one candle is required',
        }
      );

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'VolumeProfileService.calculate',
        });
      }
      throw error;
    }

    // Validate candles have required fields
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      if (
        !Number.isFinite(candle.high) ||
        !Number.isFinite(candle.low) ||
        !Number.isFinite(candle.close) ||
        !Number.isFinite(candle.volume) ||
        candle.volume < 0
      ) {
        const error = new ValidationError(
          'VolumeProfileService: Invalid candle data',
          {
            field: 'candles',
            index: i,
            candle,
            reason: 'All candle fields must be valid finite positive numbers',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.THROW,
            context: 'VolumeProfileService.calculate',
          });
        }
        throw error;
      }
    }

    if (!this.config.enabled) {
      this.safeLog('debug', 'Volume profile calculation skipped (disabled)', {});
      return null;
    }

    // ========================================================================
    // CALCULATION - Phase 8.9.47 (GRACEFUL_DEGRADE on failures)
    // ========================================================================

    try {
      // Take last N candles
      const lookback = Math.min(this.config.lookbackCandles, candles.length);
      const relevantCandles = candles.slice(-lookback);

      // Build volume distribution (price → volume map)
      const volumeMap = new Map<number, number>();

      for (const candle of relevantCandles) {
        // Get price levels within candle range
        const priceLevels = this.getPriceLevels(candle);

        // Distribute candle volume evenly across price levels
        const volumePerLevel = candle.volume / priceLevels.length;

        for (const priceLevel of priceLevels) {
          const existing = volumeMap.get(priceLevel) || 0;
          volumeMap.set(priceLevel, existing + volumePerLevel);
        }
      }

      // Convert to nodes and sort by volume (descending)
      const nodes: VolumeNode[] = Array.from(volumeMap.entries())
        .map(([price, volume]) => ({ price, volume }))
        .sort((a, b) => b.volume - a.volume);

      if (nodes.length === 0) {
        this.safeLog('warn', 'No volume nodes generated, returning null');
        return null;
      }

      const totalVolume = nodes.reduce((sum, n) => sum + n.volume, 0);

      if (!Number.isFinite(totalVolume) || totalVolume <= 0) {
        this.safeLog('warn', 'Invalid total volume calculated', { totalVolume });
        return null;
      }

      // POC = price with highest volume
      const poc = nodes[0].price;

      // Value Area = range containing N% of total volume
      const valueVolume = totalVolume * (this.config.valueAreaPercent / PERCENT_MULTIPLIER);
      let accumulatedVolume = 0;
      const valueNodes: VolumeNode[] = [];

      for (const node of nodes) {
        valueNodes.push(node);
        accumulatedVolume += node.volume;
        if (accumulatedVolume >= valueVolume) {
          break;
        }
      }

      // VAH/VAL = top/bottom of value area (sort by price)
      const valuePrices = valueNodes.map((n) => n.price).sort((a, b) => a - b);
      const val = valuePrices[0];
      const vah = valuePrices[valuePrices.length - 1];

      this.safeLog('debug', '📊 Volume Profile calculated', {
        poc: poc.toFixed(DECIMAL_PLACES.PRICE),
        vah: vah.toFixed(DECIMAL_PLACES.PRICE),
        val: val.toFixed(DECIMAL_PLACES.PRICE),
        totalVolume: totalVolume.toFixed(0),
        nodesCount: nodes.length,
      });

      return {
        poc,
        vah,
        val,
        totalVolume,
        nodes,
      };
    } catch (error) {
      // GRACEFUL_DEGRADE - Phase 8.9.47
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'VolumeProfileService.calculate',
        });
      }
      this.safeLog('warn', '⚠️ Volume profile calculation failed, returning null', {
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get price levels within candle range based on tick size
   * Phase 8.9.47: Added GRACEFUL_DEGRADE fallback
   *
   * @param candle - Candle to extract price levels from
   * @returns Array of price levels
   */
  private getPriceLevels(candle: Candle): number[] {
    try {
      const tickSize = this.config.priceTickSize;
      const levels: number[] = [];

      // Start from low and go to high by tick increments
      let price = Math.floor(candle.low / tickSize) * tickSize;
      const high = candle.high;

      while (price <= high && levels.length < 10000) { // Add safety limit
        const roundedPrice = parseFloat(price.toFixed(8)); // Round to avoid floating point issues
        if (Number.isFinite(roundedPrice)) {
          levels.push(roundedPrice);
        }
        price += tickSize;
      }

      // Fallback: if no levels generated, use close price
      return levels.length > 0 ? levels : [candle.close];
    } catch (error) {
      // GRACEFUL_DEGRADE - return fallback price level
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'VolumeProfileService.getPriceLevels',
        });
      }
      return [candle.close];
    }
  }
}
