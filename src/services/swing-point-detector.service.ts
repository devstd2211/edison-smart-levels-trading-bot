/**
 * Swing Point Detector Service
 *
 * Dedicated service for detecting swing points (local highs and lows) from candle data.
 * Separated from TrendAnalyzer for:
 * - Single Responsibility: Only detects swing points
 * - Testability: Can test detection logic independently
 * - Reusability: Used by TrendAnalyzer, EntryScanner, and other components
 * - Debugging: Easier to analyze why swing points are detected/missed
 *
 * Algorithm:
 * - Scans through candles looking for local highs and lows
 * - Uses configurable lookback period (default: 2 candles before/after)
 * - A candle is a swing high if its high is greater than lookback*2 neighbors
 * - A candle is a swing low if its low is less than lookback*2 neighbors
 */

import { Candle, SwingPoint, SwingPointType, LoggerService } from '../types';
import { DECIMAL_PLACES } from '../constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  IndicatorCalculationError,
  CandleDataMissingError,
  ValidationError,
} from '../errors/DomainErrors';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_LOOKBACK_PERIOD = 2; // Look 2 candles back and forward
const MIN_CANDLES_REQUIRED = 5; // Need at least 5 candles (2 + 1 + 2)

// ============================================================================
// SERVICE
// ============================================================================

export class SwingPointDetectorService {
  private readonly lookbackPeriod: number;

  constructor(
    private readonly logger: LoggerService,
    lookbackPeriod: number = DEFAULT_LOOKBACK_PERIOD,
    private readonly errorHandler?: ErrorHandler, // Phase 8.9.44
  ) {
    this.lookbackPeriod = lookbackPeriod;

    if (lookbackPeriod < 1) {
      const error = new ValidationError(
        `SwingPointDetectorService: Lookback period must be >= 1`,
        {
          field: 'lookbackPeriod',
          value: lookbackPeriod,
          reason: 'Lookback period must be at least 1',
        }
      );

      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.THROW,
          context: 'SwingPointDetectorService.constructor',
        });
      }
      throw error;
    }

    this.safeLog('info', '✅ SwingPointDetectorService initialized', {
      lookbackPeriod: this.lookbackPeriod,
    });
  }

  /**
   * Safe logging wrapper with SKIP strategy - Phase 8.9.44
   */
  private safeLog(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: string,
    meta?: any
  ): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, {
          strategy: RecoveryStrategy.SKIP,
          context: `SwingPointDetectorService.${level}`,
        });
      }
    }
  }

  /**
   * Validate candle data - Phase 8.9.44
   */
  private isValidCandle(candle: any, index: number): boolean {
    if (!candle) return false;

    const { high, low, timestamp } = candle;

    if (high === undefined || low === undefined || timestamp === undefined) {
      return false;
    }

    if (!Number.isFinite(high) || !Number.isFinite(low)) {
      this.safeLog('warn', 'Invalid candle price detected', {
        index,
        high,
        low,
        reason: 'NaN or Infinity',
      });
      return false;
    }

    if (high < low) {
      this.safeLog('warn', 'Invalid candle structure', {
        index,
        high,
        low,
        reason: 'high < low',
      });
      return false;
    }

    return true;
  }

  /**
   * Detect swing points from candle data
   *
   * @param candles - Array of candles to analyze
   * @returns Object with detected highs and lows arrays
   */
  detectSwingPoints(candles: Candle[]): { highs: SwingPoint[]; lows: SwingPoint[] } {
    const highs: SwingPoint[] = [];
    const lows: SwingPoint[] = [];

    try {
      // ========================================================================
      // VALIDATION
      // ========================================================================

      if (!candles || !Array.isArray(candles)) {
        const error = new ValidationError(
          'SwingPointDetectorService: Invalid candles input',
          {
            expectedType: 'Candle[]',
            receivedType: typeof candles,
            reason: 'Candles must be an array',
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'SwingPointDetectorService.detectSwingPoints',
            onRecover: () => {
              this.safeLog('warn', 'Invalid candles input - returning empty', {
                got: typeof candles,
              });
            },
          });
        } else {
          this.safeLog('warn', 'Invalid candles input', { got: typeof candles });
        }

        return { highs, lows };
      }

      if (candles.length < MIN_CANDLES_REQUIRED) {
        const error = new CandleDataMissingError(
          'SwingPointDetectorService: Insufficient candle data',
          {
            calculator: 'SwingPointDetector',
            minRequired: MIN_CANDLES_REQUIRED,
            available: candles.length,
            reason: `Need at least ${MIN_CANDLES_REQUIRED} candles`,
          }
        );

        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'SwingPointDetectorService.detectSwingPoints',
            onRecover: () => {
              this.safeLog('debug', 'Not enough candles', {
                required: MIN_CANDLES_REQUIRED,
                got: candles.length,
              });
            },
          });
        } else {
          this.safeLog('debug', 'Not enough candles', {
            required: MIN_CANDLES_REQUIRED,
            got: candles.length,
          });
        }

        return { highs, lows };
      }

      // ========================================================================
      // DETECTION ALGORITHM
      // ========================================================================

      for (let i = this.lookbackPeriod; i < candles.length - this.lookbackPeriod; i++) {
        const current = candles[i];

        // Validate current candle
        if (!this.isValidCandle(current, i)) {
          continue;
        }

        // Check if this is a local high or low
        let isSwingHigh = true;
        let isSwingLow = true;

        // Compare with all neighbors within lookback period
        for (let j = 1; j <= this.lookbackPeriod; j++) {
          const prevCandle = candles[i - j];
          const nextCandle = candles[i + j];

          // Validate neighbor candles
          if (!this.isValidCandle(prevCandle, i - j) || !this.isValidCandle(nextCandle, i + j)) {
            continue;
          }

          // For swing high: current.high must be > all neighbors' highs
          if (prevCandle.high >= current.high || nextCandle.high >= current.high) {
            isSwingHigh = false;
          }

          // For swing low: current.low must be < all neighbors' lows
          if (prevCandle.low <= current.low || nextCandle.low <= current.low) {
            isSwingLow = false;
          }
        }

        // ====================================================================
        // RECORD DETECTIONS
        // ====================================================================

        if (isSwingHigh) {
          const swingHigh: SwingPoint = {
            price: current.high,
            timestamp: current.timestamp,
            type: SwingPointType.HIGH,
          };

          highs.push(swingHigh);

          this.safeLog('debug', '📈 Swing high detected', {
            candleIndex: i,
            price: current.high.toFixed(DECIMAL_PLACES.PRICE),
            timestamp: new Date(current.timestamp).toISOString(),
          });
        }

        if (isSwingLow) {
          const swingLow: SwingPoint = {
            price: current.low,
            timestamp: current.timestamp,
            type: SwingPointType.LOW,
          };

          lows.push(swingLow);

          this.safeLog('debug', '📉 Swing low detected', {
            candleIndex: i,
            price: current.low.toFixed(DECIMAL_PLACES.PRICE),
            timestamp: new Date(current.timestamp).toISOString(),
          });
        }
      }

      // ========================================================================
      // SUMMARY LOG
      // ========================================================================

      this.safeLog('debug', '🔍 Swing point detection complete', {
        totalCandles: candles.length,
        swingHighsDetected: highs.length,
        swingLowsDetected: lows.length,
        lookbackPeriod: this.lookbackPeriod,
      });

      return { highs, lows };
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Unexpected error during detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.detectSwingPoints',
          onRecover: () => {
            this.safeLog('error', 'Detection failed - returning empty', {
              error: (error as Error).message,
            });
          },
        });
      } else {
        this.safeLog('error', 'Detection failed', {
          error: (error as Error).message,
        });
      }

      return { highs, lows };
    }
  }

  /**
   * Get the latest swing high (most recent)
   *
   * @param highs - Array of swing highs
   * @returns Latest swing high or null
   */
  getLatestHigh(highs: SwingPoint[]): SwingPoint | null {
    if (!highs || highs.length === 0) return null;
    return highs[highs.length - 1];
  }

  /**
   * Get the latest swing low (most recent)
   *
   * @param lows - Array of swing lows
   * @returns Latest swing low or null
   */
  getLatestLow(lows: SwingPoint[]): SwingPoint | null {
    if (!lows || lows.length === 0) return null;
    return lows[lows.length - 1];
  }

  /**
   * Check pattern: Higher Highs + Higher Lows (BULLISH)
   * Phase 8.9.44: Added error handling with GRACEFUL_DEGRADE
   */
  isHigherHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    try {
      if (highs.length < 2 || lows.length < 2) return false;

      const lastHigh = highs[highs.length - 1].price;
      const prevHigh = highs[highs.length - 2].price;
      const lastLow = lows[lows.length - 1].price;
      const prevLow = lows[lows.length - 2].price;

      // Validate prices
      if (
        !Number.isFinite(lastHigh) ||
        !Number.isFinite(prevHigh) ||
        !Number.isFinite(lastLow) ||
        !Number.isFinite(prevLow)
      ) {
        this.safeLog('warn', 'Invalid swing point prices in isHigherHigherLow', {
          lastHigh,
          prevHigh,
          lastLow,
          prevLow,
        });
        return false;
      }

      return lastHigh > prevHigh && lastLow > prevLow;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error in isHigherHigherLow pattern detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in pattern detection',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.isHigherHigherLow',
        });
      } else {
        this.safeLog('error', 'Pattern detection failed', {
          error: (error as Error).message,
        });
      }

      return false;
    }
  }

  /**
   * Check pattern: Lower Highs + Lower Lows (BEARISH)
   * Phase 8.9.44: Added error handling with GRACEFUL_DEGRADE
   */
  isLowerHigherLow(highs: SwingPoint[], lows: SwingPoint[]): boolean {
    try {
      if (highs.length < 2 || lows.length < 2) return false;

      const lastHigh = highs[highs.length - 1].price;
      const prevHigh = highs[highs.length - 2].price;
      const lastLow = lows[lows.length - 1].price;
      const prevLow = lows[lows.length - 2].price;

      // Validate prices
      if (
        !Number.isFinite(lastHigh) ||
        !Number.isFinite(prevHigh) ||
        !Number.isFinite(lastLow) ||
        !Number.isFinite(prevLow)
      ) {
        this.safeLog('warn', 'Invalid swing point prices in isLowerHigherLow', {
          lastHigh,
          prevHigh,
          lastLow,
          prevLow,
        });
        return false;
      }

      return lastHigh < prevHigh && lastLow < prevLow;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error in isLowerHigherLow pattern detection',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in pattern detection',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.isLowerHigherLow',
        });
      } else {
        this.safeLog('error', 'Pattern detection failed', {
          error: (error as Error).message,
        });
      }

      return false;
    }
  }

  /**
   * Calculate trend strength based on swing point consistency
   * More swing points + consistent pattern = higher strength
   *
   * @param bias - BULLISH, BEARISH, or NEUTRAL
   * @param highs - Array of swing highs
   * @param lows - Array of swing lows
   * @returns Strength value between 0.0 and 1.0
   * Phase 8.9.44: Added error handling with GRACEFUL_DEGRADE
   */
  calculateStrengthFromSwingPoints(
    bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    highs: SwingPoint[],
    lows: SwingPoint[],
  ): number {
    try {
      // Validate inputs
      if (!Array.isArray(highs) || !Array.isArray(lows)) {
        this.safeLog('warn', 'Invalid swing point arrays in calculateStrengthFromSwingPoints', {
          highsType: typeof highs,
          lowsType: typeof lows,
        });
        return 0.3; // Return NEUTRAL
      }

      // NEUTRAL = 30%
      if (bias === 'NEUTRAL') {
        return 0.3;
      }

      // For BULLISH/BEARISH, strength depends on swing point count
      const swingPointCount = highs.length + lows.length;

      // Validate count is non-negative
      if (swingPointCount < 0) {
        this.safeLog('warn', 'Invalid swing point count', { count: swingPointCount });
        return 0.3; // Return NEUTRAL
      }

      // 0-2 swing points = weak signal (50%)
      if (swingPointCount <= 2) {
        return 0.5;
      }

      // 3-5 swing points = medium signal (70%)
      if (swingPointCount <= 5) {
        return 0.7;
      }

      // 6+ swing points = strong signal (90%)
      return 0.9;
    } catch (error) {
      const tradingError = new IndicatorCalculationError(
        'SwingPointDetectorService: Error calculating strength from swing points',
        {
          calculator: 'SwingPointDetector',
          reason: 'Unhandled exception in strength calculation',
          error: (error as Error).message,
        },
        error as Error
      );

      if (this.errorHandler) {
        this.errorHandler.handle(tradingError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'SwingPointDetectorService.calculateStrengthFromSwingPoints',
          onRecover: () => {
            this.safeLog('error', 'Strength calculation failed - returning NEUTRAL', {
              error: (error as Error).message,
            });
          },
        });
      } else {
        this.safeLog('error', 'Strength calculation failed', {
          error: (error as Error).message,
        });
      }

      return 0.3; // Return NEUTRAL
    }
  }
}
