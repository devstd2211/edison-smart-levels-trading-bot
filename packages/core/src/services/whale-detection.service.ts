import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';
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
import {
  calculateImbalanceSpikeConfidence,
  calculateWallBreakConfidence,
  calculateWallDisappearanceConfidence,
} from './whale-detection/whale-detection-confidence.utils';
import { determineWallDisappearanceDirectionByTrend } from './whale-detection/whale-detection-direction.utils';
import { evaluateImbalanceSpike } from './whale-detection/whale-detection-imbalance.utils';
import {
  getWhaleConfigValidationError,
  getWhaleDetectionInputValidationError,
} from './whale-detection/whale-detection-validation.utils';
import {
  cleanupWhaleRecentBreaks,
  cleanupWhaleTrackedWalls,
  updateWhaleImbalanceHistory,
} from './whale-detection/whale-detection-state.utils';
import { getErrorMessage, normalizeError } from '../utils/error.utils';
import { ICONS } from '../cli/cli-runtime';

// ============================================================================
// CONSTANTS
// ============================================================================

const WHALE_DETECTOR_THRESHOLDS = {
  // Logging probabilities (every Nth call to avoid spam)
  LOG_DETECTION_PROBABILITY: 0.1,  // 10% chance to log detection state
  LOG_NO_DETECTION_PROBABILITY: 0.05,  // 5% chance to log "no whale" state

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

  private handleRecoveryError(error: unknown, strategy: RecoveryStrategy): void {
    if (!this.errorHandler) {
      return;
    }

    this.errorHandler.handle(normalizeError(error), { strategy }).catch(() => { /* Silent */ });
  }

  /**
   * Validate configuration values
   * @throws On invalid config
   */
  private validateConfig(): void {
    const validationError = getWhaleConfigValidationError(this.config);
    if (validationError) {
      this.throwValidationError(validationError);
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
        this.safeLog('debug', `${ICONS.whale} Whale Detector State`, {
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
      this.safeLog('error', `Whale detection setup failed: ${getErrorMessage(error)}`);
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);
      return createDetectionFailedSignal();
    }

    const modeSignal = this.runDetectionModes(analysis, currentPrice, btcMomentum, btcDirection);
    if (modeSignal) {
      return modeSignal;
    }

    // No whale detected - log summary (every 20th call)
    if (Math.random() < WHALE_DETECTOR_THRESHOLDS.LOG_NO_DETECTION_PROBABILITY) {
      this.safeLog('debug', `${ICONS.whale} No whale activity`, {
        wallsDetected: analysis.walls.length,
        imbalanceRatio: analysis.imbalance.ratio.toFixed(DECIMAL_PLACES.PERCENT),
        imbalanceDirection: analysis.imbalance.direction,
      });
    }

    return createNoWhaleSignal('No whale activity detected');
  }

  private runDetectionModes(
    analysis: OrderBookAnalysis,
    currentPrice: number,
    btcMomentum?: number,
    btcDirection?: string,
  ): WhaleSignal | null {
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

    return null;
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
    const validationError = getWhaleDetectionInputValidationError(
      analysis,
      currentPrice,
      btcMomentum,
    );
    if (validationError) {
      this.throwValidationError(validationError);
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

    const historicalSnapshot = this.imbalanceHistory.find(
      (snap) => now - snap.timestamp <= detectionWindow,
    );

    if (!historicalSnapshot) {
      return createNoWhaleSignal();
    }

    const historicalRatio = historicalSnapshot.ratio;
    const spike = evaluateImbalanceSpike({
      currentRatio,
      historicalRatio,
      minRatioChange: this.config.modes.imbalanceSpike.minRatioChange,
    });

    if (spike.detected && spike.direction === 'LONG') {
      return {
        detected: true,
        mode: WhaleDetectionMode.IMBALANCE_SPIKE,
        direction: SignalDirection.LONG,
        confidence: this.calculateSpikeConfidence(spike.ratioChange),
        reason: `BULLISH imbalance SPIKE (ratio: ${historicalRatio.toFixed(DECIMAL_PLACES.PERCENT)} → ${currentRatio.toFixed(DECIMAL_PLACES.PERCENT)}, +${((spike.ratioChange - 1) * PERCENT_MULTIPLIER).toFixed(0)}%)`,
        metadata: {
          imbalanceChange: spike.ratioChange,
        },
      };
    }

    if (spike.detected && spike.direction === 'SHORT') {
      return {
        detected: true,
        mode: WhaleDetectionMode.IMBALANCE_SPIKE,
        direction: SignalDirection.SHORT,
        confidence: this.calculateSpikeConfidence(1 / spike.ratioChange),
        reason: `BEARISH imbalance SPIKE (ratio: ${historicalRatio.toFixed(DECIMAL_PLACES.PERCENT)} → ${currentRatio.toFixed(DECIMAL_PLACES.PERCENT)}, ${((1 - spike.ratioChange) * PERCENT_MULTIPLIER).toFixed(0)}%)`,
        metadata: {
          imbalanceChange: spike.ratioChange,
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
    updateWhaleImbalanceHistory(
      this.imbalanceHistory,
      analysis.imbalance,
      this.config.maxImbalanceHistory,
      Date.now(),
    );
  }

  /**
   * Cleanup expired data
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    const wallExpiryMs = this.config.wallExpiryMs;
    cleanupWhaleTrackedWalls(this.trackedBidWalls, now, wallExpiryMs);
    cleanupWhaleTrackedWalls(this.trackedAskWalls, now, wallExpiryMs);
    cleanupWhaleRecentBreaks(
      this.recentlyBrokenWalls,
      WHALE_DETECTOR_THRESHOLDS.RECENT_BREAKS_MAX_SIZE,
    );
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
    const decision = determineWallDisappearanceDirectionByTrend({
      strategy: this.strategy,
      wallSide,
      wallPrice,
      wallLifetime,
      btcMomentum,
      btcDirection,
    });

    if (decision.blockedByTrend && btcMomentum !== undefined) {
      this.safeLog('debug', `${ICONS.warning} Wall disappearance signal BLOCKED (against strong trend)`, {
        wallSide,
        btcDirection,
        btcMomentum: btcMomentum.toFixed(DECIMAL_PLACES.PERCENT),
      });
    }

    return {
      direction: decision.direction,
      reason: decision.reason,
      trendInverted: decision.trendInverted,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS - Confidence Calculation
  // ==========================================================================

  /**
   * Calculate confidence for wall break (0-100)
   */
  private calculateBreakConfidence(wall: WhaleWall): number {
    return calculateWallBreakConfidence(
      wall.percentOfTotal,
      wall.distance,
      this.config.modes.wallBreak.maxConfidence,
    );
  }

  /**
   * Calculate confidence for wall disappearance (0-100)
   */
  private calculateDisappearanceConfidence(wall: WhaleWall, wallLifetime: number): number {
    return calculateWallDisappearanceConfidence(
      wall.percentOfTotal,
      wallLifetime,
      this.config.modes.wallDisappearance.maxConfidence,
    );
  }

  /**
   * Calculate confidence for imbalance spike (0-100)
   */
  private calculateSpikeConfidence(ratioChange: number): number {
    return calculateImbalanceSpikeConfidence(
      ratioChange,
      this.config.modes.imbalanceSpike.maxConfidence,
    );
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  /**
   * Log whale detection
   */
  private logWhaleDetection(signal: WhaleSignal): void {
    this.safeLog('info', `${ICONS.whale} WHALE DETECTED [${signal.mode}]`, {
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
      this.handleRecoveryError(error, RecoveryStrategy.SKIP);
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
      this.handleRecoveryError(error, RecoveryStrategy.GRACEFUL_DEGRADE);
    }
  }
}




