import { DECIMAL_PLACES, INTEGER_MULTIPLIERS, DOJI_THRESHOLD } from '../constants';
/**
 * Wick Analyzer
 *
 * Detects large wicks (rejection candles) that signal potential reversals or resistance.
 * Wick > 2x body size indicates strong rejection at that level.
 */

import { Candle, LoggerService, SignalDirection } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const LARGE_WICK_THRESHOLD = INTEGER_MULTIPLIERS.TWO; // Wick > 2x body = large wick

// ============================================================================
// TYPES
// ============================================================================

export enum WickDirection {
  UP = 'UP', // Upper wick (resistance rejection)
  DOWN = 'DOWN', // Lower wick (support rejection)
  NONE = 'NONE', // No significant wick
}

export interface WickAnalysis {
  hasLargeWick: boolean;
  wickDirection: WickDirection;
  wickSize: number; // Absolute size
  bodySize: number; // Absolute size
  wickToBodyRatio: number; // wick / body
  blocksDirection?: SignalDirection; // Which direction this wick blocks
}

// ============================================================================
// WICK ANALYZER
// ============================================================================

export class WickAnalyzer {
  constructor(private logger: LoggerService) {}

  /**
   * Detect large wicks on a candle
   * @param candle - Candle to analyze
   * @returns Wick analysis result
   */
  analyze(candle: Candle): WickAnalysis {
    const bodySize = Math.abs(candle.close - candle.open);

    // Handle doji/very small body
    if (bodySize < DOJI_THRESHOLD) {
      this.logger.debug('Doji candle detected (no body)', {
        timestamp: candle.timestamp,
      });
      return this.noWick(0);
    }

    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    // Check upper wick
    if (upperWick > bodySize * LARGE_WICK_THRESHOLD) {
      const ratio = upperWick / bodySize;
      this.logger.debug('Large upper wick detected', {
        upperWick: upperWick.toFixed(DECIMAL_PLACES.PRICE),
        bodySize: bodySize.toFixed(DECIMAL_PLACES.PRICE),
        ratio: ratio.toFixed(DECIMAL_PLACES.PERCENT),
      });

      return {
        hasLargeWick: true,
        wickDirection: WickDirection.UP,
        wickSize: upperWick,
        bodySize,
        wickToBodyRatio: ratio,
        blocksDirection: SignalDirection.LONG, // Upper wick blocks LONG (resistance)
      };
    }

    // Check lower wick
    if (lowerWick > bodySize * LARGE_WICK_THRESHOLD) {
      const ratio = lowerWick / bodySize;
      this.logger.debug('Large lower wick detected', {
        lowerWick: lowerWick.toFixed(DECIMAL_PLACES.PRICE),
        bodySize: bodySize.toFixed(DECIMAL_PLACES.PRICE),
        ratio: ratio.toFixed(DECIMAL_PLACES.PERCENT),
      });

      return {
        hasLargeWick: true,
        wickDirection: WickDirection.DOWN,
        wickSize: lowerWick,
        bodySize,
        wickToBodyRatio: ratio,
        blocksDirection: SignalDirection.SHORT, // Lower wick blocks SHORT (support)
      };
    }

    // No large wick
    return this.noWick(bodySize);
  }

  /**
   * Check if wick blocks a specific signal direction
   * @param wickAnalysis - Wick analysis result
   * @param signalDirection - Signal direction to check
   * @returns True if wick blocks this direction
   */
  blocksSignal(wickAnalysis: WickAnalysis, signalDirection: SignalDirection): boolean {
    if (!wickAnalysis.hasLargeWick || (wickAnalysis.blocksDirection == null)) {
      return false;
    }
    return wickAnalysis.blocksDirection === signalDirection;
  }

  /**
   * Return no wick result
   */
  private noWick(bodySize: number): WickAnalysis {
    return {
      hasLargeWick: false,
      wickDirection: WickDirection.NONE,
      wickSize: 0,
      bodySize,
      wickToBodyRatio: 0,
    };
  }
}
