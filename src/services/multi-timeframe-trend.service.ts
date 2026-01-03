/**
 * Multi-Timeframe Trend Service
 *
 * Analyzes trend across multiple timeframes (5m, 15m, 1h, 4h) and combines results
 * for comprehensive market structure understanding.
 *
 * Responsibilities:
 * - Accept candles data for multiple timeframes
 * - Delegate swing point detection to SwingPointDetectorService
 * - Calculate trend bias for each timeframe separately
 * - Detect alignment (ALIGNED/CONFLICTED/MIXED) across timeframes
 * - Provide weighted analysis based on timeframe importance
 */

import {
  Candle,
  LoggerService,
  MultiTimeframeData,
  MultiTimeframeAnalysis,
  TimeframeAnalysis,
  TrendBias,
} from '../types';
import { SwingPointDetectorService } from './swing-point-detector.service';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMEFRAMES = ['5m', '15m', '1h', '4h'] as const;

// ============================================================================
// SERVICE
// ============================================================================

export class MultiTimeframeTrendService {
  constructor(
    private readonly logger: LoggerService,
    private readonly swingPointDetector: SwingPointDetectorService,
  ) {
    this.logger.info('✅ MultiTimeframeTrendService initialized');
  }

  /**
   * Analyze multi-timeframe trend data
   *
   * @param multiTFData - Candles for multiple timeframes (5m, 15m, 1h, 4h)
   * @returns Multi-timeframe analysis with consensus and alignment
   */
  async analyze(multiTFData: MultiTimeframeData): Promise<MultiTimeframeAnalysis> {
    // ========================================================================
    // VALIDATION
    // ========================================================================

    if (!multiTFData) {
      this.logger.warn('Invalid multi-timeframe data input');
      return this.getEmptyAnalysis();
    }

    // ========================================================================
    // ANALYZE EACH TIMEFRAME
    // ========================================================================

    const byTimeframe: MultiTimeframeAnalysis['byTimeframe'] = {
      '5m': this.analyzeTimeframe(multiTFData.candles5m, '5m'),
      '15m': this.analyzeTimeframe(multiTFData.candles15m, '15m'),
      '1h': this.analyzeTimeframe(multiTFData.candles1h, '1h'),
      '4h': this.analyzeTimeframe(multiTFData.candles4h, '4h'),
    };

    // ========================================================================
    // LOG INDIVIDUAL TIMEFRAME RESULTS
    // ========================================================================

    this.logger.debug('📊 Multi-timeframe analysis complete', {
      '5m': `${byTimeframe['5m'].bias} (${byTimeframe['5m'].strength.toFixed(2)}, ${byTimeframe['5m'].swingHighsCount}H/${byTimeframe['5m'].swingLowsCount}L)`,
      '15m': `${byTimeframe['15m'].bias} (${byTimeframe['15m'].strength.toFixed(2)}, ${byTimeframe['15m'].swingHighsCount}H/${byTimeframe['15m'].swingLowsCount}L)`,
      '1h': `${byTimeframe['1h'].bias} (${byTimeframe['1h'].strength.toFixed(2)}, ${byTimeframe['1h'].swingHighsCount}H/${byTimeframe['1h'].swingLowsCount}L)`,
      '4h': `${byTimeframe['4h'].bias} (${byTimeframe['4h'].strength.toFixed(2)}, ${byTimeframe['4h'].swingHighsCount}H/${byTimeframe['4h'].swingLowsCount}L)`,
    });

    // ========================================================================
    // CALCULATE CONSENSUS
    // ========================================================================

    const primaryTrend = byTimeframe['4h'].bias;        // Longest timeframe
    const currentTrend = byTimeframe['1h'].bias;        // Immediate trend
    const entryTrend = this.getEntryTrend(byTimeframe); // Shortest timeframes (5m/15m)
    const alignment = this.detectAlignment(byTimeframe);
    const strength = this.calculateConsensusStrength(byTimeframe);

    this.logger.info('🎯 Consensus formed', {
      primaryTrend,
      currentTrend,
      entryTrend,
      alignment,
      strength: strength.toFixed(2),
    });

    // ========================================================================
    // RETURN ANALYSIS
    // ========================================================================

    return {
      byTimeframe,
      consensus: {
        primaryTrend,
        currentTrend,
        entryTrend,
        strength,
        alignment,
      },
    };
  }

  /**
   * Analyze single timeframe
   *
   * @param candles - Array of candles
   * @param timeframe - Timeframe label ('5m', '15m', '1h', '4h')
   * @returns Trend analysis for this timeframe
   */
  private analyzeTimeframe(candles: Candle[], timeframe: string): TimeframeAnalysis {
    // ========================================================================
    // VALIDATE INPUT
    // ========================================================================

    if (!candles || candles.length < 5) {
      this.logger.debug(`Insufficient candles for ${timeframe} analysis`, {
        required: 5,
        got: candles?.length || 0,
      });
      return {
        timeframe,
        bias: TrendBias.NEUTRAL,
        strength: 0.3,
        swingHighsCount: 0,
        swingLowsCount: 0,
      };
    }

    // ========================================================================
    // DETECT SWING POINTS
    // ========================================================================

    const { highs, lows } = this.swingPointDetector.detectSwingPoints(candles);

    // ========================================================================
    // CALCULATE TREND BIAS
    // ========================================================================

    const bias = this.calculateBias(highs, lows, candles);
    const pattern = this.getPattern(highs, lows);

    // ========================================================================
    // CALCULATE STRENGTH
    // ========================================================================

    const strength = this.swingPointDetector.calculateStrengthFromSwingPoints(
      bias,
      highs,
      lows,
    );

    // ========================================================================
    // LOG AND RETURN
    // ========================================================================

    this.logger.debug(`${timeframe} analysis`, {
      bias,
      pattern,
      strength: strength.toFixed(2),
      swingHighs: highs.length,
      swingLows: lows.length,
    });

    return {
      timeframe,
      bias,
      strength,
      swingHighsCount: highs.length,
      swingLowsCount: lows.length,
      pattern,
    };
  }

  /**
   * Calculate trend bias from swing points
   *
   * @param highs - Array of swing highs
   * @param lows - Array of swing lows
   * @param candles - Original candles
   * @returns Trend bias (BULLISH, BEARISH, NEUTRAL)
   */
  private calculateBias(
    highs: { price: number; timestamp: number }[],
    lows: { price: number; timestamp: number }[],
    candles: Candle[],
  ): TrendBias {
    // Need at least 2 highs and 2 lows to detect pattern
    if (highs.length < 2 || lows.length < 2) {
      // Check overall price direction
      if (candles.length >= 2) {
        const first = candles[0].close;
        const last = candles[candles.length - 1].close;
        if (last > first) return TrendBias.BULLISH;
        if (last < first) return TrendBias.BEARISH;
      }
      return TrendBias.NEUTRAL;
    }

    // Check Higher High + Higher Low = BULLISH
    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    if (lastHigh > prevHigh && lastLow > prevLow) {
      return TrendBias.BULLISH;
    }

    // Check Lower High + Lower Low = BEARISH
    if (lastHigh < prevHigh && lastLow < prevLow) {
      return TrendBias.BEARISH;
    }

    // Mixed or unclear
    return TrendBias.NEUTRAL;
  }

  /**
   * Get pattern name from swing points
   *
   * @param highs - Array of swing highs
   * @param lows - Array of swing lows
   * @returns Pattern name ('HH_HL', 'LH_LL', 'FLAT')
   */
  private getPattern(
    highs: { price: number }[],
    lows: { price: number }[],
  ): string | undefined {
    if (highs.length < 2 || lows.length < 2) return 'FLAT';

    const lastHigh = highs[highs.length - 1].price;
    const prevHigh = highs[highs.length - 2].price;
    const lastLow = lows[lows.length - 1].price;
    const prevLow = lows[lows.length - 2].price;

    if (lastHigh > prevHigh && lastLow > prevLow) return 'HH_HL';
    if (lastHigh < prevHigh && lastLow < prevLow) return 'LH_LL';
    return 'FLAT';
  }

  /**
   * Get entry trend from shorter timeframes (5m/15m average)
   *
   * @param byTimeframe - Analysis by timeframe
   * @returns Entry trend
   */
  private getEntryTrend(byTimeframe: MultiTimeframeAnalysis['byTimeframe']): TrendBias {
    const shortTFTrends = [byTimeframe['5m'].bias, byTimeframe['15m'].bias];

    // If both agree
    if (shortTFTrends[0] === shortTFTrends[1]) {
      return shortTFTrends[0];
    }

    // If different, check which is stronger
    const strength5m = byTimeframe['5m'].strength;
    const strength15m = byTimeframe['15m'].strength;

    if (strength5m > strength15m) {
      return byTimeframe['5m'].bias;
    }

    return byTimeframe['15m'].bias;
  }

  /**
   * Detect alignment across timeframes
   *
   * ALIGNED: All timeframes point same direction
   * CONFLICTED: Multiple timeframes disagree (e.g., Bullish 4h vs Bearish 1h)
   * MIXED: Some agreement but not all aligned
   *
   * @param byTimeframe - Analysis by timeframe
   * @returns Alignment status
   */
  private detectAlignment(
    byTimeframe: MultiTimeframeAnalysis['byTimeframe'],
  ): 'ALIGNED' | 'CONFLICTED' | 'MIXED' {
    const trends = [
      byTimeframe['5m'].bias,
      byTimeframe['15m'].bias,
      byTimeframe['1h'].bias,
      byTimeframe['4h'].bias,
    ];

    // Count each bias
    const bullishCount = trends.filter((t) => t === TrendBias.BULLISH).length;
    const bearishCount = trends.filter((t) => t === TrendBias.BEARISH).length;
    const neutralCount = trends.filter((t) => t === TrendBias.NEUTRAL).length;

    // All aligned in same direction
    if (bullishCount === 4 || bearishCount === 4) {
      return 'ALIGNED';
    }

    // Check for key conflicts (e.g., 4h vs 1h disagree)
    if (
      (byTimeframe['4h'].bias === TrendBias.BULLISH && byTimeframe['1h'].bias === TrendBias.BEARISH) ||
      (byTimeframe['4h'].bias === TrendBias.BEARISH && byTimeframe['1h'].bias === TrendBias.BULLISH)
    ) {
      return 'CONFLICTED';
    }

    // Some agreement but not perfect
    if (bullishCount >= 2 || bearishCount >= 2) {
      return 'MIXED';
    }

    // Too many neutrals
    return 'MIXED';
  }

  /**
   * Calculate consensus strength from all timeframes
   *
   * @param byTimeframe - Analysis by timeframe
   * @returns Weighted average strength
   */
  private calculateConsensusStrength(
    byTimeframe: MultiTimeframeAnalysis['byTimeframe'],
  ): number {
    // Weighted average: 4h=40%, 1h=30%, 15m=20%, 5m=10%
    const weighted =
      byTimeframe['4h'].strength * 0.4 +
      byTimeframe['1h'].strength * 0.3 +
      byTimeframe['15m'].strength * 0.2 +
      byTimeframe['5m'].strength * 0.1;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, weighted));
  }

  /**
   * Get empty analysis (fallback for invalid input)
   *
   * @returns Empty multi-timeframe analysis
   */
  private getEmptyAnalysis(): MultiTimeframeAnalysis {
    const emptyTF: TimeframeAnalysis = {
      timeframe: '',
      bias: TrendBias.NEUTRAL,
      strength: 0.3,
      swingHighsCount: 0,
      swingLowsCount: 0,
    };

    return {
      byTimeframe: {
        '5m': { ...emptyTF, timeframe: '5m' },
        '15m': { ...emptyTF, timeframe: '15m' },
        '1h': { ...emptyTF, timeframe: '1h' },
        '4h': { ...emptyTF, timeframe: '4h' },
      },
      consensus: {
        primaryTrend: TrendBias.NEUTRAL,
        currentTrend: TrendBias.NEUTRAL,
        entryTrend: TrendBias.NEUTRAL,
        strength: 0.3,
        alignment: 'MIXED',
      },
    };
  }
}
