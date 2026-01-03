import { DECIMAL_PLACES, PERCENTAGE_THRESHOLDS, PERCENT_MULTIPLIER } from '../constants';
import { PATTERN_BOOST_MULTIPLIER } from '../constants/technical.constants';
/**
 * Pattern Analyzer Helper
 *
 * Centralized wrapper for all chart pattern detectors.
 * Provides a single method to analyze all patterns and return confidence/reason updates.
 *
 * Benefits:
 * - Eliminates code duplication across strategies
 * - Centralized logging
 * - Easy to add new patterns
 * - Consistent confidence boosts
 */

import { Candle, SwingPoint, SignalDirection, LoggerService } from '../types';
import { ChartPatternsDetector } from './chart-patterns.detector';
import type { ChartPatternConfig } from './chart-patterns.detector';
import { EngulfingPatternDetector } from './engulfing-pattern.detector';
import { TriplePatternDetector } from './triple-pattern.detector';
import { TrianglePatternDetector } from './triangle-pattern.detector';
import { WedgePatternDetector } from './wedge-pattern.detector';
import { FlagPatternDetector } from './flag-pattern.detector';

// ============================================================================
// TYPES
// ============================================================================

export interface PatternAnalyzerConfig {
  enableChartPatterns?: boolean; // Head & Shoulders, Double Top/Bottom
  enableEngulfingPattern?: boolean; // Bullish/Bearish Engulfing
  enableTriplePattern?: boolean; // Triple Top/Bottom
  enableTrianglePattern?: boolean; // Ascending/Descending/Symmetrical Triangle
  enableWedgePattern?: boolean; // Rising/Falling Wedge
  enableFlagPattern?: boolean; // Bull/Bear Flag
  chartPatternConfig?: ChartPatternConfig; // Configuration for chart pattern detector
  triplePatternConfig?: any; // Config for triple pattern detector
  trianglePatternConfig?: any; // Config for triangle pattern detector
  wedgePatternConfig?: any; // Config for wedge pattern detector
  flagPatternConfig?: any; // Config for flag pattern detector

  // Confidence boosts (customizable per strategy)
  chartPatternBoost?: number; // Default: PERCENTAGE_THRESHOLDS.VERY_LOW
  engulfingBoost?: number; // Default: 0.10
  tripleBoost?: number; // Default: PERCENTAGE_THRESHOLDS.VERY_LOW
  triangleBoost?: number; // Default: 0.10
  wedgeBoost?: number; // Default: 0.10
  flagBoost?: number; // Default: PERCENTAGE_THRESHOLDS.VERY_LOW (continuation pattern)
}

export interface PatternAnalysisInput {
  candles: Candle[]; // For engulfing pattern
  swingPoints: SwingPoint[]; // For chart patterns
  direction: SignalDirection; // Signal direction to match
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // For triangle/wedge patterns
  strategyName: string; // For logging (e.g., "TrendFollowing")
}

export interface PatternAnalysisResult {
  confidenceBoost: number; // Total confidence boost from all patterns
  reasonAdditions: string; // String to append to reason (e.g., " + DOUBLE_BOTTOM + BULL_FLAG")
  patternsDetected: string[]; // Array of detected pattern names
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

// Default ChartPatternConfig
const DEFAULT_CHART_PATTERN_CONFIG: ChartPatternConfig = {
  headTolerancePercent: 2,
  shoulderTolerancePercent: 3,
  necklineTolerancePercent: 2,
  minPatternBars: 20,
  maxPatternBars: 100,
};

const DEFAULT_CONFIG: Required<PatternAnalyzerConfig> = {
  enableChartPatterns: false,
  enableEngulfingPattern: false,
  enableTriplePattern: false,
  enableTrianglePattern: false,
  enableWedgePattern: false,
  enableFlagPattern: false,
  chartPatternConfig: DEFAULT_CHART_PATTERN_CONFIG,
  triplePatternConfig: undefined,
  trianglePatternConfig: undefined,
  wedgePatternConfig: undefined,
  flagPatternConfig: undefined,
  chartPatternBoost: PERCENTAGE_THRESHOLDS.VERY_LOW,
  engulfingBoost: PATTERN_BOOST_MULTIPLIER,
  tripleBoost: PERCENTAGE_THRESHOLDS.VERY_LOW,
  triangleBoost: PATTERN_BOOST_MULTIPLIER,
  wedgeBoost: PATTERN_BOOST_MULTIPLIER,
  flagBoost: PERCENTAGE_THRESHOLDS.VERY_LOW,
};

// ============================================================================
// PATTERN ANALYZER HELPER
// ============================================================================

export class PatternAnalyzerHelper {
  private config: Required<PatternAnalyzerConfig>;
  private chartPatternsDetector: ChartPatternsDetector | null = null;
  private engulfingPatternDetector: EngulfingPatternDetector | null = null;
  private triplePatternDetector: TriplePatternDetector | null = null;
  private trianglePatternDetector: TrianglePatternDetector | null = null;
  private wedgePatternDetector: WedgePatternDetector | null = null;
  private flagPatternDetector: FlagPatternDetector | null = null;

  constructor(
    config: PatternAnalyzerConfig,
    private logger: LoggerService,
    private strategyName?: string, // Optional: for logging context
  ) {
    // Merge with defaults
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize enabled detectors
    if (this.config.enableChartPatterns) {
      this.chartPatternsDetector = new ChartPatternsDetector(logger, this.config.chartPatternConfig!);
      this.logger.info(
        `📊 Chart Patterns Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }

    if (this.config.enableEngulfingPattern) {
      this.engulfingPatternDetector = new EngulfingPatternDetector(logger);
      this.logger.info(
        `🕯️ Engulfing Pattern Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }

    if (this.config.enableTriplePattern) {
      this.triplePatternDetector = new TriplePatternDetector(logger, this.config.triplePatternConfig);
      this.logger.info(
        `🔺 Triple Pattern Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }

    if (this.config.enableTrianglePattern) {
      this.trianglePatternDetector = new TrianglePatternDetector(logger, this.config.trianglePatternConfig);
      this.logger.info(
        `🔺 Triangle Pattern Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }

    if (this.config.enableWedgePattern) {
      this.wedgePatternDetector = new WedgePatternDetector(logger, this.config.wedgePatternConfig);
      this.logger.info(
        `📐 Wedge Pattern Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }

    if (this.config.enableFlagPattern) {
      this.flagPatternDetector = new FlagPatternDetector(logger, this.config.flagPatternConfig);
      this.logger.info(
        `🚩 Flag Pattern Detector enabled${this.strategyName ? ` for ${this.strategyName}` : ''}`,
      );
    }
  }

  /**
   * Analyze all enabled patterns and return confidence boost + reason additions
   *
   * @param input - Pattern analysis input data
   * @returns Pattern analysis result with confidence boost and reason additions
   */
  analyzePatterns(input: PatternAnalysisInput): PatternAnalysisResult {
    let confidenceBoost = 0;
    const reasonParts: string[] = [];
    const patternsDetected: string[] = [];

    const { candles, swingPoints, direction, trend, strategyName } = input;

    // ========================================================================
    // 1. Chart Patterns (Head & Shoulders, Double Top/Bottom)
    // ========================================================================
    if (this.chartPatternsDetector && swingPoints.length >= 3) {
      const pattern = this.chartPatternsDetector.detect(swingPoints);

      if (pattern.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && pattern.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && pattern.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.chartPatternBoost;
          patternsDetected.push(pattern.type);
          reasonParts.push(pattern.type);

          this.logger.info(`📊 ${strategyName} Chart Pattern Detected!`, {
            pattern: pattern.type,
            direction: pattern.direction,
            patternConfidence: pattern.confidence.toFixed(1) + '%',
            boost: `+${(this.config.chartPatternBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Chart pattern detected but direction mismatch`, {
            pattern: pattern.type,
            patternDirection: pattern.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // 2. Engulfing Pattern
    // ========================================================================
    if (this.engulfingPatternDetector && candles.length >= 2) {
      const engulfing = this.engulfingPatternDetector.detect(candles);

      if (engulfing.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && engulfing.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && engulfing.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.engulfingBoost;
          patternsDetected.push(engulfing.type);
          reasonParts.push(engulfing.type);

          this.logger.info(`🕯️ ${strategyName} Engulfing Pattern Detected!`, {
            pattern: engulfing.type,
            direction: engulfing.direction,
            engulfingRatio: engulfing.engulfingRatio.toFixed(DECIMAL_PLACES.PERCENT) + 'x',
            patternConfidence: engulfing.confidence.toFixed(1) + '%',
            boost: `+${(this.config.engulfingBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Engulfing pattern detected but direction mismatch`, {
            pattern: engulfing.type,
            engulfingDirection: engulfing.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // 3. Triple Pattern (Triple Top/Bottom)
    // ========================================================================
    if (this.triplePatternDetector && swingPoints.length >= 5) {
      const triple = this.triplePatternDetector.detect(swingPoints);

      if (triple.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && triple.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && triple.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.tripleBoost;
          patternsDetected.push(triple.type);
          reasonParts.push(triple.type);

          this.logger.info(`🔺 ${strategyName} Triple Pattern Detected!`, {
            pattern: triple.type,
            direction: triple.direction,
            patternConfidence: triple.confidence.toFixed(1) + '%',
            neckline: triple.neckline.toFixed(DECIMAL_PLACES.PRICE),
            boost: `+${(this.config.tripleBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Triple pattern detected but direction mismatch`, {
            pattern: triple.type,
            tripleDirection: triple.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // 4. Triangle Pattern (Ascending/Descending/Symmetrical)
    // ========================================================================
    if (this.trianglePatternDetector && swingPoints.length >= 6) {
      const triangle = this.trianglePatternDetector.detect(swingPoints, trend);

      if (triangle.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && triangle.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && triangle.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.triangleBoost;
          patternsDetected.push(triangle.type);
          reasonParts.push(triangle.type);

          this.logger.info(`🔺 ${strategyName} Triangle Pattern Detected!`, {
            pattern: triangle.type,
            direction: triangle.direction,
            patternConfidence: triangle.confidence.toFixed(1) + '%',
            apex: triangle.apex.toFixed(DECIMAL_PLACES.PRICE),
            target: triangle.target.toFixed(DECIMAL_PLACES.PRICE),
            boost: `+${(this.config.triangleBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Triangle pattern detected but direction mismatch`, {
            pattern: triangle.type,
            triangleDirection: triangle.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // 5. Wedge Pattern (Rising/Falling)
    // ========================================================================
    if (this.wedgePatternDetector && swingPoints.length >= 6) {
      const wedge = this.wedgePatternDetector.detect(swingPoints, trend);

      if (wedge.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && wedge.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && wedge.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.wedgeBoost;
          patternsDetected.push(wedge.type);
          reasonParts.push(wedge.type);

          this.logger.info(`📐 ${strategyName} Wedge Pattern Detected!`, {
            pattern: wedge.type,
            direction: wedge.direction,
            patternConfidence: wedge.confidence.toFixed(1) + '%',
            apex: wedge.apex.toFixed(DECIMAL_PLACES.PRICE),
            target: wedge.target.toFixed(DECIMAL_PLACES.PRICE),
            boost: `+${(this.config.wedgeBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Wedge pattern detected but direction mismatch`, {
            pattern: wedge.type,
            wedgeDirection: wedge.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // 6. Flag Pattern (Bull/Bear Flag - continuation pattern)
    // ========================================================================
    if (this.flagPatternDetector && swingPoints.length >= 6) {
      const flag = this.flagPatternDetector.detect(swingPoints);

      if (flag.detected) {
        const directionMatch =
          (direction === SignalDirection.LONG && flag.direction === 'LONG') ||
          (direction === SignalDirection.SHORT && flag.direction === 'SHORT');

        if (directionMatch) {
          confidenceBoost += this.config.flagBoost;
          patternsDetected.push(flag.type);
          reasonParts.push(flag.type);

          this.logger.info(`🚩 ${strategyName} Flag Pattern Detected!`, {
            pattern: flag.type,
            direction: flag.direction,
            patternConfidence: flag.confidence.toFixed(1) + '%',
            poleHeight: flag.poleHeight.toFixed(DECIMAL_PLACES.PRICE),
            target: flag.target.toFixed(DECIMAL_PLACES.PRICE),
            boost: `+${(this.config.flagBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
          });
        } else {
          this.logger.debug(`⚠️ ${strategyName} Flag pattern detected but direction mismatch`, {
            pattern: flag.type,
            flagDirection: flag.direction,
            signalDirection: direction,
          });
        }
      }
    }

    // ========================================================================
    // Return Result
    // ========================================================================
    const reasonAdditions = reasonParts.length > 0 ? ' + ' + reasonParts.join(' + ') : '';

    if (patternsDetected.length > 0) {
      this.logger.info(`✨ ${strategyName} Pattern Analysis Complete`, {
        patternsDetected: patternsDetected.join(', '),
        totalBoost: `+${(confidenceBoost * PERCENT_MULTIPLIER).toFixed(0)}%`,
      });
    }

    return {
      confidenceBoost,
      reasonAdditions,
      patternsDetected,
    };
  }

  /**
   * Check if any patterns are enabled
   */
  hasEnabledPatterns(): boolean {
    return (
      this.config.enableChartPatterns === true ||
      this.config.enableEngulfingPattern === true ||
      this.config.enableTriplePattern === true ||
      this.config.enableTrianglePattern === true ||
      this.config.enableWedgePattern === true ||
      this.config.enableFlagPattern === true
    );
  }
}
