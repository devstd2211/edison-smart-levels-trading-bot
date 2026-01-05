import { MULTIPLIERS, PERCENT_MULTIPLIER } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  NEGATIVE_MARKERS,
  SECOND_INDEX,
  EQUAL_THRESHOLD_PRECISION,
} from '../constants/technical.constants';
/**
 * Market Structure Analyzer
 *
 * Analyzes swing points from ZigZag to identify market structure patterns:
 * - HH (Higher High) - bullish trend
 * - HL (Higher Low) - bullish pullback
 * - LH (Lower High) - bearish pullback
 * - LL (Lower Low) - bearish trend
 * - EH (Equal High) - flat/consolidation
 * - EL (Equal Low) - flat/consolidation
 *
 * This analyzer works with data from ZigZagIndicator and provides
 * structural interpretation for trading strategies.
 */

import {
  SwingPoint,
  SwingPointType,
  MarketStructure,
  TrendBias,
  StructureEvent,
  StructureEventType,
  StructureDirection,
  CHoCHBoSDetection,
  LoggerService,
  MarketStructureConfig,
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const EQUAL_THRESHOLD = EQUAL_THRESHOLD_PRECISION;

// These are now in config (strategic values)
// const CHOCH_ALIGNED_BOOST = 1.3;     // From config.analysisConfig.marketStructure.chochAlignedBoost
// const CHOCH_AGAINST_PENALTY = 0.5;   // From config.analysisConfig.marketStructure.chochAgainstPenalty
// const BOS_ALIGNED_BOOST = 1.1;       // From config.analysisConfig.marketStructure.bosAlignedBoost
// const NO_MODIFICATION = 1.0;         // From config.analysisConfig.marketStructure.noModification

const PRICE_COMPARISON_THRESHOLDS = {
  // Price comparison thresholds (TECHNICAL - precision)
  EQUAL_THRESHOLD_MULTIPLIER: 1 + EQUAL_THRESHOLD,  // For higher/higher checks: 1.001
  EQUAL_THRESHOLD_DIVISOR: 1 - EQUAL_THRESHOLD,     // For lower/lower checks: 0.999
  MAX_STRENGTH: 1.0,            // Cap strength at 1.0
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface StructurePoint {
  price: number;
  timestamp: number;
  type: SwingPointType;
}

// ============================================================================
// MARKET STRUCTURE ANALYZER
// ============================================================================

export class MarketStructureAnalyzer {
  private currentTrend: TrendBias = TrendBias.NEUTRAL;
  private lastStructureEvent: StructureEvent | null = null;

  constructor(
    private readonly config: MarketStructureConfig,
    private logger: LoggerService,
  ) {}

  /**
   * Identify market structure by comparing swing points
   *
   * @param highs - Swing high points from ZigZag
   * @param lows - Swing low points from ZigZag
   * @returns Market structure pattern
   */
  identifyStructure(highs: SwingPoint[], lows: SwingPoint[]): MarketStructure | null {
    // Need at least 2 points to identify structure
    if (highs.length < (INTEGER_MULTIPLIERS.TWO as number) && lows.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      return null;
    }

    // Get recent points
    const recentHighs = highs.slice(NEGATIVE_MARKERS.MINUS_TWO as number);
    const recentLows = lows.slice(NEGATIVE_MARKERS.MINUS_TWO as number);

    // Determine what structure we can identify
    if (recentHighs.length >= (INTEGER_MULTIPLIERS.TWO as number)) {
      const [prev, current] = recentHighs;

      if (this.isHigherHigh(current, prev)) {
        return MarketStructure.HIGHER_HIGH;
      } else if (this.isLowerHigh(current, prev)) {
        return MarketStructure.LOWER_HIGH;
      } else if (this.isEqualHigh(current, prev)) {
        return MarketStructure.EQUAL_HIGH;
      }
    }

    if (recentLows.length >= (INTEGER_MULTIPLIERS.TWO as number)) {
      const [prev, current] = recentLows;

      if (this.isHigherLow(current, prev)) {
        return MarketStructure.HIGHER_LOW;
      } else if (this.isLowerLow(current, prev)) {
        return MarketStructure.LOWER_LOW;
      } else if (this.isEqualLow(current, prev)) {
        return MarketStructure.EQUAL_LOW;
      }
    }

    return null;
  }

  /**
   * Get last pattern (combination of structure)
   *
   * @param highs - Swing high points
   * @param lows - Swing low points
   * @returns Pattern string
   */
  getLastPattern(highs: SwingPoint[], lows: SwingPoint[]): 'HH_HL' | 'LH_LL' | 'FLAT' | null {
    // Need at least 2 highs and 2 lows
    if (highs.length < (INTEGER_MULTIPLIERS.TWO as number) || lows.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      return null;
    }

    const recentHighs = highs.slice(NEGATIVE_MARKERS.MINUS_TWO as number);
    const recentLows = lows.slice(NEGATIVE_MARKERS.MINUS_TWO as number);

    const [prevHigh, currentHigh] = recentHighs;
    const [prevLow, currentLow] = recentLows;

    // Check for HH_HL (bullish trend)
    const hasHH = this.isHigherHigh(currentHigh, prevHigh);
    const hasHL = this.isHigherLow(currentLow, prevLow);

    if (hasHH && hasHL) {
      return 'HH_HL';
    }

    // Check for LH_LL (bearish trend)
    const hasLH = this.isLowerHigh(currentHigh, prevHigh);
    const hasLL = this.isLowerLow(currentLow, prevLow);

    if (hasLH && hasLL) {
      return 'LH_LL';
    }

    // Check for FLAT
    const hasEH = this.isEqualHigh(currentHigh, prevHigh);
    const hasEL = this.isEqualLow(currentLow, prevLow);

    if (hasEH || hasEL) {
      return 'FLAT';
    }

    // Mixed structure - unclear
    return null;
  }

  /**
   * Get trend bias from structure
   *
   * @param highs - Swing high points
   * @param lows - Swing low points
   * @returns Trend bias
   */
  getTrendBias(highs: SwingPoint[], lows: SwingPoint[]): TrendBias {
    const pattern = this.getLastPattern(highs, lows);

    switch (pattern) {
    case 'HH_HL':
      return TrendBias.BULLISH;
    case 'LH_LL':
      return TrendBias.BEARISH;
    case 'FLAT':
      return TrendBias.NEUTRAL;
    default:
      return TrendBias.NEUTRAL;
    }
  }

  // ============================================================================
  // PRIVATE METHODS - Structure Identification
  // ============================================================================

  /**
   * Check if current high is higher than previous high
   */
  private isHigherHigh(current: SwingPoint, previous: SwingPoint): boolean {
    return current.price > previous.price * PRICE_COMPARISON_THRESHOLDS.EQUAL_THRESHOLD_MULTIPLIER;
  }

  /**
   * Check if current low is higher than previous low
   */
  private isHigherLow(current: SwingPoint, previous: SwingPoint): boolean {
    return current.price > previous.price * PRICE_COMPARISON_THRESHOLDS.EQUAL_THRESHOLD_MULTIPLIER;
  }

  /**
   * Check if current high is lower than previous high
   */
  private isLowerHigh(current: SwingPoint, previous: SwingPoint): boolean {
    return current.price < previous.price * PRICE_COMPARISON_THRESHOLDS.EQUAL_THRESHOLD_DIVISOR;
  }

  /**
   * Check if current low is lower than previous low
   */
  private isLowerLow(current: SwingPoint, previous: SwingPoint): boolean {
    return current.price < previous.price * PRICE_COMPARISON_THRESHOLDS.EQUAL_THRESHOLD_DIVISOR;
  }

  /**
   * Check if current high is equal to previous high
   */
  private isEqualHigh(current: SwingPoint, previous: SwingPoint): boolean {
    return (
      Math.abs(current.price - previous.price) / previous.price <= EQUAL_THRESHOLD
    );
  }

  /**
   * Check if current low is equal to previous low
   */
  private isEqualLow(current: SwingPoint, previous: SwingPoint): boolean {
    return (
      Math.abs(current.price - previous.price) / previous.price <= EQUAL_THRESHOLD
    );
  }

  // ============================================================================
  // CHoCH/BoS DETECTION
  // ============================================================================

  /**
   * Detect CHoCH (Change of Character) and BoS (Break of Structure) events
   *
   * CHoCH - trend reversal (breaking previous swing)
   * BoS - trend continuation (breaking current swing)
   *
   * @param highs - Swing high points
   * @param lows - Swing low points
   * @param currentPrice - Current market price
   * @param signalDirection - Direction of potential trade signal
   * @returns Detection result with confidence modifier
   */
  detectCHoCHBoS(
    highs: SwingPoint[],
    lows: SwingPoint[],
    currentPrice: number,
    signalDirection?: 'LONG' | 'SHORT',
  ): CHoCHBoSDetection {
    // Need at least 2 swing points to detect structure events
    if (highs.length < (INTEGER_MULTIPLIERS.TWO as number) && lows.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      this.logger.debug('📊 BoS/CHoCH Check: Insufficient swing data', {
        highsCount: highs.length,
        lowsCount: lows.length,
        currentTrend: this.currentTrend,
      });
      return {
        hasEvent: false,
        event: null,
        currentTrend: this.currentTrend,
        confidenceModifier: MULTIPLIERS.NEUTRAL,
      };
    }

    let newEvent: StructureEvent | null = null;

    // Check for bullish CHoCH/BoS (uptrend events)
    if (highs.length >= (INTEGER_MULTIPLIERS.TWO as number)) {
      const [prevHigh, currentHigh] = highs.slice(NEGATIVE_MARKERS.MINUS_TWO as number);
      const distToPrevHigh = currentPrice - prevHigh.price;
      const distToCurrentHigh = currentPrice - currentHigh.price;
      const prevHighPct = (distToPrevHigh / prevHigh.price) * (PERCENT_MULTIPLIER as number);
      const currentHighPct = (distToCurrentHigh / currentHigh.price) * (PERCENT_MULTIPLIER as number);

      // CHoCH BULLISH: price breaks above previous high during downtrend
      if (this.currentTrend === TrendBias.BEARISH && currentPrice > prevHigh.price) {
        newEvent = {
          type: StructureEventType.CHoCH,
          direction: StructureDirection.BULLISH,
          price: currentPrice,
          timestamp: Date.now(),
          strength: this.calculateEventStrength(currentPrice, prevHigh.price, 'break'),
        };
        this.currentTrend = TrendBias.BULLISH;
        this.logger.info('✅ CHoCH BULLISH DETECTED - Trend Reversal!', {
          type: '🔄 CHANGE OF CHARACTER',
          direction: '📈 BULLISH',
          currentPrice,
          prevHighPrice: prevHigh.price,
          breakDistance: distToPrevHigh.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          breakDistancePct: prevHighPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          currentHighPrice: currentHigh.price,
          trendChanged: `BEARISH → BULLISH`,
          strength: (newEvent.strength * (PERCENT_MULTIPLIER as number)).toFixed(SECOND_INDEX as number) + '%',
          timestamp: new Date().toISOString(),
        });
      }
      // BoS BULLISH: price breaks above current high during uptrend
      else if (this.currentTrend === TrendBias.BULLISH && currentPrice > currentHigh.price) {
        newEvent = {
          type: StructureEventType.BoS,
          direction: StructureDirection.BULLISH,
          price: currentPrice,
          timestamp: Date.now(),
          strength: this.calculateEventStrength(currentPrice, currentHigh.price, 'break'),
        };
        this.logger.info('✅ BoS BULLISH DETECTED - Trend Continuation!', {
          type: '📊 BREAK OF STRUCTURE',
          direction: '📈 BULLISH',
          currentPrice,
          currentHighPrice: currentHigh.price,
          breakDistance: distToCurrentHigh.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          breakDistancePct: currentHighPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          strength: (newEvent.strength * (PERCENT_MULTIPLIER as number)).toFixed(SECOND_INDEX as number) + '%',
          timestamp: new Date().toISOString(),
        });
      }
      // Log non-triggering conditions for debugging
      else {
        this.logger.debug('📊 BoS/CHoCH Bullish Check', {
          scenario: 'Highs analysis',
          currentPrice,
          currentTrend: this.currentTrend,
          prevHigh: prevHigh.price,
          distToPrevHigh: distToPrevHigh.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          prevHighPct: prevHighPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          currentHigh: currentHigh.price,
          distToCurrentHigh: distToCurrentHigh.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          currentHighPct: currentHighPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          chochCondition: `${this.currentTrend === TrendBias.BEARISH ? '✓' : '✗'} (trend BEARISH && price > prevHigh)`,
          bosCondition: `${this.currentTrend === TrendBias.BULLISH && currentPrice > currentHigh.price ? '✓' : '✗'} (trend BULLISH && price > currentHigh)`,
        });
      }
    }

    // Check for bearish CHoCH/BoS (downtrend events)
    if (lows.length >= (INTEGER_MULTIPLIERS.TWO as number) && !newEvent) {
      const [prevLow, currentLow] = lows.slice(NEGATIVE_MARKERS.MINUS_TWO as number);
      const distToPrevLow = prevLow.price - currentPrice;
      const distToCurrentLow = currentLow.price - currentPrice;
      const prevLowPct = (distToPrevLow / prevLow.price) * (PERCENT_MULTIPLIER as number);
      const currentLowPct = (distToCurrentLow / currentLow.price) * (PERCENT_MULTIPLIER as number);

      // CHoCH BEARISH: price breaks below previous low during uptrend
      if (this.currentTrend === TrendBias.BULLISH && currentPrice < prevLow.price) {
        newEvent = {
          type: StructureEventType.CHoCH,
          direction: StructureDirection.BEARISH,
          price: currentPrice,
          timestamp: Date.now(),
          strength: this.calculateEventStrength(currentPrice, prevLow.price, 'break'),
        };
        this.currentTrend = TrendBias.BEARISH;
        this.logger.info('✅ CHoCH BEARISH DETECTED - Trend Reversal!', {
          type: '🔄 CHANGE OF CHARACTER',
          direction: '📉 BEARISH',
          currentPrice,
          prevLowPrice: prevLow.price,
          breakDistance: distToPrevLow.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          breakDistancePct: prevLowPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          currentLowPrice: currentLow.price,
          trendChanged: `BULLISH → BEARISH`,
          strength: (newEvent.strength * (PERCENT_MULTIPLIER as number)).toFixed(SECOND_INDEX as number) + '%',
          timestamp: new Date().toISOString(),
        });
      }
      // BoS BEARISH: price breaks below current low during downtrend
      else if (this.currentTrend === TrendBias.BEARISH && currentPrice < currentLow.price) {
        newEvent = {
          type: StructureEventType.BoS,
          direction: StructureDirection.BEARISH,
          price: currentPrice,
          timestamp: Date.now(),
          strength: this.calculateEventStrength(currentPrice, currentLow.price, 'break'),
        };
        this.logger.info('✅ BoS BEARISH DETECTED - Trend Continuation!', {
          type: '📊 BREAK OF STRUCTURE',
          direction: '📉 BEARISH',
          currentPrice,
          currentLowPrice: currentLow.price,
          breakDistance: distToCurrentLow.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          breakDistancePct: currentLowPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          strength: (newEvent.strength * (PERCENT_MULTIPLIER as number)).toFixed(SECOND_INDEX as number) + '%',
          timestamp: new Date().toISOString(),
        });
      }
      // Log non-triggering conditions for debugging
      else {
        this.logger.debug('📊 BoS/CHoCH Bearish Check', {
          scenario: 'Lows analysis',
          currentPrice,
          currentTrend: this.currentTrend,
          prevLow: prevLow.price,
          distToPrevLow: distToPrevLow.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          prevLowPct: prevLowPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          currentLow: currentLow.price,
          distToCurrentLow: distToCurrentLow.toFixed(INTEGER_MULTIPLIERS.TWO as number),
          currentLowPct: currentLowPct.toFixed(INTEGER_MULTIPLIERS.THREE as number) + '%',
          chochCondition: `${this.currentTrend === TrendBias.BULLISH && currentPrice < prevLow.price ? '✓' : '✗'} (trend BULLISH && price < prevLow)`,
          bosCondition: `${this.currentTrend === TrendBias.BEARISH && currentPrice < currentLow.price ? '✓' : '✗'} (trend BEARISH && price < currentLow)`,
        });
      }
    }

    // Update last event if new event detected
    if (newEvent) {
      this.lastStructureEvent = newEvent;
    }

    // Calculate confidence modifier based on event alignment with signal
    const confidenceModifier = this.calculateConfidenceModifier(
      this.lastStructureEvent,
      signalDirection,
    );

    return {
      hasEvent: newEvent !== null,
      event: newEvent,
      currentTrend: this.currentTrend,
      confidenceModifier,
    };
  }

  /**
   * Calculate event strength (0-1) based on break distance
   */
  private calculateEventStrength(
    currentPrice: number,
    brokenLevel: number,
    type: 'break',
  ): number {
    const distance = Math.abs(currentPrice - brokenLevel) / brokenLevel;
    // Normalize: 0.1% = 0.1, 1% = MULTIPLIERS.NEUTRAL
    return Math.min(distance * PERCENT_MULTIPLIER, PRICE_COMPARISON_THRESHOLDS.MAX_STRENGTH);
  }

  /**
   * Calculate confidence modifier based on CHoCH/BoS alignment with signal
   *
   * From specs:
   * - CHoCH in favor: +30% (+0.3)
   * - CHoCH against: -40 to -50% (-0.4 to -0.5)
   * - BoS in favor: +10% (+0.1)
   * - BoS neutral/against: no penalty
   */
  private calculateConfidenceModifier(
    event: StructureEvent | null,
    signalDirection?: 'LONG' | 'SHORT',
  ): number {
    if (!event || !signalDirection) {
      return this.config.noModification;
    }

    const isAligned =
      (signalDirection === 'LONG' && event.direction === StructureDirection.BULLISH) ||
      (signalDirection === 'SHORT' && event.direction === StructureDirection.BEARISH);

    const isAgainst =
      (signalDirection === 'LONG' && event.direction === StructureDirection.BEARISH) ||
      (signalDirection === 'SHORT' && event.direction === StructureDirection.BULLISH);

    if (event.type === StructureEventType.CHoCH) {
      if (isAligned) {
        return this.config.chochAlignedBoost;
      } else if (isAgainst) {
        return this.config.chochAgainstPenalty;
      }
    } else if (event.type === StructureEventType.BoS) {
      if (isAligned) {
        return this.config.bosAlignedBoost;
      }
      // BoS against signal: no penalty (trend continuation is less critical)
    }

    return this.config.noModification;
  }

  /**
   * Get current trend
   */
  getCurrentTrend(): TrendBias {
    return this.currentTrend;
  }

  /**
   * Get last structure event
   */
  getLastStructureEvent(): StructureEvent | null {
    return this.lastStructureEvent;
  }

  /**
   * Reset trend tracking (useful for testing)
   */
  resetTrend(): void {
    this.currentTrend = TrendBias.NEUTRAL;
    this.lastStructureEvent = null;
  }

  /**
   * Set current trend (for testing)
   */
  setTrend(trend: TrendBias): void {
    this.currentTrend = trend;
  }
}
