/**
 * Pattern Recognition Service
 * Phase 10.2.2
 *
 * Provides candlestick pattern recognition, fibonacci levels calculation,
 * and supply/demand zone identification:
 * - Recognizes 15+ candlestick patterns
 * - Calculates fibonacci retracement levels
 * - Identifies supply and demand zones
 * - Scores pattern reliability and strength
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  Candle,
  LogLevel,
  PatternRecognitionStrategicConfig,
  Pattern,
  PatternType,
  PatternDirection,
  FibLevel,
  SwingPoint,
  SwingPointType,
  Zone,
  ZoneType,
  PatternRecognitionConfig,
  DEFAULT_PATTERN_RECOGNITION_CONFIG,
  PatternRecognitionResult,
} from '../types/legacy';
import {
  DEFAULT_PATTERN_RECOGNITION,
  PATTERN_RECOGNITION_TECHNICAL,
} from '../constants/phase-10-constants';
import { getErrorMessage } from '../utils/error.utils';

/**
 * PatternRecognitionService
 *
 * Recognizes candlestick patterns and identifies key price levels.
 *
 * Recovery Strategies:
 * - THROW: Config/input validation (null/invalid inputs)
 * - GRACEFUL_DEGRADE: Pattern recognition failures → empty results
 * - GRACEFUL_DEGRADE: Calculation failures → safe defaults
 * - SKIP: All logging failures via safeLog()
 */
export class PatternRecognitionService {
  private config: PatternRecognitionConfig;
  private strategicConfig: PatternRecognitionStrategicConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandler | null;

  /** Candle history for analysis */
  private candleHistory: Candle[] = [];

  /** Current price for distance calculations */
  private currentPrice: number = 0;

  constructor(
    config?: Partial<PatternRecognitionConfig>,
    strategicConfig?: PatternRecognitionStrategicConfig,
    logger?: LoggerService,
    errorHandler?: ErrorHandler,
  ) {
    // THROW: Config validation OUTSIDE try-catch
    if (config !== undefined && config !== null && (typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('[PatternRecognition] Config must be an object or undefined');
    }

    this.config = { ...DEFAULT_PATTERN_RECOGNITION_CONFIG, ...config };
    this.strategicConfig = { ...DEFAULT_PATTERN_RECOGNITION, ...strategicConfig };
    this.logger = logger || new LoggerService(LogLevel.ERROR, './logs', false);
    this.errorHandler = errorHandler || null;

    this.safeLog('info', 'PatternRecognitionService initialized', {
      minCandlesRequired: this.config.minCandlesRequired,
      minPatternStrength: this.config.minPatternStrength,
      strategicThresholds: this.strategicConfig,
    });
  }

  /**
   * Recognize candlestick patterns in given candles
   *
   * @param candles - Array of candles to analyze
   * @returns Array of recognized patterns
   *
   * @throws Error if candles is null/undefined or not an array
   */
  async recognizePattern(candles: Candle[]): Promise<Pattern[]> {
    // THROW: Input validation
    if (!candles) {
      throw new Error('[PatternRecognition] Candles array cannot be null or undefined');
    }
    if (!Array.isArray(candles)) {
      throw new Error('[PatternRecognition] Candles must be an array');
    }
    if (candles.length < this.config.minCandlesRequired) {
      throw new Error(
        `[PatternRecognition] Insufficient candles: ${candles.length} < ${this.config.minCandlesRequired}`,
      );
    }

    // Update internal state
    this.candleHistory = candles;
    this.currentPrice = candles[candles.length - 1].close;

    // GRACEFUL_DEGRADE: Pattern recognition with safe fallback
    if (this.errorHandler) {
      const result = await this.errorHandler.executeAsync<Pattern[]>(
        async () => this.performPatternRecognition(candles),
        {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'recognizePattern',
        },
      );

      if (result.success && result.value) {
        return result.value;
      }

      this.safeLog('warn', 'Pattern recognition failed, returning empty array', {
        candlesCount: candles.length,
      });

      return []; // Empty array on failure
    }

    // Without ErrorHandler
    try {
      return this.performPatternRecognition(candles);
    } catch (error) {
      this.safeLog('error', 'Pattern recognition failed without ErrorHandler', {
        error: getErrorMessage(error),
      });
      return [];
    }
  }

  /**
   * Calculate pattern strength
   *
   * @param pattern - Pattern to evaluate
   * @returns Strength score (0-100)
   *
   * @throws Error if pattern is null/undefined
   */
  calculatePatternStrength(pattern: Pattern): number {
    // THROW: Input validation
    if (!pattern) {
      throw new Error('[PatternRecognition] Pattern cannot be null or undefined');
    }
    if (!pattern.type) {
      throw new Error('[PatternRecognition] Pattern must have a type');
    }

    // GRACEFUL_DEGRADE: Calculation with safe fallback
    try {
      return this.performStrengthCalculation(pattern);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'calculatePatternStrength',
        });
      }

      this.safeLog('warn', 'Pattern strength calculation failed, using default', {
        patternType: pattern.type,
      });

      return 50; // Neutral strength
    }
  }

  /**
   * Find fibonacci retracement levels
   *
   * @param swing - Swing point to calculate fibonacci from
   * @returns Array of fibonacci levels
   *
   * @throws Error if swing is null/undefined
   */
  findFibonacciLevels(swing: SwingPoint): FibLevel[] {
    // THROW: Input validation
    if (!swing) {
      throw new Error('[PatternRecognition] Swing point cannot be null or undefined');
    }
    if (typeof swing.price !== 'number' || !isFinite(swing.price)) {
      throw new Error('[PatternRecognition] Swing point must have valid price');
    }

    // GRACEFUL_DEGRADE: Fibonacci calculation with safe fallback
    try {
      return this.performFibonacciCalculation(swing);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'findFibonacciLevels',
        });
      }

      this.safeLog('warn', 'Fibonacci calculation failed, returning empty array', {
        swingType: swing.type,
        swingPrice: swing.price,
      });

      return []; // Empty array on failure
    }
  }

  /**
   * Identify supply and demand zones
   *
   * @returns Array of identified zones
   */
  identifySupplyDemandZones(): Zone[] {
    // THROW: Validate internal state
    if (this.candleHistory.length < this.config.minCandlesRequired) {
      throw new Error('[PatternRecognition] Insufficient candle history for zone identification');
    }

    // GRACEFUL_DEGRADE: Zone identification with safe fallback
    try {
      return this.performZoneIdentification();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'identifySupplyDemandZones',
        });
      }

      this.safeLog('warn', 'Zone identification failed, returning empty array', {
        candlesCount: this.candleHistory.length,
      });

      return []; // Empty array on failure
    }
  }

  /**
   * Score pattern reliability
   *
   * @param pattern - Pattern to score
   * @returns Reliability score (0-100)
   *
   * @throws Error if pattern is null/undefined
   */
  scorePatternReliability(pattern: Pattern): number {
    // THROW: Input validation
    if (!pattern) {
      throw new Error('[PatternRecognition] Pattern cannot be null or undefined');
    }

    // GRACEFUL_DEGRADE: Reliability scoring with safe fallback
    try {
      return this.performReliabilityScoring(pattern);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'scorePatternReliability',
        });
      }

      this.safeLog('warn', 'Reliability scoring failed, using default', {
        patternType: pattern.type,
      });

      return 50; // Neutral reliability
    }
  }

  /**
   * Update candle history (for zone tracking)
   */
  updateCandles(candles: Candle[]): void {
    if (!candles || !Array.isArray(candles)) {
      this.safeLog('warn', 'Cannot update candles: invalid input');
      return;
    }

    this.candleHistory = candles;
    if (candles.length > 0) {
      this.currentPrice = candles[candles.length - 1].close;
    }

    this.safeLog('debug', 'Candle history updated', {
      candlesCount: candles.length,
      currentPrice: this.currentPrice,
    });
  }

  /**
   * Clear candle history
   */
  clearHistory(): void {
    this.candleHistory = [];
    this.currentPrice = 0;
    this.safeLog('info', 'Candle history cleared');
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Perform pattern recognition
   */
  private performPatternRecognition(candles: Candle[]): Pattern[] {
    const patterns: Pattern[] = [];

    // Scan through candles looking for patterns
    for (let i = 2; i < candles.length; i++) {
      const pattern = this.checkForPattern(candles, i);
      if (pattern) {
        patterns.push(pattern);
      }
    }

    // Filter by minimum strength and reliability
    return patterns.filter(
      (p) =>
        p.strength >= this.config.minPatternStrength &&
        p.reliability >= this.config.minPatternReliability,
    );
  }

  /**
   * Check for pattern at specific candle index
   */
  private checkForPattern(candles: Candle[], index: number): Pattern | null {
    const current = candles[index];
    const prev = candles[index - 1];
    const prev2 = candles[index - 2];

    // Check single-candle patterns
    if (this.isDoji(current)) {
      return this.createPattern('doji', 'neutral', index, index, current, 1);
    }

    if (this.isHammer(current, prev)) {
      return this.createPattern('hammer', 'bullish', index, index, current, 1);
    }

    if (this.isShootingStar(current, prev)) {
      return this.createPattern('shooting_star', 'bearish', index, index, current, 1);
    }

    // Check two-candle patterns
    if (this.isEngulfingBullish(current, prev)) {
      return this.createPattern('engulfing_bullish', 'bullish', index - 1, index, current, 2);
    }

    if (this.isEngulfingBearish(current, prev)) {
      return this.createPattern('engulfing_bearish', 'bearish', index - 1, index, current, 2);
    }

    if (this.isHaramiBullish(current, prev)) {
      return this.createPattern('harami_bullish', 'bullish', index - 1, index, current, 2);
    }

    if (this.isHaramiBearish(current, prev)) {
      return this.createPattern('harami_bearish', 'bearish', index - 1, index, current, 2);
    }

    // Check three-candle patterns
    if (index >= 2) {
      if (this.isMorningStar(current, prev, prev2)) {
        return this.createPattern('morning_star', 'bullish', index - 2, index, current, 3);
      }

      if (this.isEveningStar(current, prev, prev2)) {
        return this.createPattern('evening_star', 'bearish', index - 2, index, current, 3);
      }
    }

    return null;
  }

  /**
   * Create pattern object
   */
  private createPattern(
    type: PatternType,
    direction: PatternDirection,
    startIndex: number,
    endIndex: number,
    candle: Candle,
    candleCount: number,
  ): Pattern {
    const strength = this.calculateDefaultStrength(type, direction);
    const reliability = this.calculateDefaultReliability(type);

    return {
      type,
      direction,
      strength,
      reliability,
      startIndex,
      endIndex,
      priceLevel: candle.close,
      timestamp: candle.timestamp,
      candleCount,
      confidence: (strength + reliability) / 2,
    };
  }

  /**
   * Check if candle is a doji
   */
  private isDoji(candle: Candle): boolean {
    const range = candle.high - candle.low;
    if (range === 0) return false;

    const body = Math.abs(candle.close - candle.open);
    const bodyRatio = body / range;

    return bodyRatio <= this.config.dojiBodyThreshold;
  }

  /**
   * Check if candle is a hammer
   */
  private isHammer(current: Candle, prev: Candle): boolean {
    const body = Math.abs(current.close - current.open);
    const range = current.high - current.low;
    if (range === 0) return false;

    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const upperShadow = current.high - Math.max(current.open, current.close);

    const bodyRatio = body / range;
    const lowerShadowRatio = lowerShadow / range;

    // Hammer: small body at top, long lower shadow
    return (
      bodyRatio <= this.config.hammerBodyRatio &&
      lowerShadowRatio >= PATTERN_RECOGNITION_TECHNICAL.PATTERN.HAMMER_LOWER_SHADOW_RATIO &&
      upperShadow < body * (PATTERN_RECOGNITION_TECHNICAL.PATTERN.HAMMER_UPPER_SHADOW_MAX_RATIO / this.config.hammerBodyRatio) &&
      prev.close > prev.open // Previous candle should be bearish
    );
  }

  /**
   * Check if candle is a shooting star
   */
  private isShootingStar(current: Candle, prev: Candle): boolean {
    const body = Math.abs(current.close - current.open);
    const range = current.high - current.low;
    if (range === 0) return false;

    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const upperShadow = current.high - Math.max(current.open, current.close);

    const bodyRatio = body / range;
    const upperShadowRatio = upperShadow / range;

    // Shooting star: small body at bottom, long upper shadow
    return (
      bodyRatio <= this.config.hammerBodyRatio &&
      upperShadowRatio >= 0.6 &&
      lowerShadow < body &&
      prev.close < prev.open // Previous candle should be bullish
    );
  }

  /**
   * Check if pattern is bullish engulfing
   */
  private isEngulfingBullish(current: Candle, prev: Candle): boolean {
    // Current must be bullish, previous must be bearish
    if (current.close <= current.open || prev.close >= prev.open) {
      return false;
    }

    // Current body must engulf previous body
    return current.open <= prev.close && current.close >= prev.open;
  }

  /**
   * Check if pattern is bearish engulfing
   */
  private isEngulfingBearish(current: Candle, prev: Candle): boolean {
    // Current must be bearish, previous must be bullish
    if (current.close >= current.open || prev.close <= prev.open) {
      return false;
    }

    // Current body must engulf previous body
    return current.open >= prev.close && current.close <= prev.open;
  }

  /**
   * Check if pattern is bullish harami
   */
  private isHaramiBullish(current: Candle, prev: Candle): boolean {
    // Previous must be bearish, current must be bullish
    if (prev.close >= prev.open || current.close <= current.open) {
      return false;
    }

    // Current body must be inside previous body
    return current.open >= prev.close && current.close <= prev.open;
  }

  /**
   * Check if pattern is bearish harami
   */
  private isHaramiBearish(current: Candle, prev: Candle): boolean {
    // Previous must be bullish, current must be bearish
    if (prev.close <= prev.open || current.close >= current.open) {
      return false;
    }

    // Current body must be inside previous body
    return current.open <= prev.close && current.close >= prev.open;
  }

  /**
   * Check if pattern is morning star
   */
  private isMorningStar(c3: Candle, c2: Candle, c1: Candle): boolean {
    // c1: long bearish, c2: small body (doji), c3: long bullish
    const body1 = Math.abs(c1.close - c1.open);
    const body2 = Math.abs(c2.close - c2.open);
    const body3 = Math.abs(c3.close - c3.open);

    const range1 = c1.high - c1.low;
    const range3 = c3.high - c3.low;

    if (range1 === 0 || range3 === 0) return false;

    return (
      c1.close < c1.open && // c1 bearish
      body2 < body1 * 0.3 && // c2 small
      c3.close > c3.open && // c3 bullish
      c3.close > (c1.open + c1.close) / 2 // c3 closes above c1 midpoint
    );
  }

  /**
   * Check if pattern is evening star
   */
  private isEveningStar(c3: Candle, c2: Candle, c1: Candle): boolean {
    // c1: long bullish, c2: small body (doji), c3: long bearish
    const body1 = Math.abs(c1.close - c1.open);
    const body2 = Math.abs(c2.close - c2.open);
    const body3 = Math.abs(c3.close - c3.open);

    const range1 = c1.high - c1.low;
    const range3 = c3.high - c3.low;

    if (range1 === 0 || range3 === 0) return false;

    return (
      c1.close > c1.open && // c1 bullish
      body2 < body1 * 0.3 && // c2 small
      c3.close < c3.open && // c3 bearish
      c3.close < (c1.open + c1.close) / 2 // c3 closes below c1 midpoint
    );
  }

  /**
   * Calculate default strength for pattern type
   */
  private calculateDefaultStrength(type: PatternType, direction: PatternDirection): number {
    // Three-candle patterns are stronger
    if (type === 'morning_star' || type === 'evening_star') return 80;

    // Engulfing patterns are strong
    if (type === 'engulfing_bullish' || type === 'engulfing_bearish') return 75;

    // Hammer and shooting star are moderate
    if (type === 'hammer' || type === 'shooting_star') return 65;

    // Harami patterns are weaker
    if (type === 'harami_bullish' || type === 'harami_bearish') return 55;

    // Doji is neutral
    if (type === 'doji') return 50;

    return 50; // Default
  }

  /**
   * Calculate default reliability for pattern type
   */
  private calculateDefaultReliability(type: PatternType): number {
    // Three-candle patterns are more reliable
    if (type === 'morning_star' || type === 'evening_star') return 75;

    // Engulfing patterns are reliable
    if (type === 'engulfing_bullish' || type === 'engulfing_bearish') return 70;

    // Two-candle patterns are moderately reliable
    if (type.includes('harami')) return 60;

    // Single-candle patterns are less reliable
    if (type === 'hammer' || type === 'shooting_star') return 55;

    // Doji needs confirmation
    if (type === 'doji') return 45;

    return 50; // Default
  }

  /**
   * Perform strength calculation
   */
  private performStrengthCalculation(pattern: Pattern): number {
    // Base strength from pattern type
    let strength = this.calculateDefaultStrength(pattern.type, pattern.direction);

    // Adjust based on position in recent price action
    if (this.candleHistory.length > 0) {
      const recentHigh = Math.max(...this.candleHistory.slice(-20).map((c) => c.high));
      const recentLow = Math.min(...this.candleHistory.slice(-20).map((c) => c.low));
      const range = recentHigh - recentLow;

      if (range > 0) {
        // Bullish patterns at support are stronger
        if (pattern.direction === 'bullish') {
          const distanceFromLow = (pattern.priceLevel - recentLow) / range;
          if (distanceFromLow < this.strategicConfig.supportResistanceDistance) strength += PATTERN_RECOGNITION_TECHNICAL.SUPPORT_RESISTANCE.LEVEL_BONUS; // Near support
        }

        // Bearish patterns at resistance are stronger
        if (pattern.direction === 'bearish') {
          const distanceFromHigh = (recentHigh - pattern.priceLevel) / range;
          if (distanceFromHigh < this.strategicConfig.supportResistanceDistance) strength += PATTERN_RECOGNITION_TECHNICAL.SUPPORT_RESISTANCE.LEVEL_BONUS; // Near resistance
        }
      }
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, strength));
  }

  /**
   * Perform fibonacci calculation
   */
  private performFibonacciCalculation(swing: SwingPoint): FibLevel[] {
    const levels: FibLevel[] = [];

    // Find opposite swing point
    const oppositeSwing = this.findOppositeSwing(swing);
    if (!oppositeSwing) {
      return [];
    }

    const high = Math.max(swing.price, oppositeSwing.price);
    const low = Math.min(swing.price, oppositeSwing.price);
    const range = high - low;

    if (range === 0) {
      return [];
    }

    // Calculate fibonacci levels
    for (const level of this.config.fibLevels) {
      const price = swing.type === SwingPointType.HIGH
        ? high - (range * level) / 100
        : low + (range * level) / 100;

      const distanceFromPrice = Math.abs(this.currentPrice - price) / this.currentPrice;
      const isBeingTested = distanceFromPrice < this.strategicConfig.fibonacciTestThreshold; // Within threshold

      levels.push({
        level,
        price,
        strength: this.calculateFibStrength(level),
        isBeingTested,
        distanceFromPrice: distanceFromPrice * 100,
      });
    }

    return levels;
  }

  /**
   * Find opposite swing point
   */
  private findOppositeSwing(swing: SwingPoint): SwingPoint | null {
    if (this.candleHistory.length < this.config.swingLookback) {
      return null;
    }

    const lookback = Math.min(this.config.swingLookback, this.candleHistory.length);
    const candles = this.candleHistory.slice(-lookback);

    if (swing.type === SwingPointType.HIGH) {
      // Find recent low
      const minPrice = Math.min(...candles.map((c) => c.low));
      const minIndex = candles.findIndex((c) => c.low === minPrice);

      return {
        type: SwingPointType.LOW,
        price: minPrice,
        timestamp: candles[minIndex].timestamp,
        index: this.candleHistory.length - lookback + minIndex,
        strength: 70,
      };
    } else {
      // Find recent high
      const maxPrice = Math.max(...candles.map((c) => c.high));
      const maxIndex = candles.findIndex((c) => c.high === maxPrice);

      return {
        type: SwingPointType.HIGH,
        price: maxPrice,
        timestamp: candles[maxIndex].timestamp,
        index: this.candleHistory.length - lookback + maxIndex,
        strength: 70,
      };
    }
  }

  /**
   * Calculate fibonacci level strength
   */
  private calculateFibStrength(level: number): number {
    // Key levels are stronger - use constants
    const levelStrength = PATTERN_RECOGNITION_TECHNICAL.FIBONACCI.LEVEL_STRENGTHS[level];
    if (levelStrength !== undefined) {
      return levelStrength;
    }

    return 50; // Default for extension levels
  }

  /**
   * Perform zone identification
   */
  private performZoneIdentification(): Zone[] {
    const zones: Zone[] = [];

    // Find swing highs and lows
    const swingHighs = this.findSwingPoints(SwingPointType.HIGH);
    const swingLows = this.findSwingPoints(SwingPointType.LOW);

    // Create supply zones from swing highs
    for (const swing of swingHighs) {
      const zone = this.createZone('supply', swing);
      if (zone) zones.push(zone);
    }

    // Create demand zones from swing lows
    for (const swing of swingLows) {
      const zone = this.createZone('demand', swing);
      if (zone) zones.push(zone);
    }

    // Filter valid zones
    return zones.filter((z) => z.isValid && z.touchCount >= this.config.minZoneTouches);
  }

  /**
   * Find swing points
   */
  private findSwingPoints(type: SwingPointType): SwingPoint[] {
    const swings: SwingPoint[] = [];
    const lookback = PATTERN_RECOGNITION_TECHNICAL.SWING.LOOKBACK_PERIOD;

    for (let i = lookback; i < this.candleHistory.length - lookback; i++) {
      const candle = this.candleHistory[i];

      if (type === SwingPointType.HIGH) {
        // Check if this is a local high
        const isHigh = this.candleHistory
          .slice(i - lookback, i + lookback + 1)
          .every((c, idx) => idx === lookback || c.high <= candle.high);

        if (isHigh) {
          swings.push({
            type: SwingPointType.HIGH,
            price: candle.high,
            timestamp: candle.timestamp,
            index: i,
            strength: 70,
          });
        }
      } else {
        // Check if this is a local low
        const isLow = this.candleHistory
          .slice(i - lookback, i + lookback + 1)
          .every((c, idx) => idx === lookback || c.low >= candle.low);

        if (isLow) {
          swings.push({
            type: SwingPointType.LOW,
            price: candle.low,
            timestamp: candle.timestamp,
            index: i,
            strength: 70,
          });
        }
      }
    }

    return swings;
  }

  /**
   * Create zone from swing point
   */
  private createZone(type: ZoneType, swing: SwingPoint): Zone | null {
    const zoneWidth = swing.price * this.config.zoneWidthThreshold;

    const upperBound = type === 'supply' ? swing.price : swing.price + zoneWidth;
    const lowerBound = type === 'supply' ? swing.price - zoneWidth : swing.price;

    // Count touches
    const touches = this.countZoneTouches(lowerBound, upperBound);

    // Calculate average volume in zone
    const volumeInZone = this.candleHistory
      .filter((c) => c.high >= lowerBound && c.low <= upperBound)
      .map((c) => c.volume || 0);

    const averageVolume =
      volumeInZone.length > 0
        ? volumeInZone.reduce((sum, v) => sum + v, 0) / volumeInZone.length
        : 0;

    const now = Date.now();
    const isValid = now - swing.timestamp < this.config.zoneValidityPeriod;

    return {
      type,
      upperBound,
      lowerBound,
      strength: this.calculateZoneStrength(touches, averageVolume),
      touchCount: touches,
      createdAt: swing.timestamp,
      lastTestedAt: swing.timestamp,
      isValid,
      averageVolume,
    };
  }

  /**
   * Count zone touches
   */
  private countZoneTouches(lowerBound: number, upperBound: number): number {
    let touches = 0;

    for (const candle of this.candleHistory) {
      // Check if candle touched the zone
      if (candle.high >= lowerBound && candle.low <= upperBound) {
        touches++;
      }
    }

    return touches;
  }

  /**
   * Calculate zone strength
   */
  private calculateZoneStrength(touches: number, averageVolume: number): number {
    let strength = 50;

    // More touches = stronger zone (up to a point)
    if (touches >= this.strategicConfig.highTouchThreshold) strength += PATTERN_RECOGNITION_TECHNICAL.ZONE_TOUCHES.HIGH_TOUCH_BONUS;
    else if (touches >= this.strategicConfig.mediumTouchThreshold) strength += PATTERN_RECOGNITION_TECHNICAL.ZONE_TOUCHES.MEDIUM_TOUCH_BONUS;
    else if (touches >= 2) strength += 10;

    // Higher volume = stronger zone
    if (averageVolume > 0) {
      strength += 10;
    }

    return Math.min(100, strength);
  }

  /**
   * Perform reliability scoring
   */
  private performReliabilityScoring(pattern: Pattern): number {
    // Base reliability from pattern type
    let reliability = this.calculateDefaultReliability(pattern.type);

    // Adjust based on confirmation
    if (this.candleHistory.length > pattern.endIndex + 1) {
      const confirmationCandle = this.candleHistory[pattern.endIndex + 1];

      // Check if next candle confirms pattern direction
      if (pattern.direction === 'bullish' && confirmationCandle.close > confirmationCandle.open) {
        reliability += PATTERN_RECOGNITION_TECHNICAL.CONFIRMATION.BONUS;
      } else if (pattern.direction === 'bearish' && confirmationCandle.close < confirmationCandle.open) {
        reliability += PATTERN_RECOGNITION_TECHNICAL.CONFIRMATION.BONUS;
      }
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, reliability));
  }

  /**
   * Safe logging wrapper (SKIP strategy for logging failures)
   */
  private safeLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    try {
      this.logger[level](message, meta);
    } catch (error) {
      // Silently skip logging errors (SKIP strategy)
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'logging',
        });
      }
    }
  }
}

