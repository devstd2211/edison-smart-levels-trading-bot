/**
 * Level Strength Calculation Utilities
 *
 * Unified level strength calculation for consistent behavior
 * across LevelBasedStrategy and LevelAnalyzer.
 *
 * Strength is calculated on 0-1 scale based on:
 * - Touch count (0-0.5): More touches = stronger level
 * - Recency (0-0.3): Recent touches are more relevant
 * - Volume (0-0.2): Higher volume at touches = stronger level
 */

import { Candle, SwingPoint } from '../types';

// ============================================================================
// INTERFACES
// ============================================================================

export interface LevelStrengthConfig {
  minTouchesForStrong: number; // Touches needed for max touch strength (default: 5)
  recencyDecayDays: number; // Days after which recency factor decays to 0 (default: 7)
  volumeBoostThreshold: number; // Volume ratio threshold for max volume boost (default: 1.5)
  // Time-weighted strength options
  timeWeighted?: {
    enabled: boolean;
    recentTouchBonusPercent: number; // Bonus % for recent touches (default: 20)
    recentPeriodHours: number; // What counts as "recent" (default: 24)
  };
  // Timeframe-aware recency decay (faster decay for shorter timeframes)
  // If set, overrides recencyDecayDays based on candle interval
  timeframeAwareDecay?: {
    enabled: boolean;
    candleIntervalMinutes: number; // e.g., 1 for 1m, 5 for 5m
    // Decay days by timeframe:
    // 1m -> 2 days, 5m -> 3 days, 15m+ -> 7 days
  };
}

export interface LevelStrengthInput {
  touches: number;
  lastTouchTimestamp: number;
  currentTimestamp: number;
  avgVolumeAtTouch?: number; // Optional - not always available
  avgCandleVolume?: number; // Optional - for volume comparison
  touchTimestamps?: number[]; // Optional - timestamps of all touches for time-weighting
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: LevelStrengthConfig = {
  minTouchesForStrong: 5,
  recencyDecayDays: 7,
  volumeBoostThreshold: 1.5,
};

// ============================================================================
// STRENGTH WEIGHTS
// ============================================================================

const TOUCH_WEIGHT = 0.5; // Max contribution from touches
const RECENCY_WEIGHT = 0.3; // Max contribution from recency
const VOLUME_WEIGHT = 0.2; // Max contribution from volume

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Calculate level strength on 0-1 scale
 *
 * Formula:
 * - Touch strength (0-0.5): min(touches / minTouchesForStrong, 1.0) * 0.5
 * - Recency strength (0-0.3): max(0, 1 - daysSinceLastTouch / recencyDecayDays) * 0.3
 * - Volume strength (0-0.2): min(volumeRatio / volumeBoostThreshold, 1.0) * 0.2
 *
 * @param input - Level strength input parameters
 * @param config - Configuration (optional, uses defaults if not provided)
 * @returns Strength value between 0 and 1
 */
export function calculateLevelStrength(
  input: LevelStrengthInput,
  config: Partial<LevelStrengthConfig> = {},
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Touch strength (0-0.5)
  const touchRatio = Math.min(input.touches / cfg.minTouchesForStrong, 1.0);
  const touchStrength = touchRatio * TOUCH_WEIGHT;

  // Determine effective recency decay days (timeframe-aware if enabled)
  let effectiveRecencyDecayDays = cfg.recencyDecayDays;
  if (cfg.timeframeAwareDecay?.enabled) {
    const intervalMinutes = cfg.timeframeAwareDecay.candleIntervalMinutes;
    // Faster decay for shorter timeframes:
    // 1m -> 2 days, 5m -> 3 days, 15m -> 5 days, 30m+ -> 7 days
    if (intervalMinutes <= 1) {
      effectiveRecencyDecayDays = 2;
    } else if (intervalMinutes <= 5) {
      effectiveRecencyDecayDays = 3;
    } else if (intervalMinutes <= 15) {
      effectiveRecencyDecayDays = 5;
    } else {
      effectiveRecencyDecayDays = 7;
    }
  }

  // Recency strength (0-0.3)
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const daysSinceLastTouch = (input.currentTimestamp - input.lastTouchTimestamp) / MS_PER_DAY;
  const recencyFactor = Math.max(0, 1 - daysSinceLastTouch / effectiveRecencyDecayDays);
  const recencyStrength = recencyFactor * RECENCY_WEIGHT;

  // Volume strength (0-0.2) - only if volume data available
  let volumeStrength = 0;
  if (
    input.avgVolumeAtTouch !== undefined &&
    input.avgCandleVolume !== undefined &&
    input.avgCandleVolume > 0
  ) {
    const volumeRatio = input.avgVolumeAtTouch / input.avgCandleVolume;
    volumeStrength = Math.min(volumeRatio / cfg.volumeBoostThreshold, 1.0) * VOLUME_WEIGHT;
  }

  // Base strength
  let baseStrength = touchStrength + recencyStrength + volumeStrength;

  // Time-weighted bonus - recent touches count more
  if (cfg.timeWeighted?.enabled && input.touchTimestamps && input.touchTimestamps.length > 0) {
    const recentPeriodMs = cfg.timeWeighted.recentPeriodHours * 60 * 60 * 1000;
    const recentThreshold = input.currentTimestamp - recentPeriodMs;

    // Count how many touches are within the recent period
    const recentTouches = input.touchTimestamps.filter(ts => ts >= recentThreshold).length;
    const recentRatio = recentTouches / input.touchTimestamps.length;

    // Apply bonus: up to recentTouchBonusPercent% extra strength
    const bonusMultiplier = 1 + (recentRatio * cfg.timeWeighted.recentTouchBonusPercent / 100);
    baseStrength *= bonusMultiplier;
  }

  // Total strength capped at 1.0
  return Math.min(baseStrength, 1.0);
}

/**
 * Simplified strength calculation (touch-based only)
 *
 * Use this when volume/recency data is not available.
 * Returns 0-1 based on touch count only.
 *
 * @param touches - Number of touches
 * @param minTouchesForStrong - Touches needed for max strength (default: 5)
 * @returns Strength value between 0 and 1
 */
export function calculateSimpleLevelStrength(
  touches: number,
  minTouchesForStrong: number = DEFAULT_CONFIG.minTouchesForStrong,
): number {
  return Math.min(touches / minTouchesForStrong, 1.0);
}

/**
 * Calculate average volume at touch points
 *
 * @param cluster - Array of swing points forming the level
 * @param candles - Candle data for volume lookup
 * @returns Average volume at touch points (0 if no matches)
 */
export function calculateAvgVolumeAtTouches(cluster: SwingPoint[], candles: Candle[]): number {
  if (candles.length === 0 || cluster.length === 0) {
    return 0;
  }

  let totalVolume = 0;
  let count = 0;
  const TIMESTAMP_TOLERANCE_MS = 60000; // Within 1 minute

  for (const point of cluster) {
    const candle = candles.find(c => Math.abs(c.timestamp - point.timestamp) < TIMESTAMP_TOLERANCE_MS);
    if (candle) {
      totalVolume += candle.volume;
      count++;
    }
  }

  return count > 0 ? totalVolume / count : 0;
}

/**
 * Calculate average candle volume
 *
 * @param candles - Candle data
 * @returns Average volume across all candles
 */
export function calculateAvgCandleVolume(candles: Candle[]): number {
  if (candles.length === 0) {
    return 0;
  }
  return candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;
}
