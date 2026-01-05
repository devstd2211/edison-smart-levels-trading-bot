import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
/**
 * Blocking Rules Service
 *
 * Centralized blocking rules for all strategies.
 * Philosophy: "Better to miss a good trade than take a bad trade"
 *
 * Global Blocks (apply to ALL strategies):
 * - GLOBAL_1: Insufficient data
 * - GLOBAL_2: EMA distance > 5.5% (falling knife / blow-off top)
 * - GLOBAL_3: Active positions limit (max 1)
 * - GLOBAL_4: Cooldown period (10 sec between signals)
 *
 * Additional Blocks:
 * - Volume blocks (low liquidity)
 * - Wick blocks (rejection candles)
 * - ATH protection (buying tops)
 */

import { SignalDirection, Candle, LoggerService, VolumeCalculator, WickAnalyzer } from '../types';
import { CANDLES_FOR_24H_HIGH, INTEGER_MULTIPLIERS, THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_DISTANCE_TO_EMA_PERCENT = MULTIPLIER_VALUES.FIVE_POINT_FIVE; // GLOBAL_2 (strategic)
// COOLDOWN_PERIOD_MS imported from technical.constants (GLOBAL_4: 10 seconds)
// CANDLES_FOR_24H_HIGH imported from technical.constants (288 candles = 24h at 5m)

const VOLUME_MIN_MULTIPLIER_TREND = THRESHOLD_VALUES.FIFTY_PERCENT; // Trend-Following (0.5)
const VOLUME_MIN_MULTIPLIER_LEVEL = THRESHOLD_VALUES.THIRTY_PERCENT; // Level-Based (0.3)

const MIN_DROP_FROM_ATH_FOR_LONG = THRESHOLD_VALUES.TWENTY_PERCENT; // ATH protection (0.2 = 20%)

const MIN_WICK_CHECK_CANDLES = INTEGER_MULTIPLIERS.THREE; // Need 3+ candles for wick check

// ============================================================================
// TYPES
// ============================================================================

export interface BlockingRulesConfig {
  maxDistanceToEmaPercent: number; // GLOBAL_2
  cooldownPeriodMs: number; // GLOBAL_4
  minCandles5m: number; // GLOBAL_1
  volumeMinMultiplierTrend: number;
  volumeMinMultiplierLevel: number;
  minDropFromAthForLong: number; // ATH protection
  enableAthProtection: boolean; // ATH protection toggle
  enableVolumeChecks: boolean; // Volume checks toggle
  enableWickChecks: boolean; // Wick checks toggle
}

export interface BlockingContext {
  direction: SignalDirection;
  strategy: 'TrendFollowing' | 'LevelBased' | 'CounterTrend';
  candles: Candle[];
  currentPrice: number;
  ema50: number;
  rsi?: number;
  hasActivePosition: boolean;
  lastSignalTime: number;
}

export interface BlockingResult {
  blocked: boolean;
  reason?: string;
  blockId?: string;
}

// ============================================================================
// BLOCKING RULES SERVICE
// ============================================================================

export class BlockingRulesService {
  private volumeCalculator: VolumeCalculator;
  private wickAnalyzer: WickAnalyzer;

  constructor(
    private config: BlockingRulesConfig,
    private logger: LoggerService,
  ) {
    this.volumeCalculator = new VolumeCalculator(logger);
    this.wickAnalyzer = new WickAnalyzer(logger);
  }

  /**
   * Check all blocking rules for a signal
   * Returns blocked=true if ANY rule blocks the signal
   */
  async checkBlockingRules(context: BlockingContext): Promise<BlockingResult> {
    // ========================================================================
    // GLOBAL BLOCKS (apply to ALL strategies)
    // ========================================================================

    // GLOBAL_1: Insufficient data
    const insufficientDataBlock = this.checkInsufficientData(context.candles);
    if (insufficientDataBlock.blocked) {
      return insufficientDataBlock;
    }

    // GLOBAL_2: EMA distance > 5.5%
    const emaDistanceBlock = this.checkEmaDistance(context.currentPrice, context.ema50);
    if (emaDistanceBlock.blocked) {
      return emaDistanceBlock;
    }

    // GLOBAL_3: Active positions limit
    const activePositionBlock = this.checkActivePositionLimit(context.hasActivePosition);
    if (activePositionBlock.blocked) {
      return activePositionBlock;
    }

    // GLOBAL_4: Cooldown period
    const cooldownBlock = this.checkCooldownPeriod(context.lastSignalTime);
    if (cooldownBlock.blocked) {
      return cooldownBlock;
    }

    // ========================================================================
    // STRATEGY-SPECIFIC BLOCKS
    // ========================================================================

    // Volume checks (if enabled)
    if (this.config.enableVolumeChecks) {
      const volumeBlock = this.checkVolume(context.candles, context.strategy);
      if (volumeBlock.blocked) {
        return volumeBlock;
      }
    }

    // Wick checks (if enabled)
    if (this.config.enableWickChecks) {
      const wickBlock = this.checkWicks(context.candles, context.direction);
      if (wickBlock.blocked) {
        return wickBlock;
      }
    }

    // ATH protection (if enabled, LONG only, Trend-Following only)
    if (
      this.config.enableAthProtection &&
      context.direction === SignalDirection.LONG &&
      context.strategy === 'TrendFollowing'
    ) {
      const athBlock = this.checkAthProtection(context.candles, context.currentPrice);
      if (athBlock.blocked) {
        return athBlock;
      }
    }

    // No blocks triggered
    return { blocked: false };
  }

  /**
   * GLOBAL_1: Check for insufficient data
   */
  private checkInsufficientData(candles: Candle[]): BlockingResult {
    if (candles.length < this.config.minCandles5m) {
      this.logger.warn('[BlockingRules] GLOBAL_1: Insufficient data', {
        candles: candles.length,
        required: this.config.minCandles5m,
      });
      return {
        blocked: true,
        blockId: 'GLOBAL_1',
        reason: `Insufficient data: ${candles.length} < ${this.config.minCandles5m} candles`,
      };
    }
    return { blocked: false };
  }

  /**
   * GLOBAL_2: Check EMA distance > 5.5%
   * Most effective blocking rule (prevented 15+ losses in backtests)
   */
  private checkEmaDistance(price: number, ema50: number): BlockingResult {
    const distancePercent = Math.abs((price - ema50) / ema50) * PERCENT_MULTIPLIER;

    if (distancePercent > this.config.maxDistanceToEmaPercent) {
      this.logger.warn('[BlockingRules] GLOBAL_2: EMA distance too far', {
        distance: distancePercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        max: this.config.maxDistanceToEmaPercent,
      });
      return {
        blocked: true,
        blockId: 'GLOBAL_2',
        reason: `EMA distance ${distancePercent.toFixed(DECIMAL_PLACES.PERCENT)}% > ${this.config.maxDistanceToEmaPercent}% (falling knife / blow-off top)`,
      };
    }
    return { blocked: false };
  }

  /**
   * GLOBAL_3: Check active positions limit (max 1)
   */
  private checkActivePositionLimit(hasActivePosition: boolean): BlockingResult {
    if (hasActivePosition) {
      this.logger.warn('[BlockingRules] GLOBAL_3: Active position exists');
      return {
        blocked: true,
        blockId: 'GLOBAL_3',
        reason: 'Active position exists (max 1 position limit)',
      };
    }
    return { blocked: false };
  }

  /**
   * GLOBAL_4: Check cooldown period (10 sec between signals)
   */
  private checkCooldownPeriod(lastSignalTime: number): BlockingResult {
    const now = Date.now();
    const timeSinceLastSignal = now - lastSignalTime;

    if (timeSinceLastSignal < this.config.cooldownPeriodMs) {
      this.logger.debug('[BlockingRules] GLOBAL_4: Cooldown period active', {
        timeSince: timeSinceLastSignal,
        required: this.config.cooldownPeriodMs,
      });
      return {
        blocked: true,
        blockId: 'GLOBAL_4',
        reason: `Cooldown period active (${timeSinceLastSignal}ms < ${this.config.cooldownPeriodMs}ms)`,
      };
    }
    return { blocked: false };
  }

  /**
   * VOL_TREND_1 / VOL_LEVEL_1: Check volume
   */
  private checkVolume(candles: Candle[], strategy: string): BlockingResult {
    const volumeAnalysis = this.volumeCalculator.calculate(candles);

    if (!volumeAnalysis || volumeAnalysis.avgVolume === 0) {
      return { blocked: false }; // No volume data, skip check
    }

    const threshold =
      strategy === 'LevelBased'
        ? this.config.volumeMinMultiplierLevel
        : this.config.volumeMinMultiplierTrend;

    if (volumeAnalysis.isLowVolume && volumeAnalysis.volumeRatio < threshold) {
      this.logger.warn('[BlockingRules] VOL: Low volume', {
        strategy,
        ratio: volumeAnalysis.volumeRatio.toFixed(DECIMAL_PLACES.PERCENT),
        threshold,
      });
      return {
        blocked: true,
        blockId: strategy === 'LevelBased' ? 'VOL_LEVEL_1' : 'VOL_TREND_1',
        reason: `Low volume: ${volumeAnalysis.volumeRatio.toFixed(DECIMAL_PLACES.PERCENT)}x < ${threshold}x (low liquidity risk)`,
      };
    }
    return { blocked: false };
  }

  /**
   * WICK_LONG / WICK_SHORT: Check for large wicks (rejection candles)
   */
  private checkWicks(candles: Candle[], direction: SignalDirection): BlockingResult {
    if (candles.length < MIN_WICK_CHECK_CANDLES) {
      return { blocked: false }; // Not enough candles to check
    }

    // Check last 3 candles
    const recentCandles = candles.slice(-(MIN_WICK_CHECK_CANDLES as number));

    for (const candle of recentCandles) {
      const wickAnalysis = this.wickAnalyzer.analyze(candle);

      if (wickAnalysis.hasLargeWick) {
        const blocks = this.wickAnalyzer.blocksSignal(wickAnalysis, direction);
        if (blocks) {
          this.logger.warn('[BlockingRules] WICK: Large wick detected', {
            direction,
            wickDirection: wickAnalysis.wickDirection,
          });
          return {
            blocked: true,
            blockId: direction === SignalDirection.LONG ? 'WICK_LONG' : 'WICK_SHORT',
            reason: `Large ${wickAnalysis.wickDirection} wick detected (rejection candle)`,
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * ATH_LONG: Check ATH protection (avoid buying tops)
   * Only for LONG signals in Trend-Following strategy
   */
  private checkAthProtection(candles: Candle[], currentPrice: number): BlockingResult {
    if (candles.length < CANDLES_FOR_24H_HIGH) {
      return { blocked: false }; // Not enough data for 24h high
    }

    // Get 24h high (last 288 candles at 5m)
    const last24hCandles = candles.slice(-CANDLES_FOR_24H_HIGH);
    const high24h = Math.max(...last24hCandles.map((c) => c.high));

    // Calculate drop from high
    const dropFromHighPercent = ((high24h - currentPrice) / high24h) * PERCENT_MULTIPLIER;

    if (dropFromHighPercent < this.config.minDropFromAthForLong) {
      this.logger.warn('[BlockingRules] ATH_LONG: Too close to ATH', {
        dropFromHigh: dropFromHighPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        min: this.config.minDropFromAthForLong,
      });
      return {
        blocked: true,
        blockId: 'ATH_LONG',
        reason: `Too close to ATH: drop ${dropFromHighPercent.toFixed(DECIMAL_PLACES.PERCENT)}% < ${this.config.minDropFromAthForLong}% (buying the top risk)`,
      };
    }

    return { blocked: false };
  }
}
