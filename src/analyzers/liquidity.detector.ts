import {
  CONFIDENCE_THRESHOLDS,
  MULTIPLIERS,
  PERCENT_MULTIPLIER,
  PRICE_TOLERANCE,
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  FIRST_INDEX,
  MATH_BOUNDS,
  NEGATIVE_MARKERS,
} from '../constants';
/**
 * Liquidity Detector
 *
 * Detects liquidity zones (support/resistance levels where stop losses cluster)
 * and liquidity sweeps (false breakouts designed to trigger stops).
 *
 * Key concepts:
 * - Liquidity Zone: Price level with multiple swing points (stops cluster here)
 * - Liquidity Sweep: Price briefly breaks a zone to trigger stops, then reverses
 * - Fakeout: Sweep followed by quick reversal (strong signal)
 *
 * Based on Smart Money Concepts (SMC) and institutional trading patterns.
 */

import { Candle, SwingPoint, SwingPointType, LoggerService, LiquidityDetectorConfig } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export enum LiquidityZoneType {
  SUPPORT = 'SUPPORT',
  RESISTANCE = 'RESISTANCE',
}

export enum SweepDirection {
  UP = 'UP',
  DOWN = 'DOWN',
}

/**
 * Liquidity zone - price level where stops cluster
 */
export interface LiquidityZone {
  price: number;                    // Price level
  type: LiquidityZoneType;          // SUPPORT or RESISTANCE
  touches: number;                  // Number of swing points at this level
  strength: number;                 // 0-1 (based on touches and recency)
  lastTouch: number;                // Timestamp of last touch
  swingPoints: SwingPoint[];        // Swing points that created this zone
}

/**
 * Liquidity sweep - false breakout to trigger stops
 */
export interface LiquiditySweep {
  detected: boolean;                // Was a sweep detected?
  sweepPrice: number;               // Price where sweep occurred
  zonePrice: number;                // Original zone price that was swept
  direction: SweepDirection;        // UP or DOWN
  isFakeout: boolean;               // Did price reverse after sweep?
  strength: number;                 // 0-1 (confidence in sweep)
  timestamp: number;                // When sweep occurred
}

/**
 * Liquidity analysis result
 */
export interface LiquidityAnalysis {
  zones: LiquidityZone[];           // All detected zones
  strongZones: LiquidityZone[];     // High-strength zones only
  recentSweep: LiquiditySweep | null; // Most recent sweep (if any)
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_TOUCHES_FOR_ZONE = INTEGER_MULTIPLIERS.TWO;       // Minimum swing points to form a zone
const STRONG_ZONE_STRENGTH = CONFIDENCE_THRESHOLDS.LOW;     // Strength threshold for "strong" zones
const MAX_ZONE_AGE_MS = ((INTEGER_MULTIPLIERS.SEVENTY as number) / (INTEGER_MULTIPLIERS.TEN as number)) * (INTEGER_MULTIPLIERS.TWENTY_FOUR as number) * (INTEGER_MULTIPLIERS.SIXTY as number) * (INTEGER_MULTIPLIERS.SIXTY as number) * (INTEGER_MULTIPLIERS.ONE_THOUSAND as number); // 7 days - zones older than this are ignored
const SWEEP_TOLERANCE_PERCENT = MULTIPLIERS.HALF;  // 0.5% - how far beyond zone is a sweep (TECHNICAL - measurement unit)

// ============================================================================
// LIQUIDITY DETECTOR
// ============================================================================

export class LiquidityDetector {
  constructor(
    private readonly config: LiquidityDetectorConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Detect liquidity zones from swing points
   */
  detectZones(swingPoints: SwingPoint[], currentTime: number = Date.now()): LiquidityZone[] {
    if (swingPoints.length < MIN_TOUCHES_FOR_ZONE) {
      return [];
    }

    // Group swing points by price level (with tolerance)
    const zones = this.groupSwingPointsIntoZones(swingPoints);

    // Calculate strength for each zone
    const zonesWithStrength = zones.map(zone =>
      this.calculateZoneStrength(zone, currentTime),
    );

    // Filter out weak/old zones
    const validZones = zonesWithStrength.filter(zone =>
      zone.touches >= MIN_TOUCHES_FOR_ZONE &&
      (currentTime - zone.lastTouch) <= MAX_ZONE_AGE_MS,
    );

    // Sort by strength (strongest first)
    validZones.sort((a, b) => b.strength - a.strength);

    this.logger.debug('Liquidity zones detected', {
      totalZones: validZones.length,
      strongZones: validZones.filter(z => z.strength >= STRONG_ZONE_STRENGTH).length,
    });

    return validZones;
  }

  /**
   * Detect liquidity sweep (false breakout)
   */
  detectSweep(
    candles: Candle[],
    zones: LiquidityZone[],
    lookbackCandles: number = (INTEGER_MULTIPLIERS.TEN as number),
  ): LiquiditySweep | null {
    if (candles.length < (INTEGER_MULTIPLIERS.TWO as number) || zones.length === MATH_BOUNDS.MIN_PERCENTAGE) {
      return null;
    }

    const recentCandles = candles.slice(-lookbackCandles);
    const latestCandle = candles[candles.length - 1];

    // Check each zone for potential sweep
    for (const zone of zones) {
      // Check for upward sweep (resistance break)
      if (zone.type === LiquidityZoneType.RESISTANCE) {
        const sweepCandle = this.findSweepCandle(recentCandles, zone.price, true);
        if (sweepCandle !== null) {
          const isFakeout = this.isFakeout(sweepCandle, latestCandle, zone.price, true);
          return {
            detected: true,
            sweepPrice: sweepCandle.high,
            zonePrice: zone.price,
            direction: SweepDirection.UP,
            isFakeout,
            strength: this.calculateSweepStrength(zone, isFakeout),
            timestamp: sweepCandle.timestamp,
          };
        }
      }

      // Check for downward sweep (support break)
      if (zone.type === LiquidityZoneType.SUPPORT) {
        const sweepCandle = this.findSweepCandle(recentCandles, zone.price, false);
        if (sweepCandle !== null) {
          const isFakeout = this.isFakeout(sweepCandle, latestCandle, zone.price, false);
          return {
            detected: true,
            sweepPrice: sweepCandle.low,
            zonePrice: zone.price,
            direction: SweepDirection.DOWN,
            isFakeout,
            strength: this.calculateSweepStrength(zone, isFakeout),
            timestamp: sweepCandle.timestamp,
          };
        }
      }
    }

    return null;
  }

  /**
   * Analyze liquidity (zones + sweeps)
   */
  analyze(
    swingPoints: SwingPoint[],
    candles: Candle[],
    currentTime: number = Date.now(),
  ): LiquidityAnalysis {
    const zones = this.detectZones(swingPoints, currentTime);
    const strongZones = zones.filter(z => z.strength >= STRONG_ZONE_STRENGTH);
    const recentSweep = this.detectSweep(candles, zones);

    this.logger.debug('Liquidity analysis complete', {
      totalZones: zones.length,
      strongZones: strongZones.length,
      sweepDetected: recentSweep !== null,
      sweepIsFakeout: recentSweep?.isFakeout ?? false,
    });

    return {
      zones,
      strongZones,
      recentSweep,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Group swing points into zones based on price proximity
   */
  private groupSwingPointsIntoZones(swingPoints: SwingPoint[]): LiquidityZone[] {
    const zones: LiquidityZone[] = [];

    for (const point of swingPoints) {
      // Find existing zone within tolerance
      const existingZone = zones.find(zone =>
        this.isPriceInZone(point.price, zone.price),
      );

      if (existingZone !== undefined) {
        // Add to existing zone
        existingZone.swingPoints.push(point);
        existingZone.touches++;
        existingZone.lastTouch = Math.max(existingZone.lastTouch, point.timestamp);
        // Update zone price to average
        existingZone.price = this.calculateAveragePrice(existingZone.swingPoints);
      } else {
        // Create new zone
        zones.push({
          price: point.price,
          type: point.type === SwingPointType.HIGH ? LiquidityZoneType.RESISTANCE : LiquidityZoneType.SUPPORT,
          touches: 1,
          strength: 0, // Will be calculated later
          lastTouch: point.timestamp,
          swingPoints: [point],
        });
      }
    }

    return zones;
  }

  /**
   * Check if price is within zone tolerance
   */
  private isPriceInZone(price: number, zonePrice: number): boolean {
    const tolerance = zonePrice * (PRICE_TOLERANCE.LIQUIDITY_ZONE_PERCENT / PERCENT_MULTIPLIER);
    return Math.abs(price - zonePrice) <= tolerance;
  }

  /**
   * Calculate average price from swing points
   */
  private calculateAveragePrice(swingPoints: SwingPoint[]): number {
    const sum = swingPoints.reduce((acc, point) => acc + point.price, 0);
    return sum / swingPoints.length;
  }

  /**
   * Calculate zone strength (0-1)
   */
  private calculateZoneStrength(zone: LiquidityZone, currentTime: number): LiquidityZone {
    // Factor 1: Number of touches (more = stronger)
    const touchScore = Math.min(zone.touches / (INTEGER_MULTIPLIERS.FIVE as number), RATIO_MULTIPLIERS.FULL); // Cap at 5 touches = MULTIPLIERS.NEUTRAL

    // Factor 2: Recency (newer = stronger)
    const ageMs = currentTime - zone.lastTouch;
    const recencyScore = Math.max(MATH_BOUNDS.MIN_PERCENTAGE, RATIO_MULTIPLIERS.FULL - (ageMs / MAX_ZONE_AGE_MS));

    // Combine factors (using config weights)
    const strength = (touchScore * this.config.recentTouchesWeight) + (recencyScore * this.config.oldTouchesWeight);

    return {
      ...zone,
      strength: Math.min(Math.max(strength, MATH_BOUNDS.MIN_PERCENTAGE), RATIO_MULTIPLIERS.FULL), // Clamp to 0-1
    };
  }

  /**
   * Find candle that swept a zone
   */
  private findSweepCandle(
    candles: Candle[],
    zonePrice: number,
    isUpwardSweep: boolean,
  ): Candle | null {
    const sweepThreshold = zonePrice * (RATIO_MULTIPLIERS.FULL + (isUpwardSweep ? RATIO_MULTIPLIERS.FULL : NEGATIVE_MARKERS.MINUS_ONE) * SWEEP_TOLERANCE_PERCENT / PERCENT_MULTIPLIER);

    for (let i = candles.length - (RATIO_MULTIPLIERS.FULL as number); i >= FIRST_INDEX; i--) {
      const candle = candles[i];

      if (isUpwardSweep) {
        // Upward sweep: high breaks above resistance
        if (candle.high >= sweepThreshold) {
          return candle;
        }
      } else {
        // Downward sweep: low breaks below support
        if (candle.low <= sweepThreshold) {
          return candle;
        }
      }
    }

    return null;
  }

  /**
   * Check if sweep is a fakeout (reversal after break)
   */
  private isFakeout(
    sweepCandle: Candle,
    latestCandle: Candle,
    zonePrice: number,
    isUpwardSweep: boolean,
  ): boolean {
    const reversalThreshold = zonePrice * (this.config.fakeoutReversalPercent / PERCENT_MULTIPLIER);

    if (isUpwardSweep) {
      // Upward sweep fakeout: price broke up but now closed back below zone
      return latestCandle.close < (zonePrice - reversalThreshold);
    } else {
      // Downward sweep fakeout: price broke down but now closed back above zone
      return latestCandle.close > (zonePrice + reversalThreshold);
    }
  }

  /**
   * Calculate sweep strength (0-1)
   */
  private calculateSweepStrength(zone: LiquidityZone, isFakeout: boolean): number {
    // Base strength from zone strength
    let strength = zone.strength;

    // Boost if fakeout (strong reversal signal)
    if (isFakeout) {
      strength = Math.min(strength * RATIO_MULTIPLIERS.PLUS_50_PERCENT, RATIO_MULTIPLIERS.FULL); // 50% boost, capped at 1.0
    }

    return strength;
  }
}
