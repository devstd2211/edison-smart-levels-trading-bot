/**
 * Risk Calculator Service
 *
 * Calculates Stop Loss and Take Profit levels based on:
 * - ATR (Average True Range) multiplier
 * - Reference level (support/resistance)
 * - Take profit percentages from config
 * - Session-based adjustments
 *
 * This service is independent of any strategy and can be used by all analyzers/strategies
 * to calculate SL/TP consistently.
 */

import { LoggerService, SignalDirection, SessionBasedSLConfig } from '../types';
import { SessionDetector } from '../utils/session-detector';
import { PERCENT_MULTIPLIER, DECIMAL_PLACES } from '../constants';

// ============================================================================
// TYPES
// ============================================================================

export interface TakeProfitConfig {
  level: number;
  percent: number;
  sizePercent: number;
}

export interface RiskCalculationInput {
  direction: SignalDirection;
  entryPrice: number;
  referenceLevel: number; // support (LONG) or resistance (SHORT)
  atrPercent: number; // ATR in percent (e.g., 1.5%)
  slMultiplier: number; // e.g., 1.5x ATR
  slMultiplierLong?: number; // Optional: different multiplier for LONG
  minSlDistancePercent: number; // Minimum SL distance % (from config)
  takeProfitConfigs: TakeProfitConfig[];
  sessionBasedSL?: SessionBasedSLConfig;
}

export interface RiskCalculationResult {
  stopLoss: number;
  takeProfits: Array<{
    level: number;
    price: number;
    percent: number;
    sizePercent: number;
    hit: boolean;
  }>;
  stopLossDistance: number; // absolute value from entry to SL
  stopLossPercent: number; // percentage distance
}

// ============================================================================
// RISK CALCULATOR SERVICE
// ============================================================================

export class RiskCalculator {
  constructor(private logger: LoggerService) {}

  /**
   * Calculate SL and TP levels for a trade
   *
   * @param input - Risk calculation input parameters
   * @returns SL and TP levels
   */
  calculate(input: RiskCalculationInput): RiskCalculationResult {
    const {
      direction,
      entryPrice,
      referenceLevel,
      atrPercent,
      slMultiplier,
      slMultiplierLong,
      minSlDistancePercent,
      takeProfitConfigs,
      sessionBasedSL,
    } = input;

    // ========================================================================
    // STOP LOSS CALCULATION
    // ========================================================================

    // Convert ATR from percent to absolute value
    const atrAbsolute = entryPrice * (atrPercent / PERCENT_MULTIPLIER);

    // Select appropriate SL multiplier for direction
    const effectiveSlMultiplier =
      direction === SignalDirection.LONG && slMultiplierLong
        ? slMultiplierLong
        : slMultiplier;

    // Calculate SL distance: ATR * multiplier
    let stopLossDistance = atrAbsolute * effectiveSlMultiplier;

    // Enforce minimum SL distance (from config)
    const minSlDistance = entryPrice * (minSlDistancePercent / PERCENT_MULTIPLIER);
    stopLossDistance = Math.max(stopLossDistance, minSlDistance);

    // Apply session-based adjustment if enabled
    if (sessionBasedSL?.enabled) {
      stopLossDistance = SessionDetector.applySessionBasedSL(
        stopLossDistance,
        sessionBasedSL,
        this.logger,
        'RiskCalculator',
      );
    }

    // Place SL relative to reference level (support/resistance)
    const stopLoss =
      direction === SignalDirection.LONG
        ? referenceLevel - stopLossDistance // Below support
        : referenceLevel + stopLossDistance; // Above resistance

    // Calculate SL distance as percentage
    const stopLossPercent = Math.abs((stopLoss - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;

    // ========================================================================
    // TAKE PROFIT CALCULATION
    // ========================================================================

    const takeProfits = takeProfitConfigs.map(tp => ({
      level: tp.level,
      percent: tp.percent,
      sizePercent: tp.sizePercent,
      price:
        direction === SignalDirection.LONG
          ? entryPrice * (1 + tp.percent / PERCENT_MULTIPLIER)
          : entryPrice * (1 - tp.percent / PERCENT_MULTIPLIER),
      hit: false,
    }));

    this.logger.debug(`RiskCalculator: Calculated ${direction} trade`, {
      entry: entryPrice.toFixed(DECIMAL_PLACES.PRICE),
      referenceLevel: referenceLevel.toFixed(DECIMAL_PLACES.PRICE),
      sl: stopLoss.toFixed(DECIMAL_PLACES.PRICE),
      slDistance: stopLossDistance.toFixed(DECIMAL_PLACES.PRICE),
      slPercent: stopLossPercent.toFixed(DECIMAL_PLACES.PERCENT),
      tpCount: takeProfits.length,
      atr: atrPercent.toFixed(DECIMAL_PLACES.PERCENT),
      slMultiplier: effectiveSlMultiplier.toFixed(DECIMAL_PLACES.PERCENT),
    });

    return {
      stopLoss,
      takeProfits,
      stopLossDistance,
      stopLossPercent,
    };
  }

  /**
   * Calculate SL and TP from a simple percentage-based approach
   * Useful for analyzers that don't have reference level
   *
   * @param entryPrice - Entry price
   * @param direction - LONG or SHORT
   * @param slPercent - Stop loss as percentage (e.g., 1.0 for 1%)
   * @param takeProfitConfigs - TP configs
   * @returns SL and TP levels
   */
  calculateFromPercent(
    entryPrice: number,
    direction: SignalDirection,
    slPercent: number,
    takeProfitConfigs: TakeProfitConfig[],
  ): RiskCalculationResult {
    // Convert percentage to absolute distance
    const stopLossDistance = entryPrice * (slPercent / PERCENT_MULTIPLIER);

    const stopLoss =
      direction === SignalDirection.LONG
        ? entryPrice - stopLossDistance
        : entryPrice + stopLossDistance;

    const takeProfits = takeProfitConfigs.map(tp => ({
      level: tp.level,
      percent: tp.percent,
      sizePercent: tp.sizePercent,
      price:
        direction === SignalDirection.LONG
          ? entryPrice * (1 + tp.percent / PERCENT_MULTIPLIER)
          : entryPrice * (1 - tp.percent / PERCENT_MULTIPLIER),
      hit: false,
    }));

    return {
      stopLoss,
      takeProfits,
      stopLossDistance,
      stopLossPercent: slPercent,
    };
  }
}
