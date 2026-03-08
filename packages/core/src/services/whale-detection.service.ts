import { DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER, PERCENTAGE_THRESHOLDS, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Whale Detector Service - Combined Approach
 *
 * Detects whale activity using 3 modes:
 *
 * MODE 1: WALL_BREAK (пробой стены)
 * - Detects when price breaks through a large wall
 * - High momentum signal (stop-losses triggered)
 * - Entry: After break, on pullback
 *
 * MODE 2: WALL_DISAPPEARANCE (исчезновение стены)
 * - Tracks walls that suddenly disappear
 * - Indicates whale completed accumulation/distribution
 * - Entry: After wall removed (whale done = reversal)
 *
 * MODE 3: IMBALANCE_SPIKE (резкий дисбаланс)
 * - Detects sudden bid/ask imbalance shifts
 * - Indicates large player entering market
 * - Entry: Ride the momentum (highest priority)
 *
 * IMPORTANT: Requires WebSocket orderbook for real-time data
 * REST API polling is too slow for whale detection!
 */

import { LoggerService } from './logger.service';
import { OrderBookAnalysis } from '../types/legacy';
import { SignalDirection } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  createDetectionFailedSignal,
  createNoWhaleSignal,
  createWallBreakKey,
} from './whale-detection/whale-detection-signal.utils';
import { upsertTrackedWhaleWall } from './whale-detection/whale-detection-wall.utils';

// ============================================================================
// CONSTANTS
// ============================================================================

const WHALE_DETECTOR_THRESHOLDS = {
  // Logging probabilities (every Nth call to avoid spam)
  LOG_DETECTION_PROBABILITY: 0.1,  // 10% chance to log detection state
  LOG_NO_DETECTION_PROBABILITY: 0.05,  // 5% chance to log "no whale" state

  // Confidence calculation factors
  BREAK_SIZE_SCORE_DIVISOR: 15,    // Divide wall % by this for size score
  BREAK_SIZE_SCORE_MULTIPLIER: 60, // Multiply by this to normalize
  BREAK_SIZE_SCORE_MAX: 60,        // Cap size score at 60
  BREAK_DISTANCE_BASE: 30,         // Base distance score
  BREAK_DISTANCE_MULTIPLIER: 5,    // Multiply distance by this
  BREAK_DISTANCE_MIN: 10,          // Minimum distance score

  // Disappearance confidence calculation
  DISAPPEARANCE_SIZE_DIVISOR: 20,     // Divide wall % by this
  DISAPPEARANCE_SIZE_MULTIPLIER: 50,  // Multiply by this
  DISAPPEARANCE_SIZE_MAX: 50,         // Cap size score at 50
  DISAPPEARANCE_LIFETIME_DIVISOR: 120000, // Divide lifetime (ms) by this (2 min threshold)
  DISAPPEARANCE_LIFETIME_MULTIPLIER: 30,  // Multiply by this
  DISAPPEARANCE_LIFETIME_MAX: 30,     // Cap lifetime score at 30

  // Imbalance spike confidence
  SPIKE_CONFIDENCE_MULTIPLIER: 50,  // Multiply (ratio - 1) by this

  // Recent breaks cleanup
  RECENT_BREAKS_MAX_SIZE: 100,  // Max size before clearing (prevent memory leak)
} as const;

// ============================================================================
// TYPES
// ============================================================================

export enum WhaleDetectionMode {
  WALL_BREAK = 'WALL_BREAK', // Пробой стены
  WALL_DISAPPEARANCE = 'WALL_DISAPPEARANCE', // Исчезновение стены
  IMBALANCE_SPIKE = 'IMBALANCE_SPIKE', // Резкий дисбаланс
}

export interface WhaleDetectorConfig {
  modes: {
    wallBreak: {
      enabled: boolean;
      minWallSize: number; // Min % of total volume (e.g., 15%)
      breakConfirmationMs: number; // Time to confirm break (e.g., 3000ms)
      maxConfidence: number; // Max confidence % (e.g., 85)
    };
    wallDisappearance: {
      enabled: boolean;
      minWallSize: number; // Min % of total volume (e.g., 20%)
      minWallDuration: number; // Min time wall existed (e.g., TIME_UNITS.MINUTEms = 1min)
      wallGoneThresholdMs: number; // Time without seeing wall = gone (e.g., 15000ms)
      maxConfidence: number; // Max confidence % (e.g., 80)
    };
    imbalanceSpike: {
      enabled: boolean;
      minRatioChange: number; // Min ratio change (e.g., 1.5 = CONFIDENCE_THRESHOLDS.MODERATE% change)
      detectionWindow: number; // Time window for spike (e.g., 10000ms = 10s)
      maxConfidence: number; // Max confidence % (e.g., 90)
    };
  };
  maxImbalanceHistory: number; // Max imbalance snapshots to keep (e.g., 20)
  wallExpiryMs: number; // Time before wall is removed from tracking (e.g., TIME_UNITS.MINUTEms)
  breakExpiryMs: number; // Time before broken wall can be re-detected (e.g., TIME_UNITS.FIVE_MINUTESms)
}

export interface WhaleWall {
  side: 'BID' | 'ASK';
  price: number;
  quantity: number;
  percentOfTotal: number;
  distance: number;
  detectedAt: number;
  lastSeenAt: number;
}

export interface ImbalanceSnapshot {
  ratio: number;
  timestamp: number;
  bidVolume: number;
  askVolume: number;
}

export interface WhaleSignal {
  detected: boolean;
  mode: WhaleDetectionMode | null;
  direction: SignalDirection | null;
  confidence: number; // 0-100
  reason: string;
  metadata: {
    wall?: WhaleWall;
    breakPrice?: number;
    imbalanceChange?: number;
    trendInverted?: boolean; // Whether signal was inverted due to strong trend
  };
}

// ============================================================================
// WHALE DETECTOR SERVICE
// ============================================================================

/**
 * Whale Detection Service
 *
 * Unified whale detection with pluggable strategies:
 * - 'BREAKOUT': Sell walls broken = SHORT, Buy walls broken = LONG
 * - 'FOLLOW': Follow whale direction (whale selling = SHORT, whale buying = LONG)
 */
export class WhaleDetectionService {
  // Mode 1: Wall tracking (for breaks and disappearances)
  private trackedBidWalls: Map<number, WhaleWall> = new Map();
  private trackedAskWalls: Map<number, WhaleWall> = new Map();

  // Mode 2: Recently broken walls (to avoid re-detecting same break)
  private recentlyBrokenWalls: Set<string> = new Set(); // "BID_1.5000" or "ASK_1.5200"

  // Mode 3: Imbalance history (for spike detection)
  private imbalanceHistory: ImbalanceSnapshot[] = [];

  constructor(
    private config: WhaleDetectorConfig,
    private logger?: LoggerService,
    private strategy: 'BREAKOUT' | 'FOLLOW' = 'BREAKOUT', // Pluggable strategy (default: BREAKOUT)
    private errorHandler?: ErrorHandler
  ) {
    // THROW: Config validation
    this.validateConfig();
  }

  private throwValidationError(message: string): never {
    const error = new Error(message);
    if (this.errorHandler) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
    }
    throw error;
  }

  /**
   * Validate configuration values
   * @throws On invalid config
   */
  private validateConfig(): void {
    if (!this.config || typeof this.config !== 'object') {
      this.throwValidationError('Config must be a valid object');
    }

    // Validate wall break config
    if (this.config.modes?.wallBreak) {
      const wb = this.config.modes.wallBreak;
      if (typeof wb.enabled !== 'boolean') {
        this.throwValidationError('wallBreak.enabled must be a boolean');
      }

      if (typeof wb.minWallSize !== 'number' || wb.minWallSize < 0) {
        this.throwValidationError('wallBreak.minWallSize must be non-negative number');
      }

      if (typeof wb.breakConfirmationMs !== 'number' || wb.breakConfirmationMs < 0) {
        this.throwValidationError('wallBreak.breakConfirmationMs must be non-negative number');
      }

      if (typeof wb.maxConfidence !== 'number' || wb.maxConfidence < 0 || wb.maxConfidence > 100) {
        this.throwValidationError('wallBreak.maxConfidence must be between 0 and 100');
      }
    }

    // Validate wall disappearance config
    if (this.config.modes?.wallDisappearance) {
      const wd = this.config.modes.wallDisappearance;
      if (typeof wd.enabled !== 'boolean') {
        this.throwValidationError('wallDisappearance.enabled must be a boolean');
      }

      if (typeof wd.minWallSize !== 'number' || wd.minWallSize < 0) {
        this.throwValidationError('wallDisappearance.minWallSize must be non-negative number');
      }

      if (typeof wd.maxConfidence !== 'number' || wd.maxConfidence < 0 || wd.maxConfidence > 100) {
        this.throwValidationError('wallDisappearance.maxConfidence must be between 0 and 100');
      }
    }

    // Validate imbalance spike config
    if (this.config.modes?.imbalanceSpike) {
      const is = this.config.modes.imbalanceSpike;
      if (typeof is.enabled !== 'boolean') {
        this.throwValidationError('imbalanceSpike.enabled must be a boolean');
      }

      if (typeof is.minRatioChange !== 'number' || is.minRatioChange <= 0) {
        this.throwValidationError('imbalanceSpike.minRatioChange must be positive number');
      }

      if (typeof is.maxConfidence !== 'number' || is.maxConfidence < 0 || is.maxConfidence > 100) {
        this.throwValidationError('imbalanceSpike.maxConfidence must be between 0 and 100');
      }
    }

    // Validate general config
    if (typeof this.config.maxImbalanceHistory !== 'number' || this.config.maxImbalanceHistory <= 0) {
      this.throwValidationError('maxImbalanceHistory must be positive number');
    }

    if (typeof this.config.wallExpiryMs !== 'number' || this.config.wallExpiryMs < 0) {
      this.throwValidationError('wallExpiryMs must be non-negative number');
    }

    if (typeof this.config.breakExpiryMs !== 'number' || this.config.breakExpiryMs < 0) {
      this.throwValidationError('breakExpiryMs must be non-negative number');
    }
  }

  /**
   * Detect whale activity from order book analysis
   *
   * @param analysis - Current order book analysis
   * @param currentPrice - Current market price
   * @param btcMomentum - BTC momentum (0-1, from BTCAnalysis)
   * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL')
   * @returns Whale signal (detected or not)
   * @throws On null/invalid analysis or price
   */
  detectWhale(
    analysis: OrderBookAnalysis,
    currentPrice: number,
    btcMomentum?: number,
    btcDirection?: string,
  ): WhaleSignal {
    // THROW: Input validation (OUTSIDE try-catch to propagate errors)
    this.validateDetectionInput(analysis, currentPrice, btcMomentum);

    try {
      // Update tracked data
      this.updateTrackedWalls(analysis);
      this.updateImbalanceHistory(analysis);
      this.cleanupExpiredData();

      // Log current orderbook state (every 10th call to avoid spam)
      if (Math.random() < WHALE_DETECTOR_THRESHOLDS.LOG_DETECTION_PROBABILITY) {
        this.safeLog('debug', '🐋 Whale Detector State', {
          trackedBids: this.trackedBidWalls.size,
          trackedAsks: this.trackedAskWalls.size,
          imbalanceHistory: this.imbalanceHistory.length,
          currentRatio: analysis.imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT),
          walls: analysis.walls.length,
          btcMomentum: btcMomentum?.toFixed(DECIMAL_PLACES.PERCENT),
          btcDirection,
        });
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Detection setup failures
      this.safeLog('error', `Whale detection setup failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
      return createDetectionFailedSignal();
    }

    // MODE 3: Imbalance Spike (highest priority - immediate action)
    if (this.config.modes.imbalanceSpike.enabled) {
      const spikeSignal = this.detectImbalanceSpike(analysis);
      if (spikeSignal.detected) {
        this.logWhaleDetection(spikeSignal);
        return spikeSignal;
      }
    }

    // MODE 1: Wall Break (medium priority - momentum play)
    if (this.config.modes.wallBreak.enabled) {
      const breakSignal = this.detectWallBreak(currentPrice);
      if (breakSignal.detected) {
        this.logWhaleDetection(breakSignal);
        return breakSignal;
      }
    }

    // MODE 2: Wall Disappearance (lower priority - reversal play)
    if (this.config.modes.wallDisappearance.enabled) {
      const disappearanceSignal = this.detectWallDisappearance(btcMomentum, btcDirection);
      if (disappearanceSignal.detected) {
        this.logWhaleDetection(disappearanceSignal);
        return disappearanceSignal;
      }
    }

    // No whale detected - log summary (every 20th call)
    if (Math.random() < WHALE_DETECTOR_THRESHOLDS.LOG_NO_DETECTION_PROBABILITY) {
      this.safeLog('debug', '🐋 No whale activity', {
        wallsDetected: analysis.walls.length,
        imbalanceRatio: analysis.imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT),
        imbalanceDirection: analysis.imbalance.direction,
      });
    }

    return createNoWhaleSignal('No whale activity detected');
  }

  /**
   * Validate detection input
   * @throws On invalid inputs
   */
  private validateDetectionInput(
    analysis: OrderBookAnalysis,
    currentPrice: number,
    btcMomentum?: number
  ): void {
    if (!analysis || typeof analysis !== 'object') {
      this.throwValidationError('Analysis must be a valid object');
    }

    if (typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
      this.throwValidationError('Current price must be a finite number');
    }

    if (currentPrice < 0) {
      this.throwValidationError('Current price must be non-negative');
    }

    if (btcMomentum !== undefined) {
      if (typeof btcMomentum !== 'number' || !Number.isFinite(btcMomentum)) {
        this.throwValidationError('BTC momentum must be a finite number');
      }

      if (btcMomentum < 0 || btcMomentum > 1) {
        this.throwValidationError('BTC momentum must be between 0 and 1');
      }
    }
  }

  // ==========================================================================
  // MODE 1: WALL BREAK DETECTION
  // ==========================================================================

  /**
   * Detect when price breaks through a large wall
   *
   * Logic:
   * - BID wall broken (price went below) → SHORT signal (momentum down)
   * - ASK wall broken (price went above) → LONG signal (momentum up)
   */
  private detectWallBreak(currentPrice: number): WhaleSignal {
    const now = Date.now();
    const confirmationMs = this.config.modes.wallBreak.breakConfirmationMs;
    const minWallSize = this.config.modes.wallBreak.minWallSize;

    const bidSignal = this.tryDetectWallBreakForSide(
      'BID',
      this.trackedBidWalls,
      currentPrice,
      now,
      confirmationMs,
      minWallSize,
    );
    if (bidSignal) {
      return bidSignal;
    }

    const askSignal = this.tryDetectWallBreakForSide(
      'ASK',
      this.trackedAskWalls,
      currentPrice,
      now,
      confirmationMs,
      minWallSize,
    );
    if (askSignal) {
      return askSignal;
    }

    return createNoWhaleSignal();
  }

  private tryDetectWallBreakForSide(
    side: 'BID' | 'ASK',
    trackedWalls: Map<number, WhaleWall>,
    currentPrice: number,
    now: number,
    confirmationMs: number,
    minWallSize: number,
  ): WhaleSignal | null {
    for (const [wallPrice, wall] of trackedWalls.entries()) {
      if (wall.percentOfTotal < minWallSize) {
        continue;
      }

      const priceBroken = side === 'BID' ? currentPrice < wallPrice : currentPrice > wallPrice;
      if (!priceBroken) {
        continue;
      }

      const timeSinceLastSeen = now - wall.lastSeenAt;
      if (timeSinceLastSeen < confirmationMs) {
        continue;
      }

      const wallKey = createWallBreakKey(side, wallPrice, DECIMAL_PLACES.PRICE);
      if (this.recentlyBrokenWalls.has(wallKey)) {
        continue;
      }

      this.recentlyBrokenWalls.add(wallKey);
      trackedWalls.delete(wallPrice);

      const isBid = side === 'BID';
      return {
        detected: true,
        mode: WhaleDetectionMode.WALL_BREAK,
        direction: isBid ? SignalDirection.LONG : SignalDirection.SHORT,
        confidence: this.calculateBreakConfidence(wall),
        reason: isBid
          ? `BID wall BROKEN @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (${wall.percentOfTotal.toFixed(1)}% volume) - Whale absorbed sells, Momentum UP`
          : `ASK wall BROKEN @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (${wall.percentOfTotal.toFixed(1)}% volume) - Whale absorbed buys, Momentum DOWN`,
        metadata: {
          wall,
          breakPrice: currentPrice,
        },
      };
    }

    return null;
  }

  // ==========================================================================
  // MODE 2: WALL DISAPPEARANCE DETECTION
  // ==========================================================================

  /**
   * Detect when a large wall suddenly disappears
   *
   * DEFAULT Logic (neutral market):
   * - BID wall disappears → whale done accumulating → SHORT signal (distribution next)
   * - ASK wall disappears → whale done distributing → LONG signal (accumulation next)
   *
   * TREND-AWARE Logic (strong trend):
   * - In BEARISH market (BTC down): BID disappears → SHORT continuation (whales not buying = more drop)
   * - In BULLISH market (BTC up): ASK disappears → LONG continuation (whales not selling = more pump)
   * - Logic is INVERTED in strong trends to trade WITH the trend!
   *
   * @param btcMomentum - BTC momentum (0-1, undefined if not available)
   * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL', undefined if not available)
   */
  private detectWallDisappearance(btcMomentum?: number, btcDirection?: string): WhaleSignal {
    const now = Date.now();
    const wallGoneThresholdMs = this.config.modes.wallDisappearance.wallGoneThresholdMs;
    const minWallSize = this.config.modes.wallDisappearance.minWallSize;
    const minWallDuration = this.config.modes.wallDisappearance.minWallDuration;

    const bidSignal = this.tryDetectWallDisappearanceForSide(
      'BID',
      this.trackedBidWalls,
      now,
      wallGoneThresholdMs,
      minWallSize,
      minWallDuration,
      btcMomentum,
      btcDirection,
    );
    if (bidSignal) {
      return bidSignal;
    }

    const askSignal = this.tryDetectWallDisappearanceForSide(
      'ASK',
      this.trackedAskWalls,
      now,
      wallGoneThresholdMs,
      minWallSize,
      minWallDuration,
      btcMomentum,
      btcDirection,
    );
    if (askSignal) {
      return askSignal;
    }

    return createNoWhaleSignal();
  }

  private tryDetectWallDisappearanceForSide(
    side: 'BID' | 'ASK',
    trackedWalls: Map<number, WhaleWall>,
    now: number,
    wallGoneThresholdMs: number,
    minWallSize: number,
    minWallDuration: number,
    btcMomentum?: number,
    btcDirection?: string,
  ): WhaleSignal | null {
    for (const [wallPrice, wall] of trackedWalls.entries()) {
      if (wall.percentOfTotal < minWallSize) {
        continue;
      }

      const wallLifetime = wall.lastSeenAt - wall.detectedAt;
      if (wallLifetime < minWallDuration) {
        continue;
      }

      const timeSinceLastSeen = now - wall.lastSeenAt;
      if (timeSinceLastSeen <= wallGoneThresholdMs) {
        continue;
      }

      trackedWalls.delete(wallPrice);
      const { direction, reason, trendInverted } = this.determineWallDisappearanceDirection(
        side,
        wallPrice,
        wallLifetime,
        btcMomentum,
        btcDirection,
      );

      if (direction == null) {
        continue;
      }

      return {
        detected: true,
        mode: WhaleDetectionMode.WALL_DISAPPEARANCE,
        direction,
        confidence: this.calculateDisappearanceConfidence(wall, wallLifetime),
        reason,
        metadata: {
          wall,
          trendInverted,
        },
      };
    }

    return null;
  }

  // ==========================================================================
  // MODE 3: IMBALANCE SPIKE DETECTION
  // ==========================================================================

  /**
   * Detect sudden bid/ask imbalance shift
   *
   * Logic:
   * - Sudden increase in bid ratio → LONG signal (buying pressure)
   * - Sudden increase in ask ratio → SHORT signal (selling pressure)
   */
  private detectImbalanceSpike(analysis: OrderBookAnalysis): WhaleSignal {
    if (this.imbalanceHistory.length < 3) {
      return createNoWhaleSignal();
    }

    const currentRatio = analysis.imbalance.ratio;
    const detectionWindow = this.config.modes.imbalanceSpike.detectionWindow;
    const now = Date.now();

    // Get imbalance from N seconds ago
    const historicalSnapshot = this.imbalanceHistory.find(
      (snap) => now - snap.timestamp <= detectionWindow,
    );

    if (!historicalSnapshot) {
      return createNoWhaleSignal();
    }

    const historicalRatio = historicalSnapshot.ratio;
    const ratioChange = currentRatio / historicalRatio;

    // Check for BULLISH spike (bid ratio increased)
    if (ratioChange >= 1 + this.config.modes.imbalanceSpike.minRatioChange) {
      return {
        detected: true,
        mode: WhaleDetectionMode.IMBALANCE_SPIKE,
        direction: SignalDirection.LONG,
        confidence: this.calculateSpikeConfidence(ratioChange),
        reason: `BULLISH imbalance SPIKE (ratio: ${historicalRatio.toFixed(DECIMAL_PLACES.PERCENT)} → ${currentRatio.toFixed(DECIMAL_PLACES.PERCENT)}, +${((ratioChange - 1) * PERCENT_MULTIPLIER).toFixed(0)}%)`,
        metadata: {
          imbalanceChange: ratioChange,
        },
      };
    }

    // Check for BEARISH spike (ask ratio increased = bid ratio decreased)
    if (ratioChange <= 1 / (1 + this.config.modes.imbalanceSpike.minRatioChange)) {
      return {
        detected: true,
        mode: WhaleDetectionMode.IMBALANCE_SPIKE,
        direction: SignalDirection.SHORT,
        confidence: this.calculateSpikeConfidence(1 / ratioChange),
        reason: `BEARISH imbalance SPIKE (ratio: ${historicalRatio.toFixed(DECIMAL_PLACES.PERCENT)} → ${currentRatio.toFixed(DECIMAL_PLACES.PERCENT)}, ${((1 - ratioChange) * PERCENT_MULTIPLIER).toFixed(0)}%)`,
        metadata: {
          imbalanceChange: ratioChange,
        },
      };
    }

    return createNoWhaleSignal();
  }

  // ==========================================================================
  // PRIVATE METHODS - Data Tracking
  // ==========================================================================

  /**
   * Update tracked walls with current order book
   */
  private updateTrackedWalls(analysis: OrderBookAnalysis): void {
    const now = Date.now();
    this.updateTrackedWallsForSide('BID', analysis, this.trackedBidWalls, now);
    this.updateTrackedWallsForSide('ASK', analysis, this.trackedAskWalls, now);
  }

  private updateTrackedWallsForSide(
    side: 'BID' | 'ASK',
    analysis: OrderBookAnalysis,
    trackedWalls: Map<number, WhaleWall>,
    now: number,
  ): void {
    for (const wall of analysis.walls.filter((currentWall) => currentWall.side === side)) {
      upsertTrackedWhaleWall(trackedWalls, wall, now);
    }
  }

  /**
   * Update imbalance history for spike detection
   */
  private updateImbalanceHistory(analysis: OrderBookAnalysis): void {
    const now = Date.now();

    this.imbalanceHistory.push({
      ratio: analysis.imbalance.ratio,
      timestamp: now,
      bidVolume: analysis.imbalance.bidVolume,
      askVolume: analysis.imbalance.askVolume,
    });

    // Keep only recent history
    if (this.imbalanceHistory.length > this.config.maxImbalanceHistory) {
      this.imbalanceHistory.shift();
    }
  }

  /**
   * Cleanup expired data
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const wallExpiryMs = this.config.wallExpiryMs;
    this.removeExpiredTrackedWalls(this.trackedBidWalls, now, wallExpiryMs);
    this.removeExpiredTrackedWalls(this.trackedAskWalls, now, wallExpiryMs);

    // Remove old broken walls (allow re-detection after 5 min)
    if (this.recentlyBrokenWalls.size > WHALE_DETECTOR_THRESHOLDS.RECENT_BREAKS_MAX_SIZE) {
      this.recentlyBrokenWalls.clear(); // Prevent memory leak
    }
  }

  private removeExpiredTrackedWalls(
    trackedWalls: Map<number, WhaleWall>,
    now: number,
    wallExpiryMs: number,
  ): void {
    for (const [price, wall] of trackedWalls.entries()) {
      if (now - wall.lastSeenAt > wallExpiryMs) {
        trackedWalls.delete(price);
      }
    }
  }

  // ==========================================================================
  // PRIVATE METHODS - Trend-Aware Signal Direction
  // ==========================================================================

  /**
   * Determine signal direction for WALL_DISAPPEARANCE based on market trend
   *
   * @param wallSide - Side of wall that disappeared ('BID' or 'ASK')
   * @param wallPrice - Price level of wall
   * @param wallLifetime - How long wall existed (ms)
   * @param btcMomentum - BTC momentum (0-1, undefined if not available)
   * @param btcDirection - BTC direction ('UP'/'DOWN'/'NEUTRAL', undefined if not available)
   * @returns Object with direction, reason, and whether trend was inverted
   */
  private determineWallDisappearanceDirection(
    wallSide: 'BID' | 'ASK',
    wallPrice: number,
    wallLifetime: number,
    btcMomentum?: number,
    btcDirection?: string,
  ): { direction: SignalDirection | null; reason: string; trendInverted: boolean } {
    // Choose direction based on strategy
    // BREAKOUT: BID gone → SHORT (expect sell), ASK gone → LONG (expect buy)
    // FOLLOW: BID gone → LONG (follow whale), ASK gone → SHORT (follow whale)
    const useFollowLogic = this.strategy === 'FOLLOW';
    const defaultDirection = useFollowLogic
      ? (wallSide === 'BID' ? SignalDirection.LONG : SignalDirection.SHORT)
      : (wallSide === 'BID' ? SignalDirection.SHORT : SignalDirection.LONG);
    const invertedDirection = wallSide === 'BID' ? SignalDirection.LONG : SignalDirection.SHORT;

    // If BTC data not available, use default logic
    if (btcMomentum === undefined || btcDirection === undefined) {
      const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - ${
        wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
      }`;
      return { direction: defaultDirection, reason, trendInverted: false };
    }

    // Determine trend strength
    const isStrongTrend = btcMomentum >= MULTIPLIERS.HALF; // Strong trend threshold (0.5 = 50%)
    const isNeutralMarket = btcMomentum < (PERCENTAGE_THRESHOLDS.MODERATE / PERCENT_MULTIPLIER); // Neutral market threshold (30% = 0.3)

    // NEUTRAL MARKET: Use default logic
    if (isNeutralMarket) {
      const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - ${
        wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
      } [NEUTRAL market]`;
      return { direction: defaultDirection, reason, trendInverted: false };
    }

    // STRONG TREND: Apply trend-aware logic (INVERT direction to trade WITH trend)
    if (isStrongTrend) {
      const isBearishTrend = btcDirection === 'DOWN';
      const isBullishTrend = btcDirection === 'UP';

      // BID wall disappeared in BEARISH market → INVERT to LONG (expect bounce)
      if (wallSide === 'BID' && isBearishTrend) {
        const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - BEARISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales not buying = potential SHORT-TERM BOUNCE → LONG [INVERTED]`;
        return { direction: invertedDirection, reason, trendInverted: true };
      }

      // ASK wall disappeared in BULLISH market → INVERT to SHORT (expect pullback)
      if (wallSide === 'ASK' && isBullishTrend) {
        const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - BULLISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales not selling = potential SHORT-TERM PULLBACK → SHORT [INVERTED]`;
        return { direction: invertedDirection, reason, trendInverted: true };
      }

      // BID wall disappeared in BULLISH market → Keep SHORT (continuation)
      if (wallSide === 'BID' && isBullishTrend) {
        const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - BULLISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales done accumulating → continue UP (skip SHORT)`;
        // Block this signal (it goes against trend)
        this.safeLog('debug', '⚠️ Wall disappearance signal BLOCKED (against strong trend)', {
          wallSide,
          btcDirection,
          btcMomentum: btcMomentum.toFixed(DECIMAL_PLACES.PERCENT),
        });
        return { direction: null, reason, trendInverted: false };
      }

      // ASK wall disappeared in BEARISH market → Keep LONG (continuation)
      if (wallSide === 'ASK' && isBearishTrend) {
        const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - BEARISH trend (${(
          btcMomentum * PERCENT_MULTIPLIER
        ).toFixed(0)}%) - Whales done distributing → continue DOWN (skip LONG)`;
        // Block this signal (it goes against trend)
        this.safeLog('debug', '⚠️ Wall disappearance signal BLOCKED (against strong trend)', {
          wallSide,
          btcDirection,
          btcMomentum: btcMomentum.toFixed(DECIMAL_PLACES.PERCENT),
        });
        return { direction: null, reason, trendInverted: false };
      }
    }

    // MODERATE TREND (0.3 <= momentum < MULTIPLIERS.HALF): Use default logic with caution
    const reason = `${wallSide} wall DISAPPEARED @ ${wallPrice.toFixed(DECIMAL_PLACES.PRICE)} (existed ${(wallLifetime / INTEGER_MULTIPLIERS.ONE_THOUSAND).toFixed(0)}s) - ${
      wallSide === 'BID' ? 'Accumulation done, distribution likely' : 'Distribution done, accumulation likely'
    } [MODERATE trend, BTC ${btcDirection}]`;
    return { direction: defaultDirection, reason, trendInverted: false };
  }

  // ==========================================================================
  // PRIVATE METHODS - Confidence Calculation
  // ==========================================================================

  /**
   * Calculate confidence for wall break (0-100)
   */
  private calculateBreakConfidence(wall: WhaleWall): number {
    // Factor: Wall size (bigger = higher confidence)
    const sizeScore = Math.min(
      (wall.percentOfTotal / WHALE_DETECTOR_THRESHOLDS.BREAK_SIZE_SCORE_DIVISOR) * WHALE_DETECTOR_THRESHOLDS.BREAK_SIZE_SCORE_MULTIPLIER,
      WHALE_DETECTOR_THRESHOLDS.BREAK_SIZE_SCORE_MAX,
    );

    // Factor: Distance (closer break = higher confidence)
    const distanceScore = Math.max(
      WHALE_DETECTOR_THRESHOLDS.BREAK_DISTANCE_BASE - wall.distance * WHALE_DETECTOR_THRESHOLDS.BREAK_DISTANCE_MULTIPLIER,
      WHALE_DETECTOR_THRESHOLDS.BREAK_DISTANCE_MIN,
    );

    return Math.min(sizeScore + distanceScore, this.config.modes.wallBreak.maxConfidence);
  }

  /**
   * Calculate confidence for wall disappearance (0-100)
   */
  private calculateDisappearanceConfidence(wall: WhaleWall, wallLifetime: number): number {
    // Factor: Wall size
    const sizeScore = Math.min(
      (wall.percentOfTotal / WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_SIZE_DIVISOR) * WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_SIZE_MULTIPLIER,
      WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_SIZE_MAX,
    );

    // Factor: Lifetime (longer = higher confidence)
    const lifetimeScore = Math.min(
      (wallLifetime / WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_LIFETIME_DIVISOR) * WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_LIFETIME_MULTIPLIER,
      WHALE_DETECTOR_THRESHOLDS.DISAPPEARANCE_LIFETIME_MAX,
    );

    return Math.min(sizeScore + lifetimeScore, this.config.modes.wallDisappearance.maxConfidence);
  }

  /**
   * Calculate confidence for imbalance spike (0-100)
   */
  private calculateSpikeConfidence(ratioChange: number): number {
    // Larger spike = higher confidence
    const confidence = Math.min(
      (ratioChange - 1) * WHALE_DETECTOR_THRESHOLDS.SPIKE_CONFIDENCE_MULTIPLIER,
      this.config.modes.imbalanceSpike.maxConfidence,
    );
    return confidence;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Log whale detection
   */
  private logWhaleDetection(signal: WhaleSignal): void {
    this.safeLog('info', `🐋 WHALE DETECTED [${signal.mode}]`, {
      direction: signal.direction,
      confidence: `${signal.confidence.toFixed(0)}%`,
      reason: signal.reason,
    });
  }

  /**
   * Get statistics
   */
  getStats(): {
    trackedWalls: { bids: number; asks: number };
    recentBreaks: number;
    imbalanceHistory: number;
    } {
    return {
      trackedWalls: {
        bids: this.trackedBidWalls.size,
        asks: this.trackedAskWalls.size,
      },
      recentBreaks: this.recentlyBrokenWalls.size,
      imbalanceHistory: this.imbalanceHistory.length,
    };
  }

  /**
   * Safe log wrapper - failures never block execution
   * @param level - Log level
   * @param message - Log message
   * @param meta - Optional metadata
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      if (this.logger) {
        this.logger[level]?.(message, meta);
      }
    } catch (error) {
      // SKIP: Logging failures never block execution
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Clear all tracked data
   */
  clear(): void {
    try {
      this.trackedBidWalls.clear();
      this.trackedAskWalls.clear();
      this.recentlyBrokenWalls.clear();
      this.imbalanceHistory = [];
      this.safeLog('debug', 'WhaleDetector data cleared');
    } catch (error) {
      // GRACEFUL_DEGRADE: Clear failure
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }
}


