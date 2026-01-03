/**
 * Level Analyzer
 *
 * Analyzes support/resistance levels from swing points and provides
 * trading signals based on price proximity to key levels.
 *
 * Key features:
 * - Level detection from swing points with clustering
 * - Level strength calculation (touches, recency, volume)
 * - Distance-based confidence scoring
 * - Direction determination based on level type
 *
 * This analyzer integrates with AnalyzerRegistry for weighted voting.
 */

import {
  SwingPoint,
  SwingPointType,
  SignalDirection,
  AnalyzerSignal,
  LoggerService,
  Candle,
  VolumeProfileIntegrationConfig,
  OrderBookAnalysis,
  OrderBookWall,
} from '../types';
import {
  calculateLevelStrength as calculateLevelStrengthUtil,
  calculateAvgVolumeAtTouches as calculateAvgVolumeAtTouchesUtil,
  calculateAvgCandleVolume,
} from '../utils/level-strength.utils';
import { VolumeProfileAnalyzer, VolumeProfileResult } from './volume-profile.analyzer';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Level {
  price: number;
  type: 'SUPPORT' | 'RESISTANCE';
  strength: number; // 0-1 based on touches and recency
  touches: number;
  lastTouchTimestamp: number;
  avgVolumeAtTouch: number;
  source?: 'SWING' | 'VOLUME_PROFILE' | 'COMBINED'; // Origin of the level
  volumeProfileMatch?: boolean; // True if swing level matches HVN/POC
  // Level Exhaustion tracking
  breakouts?: number; // Number of times price broke through this level
  exhaustionPenalty?: number; // Strength penalty from exhaustion (0-1)
  // Orderbook validation
  orderbookConfirmed?: boolean; // True if orderbook wall confirms this level
  orderbookWall?: OrderBookWall; // The wall that confirms this level
}

export interface LevelAnalyzerConfig {
  clusterThresholdPercent: number; // Group levels within this % (default: 0.5%)
  minTouchesRequired: number; // Minimum touches for valid level (default: 3)
  minTouchesForStrong: number; // Touches for "strong" level (default: 5)
  maxDistancePercent: number; // Max distance to level for signal (default: 1.0%)
  veryCloseDistancePercent: number; // "Very close" threshold for boost (default: 0.3%)
  recencyDecayDays: number; // Days after which level strength decays (default: 7)
  volumeBoostThreshold: number; // Volume ratio for strength boost (default: 1.5)
  baseConfidence: number; // Base confidence for signal (default: 60)
  maxConfidence: number; // Maximum confidence cap (default: 90)
  // Tiebreak preference when support and resistance scores are equal
  tiebreakPreference?: 'LONG' | 'SHORT' | 'NEAREST' | 'STRONGEST'; // default: NEAREST
  // Dynamic clustering based on ATR
  dynamicClusterThreshold?: {
    enabled: boolean;
    atrMultiplier: number; // Multiply ATR % by this for cluster threshold (default: 0.3)
  };
  // Time-weighted strength - recent touches count more
  timeWeightedStrength?: {
    enabled: boolean;
    recentTouchBonusPercent: number; // Bonus % for recent touches (default: 20)
    recentPeriodHours: number; // What counts as "recent" (default: 24)
  };
  // Volume Profile Integration (shared config - see VolumeProfileIntegrationConfig)
  volumeProfile?: VolumeProfileIntegrationConfig;
  // Level age expiration - levels older than this are ignored (default: 150 candles for 1m = 2.5 hours)
  maxLevelAgeCandles?: number;
  // Candle interval in minutes for age calculation (default: 1)
  candleIntervalMinutes?: number;
  // Asymmetric distance multiplier for trend-aligned entries (default: 1.5)
  trendAlignedDistanceMultiplier?: number;
  // Level Exhaustion - weaken levels that have been broken through multiple times
  levelExhaustion?: {
    enabled: boolean;
    // Penalty per breakout (default: 0.15 = 15% strength reduction per breakout)
    penaltyPerBreakout: number;
    // Max penalty cap (default: 0.6 = level can lose max 60% strength)
    maxPenalty: number;
    // Breakout threshold - how far price must close beyond level to count as breakout (default: 0.1%)
    breakoutThresholdPercent: number;
    // Lookback candles for breakout detection (default: 50)
    lookbackCandles: number;
  };
  // Orderbook validation - boost/confirm levels with orderbook walls
  orderbookValidation?: {
    enabled: boolean;
    // Minimum wall size (% of total orderbook volume) to consider as confirmation (default: 5%)
    minWallPercent: number;
    // Strength boost when orderbook confirms level (default: 0.15 = +15% strength)
    strengthBoost: number;
    // Max distance from level to wall price (% of price) (default: 0.3%)
    maxDistancePercent: number;
    // Require orderbook confirmation for entry (default: false = boost only)
    requireConfirmation: boolean;
  };
}

export interface LevelAnalysisResult {
  nearestLevel: Level | null;
  distancePercent: number;
  direction: SignalDirection;
  confidence: number;
  reason: string;
  allLevels: {
    support: Level[];
    resistance: Level[];
  };
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: LevelAnalyzerConfig = {
  clusterThresholdPercent: 0.5,
  minTouchesRequired: 3,
  minTouchesForStrong: 5,
  maxDistancePercent: 1.0,
  veryCloseDistancePercent: 0.3,
  recencyDecayDays: 7,
  volumeBoostThreshold: 1.5,
  baseConfidence: 60,
  maxConfidence: 90,
};

// ============================================================================
// LEVEL ANALYZER
// ============================================================================

export class LevelAnalyzer {
  private config: LevelAnalyzerConfig;
  private volumeProfileAnalyzer: VolumeProfileAnalyzer | null = null;

  constructor(
    private logger: LoggerService,
    config?: Partial<LevelAnalyzerConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize VolumeProfileAnalyzer if enabled
    if (this.config.volumeProfile?.enabled) {
      this.volumeProfileAnalyzer = new VolumeProfileAnalyzer(logger, {
        maxDistancePercent: config?.maxDistancePercent ?? 1.0,
      });
      this.logger.info('📊 LevelAnalyzer: VolumeProfile integration enabled');
    }
  }

  /**
   * Analyze swing points and current price to generate level-based signal
   * @param atrPercent - Optional ATR % for dynamic clustering threshold
   */
  analyze(
    swingPoints: SwingPoint[],
    currentPrice: number,
    candles: Candle[],
    currentTimestamp: number,
    atrPercent?: number,
  ): LevelAnalysisResult {
    // Build levels from swing points (with optional dynamic clustering)
    const swingHighs = swingPoints.filter(sp => sp.type === SwingPointType.HIGH);
    const swingLows = swingPoints.filter(sp => sp.type === SwingPointType.LOW);

    const resistanceLevels = this.buildLevels(swingHighs, 'RESISTANCE', candles, currentTimestamp, atrPercent);
    const supportLevels = this.buildLevels(swingLows, 'SUPPORT', candles, currentTimestamp, atrPercent);

    // Find nearest valid levels
    const nearestResistance = this.findNearestLevel(currentPrice, resistanceLevels, 'RESISTANCE');
    const nearestSupport = this.findNearestLevel(currentPrice, supportLevels, 'SUPPORT');

    // Determine which level to use and direction
    const { level, direction, distancePercent } = this.selectLevel(
      currentPrice,
      nearestSupport,
      nearestResistance,
    );

    if (!level) {
      return {
        nearestLevel: null,
        distancePercent: Infinity,
        direction: SignalDirection.HOLD,
        confidence: 0,
        reason: 'No valid level within distance threshold',
        allLevels: { support: supportLevels, resistance: resistanceLevels },
      };
    }

    // Calculate confidence
    const confidence = this.calculateConfidence(level, distancePercent);

    const reason = `${direction} from ${level.type.toLowerCase()} ${level.price.toFixed(4)} ` +
      `(${level.touches}T, str:${level.strength.toFixed(2)}, dist:${distancePercent.toFixed(2)}%)`;

    this.logger.debug('📊 LevelAnalyzer result', {
      direction,
      levelPrice: level.price.toFixed(4),
      levelType: level.type,
      touches: level.touches,
      strength: level.strength.toFixed(2),
      distancePercent: distancePercent.toFixed(2),
      confidence,
    });

    return {
      nearestLevel: level,
      distancePercent,
      direction,
      confidence,
      reason,
      allLevels: { support: supportLevels, resistance: resistanceLevels },
    };
  }

  /**
   * Get cluster threshold - static or dynamic based on ATR
   */
  private getClusterThreshold(atrPercent?: number): number {
    const dynamicConfig = this.config.dynamicClusterThreshold;

    if (dynamicConfig?.enabled && atrPercent !== undefined) {
      // Dynamic threshold: ATR * multiplier (converted to ratio)
      const dynamicThreshold = atrPercent * dynamicConfig.atrMultiplier / 100;
      // Ensure it's at least the static threshold
      return Math.max(dynamicThreshold, this.config.clusterThresholdPercent / 100);
    }

    // Static threshold (default behavior)
    return this.config.clusterThresholdPercent / 100;
  }

  /**
   * Build levels from swing points with clustering
   * @param atrPercent - Optional ATR % for dynamic clustering threshold
   */
  private buildLevels(
    swingPoints: SwingPoint[],
    type: 'SUPPORT' | 'RESISTANCE',
    candles: Candle[],
    currentTimestamp: number,
    atrPercent?: number,
  ): Level[] {
    if (swingPoints.length === 0) {
      return [];
    }

    const levels: Level[] = [];
    const clusterThreshold = this.getClusterThreshold(atrPercent);

    // Sort by price
    const sorted = [...swingPoints].sort((a, b) => a.price - b.price);

    // Cluster nearby points
    let currentCluster: SwingPoint[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const point = sorted[i];
      const clusterAvgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
      const priceDiff = Math.abs(point.price - clusterAvgPrice) / clusterAvgPrice;

      if (priceDiff <= clusterThreshold) {
        currentCluster.push(point);
      } else {
        // Create level from current cluster if it has enough touches
        if (currentCluster.length >= this.config.minTouchesRequired) {
          levels.push(this.createLevelFromCluster(currentCluster, type, candles, currentTimestamp));
        }
        currentCluster = [point];
      }
    }

    // Process last cluster
    if (currentCluster.length >= this.config.minTouchesRequired) {
      levels.push(this.createLevelFromCluster(currentCluster, type, candles, currentTimestamp));
    }

    return levels;
  }

  /**
   * Create a level from a cluster of swing points
   * Uses unified level-strength.utils for consistent calculation
   */
  private createLevelFromCluster(
    cluster: SwingPoint[],
    type: 'SUPPORT' | 'RESISTANCE',
    candles: Candle[],
    currentTimestamp: number,
  ): Level {
    // Calculate average price
    const avgPrice = cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;

    // Get touches count
    const touches = cluster.length;

    // Get last touch timestamp
    const lastTouchTimestamp = Math.max(...cluster.map(p => p.timestamp));

    // Get all touch timestamps for time-weighting
    const touchTimestamps = cluster.map(p => p.timestamp);

    // Calculate average volume at touch points (using unified util)
    const avgVolumeAtTouch = calculateAvgVolumeAtTouchesUtil(cluster, candles);

    // Calculate average candle volume for comparison
    const avgCandleVol = calculateAvgCandleVolume(candles);

    // Calculate strength using unified function (with optional time-weighting)
    const strength = calculateLevelStrengthUtil(
      {
        touches,
        lastTouchTimestamp,
        currentTimestamp,
        avgVolumeAtTouch,
        avgCandleVolume: avgCandleVol,
        touchTimestamps,
      },
      {
        minTouchesForStrong: this.config.minTouchesForStrong,
        recencyDecayDays: this.config.recencyDecayDays,
        volumeBoostThreshold: this.config.volumeBoostThreshold,
        timeWeighted: this.config.timeWeightedStrength,
      },
    );

    return {
      price: avgPrice,
      type,
      strength,
      touches,
      lastTouchTimestamp,
      avgVolumeAtTouch,
    };
  }

  /**
   * Find nearest level within distance threshold
   */
  private findNearestLevel(
    currentPrice: number,
    levels: Level[],
    levelType: 'SUPPORT' | 'RESISTANCE',
  ): Level | null {
    if (levels.length === 0) {
      return null;
    }

    let nearest: Level | null = null;
    let minDistance = Infinity;

    for (const level of levels) {
      const distancePercent = Math.abs((currentPrice - level.price) / level.price) * 100;

      // Direction check:
      // For SUPPORT: price should be at or above the level (bouncing from support)
      // For RESISTANCE: price should be at or below the level (bouncing from resistance)
      const validDirection = levelType === 'SUPPORT'
        ? currentPrice >= level.price
        : currentPrice <= level.price;

      if (validDirection &&
          distancePercent <= this.config.maxDistancePercent &&
          distancePercent < minDistance) {
        nearest = level;
        minDistance = distancePercent;
      }
    }

    return nearest;
  }

  /**
   * Select the best level and determine direction
   * Uses configurable tiebreak logic to avoid LONG/SHORT bias
   */
  private selectLevel(
    currentPrice: number,
    nearestSupport: Level | null,
    nearestResistance: Level | null,
  ): { level: Level | null; direction: SignalDirection; distancePercent: number } {
    if (!nearestSupport && !nearestResistance) {
      return { level: null, direction: SignalDirection.HOLD, distancePercent: Infinity };
    }

    const supportDistance = nearestSupport
      ? Math.abs((currentPrice - nearestSupport.price) / nearestSupport.price) * 100
      : Infinity;

    const resistanceDistance = nearestResistance
      ? Math.abs((currentPrice - nearestResistance.price) / nearestResistance.price) * 100
      : Infinity;

    // Choose the level with higher strength-adjusted score
    // Score = strength / (1 + distance)
    const supportScore = nearestSupport
      ? nearestSupport.strength / (1 + supportDistance / 100)
      : 0;
    const resistanceScore = nearestResistance
      ? nearestResistance.strength / (1 + resistanceDistance / 100)
      : 0;

    // Handle tie or near-tie based on tiebreak preference
    const tiebreakPreference = this.config.tiebreakPreference;
    const scoreDiff = Math.abs(supportScore - resistanceScore);
    const isTie = scoreDiff < 0.01; // Scores within 1% are considered a tie

    if (supportScore > resistanceScore && nearestSupport) {
      // Clear winner: support
      return {
        level: nearestSupport,
        direction: SignalDirection.LONG,
        distancePercent: supportDistance,
      };
    } else if (resistanceScore > supportScore && nearestResistance) {
      // Clear winner: resistance
      return {
        level: nearestResistance,
        direction: SignalDirection.SHORT,
        distancePercent: resistanceDistance,
      };
    } else if (isTie && nearestSupport && nearestResistance) {
      // Tie - use tiebreak preference
      switch (tiebreakPreference) {
        case 'LONG':
          return {
            level: nearestSupport,
            direction: SignalDirection.LONG,
            distancePercent: supportDistance,
          };
        case 'SHORT':
          return {
            level: nearestResistance,
            direction: SignalDirection.SHORT,
            distancePercent: resistanceDistance,
          };
        case 'STRONGEST':
          // Pick the level with higher absolute strength
          if (nearestSupport.strength >= nearestResistance.strength) {
            return {
              level: nearestSupport,
              direction: SignalDirection.LONG,
              distancePercent: supportDistance,
            };
          } else {
            return {
              level: nearestResistance,
              direction: SignalDirection.SHORT,
              distancePercent: resistanceDistance,
            };
          }
        case 'NEAREST':
        default:
          // Pick the closer level (by distance)
          if (supportDistance <= resistanceDistance) {
            return {
              level: nearestSupport,
              direction: SignalDirection.LONG,
              distancePercent: supportDistance,
            };
          } else {
            return {
              level: nearestResistance,
              direction: SignalDirection.SHORT,
              distancePercent: resistanceDistance,
            };
          }
      }
    } else if (nearestSupport) {
      return {
        level: nearestSupport,
        direction: SignalDirection.LONG,
        distancePercent: supportDistance,
      };
    } else if (nearestResistance) {
      return {
        level: nearestResistance,
        direction: SignalDirection.SHORT,
        distancePercent: resistanceDistance,
      };
    }

    return { level: null, direction: SignalDirection.HOLD, distancePercent: Infinity };
  }

  /**
   * Calculate confidence based on level properties and distance
   */
  private calculateConfidence(level: Level, distancePercent: number): number {
    let confidence = this.config.baseConfidence;

    // Strength boost (0-20%)
    confidence += level.strength * 20;

    // Distance modifier
    if (distancePercent <= this.config.veryCloseDistancePercent) {
      // Very close - boost confidence
      confidence *= 1.15;
    } else if (distancePercent > this.config.maxDistancePercent * 0.7) {
      // Far - reduce confidence
      confidence *= 0.85;
    }

    // Touches bonus (up to 10%)
    const touchesBonus = Math.min((level.touches - this.config.minTouchesRequired) * 2, 10);
    confidence += touchesBonus;

    return Math.min(Math.round(confidence), this.config.maxConfidence);
  }

  /**
   * Generate AnalyzerSignal for AnalyzerRegistry integration
   */
  generateSignal(
    swingPoints: SwingPoint[],
    currentPrice: number,
    candles: Candle[],
    currentTimestamp: number,
  ): AnalyzerSignal | null {
    const result = this.analyze(swingPoints, currentPrice, candles, currentTimestamp);

    if (!result.nearestLevel || result.direction === SignalDirection.HOLD) {
      return null;
    }

    return {
      source: 'LEVEL_ANALYZER',
      direction: result.direction,
      confidence: result.confidence,
      weight: 0.25, // High weight - this is core level analysis
      priority: 7,
    };
  }

  /**
   * Get all levels without minTouches filtering
   * Used by strategies that want to apply their own filtering logic
   * Optionally integrates VolumeProfile levels (VAH/VAL) and HVN matching
   *
   * @param swingPoints - All swing points to analyze
   * @param candles - Candle data for volume/timestamp calculations
   * @param currentTimestamp - Current time for age filtering
   * @param atrPercent - Optional ATR % for dynamic clustering threshold
   * @param trendContext - Optional trend context for asymmetric distance ('UPTREND' | 'DOWNTREND' | 'NEUTRAL')
   * @param orderbook - Optional orderbook analysis for level validation
   */
  getAllLevels(
    swingPoints: SwingPoint[],
    candles: Candle[],
    currentTimestamp: number,
    atrPercent?: number,
    trendContext?: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
    orderbook?: OrderBookAnalysis | null,
  ): { support: Level[]; resistance: Level[]; volumeProfile?: VolumeProfileResult | null; trendContext?: string } {
    const swingHighs = swingPoints.filter(sp => sp.type === SwingPointType.HIGH);
    const swingLows = swingPoints.filter(sp => sp.type === SwingPointType.LOW);

    // Build swing-based levels WITHOUT minTouches filter but WITH dynamic clustering
    let resistanceLevels = this.buildLevelsUnfiltered(swingHighs, 'RESISTANCE', candles, currentTimestamp, atrPercent);
    let supportLevels = this.buildLevelsUnfiltered(swingLows, 'SUPPORT', candles, currentTimestamp, atrPercent);

    // Apply level age filtering if configured
    if (this.config.maxLevelAgeCandles) {
      const candleIntervalMs = (this.config.candleIntervalMinutes ?? 1) * 60 * 1000;
      const maxAgeMs = this.config.maxLevelAgeCandles * candleIntervalMs;

      const beforeFilterCount = { support: supportLevels.length, resistance: resistanceLevels.length };

      resistanceLevels = resistanceLevels.filter(level =>
        (currentTimestamp - level.lastTouchTimestamp) <= maxAgeMs,
      );
      supportLevels = supportLevels.filter(level =>
        (currentTimestamp - level.lastTouchTimestamp) <= maxAgeMs,
      );

      const afterFilterCount = { support: supportLevels.length, resistance: resistanceLevels.length };
      const expiredSupport = beforeFilterCount.support - afterFilterCount.support;
      const expiredResistance = beforeFilterCount.resistance - afterFilterCount.resistance;

      if (expiredSupport > 0 || expiredResistance > 0) {
        this.logger.debug('📊 Level Age Filter applied', {
          maxAgeCandles: this.config.maxLevelAgeCandles,
          expiredSupport,
          expiredResistance,
          remainingSupport: afterFilterCount.support,
          remainingResistance: afterFilterCount.resistance,
        });
      }
    }

    // Mark all swing levels with source
    resistanceLevels.forEach(l => l.source = 'SWING');
    supportLevels.forEach(l => l.source = 'SWING');

    // Integrate VolumeProfile if enabled
    let volumeProfile: VolumeProfileResult | null = null;
    if (this.volumeProfileAnalyzer && this.config.volumeProfile?.enabled) {
      volumeProfile = this.volumeProfileAnalyzer.calculateProfile(candles);

      if (volumeProfile) {
        const vpConfig = this.config.volumeProfile;

        // Boost swing levels that match HVN/POC
        if (vpConfig.boostHvnMatch) {
          resistanceLevels = this.boostHvnMatchingLevels(resistanceLevels, volumeProfile, vpConfig);
          supportLevels = this.boostHvnMatchingLevels(supportLevels, volumeProfile, vpConfig);
        }

        // Add VAH/VAL as additional levels
        if (vpConfig.addVahValLevels) {
          const vahLevel = this.createVolumeProfileLevel(
            volumeProfile.vah,
            'RESISTANCE',
            vpConfig.vahValStrength,
            currentTimestamp,
          );
          const valLevel = this.createVolumeProfileLevel(
            volumeProfile.val,
            'SUPPORT',
            vpConfig.vahValStrength,
            currentTimestamp,
          );

          resistanceLevels.push(vahLevel);
          supportLevels.push(valLevel);

          this.logger.debug('📊 VolumeProfile levels added', {
            vah: volumeProfile.vah.toFixed(4),
            val: volumeProfile.val.toFixed(4),
            poc: volumeProfile.poc.price.toFixed(4),
            hvnCount: volumeProfile.hvnLevels.length,
          });
        }
      }
    }

    // Apply Level Exhaustion if enabled
    if (this.config.levelExhaustion?.enabled) {
      resistanceLevels = this.applyLevelExhaustion(resistanceLevels, candles, 'RESISTANCE');
      supportLevels = this.applyLevelExhaustion(supportLevels, candles, 'SUPPORT');
    }

    // Apply Orderbook Validation if enabled and orderbook data provided
    if (this.config.orderbookValidation?.enabled && orderbook) {
      resistanceLevels = this.validateLevelsWithOrderbook(resistanceLevels, orderbook, 'RESISTANCE');
      supportLevels = this.validateLevelsWithOrderbook(supportLevels, orderbook, 'SUPPORT');
    }

    return { support: supportLevels, resistance: resistanceLevels, volumeProfile, trendContext };
  }

  /**
   * Apply Level Exhaustion - detect breakouts and reduce level strength
   * A breakout occurs when price closes beyond the level threshold
   *
   * @param levels - Levels to analyze
   * @param candles - Recent candles for breakout detection
   * @param levelType - SUPPORT or RESISTANCE
   * @returns Levels with exhaustion penalty applied
   */
  private applyLevelExhaustion(
    levels: Level[],
    candles: Candle[],
    levelType: 'SUPPORT' | 'RESISTANCE',
  ): Level[] {
    const exhaustionConfig = this.config.levelExhaustion;
    if (!exhaustionConfig) return levels;

    const {
      penaltyPerBreakout = 0.15,
      maxPenalty = 0.6,
      breakoutThresholdPercent = 0.1,
      lookbackCandles = 50,
    } = exhaustionConfig;

    // Get recent candles for breakout detection
    const recentCandles = candles.slice(-lookbackCandles);

    return levels.map(level => {
      let breakoutCount = 0;

      for (const candle of recentCandles) {
        const thresholdDistance = level.price * (breakoutThresholdPercent / 100);

        if (levelType === 'SUPPORT') {
          // Support breakout: candle closes BELOW support by threshold
          if (candle.close < level.price - thresholdDistance) {
            breakoutCount++;
          }
        } else {
          // Resistance breakout: candle closes ABOVE resistance by threshold
          if (candle.close > level.price + thresholdDistance) {
            breakoutCount++;
          }
        }
      }

      if (breakoutCount === 0) {
        return level;
      }

      // Calculate penalty (capped at maxPenalty)
      const exhaustionPenalty = Math.min(breakoutCount * penaltyPerBreakout, maxPenalty);
      const adjustedStrength = Math.max(level.strength * (1 - exhaustionPenalty), 0.1);

      if (breakoutCount > 0) {
        this.logger.debug('📉 Level Exhaustion applied', {
          levelType,
          price: level.price.toFixed(4),
          breakouts: breakoutCount,
          originalStrength: level.strength.toFixed(2),
          penalty: (exhaustionPenalty * 100).toFixed(0) + '%',
          adjustedStrength: adjustedStrength.toFixed(2),
        });
      }

      return {
        ...level,
        breakouts: breakoutCount,
        exhaustionPenalty,
        strength: adjustedStrength,
      };
    });
  }

  /**
   * Validate levels with orderbook walls
   * Boosts level strength if matching wall found:
   * - SUPPORT: confirmed by BID wall (buyers defending the level)
   * - RESISTANCE: confirmed by ASK wall (sellers defending the level)
   *
   * @param levels - Levels to validate
   * @param orderbook - Orderbook analysis with walls
   * @param levelType - SUPPORT or RESISTANCE
   * @returns Levels with orderbook confirmation applied
   */
  private validateLevelsWithOrderbook(
    levels: Level[],
    orderbook: OrderBookAnalysis,
    levelType: 'SUPPORT' | 'RESISTANCE',
  ): Level[] {
    const obConfig = this.config.orderbookValidation;
    if (!obConfig) return levels;

    const {
      minWallPercent = 5,
      strengthBoost = 0.15,
      maxDistancePercent = 0.3,
    } = obConfig;

    // Filter walls by type: SUPPORT needs BID walls, RESISTANCE needs ASK walls
    const relevantWalls = orderbook.walls.filter(wall => {
      if (levelType === 'SUPPORT') {
        return wall.side === 'BID' && wall.percentOfTotal >= minWallPercent;
      } else {
        return wall.side === 'ASK' && wall.percentOfTotal >= minWallPercent;
      }
    });

    if (relevantWalls.length === 0) {
      return levels;
    }

    let confirmedCount = 0;

    const validatedLevels = levels.map(level => {
      // Find matching wall within maxDistancePercent of level price
      const matchingWall = relevantWalls.find(wall => {
        const distancePercent = Math.abs((wall.price - level.price) / level.price) * 100;
        return distancePercent <= maxDistancePercent;
      });

      if (!matchingWall) {
        return level;
      }

      confirmedCount++;

      // Boost strength with orderbook confirmation
      const boostedStrength = Math.min(level.strength + strengthBoost, 1.0);

      this.logger.debug('📗 Orderbook confirms level', {
        levelType,
        levelPrice: level.price.toFixed(4),
        wallPrice: matchingWall.price.toFixed(4),
        wallSide: matchingWall.side,
        wallPercent: matchingWall.percentOfTotal.toFixed(1) + '%',
        originalStrength: level.strength.toFixed(2),
        boostedStrength: boostedStrength.toFixed(2),
      });

      return {
        ...level,
        orderbookConfirmed: true,
        orderbookWall: matchingWall,
        strength: boostedStrength,
      };
    });

    if (confirmedCount > 0) {
      this.logger.info(`📗 Orderbook validation: ${confirmedCount}/${levels.length} ${levelType} levels confirmed`);
    }

    return validatedLevels;
  }

  /**
   * Get asymmetric max distance based on trend context
   * In trending markets, allow wider distance for trend-aligned levels:
   * - UPTREND: wider distance for SUPPORT (LONG entries)
   * - DOWNTREND: wider distance for RESISTANCE (SHORT entries)
   *
   * @param levelType - 'SUPPORT' or 'RESISTANCE'
   * @param trendContext - Current trend context
   * @returns Effective max distance percent
   */
  getAsymmetricMaxDistance(
    levelType: 'SUPPORT' | 'RESISTANCE',
    trendContext?: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
  ): number {
    const baseDistance = this.config.maxDistancePercent;
    const multiplier = this.config.trendAlignedDistanceMultiplier ?? 1.5;

    // In UPTREND: allow wider distance for SUPPORT (trend-aligned LONG)
    if (trendContext === 'UPTREND' && levelType === 'SUPPORT') {
      return baseDistance * multiplier;
    }

    // In DOWNTREND: allow wider distance for RESISTANCE (trend-aligned SHORT)
    if (trendContext === 'DOWNTREND' && levelType === 'RESISTANCE') {
      return baseDistance * multiplier;
    }

    return baseDistance;
  }

  /**
   * Boost strength of levels that match HVN (High Volume Nodes)
   */
  private boostHvnMatchingLevels(
    levels: Level[],
    volumeProfile: VolumeProfileResult,
    vpConfig: NonNullable<LevelAnalyzerConfig['volumeProfile']>,
  ): Level[] {
    const hvnPrices = volumeProfile.hvnLevels.map(h => h.price);
    hvnPrices.push(volumeProfile.poc.price); // POC is also a high volume area

    return levels.map(level => {
      // Check if level matches any HVN or POC
      const matchesHvn = hvnPrices.some(hvnPrice => {
        const distance = Math.abs((level.price - hvnPrice) / hvnPrice) * 100;
        return distance <= vpConfig.hvnMatchThresholdPercent;
      });

      if (matchesHvn) {
        return {
          ...level,
          strength: Math.min(level.strength + vpConfig.hvnStrengthBoost, 1.0),
          volumeProfileMatch: true,
          source: 'COMBINED' as const,
        };
      }
      return level;
    });
  }

  /**
   * Create a level from VolumeProfile data (VAH/VAL)
   */
  private createVolumeProfileLevel(
    price: number,
    type: 'SUPPORT' | 'RESISTANCE',
    strength: number,
    currentTimestamp: number,
  ): Level {
    return {
      price,
      type,
      strength,
      touches: 0, // Volume profile levels don't have touches
      lastTouchTimestamp: currentTimestamp,
      avgVolumeAtTouch: 0,
      source: 'VOLUME_PROFILE',
      volumeProfileMatch: false,
    };
  }

  /**
   * Build levels without minTouches filtering
   * Returns all clustered levels regardless of touch count
   * Now supports dynamic clustering based on ATR
   *
   * @param atrPercent - Optional ATR % for dynamic clustering threshold
   */
  private buildLevelsUnfiltered(
    swingPoints: SwingPoint[],
    type: 'SUPPORT' | 'RESISTANCE',
    candles: Candle[],
    currentTimestamp: number,
    atrPercent?: number,
  ): Level[] {
    if (swingPoints.length === 0) {
      return [];
    }

    const levels: Level[] = [];
    // Use dynamic clustering threshold if ATR is provided
    const clusterThreshold = this.getClusterThreshold(atrPercent);

    // Sort by price
    const sorted = [...swingPoints].sort((a, b) => a.price - b.price);

    // Cluster nearby points
    let currentCluster: SwingPoint[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const point = sorted[i];
      const clusterAvgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
      const priceDiff = Math.abs(point.price - clusterAvgPrice) / clusterAvgPrice;

      if (priceDiff <= clusterThreshold) {
        currentCluster.push(point);
      } else {
        // Create level from current cluster (no minTouches check)
        levels.push(this.createLevelFromCluster(currentCluster, type, candles, currentTimestamp));
        currentCluster = [point];
      }
    }

    // Process last cluster (no minTouches check)
    if (currentCluster.length > 0) {
      levels.push(this.createLevelFromCluster(currentCluster, type, candles, currentTimestamp));
    }

    return levels;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LevelAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LevelAnalyzerConfig {
    return { ...this.config };
  }
}
