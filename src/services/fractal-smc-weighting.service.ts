/**
 * Fractal-SMC Weighting Service
 *
 * Comprehensive weighted scoring system combining:
 * - Fractal signals (max 125 points)
 * - SMC signals (max 110 points)
 * - Total score (max 220 points)
 *
 * Scoring rules:
 * - Threshold: 70 points minimum
 * - HIGH confidence: 90+ points (100% position)
 * - MEDIUM confidence: 70-89 points (75% position)
 * - LOW confidence: <70 points (skip, not tradable)
 */

import { LoggerService, StrategyMarketData } from '../types';
import {
  FractalSetup,
  ScoreWeight,
  WeightedSignal,
  WeightedSignalConfig,
  ConfidenceLevel
} from '../types/fractal-strategy.types';
import { INTEGER_MULTIPLIERS, DECIMAL_PLACES } from '../constants';

export class FractalSmcWeightingService {
  // Fractal weights (total max: 125 normalized points)
  private readonly FRACTAL_WEIGHTS: Record<string, ScoreWeight> = {
    BREAKOUT_CONFIRMED: { base: 25, weight: 1.5 },    // 37.5 max
    RETEST_ZONE: { base: 20, weight: 1.2 },           // 24 max
    REVERSAL_CANDLE: { base: 30, weight: 1.8 },       // 54 max (MOST IMPORTANT)
    CONFIRMATION_BARS: { base: 15, weight: 1.0 },     // 15 max
    VOLUME: { base: 20, weight: 1.3 },                // 26 max
    PRICE_ACTION: { base: 15, weight: 1.2 }           // 18 max
  };

  // SMC weights (total max: 110 normalized points)
  private readonly SMC_WEIGHTS: Record<string, ScoreWeight> = {
    ORDER_BLOCK: { base: 20, weight: 1.4 },           // 28 max
    FAIR_VALUE_GAP: { base: 18, weight: 1.3 },        // 23.4 max
    LIQUIDITY_GRAB: { base: 25, weight: 2.0 },        // 50 max (MOST IMPORTANT)
    BREAKER_BLOCK: { base: 16, weight: 1.2 },         // 19.2 max
    MITIGATION_BLOCK: { base: 14, weight: 1.1 },      // 15.4 max
    STRUCTURE_ALIGNMENT: { base: 17, weight: 1.5 }    // 25.5 max
  };

  private readonly FRACTAL_MAX_RAW_SCORE = 174.5;     // Sum of max weighted scores
  private readonly SMC_MAX_RAW_SCORE = 161.5;         // Sum of max weighted scores

  constructor(
    private config: WeightedSignalConfig,
    private logger: LoggerService
  ) {}

  /**
   * Calculate comprehensive weighted score
   */
  calculateWeightedScore(setup: FractalSetup, data: StrategyMarketData): WeightedSignal {
    const fractalScore = this.calculateFractalScore(setup);
    const smcScore = this.calculateSmcScore(setup, data);
    const combinedScore = fractalScore + smcScore;
    const passesThreshold = combinedScore >= this.config.threshold;
    const confidence = this.determineConfidence(combinedScore);
    const positionSize = this.getPositionSize(confidence);
    const reasoning = this.buildReasoning(setup, data, fractalScore, smcScore, confidence);

    this.logger.info('Weighted score calculated', {
      fractalScore: fractalScore.toFixed(1),
      smcScore: smcScore.toFixed(1),
      combined: combinedScore.toFixed(1),
      threshold: this.config.threshold,
      confidence,
      positionSize: (positionSize * INTEGER_MULTIPLIERS.ONE_HUNDRED).toFixed(0) + '%',
      passes: passesThreshold
    });

    return {
      fractalScore,
      smcScore,
      combinedScore,
      threshold: this.config.threshold,
      passesThreshold,
      confidence,
      positionSize,
      reasoning
    };
  }

  /**
   * Calculate Fractal score (0-125)
   * Based on 6 criteria with weights
   */
  private calculateFractalScore(setup: FractalSetup): number {
    let rawScore = 0;
    const details: string[] = [];

    // 1. Breakout Confirmed
    if (setup.breakout && setup.breakout.confirmedByClose) {
      const strength = setup.breakout.strength * INTEGER_MULTIPLIERS.ONE_HUNDRED; // Convert to basis points
      const basePoints = Math.min(this.FRACTAL_WEIGHTS.BREAKOUT_CONFIRMED.base, strength / 0.04);
      const weighted = basePoints * this.FRACTAL_WEIGHTS.BREAKOUT_CONFIRMED.weight;
      rawScore += weighted;
      details.push(`Breakout: ${weighted.toFixed(1)} pts (${(strength * 0.01).toFixed(DECIMAL_PLACES.PERCENT)}% strength)`);
    }

    // 2. Retest Zone Reached
    if (setup.retest && setup.retest.isSecondTouch) {
      const touchBonus = Math.min(5, setup.retest.touchCount - 1);
      const basePoints = this.FRACTAL_WEIGHTS.RETEST_ZONE.base + touchBonus;
      const weighted = basePoints * this.FRACTAL_WEIGHTS.RETEST_ZONE.weight;
      rawScore += weighted;
      details.push(`Retest: ${weighted.toFixed(1)} pts (${setup.retest.touchCount} touches)`);
    }

    // 3. Reversal Candle (MOST IMPORTANT)
    if (setup.reversal && setup.reversal.strongCandleBody) {
      const weighted = this.FRACTAL_WEIGHTS.REVERSAL_CANDLE.base * this.FRACTAL_WEIGHTS.REVERSAL_CANDLE.weight;
      rawScore += weighted;
      details.push(`Reversal candle: ${weighted.toFixed(1)} pts`);
    }

    // 4. Confirmation Bars
    if (setup.reversal && setup.reversal.confirmationBars >= 1) {
      const basePoints = Math.min(
        this.FRACTAL_WEIGHTS.CONFIRMATION_BARS.base,
        setup.reversal.confirmationBars * 7.5
      );
      const weighted = basePoints * this.FRACTAL_WEIGHTS.CONFIRMATION_BARS.weight;
      rawScore += weighted;
      details.push(`Confirmation: ${weighted.toFixed(1)} pts (${setup.reversal.confirmationBars} bars)`);
    }

    // 5. Volume
    if (setup.breakout && setup.breakout.volumeRatio > 1.0) {
      const volumeBonus = Math.min(INTEGER_MULTIPLIERS.TEN, (setup.breakout.volumeRatio - 1) * INTEGER_MULTIPLIERS.TEN);
      const basePoints = this.FRACTAL_WEIGHTS.VOLUME.base + volumeBonus;
      const weighted = basePoints * this.FRACTAL_WEIGHTS.VOLUME.weight;
      rawScore += weighted;
      details.push(`Volume: ${weighted.toFixed(1)} pts (${setup.breakout.volumeRatio.toFixed(DECIMAL_PLACES.PERCENT)}x avg)`);
    }

    // 6. Price Action Pattern
    if (setup.reversal && setup.reversal.priceActionPattern) {
      const weighted = this.FRACTAL_WEIGHTS.PRICE_ACTION.base * this.FRACTAL_WEIGHTS.PRICE_ACTION.weight;
      rawScore += weighted;
      details.push(`Pattern ${setup.reversal.priceActionPattern}: ${weighted.toFixed(1)} pts`);
    }

    // Normalize to 125 points max
    const normalized = (rawScore / this.FRACTAL_MAX_RAW_SCORE) * this.config.maxFractalScore;

    this.logger.debug('Fractal score breakdown', {
      rawScore: rawScore.toFixed(1),
      normalized: normalized.toFixed(1),
      details
    });

    return Math.min(normalized, this.config.maxFractalScore);
  }

  /**
   * Calculate SMC score (0-110)
   * Based on 6 criteria with weights
   */
  private calculateSmcScore(setup: FractalSetup, data: StrategyMarketData): number {
    let rawScore = 0;
    const details: string[] = [];

    // Note: In full implementation, would analyze real SMC data from data parameter
    // For now, we give points based on available data

    // 1. Structure Alignment (from entry refinement)
    if (setup.reversal && setup.reversal.structureAligned) {
      const weighted = this.SMC_WEIGHTS.STRUCTURE_ALIGNMENT.base * this.SMC_WEIGHTS.STRUCTURE_ALIGNMENT.weight;
      rawScore += weighted;
      details.push(`Structure alignment: ${weighted.toFixed(1)} pts`);
    }

    // 2. Check for liquidity analysis in data
    if (data.liquidity?.strongZones && data.liquidity.strongZones.length > 0) {
      const weighted = this.SMC_WEIGHTS.ORDER_BLOCK.base * this.SMC_WEIGHTS.ORDER_BLOCK.weight;
      rawScore += weighted;
      details.push(`Order block zone: ${weighted.toFixed(1)} pts`);
    }

    // 3. Check for recent liquidity sweep (MOST IMPORTANT)
    if (data.liquidity?.recentSweep?.detected) {
      const weighted = this.SMC_WEIGHTS.LIQUIDITY_GRAB.base * this.SMC_WEIGHTS.LIQUIDITY_GRAB.weight;
      rawScore += weighted;
      details.push(`Liquidity grab: ${weighted.toFixed(1)} pts`);
    }

    // 4. Volume confirmation as proxy for SMC interest
    if (setup.reversal && setup.reversal.volumeConfirmed) {
      const weighted = this.SMC_WEIGHTS.FAIR_VALUE_GAP.base * this.SMC_WEIGHTS.FAIR_VALUE_GAP.weight;
      rawScore += weighted;
      details.push(`Volume confirmed: ${weighted.toFixed(1)} pts`);
    }

    // Normalize to 110 points max
    const normalized = (rawScore / this.SMC_MAX_RAW_SCORE) * this.config.maxSmcScore;

    this.logger.debug('SMC score breakdown', {
      rawScore: rawScore.toFixed(1),
      normalized: normalized.toFixed(1),
      details
    });

    return Math.min(normalized, this.config.maxSmcScore);
  }

  /**
   * Determine confidence level based on combined score
   */
  private determineConfidence(score: number): ConfidenceLevel {
    if (score >= this.config.highConfidenceThreshold) {
      return ConfidenceLevel.HIGH;
    }
    if (score >= this.config.threshold) {
      return ConfidenceLevel.MEDIUM;
    }
    return ConfidenceLevel.LOW;
  }

  /**
   * Get position size multiplier based on confidence
   */
  private getPositionSize(confidence: ConfidenceLevel): number {
    switch (confidence) {
      case ConfidenceLevel.HIGH:
        return 1.0;   // 100% position size
      case ConfidenceLevel.MEDIUM:
        return 0.75;  // 75% position size
      case ConfidenceLevel.LOW:
        return 0.5;   // Not tradable, but return 50% for logging
    }
  }

  /**
   * Build detailed reasoning for scoring decision
   */
  private buildReasoning(
    setup: FractalSetup,
    data: StrategyMarketData,
    fractalScore: number,
    smcScore: number,
    confidence: ConfidenceLevel
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Fractal: ${fractalScore.toFixed(1)}/125 pts`);
    reasoning.push(`SMC: ${smcScore.toFixed(1)}/110 pts`);
    reasoning.push(`Combined: ${(fractalScore + smcScore).toFixed(1)}/220 pts`);
    reasoning.push(`Confidence: ${confidence}`);

    // Add key factors
    if (setup.reversal?.strongCandleBody) {
      reasoning.push('✓ Strong reversal candle');
    }
    if (setup.breakout && setup.breakout.volumeRatio > 1.5) {
      reasoning.push('✓ High volume breakout');
    }
    if (setup.retest && setup.retest.touchCount >= 2) {
      reasoning.push(`✓ Multiple retest touches (${setup.retest.touchCount})`);
    }
    if (data.liquidity?.recentSweep?.detected) {
      reasoning.push('✓ Liquidity sweep detected');
    }
    if (setup.reversal?.priceActionPattern) {
      reasoning.push(`✓ Price action pattern: ${setup.reversal.priceActionPattern}`);
    }

    return reasoning;
  }
}
