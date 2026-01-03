/**
 * Enhanced Exit Service
 *
 * Provides advanced TP/SL calculation with:
 * 1. R:R Gate - Validate risk/reward before entry
 * 2. Structure-Based TP - TP targets at next level
 * 3. Liquidity-Aware SL - SL beyond liquidity zones
 * 4. ATR-Based TP - TP scaled by volatility
 * 5. Session-Based TP - TP multipliers by trading session
 * 6. Dynamic Breakeven - Breakeven based on % or ATR, not TP level
 * 7. Time-Decay TP - Tighten TP over time
 * 8. Adaptive Trailing - Trailing based on % movement
 */

import {
  LoggerService,
  SignalDirection,
  TakeProfit,
  Candle,
  SwingPoint,
  SwingPointType,
  LiquidityZone,
} from '../types';
import { Level } from '../analyzers/level.analyzer';
import { SessionDetector, TradingSession } from '../utils/session-detector';
import { DECIMAL_PLACES, PERCENT_MULTIPLIER } from '../constants';

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

export interface RiskRewardGateConfig {
  enabled: boolean;
  minRR: number; // Minimum R:R to allow entry (default: 1.5)
  preferredRR: number; // Preferred R:R (default: 2.0)
  adaptiveRR?: {
    enabled: boolean;
    // Adjust minRR based on win rate
    // winRate 60%+ -> can reduce to 1.2
    // winRate 40%- -> increase to 2.0
  };
}

export interface StructureBasedTPConfig {
  enabled: boolean;
  mode: 'LEVEL' | 'FVG' | 'HYBRID'; // What to target
  offsetPercent: number; // Distance before target level (default: 0.1%)
  fallbackPercent: number; // Use if no level found (default: 2.0%)
  useNextLevelAsTP1: boolean; // TP1 = next level
  useSecondLevelAsTP2?: boolean; // TP2 = second level
}

export interface LiquidityAwareSLConfig {
  enabled: boolean;
  extendBeyondLiquidity: boolean; // Place SL beyond liquidity zones
  extensionPercent: number; // How far beyond (default: 0.2%)
  useSwingPoints: boolean; // Use swing points as SL reference
  swingLookback: number; // How many candles to look back (default: 20)
}

export interface ATRBasedTPConfig {
  enabled: boolean;
  tp1AtrMultiplier: number; // TP1 = ATR * multiplier (default: 1.5)
  tp2AtrMultiplier: number; // TP2 = ATR * multiplier (default: 3.0)
  tp3AtrMultiplier?: number; // TP3 = ATR * multiplier (optional)
  minTPPercent: number; // Minimum TP % (default: 0.5%)
  maxTPPercent: number; // Maximum TP % (default: 5.0%)
}

export interface SessionBasedTPConfig {
  enabled: boolean;
  asianMultiplier: number; // 00:00-08:00 UTC (default: 0.8 = tighter)
  londonMultiplier: number; // 08:00-16:00 UTC (default: 1.2 = wider)
  nyMultiplier: number; // 13:00-21:00 UTC (default: 1.2 = wider)
  overlapMultiplier: number; // 13:00-16:00 UTC (default: 1.4 = widest)
}

export interface DynamicBreakevenConfig {
  enabled: boolean;
  // Breakeven after X% movement (not after TP1)
  activationPercent: number; // Default: 1.0%
  // Or: after X ATR movement
  activationATR?: number; // Default: 1.5 ATR
  // Offset from entry (not exactly at 0)
  offsetPercent: number; // Default: 0.1% (small profit)
}

export interface TimeDecayTPConfig {
  enabled: boolean;
  decayStartMinutes: number; // Start decay after X minutes (default: 60)
  decayRatePerHour: number; // % reduction per hour (default: 0.2%)
  minTPPercent: number; // Minimum TP % after decay (default: 0.5%)
  // Alternative: switch to trailing after X time
  switchToTrailingAfter?: number; // Minutes (default: 120)
  trailingDistance?: number; // % trailing distance (default: 0.3%)
}

export interface AdaptiveTrailingConfig {
  enabled: boolean;
  // Trailing on % movement, not TP level
  activationPercent: number; // Activate after X% profit (default: 1.5%)
  // Or: on ATR movement
  activationATR?: number; // Activate after X ATR (default: 2.0)
  // Trailing distance (also dynamic)
  trailingDistancePercent: number; // Static distance (default: 0.5%)
  trailingDistanceATR?: number; // Dynamic: ATR * multiplier (default: 0.5)
  useATRDistance: boolean; // Use ATR-based distance
}

export interface EnhancedExitConfig {
  riskRewardGate: RiskRewardGateConfig;
  structureBasedTP: StructureBasedTPConfig;
  liquidityAwareSL: LiquidityAwareSLConfig;
  atrBasedTP: ATRBasedTPConfig;
  sessionBasedTP: SessionBasedTPConfig;
  dynamicBreakeven: DynamicBreakevenConfig;
  timeDecayTP: TimeDecayTPConfig;
  adaptiveTrailing: AdaptiveTrailingConfig;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface RiskRewardValidation {
  valid: boolean;
  riskRewardRatio: number;
  riskPercent: number;
  rewardPercent: number;
  recommendation: string;
}

export interface EnhancedTPSLResult {
  stopLoss: number;
  takeProfits: TakeProfit[];
  riskRewardRatio: number;
  slType: 'LIQUIDITY' | 'SWING' | 'ATR' | 'LEVEL';
  tpType: 'STRUCTURE' | 'ATR' | 'PERCENT' | 'HYBRID';
  details: {
    slReason: string;
    tp1Reason: string;
    tp2Reason?: string;
    breakevenPrice?: number;
    timeDecayActive?: boolean;
  };
}

export interface BreakevenCheck {
  shouldActivate: boolean;
  breakevenPrice: number;
  reason: string;
}

export interface TrailingCheck {
  shouldActivate: boolean;
  trailingDistance: number;
  reason: string;
}

export interface TimeDecayAdjustment {
  adjusted: boolean;
  newTPPercent: number;
  switchToTrailing: boolean;
  reason: string;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: EnhancedExitConfig = {
  riskRewardGate: {
    enabled: true,
    minRR: 1.5,
    preferredRR: 2.0,
  },
  structureBasedTP: {
    enabled: true,
    mode: 'LEVEL',
    offsetPercent: 0.1,
    fallbackPercent: 2.0,
    useNextLevelAsTP1: true,
  },
  liquidityAwareSL: {
    enabled: true,
    extendBeyondLiquidity: true,
    extensionPercent: 0.2,
    useSwingPoints: true,
    swingLookback: 20,
  },
  atrBasedTP: {
    enabled: true,
    tp1AtrMultiplier: 1.5,
    tp2AtrMultiplier: 3.0,
    minTPPercent: 0.5,
    maxTPPercent: 5.0,
  },
  sessionBasedTP: {
    enabled: true,
    asianMultiplier: 0.8,
    londonMultiplier: 1.2,
    nyMultiplier: 1.2,
    overlapMultiplier: 1.4,
  },
  dynamicBreakeven: {
    enabled: true,
    activationPercent: 1.0,
    offsetPercent: 0.1,
  },
  timeDecayTP: {
    enabled: false, // Off by default
    decayStartMinutes: 60,
    decayRatePerHour: 0.2,
    minTPPercent: 0.5,
  },
  adaptiveTrailing: {
    enabled: true,
    activationPercent: 1.5,
    trailingDistancePercent: 0.5,
    useATRDistance: true,
    trailingDistanceATR: 0.5,
  },
};

// ============================================================================
// ENHANCED EXIT SERVICE
// ============================================================================

export class EnhancedExitService {
  private config: EnhancedExitConfig;

  constructor(
    private logger: LoggerService,
    config?: Partial<EnhancedExitConfig>,
  ) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, config);
  }

  /**
   * Deep merge configuration
   */
  private mergeConfig(
    defaults: EnhancedExitConfig,
    overrides?: Partial<EnhancedExitConfig>,
  ): EnhancedExitConfig {
    if (!overrides) return defaults;

    return {
      riskRewardGate: { ...defaults.riskRewardGate, ...overrides.riskRewardGate },
      structureBasedTP: { ...defaults.structureBasedTP, ...overrides.structureBasedTP },
      liquidityAwareSL: { ...defaults.liquidityAwareSL, ...overrides.liquidityAwareSL },
      atrBasedTP: { ...defaults.atrBasedTP, ...overrides.atrBasedTP },
      sessionBasedTP: { ...defaults.sessionBasedTP, ...overrides.sessionBasedTP },
      dynamicBreakeven: { ...defaults.dynamicBreakeven, ...overrides.dynamicBreakeven },
      timeDecayTP: { ...defaults.timeDecayTP, ...overrides.timeDecayTP },
      adaptiveTrailing: { ...defaults.adaptiveTrailing, ...overrides.adaptiveTrailing },
    };
  }

  // ==========================================================================
  // 1. R:R GATE - Validate Risk/Reward Before Entry
  // ==========================================================================

  /**
   * Validate if the trade meets minimum Risk/Reward requirements
   */
  validateRiskReward(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
  ): RiskRewardValidation {
    const config = this.config.riskRewardGate;

    if (!config.enabled) {
      return {
        valid: true,
        riskRewardRatio: 0,
        riskPercent: 0,
        rewardPercent: 0,
        recommendation: 'R:R Gate disabled',
      };
    }

    const riskDistance = Math.abs(entryPrice - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entryPrice);

    const riskPercent = (riskDistance / entryPrice) * PERCENT_MULTIPLIER;
    const rewardPercent = (rewardDistance / entryPrice) * PERCENT_MULTIPLIER;

    const riskRewardRatio = rewardDistance / riskDistance;

    if (riskRewardRatio < config.minRR) {
      return {
        valid: false,
        riskRewardRatio,
        riskPercent,
        rewardPercent,
        recommendation: `R:R ${riskRewardRatio.toFixed(2)} < minimum ${config.minRR}. Skip trade.`,
      };
    }

    const recommendation =
      riskRewardRatio >= config.preferredRR
        ? `Excellent R:R ${riskRewardRatio.toFixed(2)} >= preferred ${config.preferredRR}`
        : `Acceptable R:R ${riskRewardRatio.toFixed(2)} >= minimum ${config.minRR}`;

    return {
      valid: true,
      riskRewardRatio,
      riskPercent,
      rewardPercent,
      recommendation,
    };
  }

  // ==========================================================================
  // 2. STRUCTURE-BASED TP - Target Next Level
  // ==========================================================================

  /**
   * Calculate TP based on next structural level
   */
  calculateStructureBasedTP(
    entryPrice: number,
    direction: SignalDirection,
    levels: { support: Level[]; resistance: Level[] },
    fallbackPercent?: number,
  ): TakeProfit[] {
    const config = this.config.structureBasedTP;

    if (!config.enabled) {
      return this.calculatePercentBasedTP(entryPrice, direction, fallbackPercent ?? config.fallbackPercent);
    }

    const takeProfits: TakeProfit[] = [];

    // Find next level(s) in the direction of the trade
    const targetLevels =
      direction === SignalDirection.LONG
        ? levels.resistance.filter(l => l.price > entryPrice).sort((a, b) => a.price - b.price)
        : levels.support.filter(l => l.price < entryPrice).sort((a, b) => b.price - a.price);

    // TP1: Next level with offset
    if (targetLevels.length > 0 && config.useNextLevelAsTP1) {
      const nextLevel = targetLevels[0];
      const offsetMultiplier =
        direction === SignalDirection.LONG
          ? 1 - config.offsetPercent / PERCENT_MULTIPLIER
          : 1 + config.offsetPercent / PERCENT_MULTIPLIER;

      const tp1Price = nextLevel.price * offsetMultiplier;
      const tp1Percent = Math.abs((tp1Price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;

      takeProfits.push({
        level: 1,
        price: tp1Price,
        percent: tp1Percent,
        sizePercent: targetLevels.length > 1 ? 60 : 100, // 60% if TP2 exists
        hit: false,
      });

      this.logger.debug('Structure-Based TP1', {
        nextLevel: nextLevel.price.toFixed(DECIMAL_PLACES.PRICE),
        tp1Price: tp1Price.toFixed(DECIMAL_PLACES.PRICE),
        tp1Percent: tp1Percent.toFixed(2) + '%',
        levelStrength: nextLevel.strength.toFixed(2),
      });

      // TP2: Second level (if exists and enabled)
      if (targetLevels.length > 1 && config.useSecondLevelAsTP2) {
        const secondLevel = targetLevels[1];
        const tp2Price =
          direction === SignalDirection.LONG
            ? secondLevel.price * (1 - config.offsetPercent / PERCENT_MULTIPLIER)
            : secondLevel.price * (1 + config.offsetPercent / PERCENT_MULTIPLIER);

        const tp2Percent = Math.abs((tp2Price - entryPrice) / entryPrice) * PERCENT_MULTIPLIER;

        takeProfits.push({
          level: 2,
          price: tp2Price,
          percent: tp2Percent,
          sizePercent: 40,
          hit: false,
        });
      }
    } else {
      // Fallback: use percentage-based TP
      this.logger.debug('No structural level found, using fallback %', {
        direction,
        fallbackPercent: config.fallbackPercent,
      });
      return this.calculatePercentBasedTP(entryPrice, direction, config.fallbackPercent);
    }

    return takeProfits;
  }

  /**
   * Calculate percentage-based TP (fallback)
   */
  private calculatePercentBasedTP(
    entryPrice: number,
    direction: SignalDirection,
    percent: number,
  ): TakeProfit[] {
    const tpPrice =
      direction === SignalDirection.LONG
        ? entryPrice * (1 + percent / PERCENT_MULTIPLIER)
        : entryPrice * (1 - percent / PERCENT_MULTIPLIER);

    return [
      {
        level: 1,
        price: tpPrice,
        percent,
        sizePercent: 100,
        hit: false,
      },
    ];
  }

  // ==========================================================================
  // 3. LIQUIDITY-AWARE SL - Place SL Beyond Liquidity Zones
  // ==========================================================================

  /**
   * Calculate SL that accounts for liquidity zones and swing points
   */
  calculateLiquidityAwareSL(
    entryPrice: number,
    direction: SignalDirection,
    referenceLevel: number,
    atrAbsolute: number,
    swingPoints: SwingPoint[],
    liquidityZones?: LiquidityZone[],
  ): { stopLoss: number; slType: 'LIQUIDITY' | 'SWING' | 'ATR' | 'LEVEL'; reason: string } {
    const config = this.config.liquidityAwareSL;

    if (!config.enabled) {
      // Standard ATR-based SL
      const stopLoss =
        direction === SignalDirection.LONG
          ? referenceLevel - atrAbsolute * 1.5
          : referenceLevel + atrAbsolute * 1.5;

      return { stopLoss, slType: 'ATR', reason: 'Standard ATR-based SL' };
    }

    let candidateSL = referenceLevel;
    let slType: 'LIQUIDITY' | 'SWING' | 'ATR' | 'LEVEL' = 'LEVEL';
    let reason = 'Based on reference level';

    // Check liquidity zones
    if (config.extendBeyondLiquidity && liquidityZones && liquidityZones.length > 0) {
      const relevantZones =
        direction === SignalDirection.LONG
          ? liquidityZones.filter(z => z.type === 'SUPPORT' && z.price < entryPrice)
          : liquidityZones.filter(z => z.type === 'RESISTANCE' && z.price > entryPrice);

      if (relevantZones.length > 0) {
        // Sort by proximity to entry
        const nearestZone = relevantZones.sort((a, b) =>
          direction === SignalDirection.LONG ? b.price - a.price : a.price - b.price,
        )[0];

        // Place SL beyond the liquidity zone
        const extension = entryPrice * (config.extensionPercent / PERCENT_MULTIPLIER);
        candidateSL =
          direction === SignalDirection.LONG
            ? nearestZone.price - extension
            : nearestZone.price + extension;

        slType = 'LIQUIDITY';
        reason = `Beyond liquidity zone at ${nearestZone.price.toFixed(DECIMAL_PLACES.PRICE)}`;
      }
    }

    // Check swing points
    if (config.useSwingPoints) {
      const recentSwings = swingPoints.slice(-config.swingLookback);
      const relevantSwings =
        direction === SignalDirection.LONG
          ? recentSwings
              .filter(s => s.type === SwingPointType.LOW && s.price < entryPrice)
              .sort((a, b) => b.price - a.price)
          : recentSwings
              .filter(s => s.type === SwingPointType.HIGH && s.price > entryPrice)
              .sort((a, b) => a.price - b.price);

      if (relevantSwings.length > 0) {
        const swingSL = relevantSwings[0].price;
        const extension = entryPrice * (config.extensionPercent / PERCENT_MULTIPLIER);

        const swingBasedSL =
          direction === SignalDirection.LONG ? swingSL - extension : swingSL + extension;

        // Use the further SL (more protection)
        if (direction === SignalDirection.LONG && swingBasedSL < candidateSL) {
          candidateSL = swingBasedSL;
          slType = 'SWING';
          reason = `Beyond swing low at ${swingSL.toFixed(DECIMAL_PLACES.PRICE)}`;
        } else if (direction === SignalDirection.SHORT && swingBasedSL > candidateSL) {
          candidateSL = swingBasedSL;
          slType = 'SWING';
          reason = `Beyond swing high at ${swingSL.toFixed(DECIMAL_PLACES.PRICE)}`;
        }
      }
    }

    // Ensure minimum SL distance (1% of entry)
    const minSLDistance = entryPrice * 0.01;
    const currentDistance = Math.abs(entryPrice - candidateSL);

    if (currentDistance < minSLDistance) {
      candidateSL =
        direction === SignalDirection.LONG
          ? entryPrice - minSLDistance
          : entryPrice + minSLDistance;
      slType = 'ATR';
      reason = 'Enforced minimum 1% SL distance';
    }

    this.logger.debug('Liquidity-Aware SL', {
      entryPrice: entryPrice.toFixed(DECIMAL_PLACES.PRICE),
      stopLoss: candidateSL.toFixed(DECIMAL_PLACES.PRICE),
      slType,
      reason,
      distancePercent: ((Math.abs(entryPrice - candidateSL) / entryPrice) * PERCENT_MULTIPLIER).toFixed(2) + '%',
    });

    return { stopLoss: candidateSL, slType, reason };
  }

  // ==========================================================================
  // 4. ATR-BASED TP - Scale TP by Volatility
  // ==========================================================================

  /**
   * Calculate TP levels based on ATR
   */
  calculateATRBasedTP(
    entryPrice: number,
    direction: SignalDirection,
    atrPercent: number,
  ): TakeProfit[] {
    const config = this.config.atrBasedTP;

    if (!config.enabled) {
      return [];
    }

    const takeProfits: TakeProfit[] = [];

    // Clamp function
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    // TP1
    const tp1Percent = clamp(
      atrPercent * config.tp1AtrMultiplier,
      config.minTPPercent,
      config.maxTPPercent,
    );
    const tp1Price =
      direction === SignalDirection.LONG
        ? entryPrice * (1 + tp1Percent / PERCENT_MULTIPLIER)
        : entryPrice * (1 - tp1Percent / PERCENT_MULTIPLIER);

    takeProfits.push({
      level: 1,
      price: tp1Price,
      percent: tp1Percent,
      sizePercent: config.tp3AtrMultiplier ? 40 : 60,
      hit: false,
    });

    // TP2
    const tp2Percent = clamp(
      atrPercent * config.tp2AtrMultiplier,
      config.minTPPercent,
      config.maxTPPercent,
    );
    const tp2Price =
      direction === SignalDirection.LONG
        ? entryPrice * (1 + tp2Percent / PERCENT_MULTIPLIER)
        : entryPrice * (1 - tp2Percent / PERCENT_MULTIPLIER);

    takeProfits.push({
      level: 2,
      price: tp2Price,
      percent: tp2Percent,
      sizePercent: config.tp3AtrMultiplier ? 30 : 40,
      hit: false,
    });

    // TP3 (optional)
    if (config.tp3AtrMultiplier) {
      const tp3Percent = clamp(
        atrPercent * config.tp3AtrMultiplier,
        config.minTPPercent,
        config.maxTPPercent,
      );
      const tp3Price =
        direction === SignalDirection.LONG
          ? entryPrice * (1 + tp3Percent / PERCENT_MULTIPLIER)
          : entryPrice * (1 - tp3Percent / PERCENT_MULTIPLIER);

      takeProfits.push({
        level: 3,
        price: tp3Price,
        percent: tp3Percent,
        sizePercent: 30,
        hit: false,
      });
    }

    this.logger.debug('ATR-Based TP', {
      atrPercent: atrPercent.toFixed(2) + '%',
      tp1: tp1Percent.toFixed(2) + '%',
      tp2: tp2Percent.toFixed(2) + '%',
      tp3: config.tp3AtrMultiplier
        ? (atrPercent * config.tp3AtrMultiplier).toFixed(2) + '%'
        : 'N/A',
    });

    return takeProfits;
  }

  // ==========================================================================
  // 5. SESSION-BASED TP - Adjust TP by Trading Session
  // ==========================================================================

  /**
   * Apply session multiplier to TP levels
   */
  applySessionMultiplier(takeProfits: TakeProfit[], entryPrice: number): TakeProfit[] {
    const config = this.config.sessionBasedTP;

    if (!config.enabled) {
      return takeProfits;
    }

    const session = SessionDetector.getCurrentSession();
    let multiplier = 1.0;

    switch (session) {
      case TradingSession.ASIAN:
        multiplier = config.asianMultiplier;
        break;
      case TradingSession.LONDON:
        multiplier = config.londonMultiplier;
        break;
      case TradingSession.NY:
        multiplier = config.nyMultiplier;
        break;
      case TradingSession.OVERLAP:
        multiplier = config.overlapMultiplier;
        break;
    }

    this.logger.debug('Session-Based TP Multiplier', {
      session,
      multiplier,
    });

    return takeProfits.map(tp => {
      const adjustedPercent = tp.percent * multiplier;
      const isLong = tp.price > entryPrice;
      const adjustedPrice = isLong
        ? entryPrice * (1 + adjustedPercent / PERCENT_MULTIPLIER)
        : entryPrice * (1 - adjustedPercent / PERCENT_MULTIPLIER);

      return {
        ...tp,
        percent: adjustedPercent,
        price: adjustedPrice,
      };
    });
  }

  // ==========================================================================
  // 6. DYNAMIC BREAKEVEN - Based on % Movement, Not TP Level
  // ==========================================================================

  /**
   * Check if breakeven should be activated
   */
  checkBreakeven(
    entryPrice: number,
    currentPrice: number,
    direction: SignalDirection,
    atrPercent?: number,
  ): BreakevenCheck {
    const config = this.config.dynamicBreakeven;

    if (!config.enabled) {
      return { shouldActivate: false, breakevenPrice: entryPrice, reason: 'Breakeven disabled' };
    }

    const isLong = direction === SignalDirection.LONG;
    const profitPercent = isLong
      ? ((currentPrice - entryPrice) / entryPrice) * PERCENT_MULTIPLIER
      : ((entryPrice - currentPrice) / entryPrice) * PERCENT_MULTIPLIER;

    // Check % activation
    let shouldActivate = profitPercent >= config.activationPercent;
    let reason = '';

    if (shouldActivate) {
      reason = `Profit ${profitPercent.toFixed(2)}% >= activation ${config.activationPercent}%`;
    }

    // Check ATR activation (if configured)
    if (!shouldActivate && config.activationATR && atrPercent) {
      const profitInATR = profitPercent / atrPercent;
      shouldActivate = profitInATR >= config.activationATR;
      if (shouldActivate) {
        reason = `Profit ${profitInATR.toFixed(2)} ATR >= activation ${config.activationATR} ATR`;
      }
    }

    // Calculate breakeven price with offset
    const breakevenPrice = isLong
      ? entryPrice * (1 + config.offsetPercent / PERCENT_MULTIPLIER)
      : entryPrice * (1 - config.offsetPercent / PERCENT_MULTIPLIER);

    if (!shouldActivate) {
      reason = `Profit ${profitPercent.toFixed(2)}% < activation ${config.activationPercent}%`;
    }

    return { shouldActivate, breakevenPrice, reason };
  }

  // ==========================================================================
  // 7. TIME-DECAY TP - Tighten TP Over Time
  // ==========================================================================

  /**
   * Calculate time-decay adjustment for TP
   */
  calculateTimeDecay(
    originalTPPercent: number,
    entryTime: number,
    currentTime: number,
  ): TimeDecayAdjustment {
    const config = this.config.timeDecayTP;

    if (!config.enabled) {
      return {
        adjusted: false,
        newTPPercent: originalTPPercent,
        switchToTrailing: false,
        reason: 'Time decay disabled',
      };
    }

    const minutesElapsed = (currentTime - entryTime) / 60000;

    // Check if should switch to trailing
    if (config.switchToTrailingAfter && minutesElapsed >= config.switchToTrailingAfter) {
      return {
        adjusted: true,
        newTPPercent: originalTPPercent,
        switchToTrailing: true,
        reason: `${minutesElapsed.toFixed(0)}m elapsed >= ${config.switchToTrailingAfter}m, switching to trailing`,
      };
    }

    // Check if decay should start
    if (minutesElapsed < config.decayStartMinutes) {
      return {
        adjusted: false,
        newTPPercent: originalTPPercent,
        switchToTrailing: false,
        reason: `${minutesElapsed.toFixed(0)}m < decay start ${config.decayStartMinutes}m`,
      };
    }

    // Calculate decay
    const hoursInDecay = (minutesElapsed - config.decayStartMinutes) / 60;
    const totalDecay = hoursInDecay * config.decayRatePerHour;
    const newTPPercent = Math.max(originalTPPercent - totalDecay, config.minTPPercent);

    return {
      adjusted: true,
      newTPPercent,
      switchToTrailing: false,
      reason: `Decay: ${totalDecay.toFixed(2)}% after ${hoursInDecay.toFixed(1)}h, TP: ${originalTPPercent.toFixed(2)}% -> ${newTPPercent.toFixed(2)}%`,
    };
  }

  // ==========================================================================
  // 8. ADAPTIVE TRAILING - Based on % Movement
  // ==========================================================================

  /**
   * Check if trailing stop should be activated
   */
  checkAdaptiveTrailing(
    entryPrice: number,
    currentPrice: number,
    direction: SignalDirection,
    atrPercent?: number,
  ): TrailingCheck {
    const config = this.config.adaptiveTrailing;

    if (!config.enabled) {
      return {
        shouldActivate: false,
        trailingDistance: 0,
        reason: 'Adaptive trailing disabled',
      };
    }

    const isLong = direction === SignalDirection.LONG;
    const profitPercent = isLong
      ? ((currentPrice - entryPrice) / entryPrice) * PERCENT_MULTIPLIER
      : ((entryPrice - currentPrice) / entryPrice) * PERCENT_MULTIPLIER;

    // Check % activation
    let shouldActivate = profitPercent >= config.activationPercent;
    let reason = '';

    if (shouldActivate) {
      reason = `Profit ${profitPercent.toFixed(2)}% >= activation ${config.activationPercent}%`;
    }

    // Check ATR activation (if configured)
    if (!shouldActivate && config.activationATR && atrPercent) {
      const profitInATR = profitPercent / atrPercent;
      shouldActivate = profitInATR >= config.activationATR;
      if (shouldActivate) {
        reason = `Profit ${profitInATR.toFixed(2)} ATR >= activation ${config.activationATR} ATR`;
      }
    }

    // Calculate trailing distance
    let trailingDistance = config.trailingDistancePercent;

    if (config.useATRDistance && config.trailingDistanceATR && atrPercent) {
      trailingDistance = atrPercent * config.trailingDistanceATR;
    }

    if (!shouldActivate) {
      reason = `Profit ${profitPercent.toFixed(2)}% < activation ${config.activationPercent}%`;
    }

    return { shouldActivate, trailingDistance, reason };
  }

  // ==========================================================================
  // COMBINED: Calculate Enhanced TP/SL
  // ==========================================================================

  /**
   * Calculate complete enhanced TP/SL with all features
   */
  calculateEnhancedTPSL(
    entryPrice: number,
    direction: SignalDirection,
    referenceLevel: number,
    atrPercent: number,
    levels: { support: Level[]; resistance: Level[] },
    swingPoints: SwingPoint[],
    liquidityZones?: LiquidityZone[],
  ): EnhancedTPSLResult {
    // 1. Calculate Liquidity-Aware SL
    const atrAbsolute = entryPrice * (atrPercent / PERCENT_MULTIPLIER);
    const slResult = this.calculateLiquidityAwareSL(
      entryPrice,
      direction,
      referenceLevel,
      atrAbsolute,
      swingPoints,
      liquidityZones,
    );

    // 2. Calculate Structure-Based TP (primary)
    let takeProfits = this.calculateStructureBasedTP(entryPrice, direction, levels);
    let tpType: 'STRUCTURE' | 'ATR' | 'PERCENT' | 'HYBRID' = 'STRUCTURE';

    // 3. If no structure found, use ATR-based TP
    if (takeProfits.length === 0 || !this.config.structureBasedTP.enabled) {
      takeProfits = this.calculateATRBasedTP(entryPrice, direction, atrPercent);
      tpType = 'ATR';
    }

    // 4. If still no TP, use fallback percent
    if (takeProfits.length === 0) {
      takeProfits = this.calculatePercentBasedTP(
        entryPrice,
        direction,
        this.config.structureBasedTP.fallbackPercent,
      );
      tpType = 'PERCENT';
    }

    // 5. Apply session multiplier
    takeProfits = this.applySessionMultiplier(takeProfits, entryPrice);

    // 6. Calculate R:R
    const tp1 = takeProfits[0];
    const riskRewardRatio = tp1
      ? Math.abs(tp1.price - entryPrice) / Math.abs(entryPrice - slResult.stopLoss)
      : 0;

    // 7. Calculate breakeven price
    const breakevenCheck = this.checkBreakeven(entryPrice, entryPrice, direction, atrPercent);

    return {
      stopLoss: slResult.stopLoss,
      takeProfits,
      riskRewardRatio,
      slType: slResult.slType,
      tpType,
      details: {
        slReason: slResult.reason,
        tp1Reason: tp1 ? `${tpType}: ${tp1.percent.toFixed(2)}%` : 'No TP',
        tp2Reason: takeProfits[1] ? `${tpType}: ${takeProfits[1].percent.toFixed(2)}%` : undefined,
        breakevenPrice: breakevenCheck.breakevenPrice,
      },
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): EnhancedExitConfig {
    return this.config;
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(updates: Partial<EnhancedExitConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
    this.logger.info('EnhancedExitService config updated', {
      riskRewardGateEnabled: this.config.riskRewardGate.enabled,
      structureBasedTPEnabled: this.config.structureBasedTP.enabled,
      liquidityAwareSLEnabled: this.config.liquidityAwareSL.enabled,
    });
  }
}
