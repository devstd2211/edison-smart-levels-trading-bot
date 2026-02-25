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
} from '../types/legacy';
import { SwingPointDetectorService } from './swing-point-detector.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

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
    private readonly errorHandler?: ErrorHandler,
  ) {
    try {
      this.logger.info('✅ MultiTimeframeTrendService initialized');
    } catch {
      // Ignore logger errors on initialization
    }
  }

  /**
   * Analyze multi-timeframe trend data
   *
   * @param multiTFData - Candles for multiple timeframes (5m, 15m, 1h, 4h)
   * @returns Multi-timeframe analysis with consensus and alignment
   */
  async analyze(multiTFData: MultiTimeframeData): Promise<MultiTimeframeAnalysis> {
    // ========================================================================
    // VALIDATION (THROW STRATEGY)
    // ========================================================================

    if (!multiTFData) {
      const error = new Error('MultiTimeframe: null or undefined input data received');
      if (this.errorHandler) {
        await this.errorHandler.executeAsync(
          async () => {
            throw error;
          },
          { strategy: RecoveryStrategy.THROW },
        );
      }
      throw error;
    }

    // ========================================================================
    // ANALYZE EACH TIMEFRAME (GRACEFUL_DEGRADE)
    // ========================================================================

    let byTimeframe: MultiTimeframeAnalysis['byTimeframe'];

    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync(
        async () => ({
          '5m': this.analyzeTimeframe((multiTFData as any).candles5m || [], '5m'),
          '15m': this.analyzeTimeframe((multiTFData as any).candles15m || [], '15m'),
          '1h': this.analyzeTimeframe((multiTFData as any).candles1h || [], '1h'),
          '4h': this.analyzeTimeframe((multiTFData as any).candles4h || [], '4h'),
        }),
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );

      if (result.success && result.value) {
        byTimeframe = result.value;
      } else {
        byTimeframe = {
          '5m': { timeframe: '5m', bias: TrendBias.NEUTRAL, strength: 0.3, swingHighsCount: 0, swingLowsCount: 0 },
          '15m': { timeframe: '15m', bias: TrendBias.NEUTRAL, strength: 0.3, swingHighsCount: 0, swingLowsCount: 0 },
          '1h': { timeframe: '1h', bias: TrendBias.NEUTRAL, strength: 0.3, swingHighsCount: 0, swingLowsCount: 0 },
          '4h': { timeframe: '4h', bias: TrendBias.NEUTRAL, strength: 0.3, swingHighsCount: 0, swingLowsCount: 0 },
        };
      }
    } else {
      byTimeframe = {
        '5m': this.analyzeTimeframe((multiTFData as any).candles5m || [], '5m'),
        '15m': this.analyzeTimeframe((multiTFData as any).candles15m || [], '15m'),
        '1h': this.analyzeTimeframe((multiTFData as any).candles1h || [], '1h'),
        '4h': this.analyzeTimeframe((multiTFData as any).candles4h || [], '4h'),
      };
    }

    // ========================================================================
    // LOG INDIVIDUAL TIMEFRAME RESULTS (SKIP STRATEGY)
    // ========================================================================

    if (this.errorHandler) {
      await this.errorHandler.executeAsync(
        async () => {
          this.logger.debug('📊 Multi-timeframe analysis complete', {
            '5m': `${byTimeframe['5m'].bias} (${byTimeframe['5m'].strength.toFixed(2)}, ${byTimeframe['5m'].swingHighsCount}H/${byTimeframe['5m'].swingLowsCount}L)`,
            '15m': `${byTimeframe['15m'].bias} (${byTimeframe['15m'].strength.toFixed(2)}, ${byTimeframe['15m'].swingHighsCount}H/${byTimeframe['15m'].swingLowsCount}L)`,
            '1h': `${byTimeframe['1h'].bias} (${byTimeframe['1h'].strength.toFixed(2)}, ${byTimeframe['1h'].swingHighsCount}H/${byTimeframe['1h'].swingLowsCount}L)`,
            '4h': `${byTimeframe['4h'].bias} (${byTimeframe['4h'].strength.toFixed(2)}, ${byTimeframe['4h'].swingHighsCount}H/${byTimeframe['4h'].swingLowsCount}L)`,
          });
        },
        { strategy: RecoveryStrategy.SKIP },
      );
    } else {
      this.logger.debug('📊 Multi-timeframe analysis complete', {
        '5m': `${byTimeframe['5m'].bias} (${byTimeframe['5m'].strength.toFixed(2)}, ${byTimeframe['5m'].swingHighsCount}H/${byTimeframe['5m'].swingLowsCount}L)`,
        '15m': `${byTimeframe['15m'].bias} (${byTimeframe['15m'].strength.toFixed(2)}, ${byTimeframe['15m'].swingHighsCount}H/${byTimeframe['15m'].swingLowsCount}L)`,
        '1h': `${byTimeframe['1h'].bias} (${byTimeframe['1h'].strength.toFixed(2)}, ${byTimeframe['1h'].swingHighsCount}H/${byTimeframe['1h'].swingLowsCount}L)`,
        '4h': `${byTimeframe['4h'].bias} (${byTimeframe['4h'].strength.toFixed(2)}, ${byTimeframe['4h'].swingHighsCount}H/${byTimeframe['4h'].swingLowsCount}L)`,
      });
    }

    // ========================================================================
    // CALCULATE CONSENSUS (GRACEFUL_DEGRADE)
    // ========================================================================

    let primaryTrend = byTimeframe['4h'].bias;
    let currentTrend = byTimeframe['1h'].bias;
    let entryTrend = byTimeframe['5m'].bias;
    let alignment: 'ALIGNED' | 'CONFLICTED' | 'MIXED' = 'MIXED';
    let strength = 0.3;

    if (this.errorHandler) {
      await this.errorHandler.executeAsync(
        async () => {
          primaryTrend = byTimeframe['4h'].bias;
          currentTrend = byTimeframe['1h'].bias;
          entryTrend = this.getEntryTrend(byTimeframe);
          alignment = this.detectAlignment(byTimeframe);
          strength = this.calculateConsensusStrength(byTimeframe);
        },
        { strategy: RecoveryStrategy.GRACEFUL_DEGRADE },
      );
    } else {
      primaryTrend = byTimeframe['4h'].bias;
      currentTrend = byTimeframe['1h'].bias;
      entryTrend = this.getEntryTrend(byTimeframe);
      alignment = this.detectAlignment(byTimeframe);
      strength = this.calculateConsensusStrength(byTimeframe);
    }

    // ========================================================================
    // LOG CONSENSUS (SKIP STRATEGY)
    // ========================================================================

    if (this.errorHandler) {
      await this.errorHandler.executeAsync(
        async () => {
          this.logger.info('🎯 Consensus formed', {
            primaryTrend,
            currentTrend,
            entryTrend,
            alignment,
            strength: strength.toFixed(2),
          });
        },
        { strategy: RecoveryStrategy.SKIP },
      );
    } else {
      this.logger.info('🎯 Consensus formed', {
        primaryTrend,
        currentTrend,
        entryTrend,
        alignment,
        strength: strength.toFixed(2),
      });
    }

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
    // VALIDATE INPUT (GRACEFUL_DEGRADE)
    // ========================================================================

    if (!candles || candles.length < 5) {
      try {
        this.logger.debug(`Insufficient candles for ${timeframe} analysis`, {
          required: 5,
          got: candles?.length || 0,
        });
      } catch {
        // Ignore logger errors
      }

      return {
        timeframe,
        bias: TrendBias.NEUTRAL,
        strength: 0.3,
        swingHighsCount: 0,
        swingLowsCount: 0,
      };
    }

    // ========================================================================
    // DETECT SWING POINTS (GRACEFUL_DEGRADE)
    // ========================================================================

    let highs: { price: number; timestamp: number }[] = [];
    let lows: { price: number; timestamp: number }[] = [];

    try {
      const result = this.swingPointDetector.detectSwingPoints(candles);
      highs = result.highs;
      lows = result.lows;
    } catch {
      // Return safe defaults on detection failure
      highs = [];
      lows = [];
    }

    // ========================================================================
    // CALCULATE TREND BIAS (GRACEFUL_DEGRADE)
    // ========================================================================

    let bias = this.calculateBias(highs, lows, candles);
    let pattern = this.getPattern(highs, lows) || 'FLAT';

    // ========================================================================
    // CALCULATE STRENGTH (GRACEFUL_DEGRADE)
    // ========================================================================

    let strength = 0.3;
    try {
      strength = this.swingPointDetector.calculateStrengthFromSwingPoints(
        bias,
        highs as any,
        lows as any,
      );
    } catch {
      // Return safe default on strength calculation failure
      strength = 0.3;
    }

    // ========================================================================
    // LOG AND RETURN (SKIP LOGGING)
    // ========================================================================

    try {
      this.logger.debug(`${timeframe} analysis`, {
        bias,
        pattern,
        strength: strength.toFixed(2),
        swingHighs: highs.length,
        swingLows: lows.length,
      });
    } catch {
      // Ignore logger errors
    }

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
    // ========================================================================
    // VALIDATE NaN/INVALID VALUES (GRACEFUL_DEGRADE)
    // ========================================================================

    if (!highs || !lows) {
      return TrendBias.NEUTRAL;
    }

    // Validate prices are valid numbers
    for (const high of highs) {
      if (!Number.isFinite(high.price)) {
        return TrendBias.NEUTRAL;
      }
    }

    for (const low of lows) {
      if (!Number.isFinite(low.price)) {
        return TrendBias.NEUTRAL;
      }
    }

    // ========================================================================
    // ANALYZE PATTERN
    // ========================================================================

    // Need at least 2 highs and 2 lows to detect pattern
    if (highs.length < 2 || lows.length < 2) {
      // Check overall price direction
      if (candles && candles.length >= 2) {
        const first = candles[0].close;
        const last = candles[candles.length - 1].close;

        // Validate prices
        if (!Number.isFinite(first) || !Number.isFinite(last)) {
          return TrendBias.NEUTRAL;
        }

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
    // ========================================================================
    // VALIDATE INPUT
    // ========================================================================

    if (!highs || !lows) return 'FLAT';

    if (highs.length < 2 || lows.length < 2) return 'FLAT';

    // Validate prices are valid numbers
    for (const high of highs) {
      if (!Number.isFinite(high.price)) return 'FLAT';
    }

    for (const low of lows) {
      if (!Number.isFinite(low.price)) return 'FLAT';
    }

    // ========================================================================
    // DETECT PATTERN
    // ========================================================================

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
    // ========================================================================
    // VALIDATE INPUT (GRACEFUL_DEGRADE)
    // ========================================================================

    if (!byTimeframe || !byTimeframe['5m'] || !byTimeframe['15m']) {
      return TrendBias.NEUTRAL;
    }

    const shortTFTrends = [byTimeframe['5m'].bias, byTimeframe['15m'].bias];

    // ========================================================================
    // DETERMINE ENTRY TREND
    // ========================================================================

    // If both agree
    if (shortTFTrends[0] === shortTFTrends[1]) {
      return shortTFTrends[0];
    }

    // If different, check which is stronger
    const strength5m = byTimeframe['5m'].strength ?? 0;
    const strength15m = byTimeframe['15m'].strength ?? 0;

    if (!Number.isFinite(strength5m) || !Number.isFinite(strength15m)) {
      return TrendBias.NEUTRAL;
    }

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
    // ========================================================================
    // VALIDATE INPUT (GRACEFUL_DEGRADE)
    // ========================================================================

    if (!byTimeframe) {
      return 'MIXED';
    }

    // Validate all timeframes exist
    if (
      !byTimeframe['5m'] ||
      !byTimeframe['15m'] ||
      !byTimeframe['1h'] ||
      !byTimeframe['4h']
    ) {
      return 'MIXED';
    }

    // ========================================================================
    // COUNT BIASES
    // ========================================================================

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

    // ========================================================================
    // DETERMINE ALIGNMENT
    // ========================================================================

    // All aligned in same direction
    if (bullishCount === 4 || bearishCount === 4) {
      return 'ALIGNED';
    }

    // Check for key conflicts (e.g., 4h vs 1h disagree)
    if (
      (byTimeframe['4h'].bias === TrendBias.BULLISH &&
        byTimeframe['1h'].bias === TrendBias.BEARISH) ||
      (byTimeframe['4h'].bias === TrendBias.BEARISH &&
        byTimeframe['1h'].bias === TrendBias.BULLISH)
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
    // ========================================================================
    // VALIDATE INPUT (GRACEFUL_DEGRADE)
    // ========================================================================

    if (!byTimeframe) {
      return 0.3;
    }

    // Validate all timeframes exist with valid strength values
    const strength4h = byTimeframe['4h']?.strength ?? 0.3;
    const strength1h = byTimeframe['1h']?.strength ?? 0.3;
    const strength15m = byTimeframe['15m']?.strength ?? 0.3;
    const strength5m = byTimeframe['5m']?.strength ?? 0.3;

    // Check for NaN/Infinity values
    if (
      !Number.isFinite(strength4h) ||
      !Number.isFinite(strength1h) ||
      !Number.isFinite(strength15m) ||
      !Number.isFinite(strength5m)
    ) {
      return 0.3;
    }

    // ========================================================================
    // CALCULATE WEIGHTED AVERAGE
    // ========================================================================

    // Weighted average: 4h=40%, 1h=30%, 15m=20%, 5m=10%
    const weighted =
      strength4h * 0.4 + strength1h * 0.3 + strength15m * 0.2 + strength5m * 0.1;

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
