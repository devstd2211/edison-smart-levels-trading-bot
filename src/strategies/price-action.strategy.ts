import { DECIMAL_PLACES, MULTIPLIERS, THRESHOLD_VALUES, MULTIPLIER_VALUES } from '../constants';
/**
 * Price Action Strategy
 *
 * Advanced strategy based on Smart Money Concepts (SMC):
 * - CHoCH/BoS (Change of Character / Break of Structure)
 * - Liquidity Sweeps (false breakouts)
 * - Divergences (RSI vs Price)
 *
 * Priority: MULTIPLIERS.HALF (higher than Trend-Following)
 * Best for: Reversal entries after liquidity grabs
 */

import {
  SignalDirection,
  SwingPoint,
  Candle,
  LoggerService,
  StructureEventType,
  StructureDirection,
  StructureEvent,
} from '../types';
import { IStrategy, StrategyEvaluation } from './strategy.interface';
import { MarketStructureAnalyzer } from '../analyzers/market-structure.analyzer';
import { LiquidityDetector, LiquidityAnalysis } from '../analyzers/liquidity.detector';
import { DivergenceDetector, Divergence, DivergenceType } from '../analyzers/divergence.detector';

// ============================================================================
// TYPES
// ============================================================================

export interface PriceActionConfig {
  enabled: boolean;
  minConfidence: number;          // Minimum confidence to enter (0.75-0.85)
  requireLiquiditySweep: boolean; // Require liquidity sweep for entry
  requireDivergence: boolean;     // Require divergence for entry
  requireCHoCH: boolean;          // Require CHoCH for entry
}

export interface PriceActionData {
  swingPoints: SwingPoint[];
  candles: Candle[];
  currentPrice: number;
  rsi: number;
  rsiHistory: Map<number, number>; // timestamp -> RSI value
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BASE_CONFIDENCE = THRESHOLD_VALUES.SEVENTY_FIVE_PERCENT; // High base confidence for PA signals
const LIQUIDITY_SWEEP_BOOST = THRESHOLD_VALUES.FIFTEEN_PERCENT; // +15% for fakeout
const DIVERGENCE_BOOST = THRESHOLD_VALUES.TEN_PERCENT;          // +10% for divergence
const CHOCH_BOOST = THRESHOLD_VALUES.TEN_PERCENT;               // +10% for CHoCH in our direction
const BOS_BOOST = THRESHOLD_VALUES.FIVE_PERCENT;                // +5% for BoS
const CONFLICT_PENALTY = THRESHOLD_VALUES.TWENTY_FIVE_PERCENT;  // -25% penalty for opposite divergence

// ============================================================================
// PRICE ACTION STRATEGY
// ============================================================================

export class PriceActionStrategy implements IStrategy<PriceActionData> {
  constructor(
    private config: PriceActionConfig,
    private structureAnalyzer: MarketStructureAnalyzer,
    private liquidityDetector: LiquidityDetector,
    private divergenceDetector: DivergenceDetector,
    private logger: LoggerService,
  ) {}

  /**
   * Get strategy name
   */
  getName(): string {
    return 'PriceAction';
  }

  /**
   * Get strategy description
   */
  getDescription(): string {
    return 'Advanced price action strategy based on Smart Money Concepts (CHoCH/BoS, Liquidity Sweeps, Divergences)';
  }

  /**
   * Evaluate price action signals with fully typed data
   *
   * @param data - Properly typed PriceActionData (no casting needed)
   * @returns Strategy evaluation result
   */
  evaluate(data: PriceActionData): StrategyEvaluation {
    if (!this.config.enabled) {
      return this.noSignal('Strategy disabled');
    }

    // Step 1: Analyze liquidity (zones + sweeps)
    const liquidityAnalysis = this.liquidityDetector.analyze(
      data.swingPoints,
      data.candles,
    );

    // Step 2: Detect divergence
    const divergence = this.divergenceDetector.detect(
      data.swingPoints,
      data.rsiHistory,
    );

    // Step 3: Get structure events (CHoCH/BoS)
    const structureEvent = this.structureAnalyzer.getLastStructureEvent();
    const currentTrend = this.structureAnalyzer.getCurrentTrend();

    this.logger.debug('Price Action Analysis', {
      liquiditySweep: liquidityAnalysis.recentSweep?.detected ?? false,
      isFakeout: liquidityAnalysis.recentSweep?.isFakeout ?? false,
      divergenceType: divergence.type,
      structureEvent: structureEvent?.type ?? 'NONE',
      currentTrend,
    });

    // Step 4: Evaluate LONG signals
    const longSignal = this.evaluateLong(
      liquidityAnalysis,
      divergence,
      structureEvent,
      currentTrend,
    );

    if (longSignal.shouldEnter) {
      return longSignal;
    }

    // Step 5: Evaluate SHORT signals
    const shortSignal = this.evaluateShort(
      liquidityAnalysis,
      divergence,
      structureEvent,
      currentTrend,
    );

    if (shortSignal.shouldEnter) {
      return shortSignal;
    }

    // Combine blocked reasons from both directions
    const allBlockedReasons = [
      ...new Set([...longSignal.blockedBy, ...shortSignal.blockedBy]),
    ];

    return this.noSignal('No price action setup found', allBlockedReasons);
  }

  // ============================================================================
  // PRIVATE: LONG EVALUATION
  // ============================================================================

  private evaluateLong(
    liquidity: LiquidityAnalysis,
    divergence: Divergence,
    structureEvent: StructureEvent | null,
    currentTrend: string,
  ): StrategyEvaluation {
    const reasons: string[] = [];
    const blockedBy: string[] = [];
    let confidence = BASE_CONFIDENCE;

    // Scenario 1: Liquidity Sweep + Bullish Divergence
    const hasSweep = liquidity.recentSweep?.detected &&
                     liquidity.recentSweep.isFakeout &&
                     liquidity.recentSweep.direction === 'DOWN';

    const hasBullishDiv = divergence.type === DivergenceType.BULLISH;
    const hasBearishStructure = structureEvent?.direction === StructureDirection.BEARISH;

    // 🛡️ SAFETY CHECK: Divergence-Structure conflict
    // Bullish divergence (expecting reversal UP) vs Bearish structure (trend DOWN)
    if (hasBullishDiv && hasBearishStructure) {
      this.logger.warn('Conflicting signals detected', {
        direction: 'LONG',
        conflict: 'Bullish divergence vs Bearish structure',
        confidencePenalty: -CONFLICT_PENALTY,
      });

      // Apply penalty for conflicting signals
      confidence -= CONFLICT_PENALTY;
      reasons.push('⚠️ Structure conflict');
    }

    // Check required conditions
    if (this.config.requireLiquiditySweep && !hasSweep) {
      blockedBy.push('NO_LIQUIDITY_SWEEP');
      return this.noSignal('No liquidity sweep for LONG', blockedBy);
    }

    if (this.config.requireDivergence && !hasBullishDiv) {
      blockedBy.push('NO_DIVERGENCE');
      return this.noSignal('No bullish divergence', blockedBy);
    }

    // If no requirements set, need AT LEAST ONE signal present
    const hasBullishStructure = structureEvent?.direction === StructureDirection.BULLISH;
    if (!this.config.requireLiquiditySweep && !this.config.requireDivergence && !this.config.requireCHoCH) {
      if (!hasSweep && !hasBullishDiv && !hasBullishStructure) {
        blockedBy.push('NO_SIGNALS');
        return this.noSignal('No price action signals detected', blockedBy);
      }
    }

    // 🛡️ FINAL SAFETY: Don't enter LONG with bearish structure (hard block)
    if (hasBearishStructure) {
      this.logger.warn('Bearish structure blocks LONG entry');
      blockedBy.push('BEARISH_STRUCTURE');
      return this.noSignal('Bearish structure detected', blockedBy);
    }

    // Boost confidence based on signals
    if (hasSweep) {
      confidence += LIQUIDITY_SWEEP_BOOST * (liquidity.recentSweep!.strength);
      reasons.push('Liquidity sweep (fakeout down)');
    }

    if (hasBullishDiv) {
      confidence += DIVERGENCE_BOOST * divergence.strength;
      reasons.push(`Bullish divergence (strength: ${divergence.strength.toFixed(DECIMAL_PLACES.PERCENT)})`);
    }

    // CHoCH/BoS boost (bearish structure already blocked above)
    if (structureEvent && structureEvent.direction === StructureDirection.BULLISH) {
      if (structureEvent.type === StructureEventType.CHoCH) {
        confidence += CHOCH_BOOST;
        reasons.push('Bullish CHoCH');
      } else if (structureEvent.type === StructureEventType.BoS) {
        confidence += BOS_BOOST;
        reasons.push('Bullish BoS');
      }
    }

    // Check minimum confidence
    if (confidence < this.config.minConfidence) {
      blockedBy.push('LOW_CONFIDENCE');
      return this.noSignal(`Confidence too low: ${confidence.toFixed(DECIMAL_PLACES.PERCENT)}`, blockedBy);
    }

    // Entry signal!
    return {
      shouldEnter: true,
      direction: SignalDirection.LONG,
      confidence: Math.min(confidence, 1.0), // Cap at 1.0
      reason: reasons.join(' + '),
      blockedBy: [],
    };
  }

  // ============================================================================
  // PRIVATE: SHORT EVALUATION
  // ============================================================================

  private evaluateShort(
    liquidity: LiquidityAnalysis,
    divergence: Divergence,
    structureEvent: StructureEvent | null,
    currentTrend: string,
  ): StrategyEvaluation {
    const reasons: string[] = [];
    const blockedBy: string[] = [];
    let confidence = BASE_CONFIDENCE;

    // Scenario 2: Liquidity Sweep + Bearish Divergence
    const hasSweep = liquidity.recentSweep?.detected &&
                     liquidity.recentSweep.isFakeout &&
                     liquidity.recentSweep.direction === 'UP';

    const hasBearishDiv = divergence.type === DivergenceType.BEARISH;
    const hasBullishStructure = structureEvent?.direction === StructureDirection.BULLISH;
    const hasBearishStructure = structureEvent?.direction === StructureDirection.BEARISH;

    // 🛡️ SAFETY CHECK: Divergence-Structure conflict
    // Bearish divergence (expecting reversal DOWN) vs Bullish structure (trend UP)
    if (hasBearishDiv && hasBullishStructure) {
      this.logger.warn('Conflicting signals detected', {
        direction: 'SHORT',
        conflict: 'Bearish divergence vs Bullish structure',
        confidencePenalty: -CONFLICT_PENALTY,
      });

      // Apply penalty for conflicting signals
      confidence -= CONFLICT_PENALTY;
      reasons.push('⚠️ Structure conflict');
    }

    // Check required conditions
    if (this.config.requireLiquiditySweep && !hasSweep) {
      blockedBy.push('NO_LIQUIDITY_SWEEP');
      return this.noSignal('No liquidity sweep for SHORT', blockedBy);
    }

    if (this.config.requireDivergence && !hasBearishDiv) {
      blockedBy.push('NO_DIVERGENCE');
      return this.noSignal('No bearish divergence', blockedBy);
    }

    // If no requirements set, need AT LEAST ONE signal present
    if (!this.config.requireLiquiditySweep && !this.config.requireDivergence && !this.config.requireCHoCH) {
      if (!hasSweep && !hasBearishDiv && !hasBearishStructure) {
        blockedBy.push('NO_SIGNALS');
        return this.noSignal('No price action signals detected', blockedBy);
      }
    }

    // 🛡️ FINAL SAFETY: Don't enter SHORT with bullish structure (hard block)
    if (hasBullishStructure) {
      this.logger.warn('Bullish structure blocks SHORT entry');
      blockedBy.push('BULLISH_STRUCTURE');
      return this.noSignal('Bullish structure detected', blockedBy);
    }

    // Boost confidence based on signals
    if (hasSweep) {
      confidence += LIQUIDITY_SWEEP_BOOST * (liquidity.recentSweep!.strength);
      reasons.push('Liquidity sweep (fakeout up)');
    }

    if (hasBearishDiv) {
      confidence += DIVERGENCE_BOOST * divergence.strength;
      reasons.push(`Bearish divergence (strength: ${divergence.strength.toFixed(DECIMAL_PLACES.PERCENT)})`);
    }

    // CHoCH/BoS boost (bullish structure already blocked above)
    if (structureEvent && structureEvent.direction === StructureDirection.BEARISH) {
      if (structureEvent.type === StructureEventType.CHoCH) {
        confidence += CHOCH_BOOST;
        reasons.push('Bearish CHoCH');
      } else if (structureEvent.type === StructureEventType.BoS) {
        confidence += BOS_BOOST;
        reasons.push('Bearish BoS');
      }
    }

    // Check minimum confidence
    if (confidence < this.config.minConfidence) {
      blockedBy.push('LOW_CONFIDENCE');
      return this.noSignal(`Confidence too low: ${confidence.toFixed(DECIMAL_PLACES.PERCENT)}`, blockedBy);
    }

    // Entry signal!
    return {
      shouldEnter: true,
      direction: SignalDirection.SHORT,
      confidence: Math.min(confidence, 1.0), // Cap at 1.0
      reason: reasons.join(' + '),
      blockedBy: [],
    };
  }

  // ============================================================================
  // HELPER
  // ============================================================================

  private noSignal(reason: string, blockedBy: string[] = []): StrategyEvaluation {
    return {
      shouldEnter: false,
      direction: SignalDirection.HOLD,
      confidence: 0,
      reason,
      blockedBy,
    };
  }
}
