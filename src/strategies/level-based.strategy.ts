import { CONFIDENCE_THRESHOLDS, DECIMAL_PLACES, MULTIPLIERS, PERCENT_MULTIPLIER } from '../constants';
import { INTEGER_MULTIPLIERS, MULTIPLIER_VALUES } from '../constants/technical.constants';
/**
 * Level-Based Strategy (Priority 2)
 *
 * Entry conditions:
 * 1. Price near support/resistance level (swing points from ZigZag)
 * 2. Distance to level < 1.5%
 * 3. Level has minimum touches (default: 2+ touches required)
 * 4. Level strength based on touches (more touches = stronger level)
 * 5. Trend alignment (prefer LONG near support in uptrend, SHORT near resistance in downtrend)
 *
 * Confidence calculation:
 * - Base confidence: 0.70
 * - Level strength boost: 0 to +40% (based on touches)
 * - Trend alignment boost: +15%
 * - Distance penalty: closer = higher confidence
 */

import {
  IStrategy,
  StrategyMarketData,
  StrategySignal,
  Signal,
  SignalDirection,
  SignalType,
  LoggerService,
  Candle,
  TakeProfit,
  SessionBasedSLConfig,
  WeightMatrixInput,
  SignalScoreBreakdown,
  ZigZagNRIndicator,
  WeightMatrixCalculatorService,
  FootprintIndicator,
  OrderBlockDetector,
  FairValueGapDetector,
  VolumeCalculator,
  PatternAnalyzerHelper,
  PatternAnalyzerConfig,
  LevelAnalyzer,
  Level,
  VolatilityRegimeService,
  VolatilityRegimeParams,
  VolatilityRegime,
  VolumeProfileIntegrationConfig,
  OrderBookAnalyzer,
  OrderBookAnalysis,
  OrderbookLevel,
  SweepDetectorConfig,
  SweepAnalysis,
  EnhancedExitService,
  EnhancedExitConfig,
  MTFTPValidatorService,
  MTFTPConfig,
  MTFTPValidationResult,
  WhaleWallTPService,
  WhaleWallTPConfig,
} from '../types';
import { SweepDetector } from '../analyzers/sweep.detector';
import { ConfidenceHelper } from '../utils/confidence.helper';
import { SessionDetector } from '../utils/session-detector';

// ============================================================================
// CONSTANTS (Strategy Metadata Only)
// ============================================================================

const STRATEGY_NAME = 'LevelBased';
const STRATEGY_PRIORITY = 2; // Second priority (after TrendFollowing)

// All other constants are now configured in LevelBasedConfig
// They are read from config.json and applied during strategy execution

// ============================================================================
// TYPES
// ============================================================================

export interface LevelBasedConfig {
  enabled: boolean;
  maxDistancePercent: number;
  minDistanceFloorPercent?: number; // Minimum distance floor regardless of ATR (default: 0.3%)
  minTouchesRequired: number;
  minTouchesRequiredShort?: number;
  minTouchesRequiredLong?: number;
  minTouchesForStrong: number;
  minStrengthForNeutral?: number; // Minimum level strength for NEUTRAL trend entries (0-1, default: 0.4)
  requireTrendAlignment: boolean;
  blockLongInDowntrend?: boolean;
  blockShortInUptrend?: boolean;
  stopLossAtrMultiplier: number;
  stopLossAtrMultiplierLong?: number;
  minConfidenceThreshold?: number; // Minimum confidence to generate signal (0.0-1.0)
  takeProfits?: Array<{ level: number; percent: number; sizePercent: number }>;
  rrRatio?: number;
  zigzagDepth?: number;
  sessionBasedSL?: SessionBasedSLConfig;
  patterns?: PatternAnalyzerConfig;
  rsiFilters?: {
    enabled: boolean;
    longMinThreshold: number;    // Min RSI for LONG (e.g., 45)
    longMaxThreshold: number;    // Max RSI for LONG (e.g., 70)
    shortMinThreshold: number;   // Min RSI for SHORT (e.g., 30)
    shortMaxThreshold: number;   // Max RSI for SHORT (e.g., 55)
    bypassOnStrongTrend?: boolean; // Bypass RSI filters when EMA gap is large
    strongTrendEmaGapPercent?: number; // EMA gap % to consider trend strong (default: 1.5)
  };
  emaFilters?: {
    enabled: boolean;
    downtrend: {
      rsiThreshold: number;      // RSI threshold for downtrend detection (e.g., 55)
      emaDiffThreshold: number;  // EMA difference threshold % (e.g., 0.5)
    };
  };
  distanceModifier?: {
    veryClosePercent: number;    // Distance threshold for very close levels (e.g., 0.5%)
    veryClosePenalty: number;    // Confidence boost for very close (e.g., 1.1)
    farPercent: number;          // Distance threshold for far levels (e.g., 1.2%)
    farPenalty: number;          // Confidence penalty for far (e.g., 0.9)
  };
  dynamicDistance?: {
    enabled: boolean;            // Enable ATR-based dynamic distance floor
    atrMultiplier: number;       // Multiply ATR by this for min distance (default: 0.2)
    absoluteMinPercent: number;  // Absolute minimum floor (default: 0.15%)
  };
  trendExistenceFilter?: {
    enabled: boolean;
    minEmaGapPercent: number;    // Minimum EMA gap to consider trend exists (default: 0.5)
    bypassOnStrongLevel: boolean; // Allow entry if level strength > threshold
    strongLevelThreshold: number; // Level strength threshold to bypass (default: 0.7)
  };
  levelClustering?: {
    clusterThresholdPercent: number;  // Group levels within this % (e.g., 0.3%)
    minTouchesForStrong: number;      // Min touches for strong level (e.g., 5)
    strengthBoost: number;            // Max strength boost (e.g., 0.4)
    baseConfidence: number;           // Base confidence for signals (e.g., 0.7)
    trendAlignmentBoost: number;      // Bonus for trend alignment (e.g., 0.15)
    trendFilters?: {                  // Trend-based filtering
      minTrendGapPercent: number;     // Min EMA gap % for trend detection (e.g., 0.5)
      downtrend: {
        enabled: boolean;
        rsiThreshold: number;         // RSI threshold for downtrend (e.g., 55)
      };
      uptrend: {
        enabled: boolean;
        rsiThreshold: number;         // RSI threshold for uptrend (e.g., 45)
      };
    };
  };
  entryConfirmation?: {
    enabled?: boolean;                // Require candle pattern confirmation (default: true)
    longBodyRatioMin?: number;        // Min body/candle ratio for LONG (e.g., 0.3 = 30%)
    longWickRatioMax?: number;        // Max upper wick/candle ratio for LONG (e.g., 0.4 = 40%)
    shortBodyRatioMin?: number;       // Min body/candle ratio for SHORT (e.g., 0.3 = 30%)
    shortWickRatioMax?: number;       // Max lower wick/candle ratio for SHORT (e.g., 0.4 = 40%)
    hammerWickRatio?: number;         // Min lower wick ratio for hammer detection (default: 0.6)
    shootingStarWickRatio?: number;   // Min upper wick ratio for shooting star detection (default: 0.6)
  };
  smartMoneyConcepts?: {
    footprint?: {
      enabled: boolean;
      tickLevels: number;
      minImbalanceRatio: number;
      minVolumeForImbalance: number;
      aggressionBoostMultiplier: number;
      aggressionPenaltyMultiplier: number;
    };
    orderBlocks?: {
      enabled: boolean;
      minBreakoutPercent: number;
      minVolumeRatio: number;
      maxBlockAge: number;
      maxDistancePercent: number;
      confidenceBoost: number;
      retestBoostMultiplier: number;
    };
    fairValueGaps?: {
      enabled: boolean;
      minGapPercent: number;
      maxGapAge: number;
      fillThreshold: number;
      maxDistancePercent: number;
      fillExpectationBoost: number;
    };
  };
  volumeProfileIntegration?: VolumeProfileIntegrationConfig;
  multiTimeframeConfirmation?: {
    enabled: boolean;               // Enable MTF level confirmation
    htfLevelConfirmation: {
      enabled: boolean;             // Check if level aligns with HTF (15m) level
      alignmentThresholdPercent: number; // Max distance to consider aligned (default: 0.3%)
      confidenceBoostPercent: number;    // Confidence boost if HTF-confirmed (default: 15)
    };
    trend2LevelConfirmation?: {
      enabled: boolean;             // Check if level aligns with TREND2 (30m) level
      alignmentThresholdPercent: number; // Max distance to consider aligned (default: 0.4%)
      confidenceBoostPercent: number;    // Confidence boost if TREND2-confirmed (default: 10)
    };
    contextTrendFilter: {
      enabled: boolean;             // Block entry if 1h trend opposite
      minEmaGapPercent: number;     // Min EMA gap to consider trend exists (default: 0.5%)
    };
  };
  sweepDetection?: SweepDetectorConfig;  // Liquidity sweep detection
  enhancedExit?: EnhancedExitConfig;  // Enhanced TP/SL with R:R gate, structure-based TP, etc.
  mtfTPValidation?: MTFTPConfig;  // MTF TP Validation - check TP against HTF levels
  whaleWallTP?: WhaleWallTPConfig;  // Whale Wall TP - use orderbook walls for TP/SL optimization
}

// Level interface is imported from LevelAnalyzer via types.ts

/**
 * Filter pipeline result - unified structure for all trend/entry filters
 */
interface FilterPipelineResult {
  passed: boolean;
  blockedBy: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  filtersChecked: string[];
}

// ============================================================================
// LEVEL-BASED STRATEGY
// ============================================================================

export class LevelBasedStrategy implements IStrategy {
  readonly name = STRATEGY_NAME;
  readonly priority = STRATEGY_PRIORITY;

  private zigzagNR: ZigZagNRIndicator;
  private levelAnalyzer: LevelAnalyzer;
  private volumeCalculator: VolumeCalculator;
  private patternAnalyzer: PatternAnalyzerHelper | null = null;
  private weightMatrix: WeightMatrixCalculatorService | null = null;
  private footprintIndicator: FootprintIndicator | null = null;
  private orderBlockDetector: OrderBlockDetector | null = null;
  private fairValueGapDetector: FairValueGapDetector | null = null;
  private volatilityRegimeService: VolatilityRegimeService | null = null;
  private currentRegimeParams: VolatilityRegimeParams | null = null;
  private orderbookAnalyzer: OrderBookAnalyzer | null = null;
  private sweepDetector: SweepDetector | null = null;
  private enhancedExitService: EnhancedExitService | null = null;
  private mtfTPValidator: MTFTPValidatorService | null = null;
  private whaleWallTPService: WhaleWallTPService | null = null;

  constructor(
    private config: LevelBasedConfig,
    private logger: LoggerService,
    weightMatrix?: WeightMatrixCalculatorService,
    volatilityRegimeService?: VolatilityRegimeService,
    orderbookAnalyzer?: OrderBookAnalyzer,
  ) {
    this.zigzagNR = new ZigZagNRIndicator(config.zigzagDepth ?? (INTEGER_MULTIPLIERS.TWO as number));

    // Initialize LevelAnalyzer with clustering, volume profile, and new level management config
    const vpIntegration = config.volumeProfileIntegration;
    const levelClustering = config.levelClustering as any;
    this.levelAnalyzer = new LevelAnalyzer(logger, {
      clusterThresholdPercent: levelClustering?.clusterThresholdPercent ?? 0.3,
      minTouchesRequired: config.minTouchesRequired ?? 3,
      minTouchesForStrong: levelClustering?.minTouchesForStrong ?? 5,
      maxDistancePercent: config.maxDistancePercent ?? 1.0,
      // Level age expiration (default: 150 candles for 1m = 2.5 hours)
      maxLevelAgeCandles: levelClustering?.maxLevelAgeCandles ?? 150,
      candleIntervalMinutes: levelClustering?.candleIntervalMinutes ?? 1,
      // Asymmetric distance multiplier for trend-aligned entries (default: 1.5x)
      trendAlignedDistanceMultiplier: levelClustering?.trendAlignedDistanceMultiplier ?? 1.5,
      // Dynamic clustering based on ATR
      dynamicClusterThreshold: {
        enabled: true,
        atrMultiplier: 0.3,
      },
      // Level Exhaustion - weaken levels after breakouts
      levelExhaustion: levelClustering?.levelExhaustion ? {
        enabled: levelClustering.levelExhaustion.enabled ?? true,
        penaltyPerBreakout: levelClustering.levelExhaustion.penaltyPerBreakout ?? 0.15,
        maxPenalty: levelClustering.levelExhaustion.maxPenalty ?? 0.6,
        breakoutThresholdPercent: levelClustering.levelExhaustion.breakoutThresholdPercent ?? 0.1,
        lookbackCandles: levelClustering.levelExhaustion.lookbackCandles ?? 50,
      } : undefined,
      volumeProfile: vpIntegration ? {
        enabled: vpIntegration.enabled ?? false,
        addVahValLevels: vpIntegration.addVahValLevels ?? true,
        boostHvnMatch: vpIntegration.boostHvnMatch ?? true,
        hvnMatchThresholdPercent: vpIntegration.hvnMatchThresholdPercent ?? 0.3,
        hvnStrengthBoost: vpIntegration.hvnStrengthBoost ?? 0.2,
        vahValStrength: vpIntegration.vahValStrength ?? 0.7,
      } : undefined,
      // Orderbook validation - boost levels confirmed by orderbook walls
      orderbookValidation: levelClustering?.orderbookValidation ? {
        enabled: levelClustering.orderbookValidation.enabled ?? false,
        minWallPercent: levelClustering.orderbookValidation.minWallPercent ?? 5,
        strengthBoost: levelClustering.orderbookValidation.strengthBoost ?? 0.15,
        maxDistancePercent: levelClustering.orderbookValidation.maxDistancePercent ?? 0.3,
        requireConfirmation: levelClustering.orderbookValidation.requireConfirmation ?? false,
      } : undefined,
    });

    this.volumeCalculator = new VolumeCalculator(logger);

    // Store orderbook analyzer if provided
    if (orderbookAnalyzer) {
      this.orderbookAnalyzer = orderbookAnalyzer;
      this.logger.info(`${STRATEGY_NAME} Strategy: Orderbook validation enabled`);
    }

    // Initialize sweep detector if enabled (config is in levelClustering section)
    const sweepConfig = (config.levelClustering as any)?.sweepDetection;
    if (sweepConfig?.enabled) {
      this.sweepDetector = new SweepDetector(logger, sweepConfig);
      this.logger.info(`${STRATEGY_NAME} Strategy: Sweep detection enabled`);
    }

    // Initialize pattern analyzer if any patterns are configured
    if (config.patterns) {
      this.patternAnalyzer = new PatternAnalyzerHelper(config.patterns, logger, STRATEGY_NAME);
    }

    // Initialize weight matrix if provided
    if (weightMatrix) {
      this.weightMatrix = weightMatrix;
      this.logger.info(`${STRATEGY_NAME} Strategy: Weight Matrix enabled`);
    }

    // Initialize Smart Money Concepts components
    const smc = config.smartMoneyConcepts;
    if (smc?.footprint?.enabled) {
      this.footprintIndicator = new FootprintIndicator(smc.footprint, logger);
      this.logger.info(`${STRATEGY_NAME} Strategy: Footprint Indicator enabled`);
    }
    if (smc?.orderBlocks?.enabled) {
      this.orderBlockDetector = new OrderBlockDetector(smc.orderBlocks, logger);
      this.logger.info(`${STRATEGY_NAME} Strategy: Order Block Detector enabled`);
    }
    if (smc?.fairValueGaps?.enabled) {
      this.fairValueGapDetector = new FairValueGapDetector(smc.fairValueGaps, logger);
      this.logger.info(`${STRATEGY_NAME} Strategy: Fair Value Gap Detector enabled`);
    }

    // Initialize Volatility Regime Service if provided
    if (volatilityRegimeService) {
      this.volatilityRegimeService = volatilityRegimeService;
      this.logger.info(`${STRATEGY_NAME} Strategy: Volatility Regime Service enabled`);
    }

    // Initialize Enhanced Exit Service for advanced TP/SL calculation
    if (config.enhancedExit) {
      this.enhancedExitService = new EnhancedExitService(logger, config.enhancedExit);
      this.logger.info(`${STRATEGY_NAME} Strategy: Enhanced Exit Service enabled`, {
        rrGate: config.enhancedExit.riskRewardGate?.enabled ?? true,
        structureTP: config.enhancedExit.structureBasedTP?.enabled ?? true,
        liquiditySL: config.enhancedExit.liquidityAwareSL?.enabled ?? true,
      });
    }

    // Initialize MTF TP Validator for HTF-based TP validation
    if (config.mtfTPValidation?.enabled) {
      this.mtfTPValidator = new MTFTPValidatorService(logger, this.levelAnalyzer, config.mtfTPValidation);
      this.logger.info(`${STRATEGY_NAME} Strategy: MTF TP Validation enabled`, {
        htfValidation: config.mtfTPValidation.htfTPValidation?.enabled ?? true,
        trend2Validation: config.mtfTPValidation.trend2TPValidation?.enabled ?? true,
        contextAdjustment: config.mtfTPValidation.contextTPAdjustment?.enabled ?? true,
      });
    }

    // Initialize Whale Wall TP Service for orderbook-based TP/SL optimization
    if (config.whaleWallTP?.enabled) {
      this.whaleWallTPService = new WhaleWallTPService(logger, config.whaleWallTP);
      this.logger.info(`${STRATEGY_NAME} Strategy: Whale Wall TP enabled`, {
        tpTargeting: config.whaleWallTP.tpTargeting?.enabled ?? true,
        slProtection: config.whaleWallTP.slProtection?.enabled ?? true,
        minWallPercent: config.whaleWallTP.minWallPercent ?? 5,
      });
    }
  }

  /**
   * Evaluate market data for level-based entry
   */
  async evaluate(data: StrategyMarketData): Promise<StrategySignal> {
    this.logger.info(`🔍 ${this.name} Strategy Evaluation`, {
      price: data.currentPrice,
      trend: data.trend,
      candles: data.candles.length,
    });

    // ========================================================================
    // STEP 0: Detect Volatility Regime (auto-adjust params)
    // ========================================================================
    const atrPercent = data.atr || 0.1;
    this.updateVolatilityRegime(atrPercent);

    // ========================================================================
    // STEP 1: Extract swing points (levels)
    // ========================================================================
    const { swingHighs, swingLows } = this.zigzagNR.findSwingPoints(data.candles);

    this.logger.info(`📊 ${this.name} Swing Points`, {
      highs: swingHighs.length,
      lows: swingLows.length,
      candles: data.candles.length,
    });

    // Need at least 2 swing points to create meaningful levels
    const MIN_SWING_POINTS = INTEGER_MULTIPLIERS.TWO as number;
    if (swingHighs.length < MIN_SWING_POINTS || swingLows.length < MIN_SWING_POINTS) {
      this.logger.info(`❌ ${this.name} BLOCKED`, {
        blockedBy: ['NOT_ENOUGH_SWING_POINTS'],
        highs: swingHighs.length,
        lows: swingLows.length,
        requireBoth: `${MIN_SWING_POINTS}+ each`,
      });
      return this.noSignal('Not enough swing points for level detection');
    }

    // ========================================================================
    // STEP 2: Build levels from swing points (using LevelAnalyzer)
    // ========================================================================
    const allSwingPoints = [...swingHighs, ...swingLows];

    // Detect trend context for level building and asymmetric distance
    const trendContext: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL' =
      data.ema.fast > data.ema.slow ? 'UPTREND' :
      data.ema.fast < data.ema.slow ? 'DOWNTREND' : 'NEUTRAL';

    // Analyze orderbook for level validation (if available and analyzer provided)
    let orderbookAnalysis: OrderBookAnalysis | null = null;
    if (this.orderbookAnalyzer && data.orderbook) {
      // Convert OrderBook to OrderBookData format (handle both tuple and object formats)
      const getPrice = (level: OrderbookLevel): number => {
        return typeof level === 'object' && 'price' in level ? level.price : level[0];
      };
      const getSize = (level: OrderbookLevel): number => {
        return typeof level === 'object' && 'size' in level ? level.size : level[1];
      };

      const orderbookData = {
        bids: data.orderbook.bids.map((b: OrderbookLevel) => ({
          price: getPrice(b),
          size: getSize(b),
        })),
        asks: data.orderbook.asks.map((a: OrderbookLevel) => ({
          price: getPrice(a),
          size: getSize(a),
        })),
        timestamp: data.orderbook.timestamp,
      };

      orderbookAnalysis = this.orderbookAnalyzer.analyze(orderbookData, data.currentPrice);
    }

    // Pass atrPercent for dynamic clustering, trendContext for asymmetric distance, and orderbook for validation
    const allLevels = this.levelAnalyzer.getAllLevels(
      allSwingPoints,
      data.candles,
      data.timestamp,
      atrPercent,
      trendContext,
      orderbookAnalysis,
    );
    const supportLevels = allLevels.support;
    const resistanceLevels = allLevels.resistance;

    this.logger.info(`📊 ${this.name} Levels Detected`, {
      support: supportLevels.length,
      resistance: resistanceLevels.length,
      supportPrices: supportLevels.map(l => l.price.toFixed(DECIMAL_PLACES.PRICE)),
      resistancePrices: resistanceLevels.map(l => l.price.toFixed(DECIMAL_PLACES.PRICE)),
    });

    // ========================================================================
    // STEP 3: Find nearest level (Dynamic ATR-based distance with asymmetric support)
    // ========================================================================
    // Use ATR to adjust "nearness" tolerance.
    // If ATR is high (volatile), allow wider distance. If low (calm), require tighter entry.
    // Default limit is config.maxDistancePercent (e.g. 0.6%) - overridden by volatility regime
    // IMPORTANT: Add minimum floor to prevent too narrow distance in low volatility
    // NEW: Use asymmetric distance for trend-aligned levels (wider for trend-following entries)
    const dynamicMaxDistance = this.calculateDynamicDistance(atrPercent);

    // Get asymmetric distances based on trend context
    // UPTREND: wider distance for SUPPORT (LONG entries are trend-aligned)
    // DOWNTREND: wider distance for RESISTANCE (SHORT entries are trend-aligned)
    const supportMaxDistance = this.levelAnalyzer.getAsymmetricMaxDistance('SUPPORT', trendContext);
    const resistanceMaxDistance = this.levelAnalyzer.getAsymmetricMaxDistance('RESISTANCE', trendContext);

    // Use the larger of dynamic distance or asymmetric distance
    const effectiveSupportDistance = Math.max(dynamicMaxDistance, supportMaxDistance);
    const effectiveResistanceDistance = Math.max(dynamicMaxDistance, resistanceMaxDistance);

    const nearestSupport = this.findNearestLevel(
      data.currentPrice,
      supportLevels,
      effectiveSupportDistance,
      'SUPPORT',
      trendContext,
    );
    const nearestResistance = this.findNearestLevel(
      data.currentPrice,
      resistanceLevels,
      effectiveResistanceDistance,
      'RESISTANCE',
      trendContext,
    );

    // ========================================================================
    // STEP 4: Determine entry direction (TREND-BASED!)
    // ========================================================================
    let direction: SignalDirection | null = null;
    let level: Level | null = null;
    let reason = '';

    // trendContext already detected in STEP 2 for level building

    // TRADE WITH THE TREND!
    // Downtrend: prefer SHORT from resistance
    // Uptrend: prefer LONG from support
    // Neutral: choose nearest level

    if (trendContext === 'DOWNTREND' && nearestResistance) {
      // Downtrend - SHORT from resistance (against falling prices)
      direction = SignalDirection.SHORT;
      level = nearestResistance;
      reason = `DOWNTREND: SHORT from resistance ${nearestResistance.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestResistance.touches}T)`;
    } else if (trendContext === 'UPTREND' && nearestSupport) {
      // Uptrend - LONG from support (with rising prices)
      direction = SignalDirection.LONG;
      level = nearestSupport;
      reason = `UPTREND: LONG from support ${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestSupport.touches}T)`;
    } else if (nearestSupport && nearestResistance) {
      // Neutral or fallback - choose the NEAREST level with minimum strength check
      const minStrength = this.config.minStrengthForNeutral ?? 0.4; // Default: 40% strength required
      const supportDistance = Math.abs((data.currentPrice - nearestSupport.price) / nearestSupport.price) * PERCENT_MULTIPLIER;
      const resistanceDistance = Math.abs((data.currentPrice - nearestResistance.price) / nearestResistance.price) * PERCENT_MULTIPLIER;

      // Filter levels by minimum strength for NEUTRAL trend
      const supportValid = nearestSupport.strength >= minStrength;
      const resistanceValid = nearestResistance.strength >= minStrength;

      if (!supportValid && !resistanceValid) {
        // Neither level meets minimum strength for NEUTRAL trend
        this.logger.info(`❌ ${this.name} BLOCKED - NEUTRAL trend requires stronger levels`, {
          blockedBy: ['NEUTRAL_WEAK_LEVELS'],
          supportStrength: nearestSupport.strength.toFixed(DECIMAL_PLACES.PERCENT),
          resistanceStrength: nearestResistance.strength.toFixed(DECIMAL_PLACES.PERCENT),
          minRequired: minStrength.toFixed(DECIMAL_PLACES.PERCENT),
        });
        return this.noSignal(
          `NEUTRAL trend: Both levels too weak (support: ${nearestSupport.strength.toFixed(2)}, resistance: ${nearestResistance.strength.toFixed(2)}, min: ${minStrength})`,
        );
      }

      // Choose the closest VALID level - WITH TREND VALIDATION
      if (supportValid && resistanceValid) {
        // Both valid - choose closest, but respect trend filters
        if (supportDistance <= resistanceDistance) {
          // Support is closer - consider LONG
          direction = SignalDirection.LONG;
          level = nearestSupport;
          reason = `NEUTRAL: LONG from support ${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestSupport.touches}T, str:${nearestSupport.strength.toFixed(2)})`;
        } else {
          // Resistance is closer - consider SHORT
          // BUT: Check if we're in uptrend (which would block SHORT)
          if (this.config.blockShortInUptrend && this.isUptrend(data)) {
            // Can't do SHORT in uptrend - fallback to support if available
            if (supportValid && nearestSupport) {
              direction = SignalDirection.LONG;
              level = nearestSupport;
              reason = `NEUTRAL: BLOCKED SHORT (uptrend), fallback to LONG from support ${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)}`;
            } else {
              // Can't enter - resistance blocked by uptrend, support not available
              return this.noSignal(`NEUTRAL trend: SHORT blocked (uptrend), no alternative support level`);
            }
          } else {
            direction = SignalDirection.SHORT;
            level = nearestResistance;
            reason = `NEUTRAL: SHORT from resistance ${nearestResistance.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestResistance.touches}T, str:${nearestResistance.strength.toFixed(2)})`;
          }
        }
      } else if (supportValid) {
        // Only support is strong enough - LONG
        direction = SignalDirection.LONG;
        level = nearestSupport;
        reason = `NEUTRAL: LONG from support ${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestSupport.touches}T, str:${nearestSupport.strength.toFixed(2)})`;
      } else {
        // Only resistance is strong enough - SHORT
        // Check trend filter first
        if (this.config.blockShortInUptrend && this.isUptrend(data)) {
          return this.noSignal(`NEUTRAL trend: SHORT from resistance blocked (uptrend), resistance is only valid level`);
        }
        direction = SignalDirection.SHORT;
        level = nearestResistance;
        reason = `NEUTRAL: SHORT from resistance ${nearestResistance.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestResistance.touches}T, str:${nearestResistance.strength.toFixed(2)})`;
      }
    } else if (nearestSupport) {
      // Only support found → LONG (with trend validation)
      // Check if LONG is allowed in current trend
      if (this.config.blockLongInDowntrend && this.isDowntrend(data)) {
        return this.noSignal(`LONG blocked in downtrend (EMA ${data.ema.fast.toFixed(4)} < ${data.ema.slow.toFixed(4)}, RSI ${data.rsi.toFixed(1)})`);
      }
      direction = SignalDirection.LONG;
      level = nearestSupport;
      reason = `LONG from support ${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestSupport.touches}T)`;
    } else if (nearestResistance) {
      // Only resistance found → SHORT (with trend validation)
      // Check if SHORT is allowed in current trend
      if (this.config.blockShortInUptrend && this.isUptrend(data)) {
        return this.noSignal(`SHORT blocked in uptrend (EMA ${data.ema.fast.toFixed(4)} > ${data.ema.slow.toFixed(4)}, RSI ${data.rsi.toFixed(1)})`);
      }
      direction = SignalDirection.SHORT;
      level = nearestResistance;
      reason = `SHORT from resistance ${nearestResistance.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestResistance.touches}T)`;
    }

    const effectiveMaxDist = this.getEffectiveMaxDistance();
    const currentRegime = this.getCurrentVolatilityRegime();
    this.logger.info(`📊 ${this.name} Nearest Levels Check`, {
      currentPrice: data.currentPrice.toFixed(DECIMAL_PLACES.PRICE),
      nearestSupport: nearestSupport ? `${nearestSupport.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestSupport.touches}T)` : 'none',
      nearestResistance: nearestResistance ? `${nearestResistance.price.toFixed(DECIMAL_PLACES.PRICE)} (${nearestResistance.touches}T)` : 'none',
      maxDistance: effectiveMaxDist + '%',
      volatilityRegime: currentRegime ?? 'disabled',
    });

    if ((direction == null) || !level) {
      // ========================================================================
      // BREAKOUT MODE: Enter strong trends without nearby levels
      // ========================================================================
      const breakoutConfig = (this.config.levelClustering as any)?.breakoutMode;
      if (breakoutConfig?.enabled) {
        const breakoutSignal = this.checkBreakoutMode(data, trendContext, atrPercent);
        if (breakoutSignal) {
          return breakoutSignal;
        }
      }

      this.logger.info(`❌ ${this.name} BLOCKED`, {
        blockedBy: ['NO_LEVELS_WITHIN_DISTANCE'],
        maxDistance: effectiveMaxDist + '%',
        volatilityRegime: currentRegime ?? 'disabled',
      });
      return this.noSignal('No levels within distance threshold');
    }

    this.logger.info(`✅ ${this.name} Level Pattern Found`, {
      direction,
      levelPrice: level.price.toFixed(DECIMAL_PLACES.PRICE),
      levelType: level.type,
      touches: level.touches,
      strength: level.strength.toFixed(DECIMAL_PLACES.PERCENT),
    });

    // ========================================================================
    // STEP 4.5: Unified Filter Pipeline (Trend + RSI + EMA filters)
    // ========================================================================
    // All trend-related filters consolidated into a single pipeline
    const filterResult = this.runFilterPipeline(direction, data, level);

    this.logger.debug(`📊 ${this.name} Filter Pipeline`, {
      passed: filterResult.passed,
      filtersChecked: filterResult.filtersChecked,
      blockedBy: filterResult.blockedBy,
      ...filterResult.details,
    });

    if (!filterResult.passed) {
      this.logger.info(`❌ ${this.name} BLOCKED`, {
        blockedBy: [filterResult.blockedBy],
        reason: filterResult.reason,
        filtersChecked: filterResult.filtersChecked,
        ...filterResult.details,
      });
      return this.noSignal(filterResult.reason || 'Filter pipeline blocked');
    }

    // ========================================================================
    // STEP 4.6: Entry Confirmation - Candle Pattern Validation
    // ========================================================================
    // Separate from trend filters - checks candle patterns for entry timing
    const confirmationConfig = this.config.entryConfirmation;

    if (!confirmationConfig) {
      this.logger.warn(`${this.name} Missing entryConfirmation config, skipping check (risky)`);
    } else if (confirmationConfig.enabled !== false) {
      const currentCandle = data.candles[data.candles.length - 1];
      const confirmation = this.checkCandleConfirmation(currentCandle, direction, confirmationConfig);

      if (!confirmation.isValid) {
        const blockedBy = direction === SignalDirection.LONG ? 'NO_LONG_CONFIRMATION' : 'NO_SHORT_CONFIRMATION';
        this.logger.info(`❌ ${this.name} BLOCKED - ${confirmation.reason}`, {
          blockedBy: [blockedBy],
          direction,
          ...confirmation.details,
          currentOpen: currentCandle.open.toFixed(DECIMAL_PLACES.PRICE),
          currentClose: currentCandle.close.toFixed(DECIMAL_PLACES.PRICE),
        });
        return this.noSignal(
          `${direction} entry not confirmed: ${confirmation.reason}`,
        );
      }
    }

    // ========================================================================
    // NOTE: LONG Entry Confirmation
    // ========================================================================
    // LONG entries will be sent to LongEntryConfirmationManager in PositionManager
    // to wait for next 1m candle close confirmation (avoids falling knife entries)

    // ========================================================================
    // STEP 5: Multi-Timeframe Context Trend Filter (Phase 3)
    // ========================================================================
    // Block entry if 1h trend is opposite to signal direction
    const contextTrendCheck = this.checkContextTrendFilter(direction, data.emaContext);
    if (contextTrendCheck.blocked) {
      this.logger.info(`❌ ${this.name} BLOCKED`, {
        blockedBy: ['CONTEXT_TREND_OPPOSITE'],
        reason: contextTrendCheck.reason,
        direction,
      });
      return this.noSignal(contextTrendCheck.reason || '1h trend blocks entry');
    }

    // ========================================================================
    // STEP 6: Calculate confidence
    // ========================================================================
    const distancePercent = Math.abs((data.currentPrice - level.price) / level.price) * PERCENT_MULTIPLIER;

    let confidence: number;
    let scoreBreakdown: SignalScoreBreakdown | null = null;

    // Use Weight Matrix if enabled
    if (this.weightMatrix) {
      // Build WeightMatrixInput
      const volumeAnalysis = this.volumeCalculator.calculate(data.candles);
      const currentCandle = data.candles[data.candles.length - 1];

      const input: WeightMatrixInput = {
        rsi: data.rsi,
        stochastic: data.stochastic ? { k: data.stochastic.k, d: data.stochastic.d } : undefined,
        ema: { fast: data.ema.fast, slow: data.ema.slow, price: data.currentPrice },
        bollingerBands: data.bollingerBands ? { position: data.bollingerBands.percentB } : undefined,
        atr: data.atr ? { current: data.atr, average: data.atr } : undefined,
        volume: {
          current: currentCandle.volume,
          average: volumeAnalysis.avgVolume,
        },
        delta: data.deltaAnalysis
          ? { buyPressure: data.deltaAnalysis.buyVolume, sellPressure: data.deltaAnalysis.sellVolume }
          : undefined, // PHASE 4: Delta analysis
        levelStrength: { touches: level.touches, strength: level.strength },
        levelDistance: { percent: distancePercent },
        swingPoints: { quality: level.strength }, // Use level strength as swing quality
        seniorTFAlignment: {
          aligned: this.isTrendAligned(direction, data.trend),
          strength: this.isTrendAligned(direction, data.trend) ? MULTIPLIERS.NEUTRAL : 0.0,
        },
        tfAlignmentScore:
          data.tfAlignment && direction === SignalDirection.LONG
            ? data.tfAlignment.long.score
            : data.tfAlignment
              ? data.tfAlignment.short.score
              : undefined, // PHASE 6: Multi-timeframe alignment
      };

      scoreBreakdown = this.weightMatrix.calculateScore(input, direction);
      confidence = scoreBreakdown.confidence;

      // Log contributions for transparency
      this.logger.info(`📊 ${this.name} Weight Matrix Score`, {
        confidence: (confidence * PERCENT_MULTIPLIER).toFixed(1) + '%',
        totalScore: `${scoreBreakdown.totalScore.toFixed(1)}/${scoreBreakdown.maxPossibleScore}`,
        rsi: scoreBreakdown.contributions.rsi?.reason,
        volume: scoreBreakdown.contributions.volume?.reason,
        levelStrength: scoreBreakdown.contributions.levelStrength?.reason,
        levelDistance: scoreBreakdown.contributions.levelDistance?.reason,
        ema: scoreBreakdown.contributions.ema?.reason,
        stochastic: scoreBreakdown.contributions.stochastic?.reason,
      });
    } else {
      // Legacy confidence calculation (using config parameters)
      if (!this.config.levelClustering) {
        throw new Error('Missing levelClustering in strategies.levelBased config.json');
      }
      const clustering = this.config.levelClustering;

      confidence = clustering.baseConfidence;

      // Level strength boost (0 to +strengthBoost)
      const strengthBoost = level.strength * clustering.strengthBoost;
      confidence += strengthBoost;

      // Trend alignment boost
      if (this.isTrendAligned(direction, data.trend)) {
        confidence += clustering.trendAlignmentBoost;
      }

      // Distance modifier (closer = better)
      const distanceModifier = this.calculateDistanceModifier(distancePercent);
      confidence *= distanceModifier;

      // ========================================================================
      // STEP 6.5: Pattern Analysis (all patterns via helper)
      // ========================================================================
      if (this.patternAnalyzer) {
        const patternResult = this.patternAnalyzer.analyzePatterns({
          candles: data.candles,
          swingPoints: data.swingPoints,
          direction,
          trend: data.trend,
          strategyName: this.name,
        });

        confidence += patternResult.confidenceBoost;
        reason += patternResult.reasonAdditions;
      }

      // ========================================================================
      // STEP 6.7: HTF Level Confirmation (Phase 3)
      // ========================================================================
      // Boost confidence if level aligns with HTF (15m) level
      const htfConfirmation = this.checkHTFLevelConfirmation(
        level,
        data.candlesTrend1,
        direction,
        data.timestamp,
      );

      if (htfConfirmation.isConfirmed) {
        confidence += htfConfirmation.confidenceBoost;
        reason += ` [HTF-Confirmed]`;
      }

      // ========================================================================
      // STEP 6.8: TREND2 Level Confirmation (30m) - Additional HTF layer
      // ========================================================================
      const trend2Confirmation = this.checkTrend2LevelConfirmation(
        level,
        data.candlesTrend2,
        direction,
        data.timestamp,
      );

      if (trend2Confirmation.isConfirmed) {
        confidence += trend2Confirmation.confidenceBoost;
        reason += ` [30m-Confirmed]`;
      }

      // ========================================================================
      // STEP 6.9: Sweep Detection - Liquidity grab confirmation
      // ========================================================================
      const sweepAnalysis = this.analyzeSweep(data.candles, direction, allLevels);
      if (sweepAnalysis.hasSweep && sweepAnalysis.confidenceBoost > 0) {
        confidence += sweepAnalysis.confidenceBoost;
        reason += ` [Sweep-Confirmed]`;
        this.logger.debug(`${this.name} Sweep boost applied`, {
          sweepType: sweepAnalysis.sweep?.type,
          confidenceBoost: (sweepAnalysis.confidenceBoost * PERCENT_MULTIPLIER).toFixed(1) + '%',
          suggestedSL: sweepAnalysis.suggestedSL?.toFixed(DECIMAL_PLACES.PRICE) ?? 'none',
        });
      }

      // Normalize confidence to 0-100 range
      confidence = ConfidenceHelper.normalize(confidence);
    }

    // ========================================================================
    // STEP 6.10: Confidence threshold check (regime-aware)
    // ========================================================================
    const minConfidence = this.getEffectiveMinConfidence();
    if (confidence < minConfidence) {
      this.logger.debug(`${this.name} Signal blocked by confidence threshold`, {
        confidence: (confidence * PERCENT_MULTIPLIER).toFixed(1) + '%',
        threshold: (minConfidence * PERCENT_MULTIPLIER).toFixed(1) + '%',
        reason,
      });
      return this.noSignal(`Confidence ${(confidence * PERCENT_MULTIPLIER).toFixed(1)}% below minimum ${(minConfidence * PERCENT_MULTIPLIER).toFixed(1)}%`);
    }

    // ========================================================================
    // STEP 7: Build signal (with enhanced TP/SL if enabled)
    // ========================================================================
    const signal = this.buildSignal(direction, confidence, data, reason, level, allLevels, orderbookAnalysis);

    // STEP 7.1: Check if signal was blocked by R:R Gate
    if (!signal) {
      return this.noSignal('R:R Gate blocked - risk/reward ratio too low');
    }

    this.logger.info(`✅ ${this.name} SIGNAL GENERATED!`, {
      direction,
      reason,
      level: level.price.toFixed(DECIMAL_PLACES.PRICE),
      levelStrength: level.strength.toFixed(DECIMAL_PLACES.PERCENT),
      touches: level.touches,
      distance: distancePercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
      confidence: confidence.toFixed(DECIMAL_PLACES.PERCENT),
      entry: data.currentPrice.toFixed(DECIMAL_PLACES.PRICE),
      sl: signal.stopLoss.toFixed(DECIMAL_PLACES.PRICE),
    });

    return {
      valid: true,
      signal,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }

  // NOTE: buildLevels() and createLevelFromCluster() removed - now using LevelAnalyzer.getAllLevels()

  /**
   * Calculate dynamic distance threshold based on ATR
   * Uses configurable parameters or fallback to legacy behavior
   * Now regime-aware: uses getEffectiveMaxDistance() for the cap
   */
  private calculateDynamicDistance(atrPercent: number): number {
    const dynamicConfig = this.config.dynamicDistance;
    const effectiveMaxDistance = this.getEffectiveMaxDistance();

    if (dynamicConfig?.enabled) {
      // New configurable dynamic distance
      const atrMultiplier = dynamicConfig.atrMultiplier;
      const absoluteMin = dynamicConfig.absoluteMinPercent;

      // Dynamic floor based on ATR: max(atr * multiplier, absoluteMin)
      const dynamicFloor = Math.max(atrPercent * atrMultiplier, absoluteMin);

      // Final distance: min(dynamicFloor, maxDistancePercent) but at least dynamicFloor
      // Note: effectiveMaxDistance is regime-aware (LOW=0.3, MEDIUM=0.6, HIGH=1.2)
      return Math.min(Math.max(dynamicFloor, absoluteMin), effectiveMaxDistance);
    } else {
      // Legacy behavior with static floor
      const minDistanceFloor = this.config.minDistanceFloorPercent ?? 0.3;
      return Math.max(
        Math.min(atrPercent * 0.5, effectiveMaxDistance),
        minDistanceFloor,
      );
    }
  }

  /**
   * Find nearest level within distance threshold
   * For SUPPORT: only accept if price >= level (not below)
   * For RESISTANCE: only accept if price <= level (not above)
   * Now regime-aware: uses getEffectiveMinTouches() for minTouches threshold
   * Now logs detailed rejection reasons for each level
   *
   * @param trendContext - Optional trend context for logging
   */
  private findNearestLevel(
    price: number,
    levels: Level[],
    maxDistancePercent: number,
    levelType: 'SUPPORT' | 'RESISTANCE',
    trendContext?: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
  ): Level | null {
    if (levels.length === 0) {
      this.logger.debug(`🔍 ${this.name} findNearestLevel: No ${levelType} levels available`);
      return null;
    }

    let nearest: Level | null = null;
    let minDistance = Infinity;

    // Determine minTouches based on level type and volatility regime
    // SUPPORT=LONG, RESISTANCE=SHORT
    const direction = levelType === 'SUPPORT' ? 'LONG' : 'SHORT';
    const minTouches = this.getEffectiveMinTouches(direction);

    // Collect rejection reasons for detailed logging
    const rejectionReasons: Array<{
      price: string;
      touches: number;
      strength: string;
      distance: string;
      reason: string;
    }> = [];

    for (const level of levels) {
      const distancePercent = Math.abs((price - level.price) / level.price) * PERCENT_MULTIPLIER;
      const isValidDirection =
        levelType === 'SUPPORT' ? price >= level.price : price <= level.price;

      // Detailed rejection tracking
      let rejectionReason: string | null = null;

      // Check 1: Minimum touches
      if (level.touches < minTouches) {
        rejectionReason = `insufficient_touches (${level.touches} < ${minTouches})`;
      }
      // Check 2: Direction validity
      else if (!isValidDirection) {
        const directionIssue = levelType === 'SUPPORT'
          ? `price ${price.toFixed(4)} below support ${level.price.toFixed(4)}`
          : `price ${price.toFixed(4)} above resistance ${level.price.toFixed(4)}`;
        rejectionReason = `invalid_direction: ${directionIssue}`;
      }
      // Check 3: Distance threshold
      else if (distancePercent > maxDistancePercent) {
        rejectionReason = `distance_exceeded (${distancePercent.toFixed(2)}% > ${maxDistancePercent.toFixed(2)}%)`;
      }

      if (rejectionReason) {
        rejectionReasons.push({
          price: level.price.toFixed(DECIMAL_PLACES.PRICE),
          touches: level.touches,
          strength: level.strength.toFixed(2),
          distance: distancePercent.toFixed(2) + '%',
          reason: rejectionReason,
        });
        continue;
      }

      // All checks passed - check if this is the nearest
      if (distancePercent < minDistance) {
        nearest = level;
        minDistance = distancePercent;
      }
    }

    // Log detailed rejection info
    if (!nearest && rejectionReasons.length > 0) {
      this.logger.debug(`🔍 ${this.name} findNearestLevel REJECTIONS`, {
        levelType,
        trendContext: trendContext ?? 'unknown',
        currentPrice: price.toFixed(DECIMAL_PLACES.PRICE),
        minTouches,
        maxDistance: maxDistancePercent.toFixed(2) + '%',
        totalLevels: levels.length,
        rejections: rejectionReasons,
      });
    }

    // Log successful selection
    if (nearest) {
      this.logger.debug(`✅ ${this.name} findNearestLevel FOUND`, {
        levelType,
        trendContext: trendContext ?? 'unknown',
        levelPrice: nearest.price.toFixed(DECIMAL_PLACES.PRICE),
        touches: nearest.touches,
        strength: nearest.strength.toFixed(2),
        distance: minDistance.toFixed(2) + '%',
        maxAllowed: maxDistancePercent.toFixed(2) + '%',
      });
    }

    return nearest;
  }

  /**
   * Breakout Mode: Enter strong trends without nearby levels
   *
   * Conditions for breakout entry:
   * 1. No levels found within normal distance
   * 2. Strong trend (EMA gap > minEmaGapPercent)
   * 3. RSI confirms momentum (not overbought/oversold against trend)
   * 4. ATR shows sufficient volatility
   *
   * @returns Strategy signal if breakout conditions met, null otherwise
   */
  private checkBreakoutMode(
    data: StrategyMarketData,
    trendContext: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL',
    atrPercent: number,
  ): StrategySignal | null {
    const breakoutConfig = (this.config.levelClustering as any)?.breakoutMode;
    if (!breakoutConfig?.enabled) {
      return null;
    }

    const {
      minEmaGapPercent = 1.5,
      rsiThresholdLong = 40,
      rsiThresholdShort = 60,
      minAtrPercent = 0.6,
      confidenceBoost = 0.1,
    } = breakoutConfig;

    // Calculate EMA gap
    const emaGapPercent = Math.abs((data.ema.fast - data.ema.slow) / data.ema.slow) * PERCENT_MULTIPLIER;

    // Check if trend is strong enough for breakout
    if (emaGapPercent < minEmaGapPercent) {
      this.logger.debug(`📊 ${this.name} Breakout Mode: EMA gap too small`, {
        emaGap: emaGapPercent.toFixed(2) + '%',
        required: minEmaGapPercent + '%',
      });
      return null;
    }

    // Check ATR volatility
    if (atrPercent < minAtrPercent) {
      this.logger.debug(`📊 ${this.name} Breakout Mode: ATR too low`, {
        atr: atrPercent.toFixed(2) + '%',
        required: minAtrPercent + '%',
      });
      return null;
    }

    let direction: SignalDirection | null = null;
    let reason = '';

    // Determine direction based on trend and RSI confirmation
    if (trendContext === 'UPTREND') {
      // LONG breakout: RSI should NOT be overbought (room to move up)
      if (data.rsi <= rsiThresholdShort) {
        direction = SignalDirection.LONG;
        reason = `BREAKOUT LONG: Strong uptrend (EMA gap ${emaGapPercent.toFixed(1)}%, RSI ${data.rsi.toFixed(0)})`;
      } else {
        this.logger.debug(`📊 ${this.name} Breakout Mode: RSI overbought`, {
          rsi: data.rsi.toFixed(0),
          maxForLong: rsiThresholdShort,
        });
        return null;
      }
    } else if (trendContext === 'DOWNTREND') {
      // SHORT breakout: RSI should NOT be oversold (room to move down)
      if (data.rsi >= rsiThresholdLong) {
        direction = SignalDirection.SHORT;
        reason = `BREAKOUT SHORT: Strong downtrend (EMA gap ${emaGapPercent.toFixed(1)}%, RSI ${data.rsi.toFixed(0)})`;
      } else {
        this.logger.debug(`📊 ${this.name} Breakout Mode: RSI oversold`, {
          rsi: data.rsi.toFixed(0),
          minForShort: rsiThresholdLong,
        });
        return null;
      }
    } else {
      // NEUTRAL trend - no breakout
      return null;
    }

    // Calculate ATR-based SL (no level to reference, use current price)
    const atrValue = data.atr ?? (data.currentPrice * atrPercent / PERCENT_MULTIPLIER);
    const slMultiplier = this.config.stopLossAtrMultiplier ?? 1.5;
    let stopLossDistance = atrValue * slMultiplier;

    // Enforce minimum SL distance (same as buildSignal)
    const MIN_SL_DISTANCE_PERCENT = MULTIPLIERS.NEUTRAL; // 1%
    const minSlDistance = data.currentPrice * (MIN_SL_DISTANCE_PERCENT / PERCENT_MULTIPLIER);
    stopLossDistance = Math.max(stopLossDistance, minSlDistance);

    const stopLoss = direction === SignalDirection.LONG
      ? data.currentPrice - stopLossDistance
      : data.currentPrice + stopLossDistance;

    // Calculate TP based on R:R ratio
    const rrRatio = this.config.rrRatio ?? 1.5;
    const takeProfitDistance = stopLossDistance * rrRatio;
    const tpPrice = direction === SignalDirection.LONG
      ? data.currentPrice + takeProfitDistance
      : data.currentPrice - takeProfitDistance;

    const takeProfits: TakeProfit[] = [{
      level: 1,
      price: tpPrice,
      sizePercent: 100,
      percent: (takeProfitDistance / data.currentPrice) * PERCENT_MULTIPLIER,
      hit: false,
    }];

    // Calculate confidence (base + boost for strong trend)
    const baseConfidence = (this.config.levelClustering as any)?.baseConfidence ?? 0.7;
    const trendBoost = Math.min((emaGapPercent - minEmaGapPercent) * 0.05, 0.15); // Up to 15% boost
    const confidence = Math.min(baseConfidence + confidenceBoost + trendBoost, 0.95);

    this.logger.info(`🚀 ${this.name} BREAKOUT MODE TRIGGERED`, {
      direction,
      trendContext,
      emaGap: emaGapPercent.toFixed(2) + '%',
      rsi: data.rsi.toFixed(0),
      atr: atrPercent.toFixed(2) + '%',
      stopLoss: stopLoss.toFixed(DECIMAL_PLACES.PRICE),
      takeProfit: tpPrice.toFixed(DECIMAL_PLACES.PRICE),
      confidence: (confidence * PERCENT_MULTIPLIER).toFixed(0) + '%',
      useTrailingSL: breakoutConfig.useTrailingSL ?? true,
    });

    // Build Signal object
    const signal: Signal = {
      direction,
      type: SignalType.LEVEL_BASED,
      confidence,
      price: data.currentPrice,
      stopLoss,
      takeProfits,
      reason,
      timestamp: data.timestamp,
      marketData: {
        rsi: data.rsi,
        ema20: data.ema.fast,
        ema50: data.ema.slow,
        atr: atrValue,
        trend: data.trend as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      },
    };

    return {
      valid: true,
      signal,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }

  /**
   * Check if trend aligns with signal direction
   */
  private isTrendAligned(direction: SignalDirection, trend: string): boolean {
    if (direction === SignalDirection.LONG && trend === 'BULLISH') {
      return true;
    }
    if (direction === SignalDirection.SHORT && trend === 'BEARISH') {
      return true;
    }
    return false;
  }

  /**
   * Check if market is in downtrend
   * Criteria: EMA20 < EMA50 AND (RSI < 55 OR strong EMA divergence)
   *
   * Strengthened in Session 36:
   * - RSI threshold increased from 50 to 55
   * - Added EMA divergence check (>0.5% = strong downtrend)
   */
  private isDowntrend(data: StrategyMarketData): boolean {
    const emaDowntrend = data.ema.fast < data.ema.slow; // EMA20 < EMA50
    const RSI_THRESHOLD = INTEGER_MULTIPLIERS.FIFTY as number; // 50 - neutral level
    const rsiWeak = data.rsi < RSI_THRESHOLD;

    // Calculate EMA divergence percentage
    const emaDiff = ((data.ema.slow - data.ema.fast) / data.ema.fast) * PERCENT_MULTIPLIER;
    const strongDowntrend = emaDiff > MULTIPLIERS.HALF; // EMA difference > 0.5% = strong downtrend

    // Block LONG if: downtrend AND (weak RSI OR strong EMA divergence)
    return emaDowntrend && (rsiWeak || strongDowntrend);
  }

  /**
   * Check if market is in uptrend
   * Criteria: EMA20 > EMA50 AND (RSI > 45 OR strong EMA divergence)
   * Block SHORT if: uptrend AND (strong RSI OR strong EMA divergence)
   */
  private isUptrend(data: StrategyMarketData): boolean {
    const emaUptrend = data.ema.fast > data.ema.slow; // EMA20 > EMA50
    const RSI_THRESHOLD = INTEGER_MULTIPLIERS.FIFTY as number; // 50 - neutral level
    const rsiStrong = data.rsi > RSI_THRESHOLD;

    // Calculate EMA divergence percentage
    const emaDiff = ((data.ema.fast - data.ema.slow) / data.ema.slow) * PERCENT_MULTIPLIER;
    const strongUptrend = emaDiff > MULTIPLIERS.HALF; // EMA difference > 0.5% = strong uptrend

    // Block SHORT if: uptrend AND (strong RSI OR strong EMA divergence)
    return emaUptrend && (rsiStrong || strongUptrend);
  }

  /**
   * Check if there's a significant trend (not bokovnik/sideways market)
   *
   * This filter prevents entries on flat markets where EMA gap is too small.
   * On bokovnik: EMA gap < 0.5%, all signals become noise
   * On trend: EMA gap > 0.5%, signals have better timing
   *
   * Added in Session 51 to solve wrong entry points issue (-23.7 USDT loss in production)
   */
  private checkTrendExistence(data: StrategyMarketData, levelStrength?: number): {
    hasSignificantTrend: boolean;
    emaDiffPercent: number;
    trendStrength: number;
    isTrendAligned: boolean;
    bypassedByStrongLevel: boolean;
  } {
    // Calculate EMA difference as percentage
    const gap = Math.abs(data.ema.fast - data.ema.slow);
    const emaDiffPercent = (gap / data.ema.slow) * PERCENT_MULTIPLIER;

    // Get threshold from config or use default
    const filterConfig = this.config.trendExistenceFilter;
    const minTrendGapPercent = filterConfig?.minEmaGapPercent ?? 0.5;

    // Check if trend gap is significant
    let hasSignificantTrend = emaDiffPercent >= minTrendGapPercent;
    let bypassedByStrongLevel = false;

    // Check if we can bypass due to strong level
    if (!hasSignificantTrend && filterConfig?.bypassOnStrongLevel && levelStrength !== undefined) {
      const strongLevelThreshold = filterConfig.strongLevelThreshold;
      if (levelStrength >= strongLevelThreshold) {
        hasSignificantTrend = true;
        bypassedByStrongLevel = true;
      }
    }

    // Calculate trend strength (capped at 1.0)
    // Range: 0.0 (no gap) to 1.0 (strong gap > 2%)
    const trendStrength = Math.min(emaDiffPercent / (MULTIPLIER_VALUES.TWO as number), MULTIPLIER_VALUES.ONE as number);

    // Check if trend direction aligns with EMAs
    const isTrendAligned = data.ema.fast > data.ema.slow ? true : false;

    return {
      hasSignificantTrend,
      emaDiffPercent,
      trendStrength,
      isTrendAligned,
      bypassedByStrongLevel,
    };
  }

  /**
   * Unified filter pipeline for trend and entry validation
   *
   * Consolidates all overlapping filters into a single pass:
   * 1. Trend existence check (EMA gap)
   * 2. Direction-specific trend filter (LONG in downtrend, SHORT in uptrend)
   * 3. RSI filters
   * 4. EMA/Structure filters
   * 5. Trend alignment check
   *
   * Returns structured result with all rejection reasons for logging.
   */
  private runFilterPipeline(
    direction: SignalDirection,
    data: StrategyMarketData,
    level: Level,
  ): FilterPipelineResult {
    const filtersChecked: string[] = [];
    const details: Record<string, unknown> = {
      direction,
      levelPrice: level.price,
      levelStrength: level.strength,
      emaFast: data.ema.fast,
      emaSlow: data.ema.slow,
      rsi: data.rsi,
    };

    // ========================================================================
    // FILTER 1: Trend Existence (prevents trading in flat/sideways markets)
    // ========================================================================
    filtersChecked.push('TREND_EXISTENCE');
    const filterConfig = this.config.trendExistenceFilter;
    const minGapForFilter = filterConfig?.minEmaGapPercent ?? 0.5;

    // Pass level strength for potential bypass
    const trendResult = this.checkTrendExistence(data, level.strength);
    details.emaDiffPercent = trendResult.emaDiffPercent;
    details.hasSignificantTrend = trendResult.hasSignificantTrend;
    details.bypassedByStrongLevel = trendResult.bypassedByStrongLevel;

    if (!trendResult.hasSignificantTrend) {
      return {
        passed: false,
        blockedBy: 'NO_SIGNIFICANT_TREND',
        reason: `Flat market - EMA gap ${trendResult.emaDiffPercent.toFixed(2)}% < ${minGapForFilter}%`,
        details,
        filtersChecked,
      };
    }

    // ========================================================================
    // FILTER 2: Direction-specific trend filter
    // ========================================================================
    if (direction === SignalDirection.LONG && this.config.blockLongInDowntrend) {
      filtersChecked.push('LONG_DOWNTREND');
      if (this.isDowntrend(data)) {
        return {
          passed: false,
          blockedBy: 'LONG_IN_DOWNTREND',
          reason: `LONG blocked in downtrend (EMA ${data.ema.fast.toFixed(4)} < ${data.ema.slow.toFixed(4)}, RSI ${data.rsi.toFixed(1)})`,
          details,
          filtersChecked,
        };
      }
    }

    if (direction === SignalDirection.SHORT && this.config.blockShortInUptrend) {
      filtersChecked.push('SHORT_UPTREND');
      if (this.isUptrend(data)) {
        return {
          passed: false,
          blockedBy: 'SHORT_IN_UPTREND',
          reason: `SHORT blocked in uptrend (EMA ${data.ema.fast.toFixed(4)} > ${data.ema.slow.toFixed(4)}, RSI ${data.rsi.toFixed(1)})`,
          details,
          filtersChecked,
        };
      }
    }

    // ========================================================================
    // FILTER 3: RSI filters (with optional bypass on strong trends)
    // ========================================================================
    if (this.config.rsiFilters?.enabled) {
      filtersChecked.push('RSI_FILTER');
      const rsiConfig = this.config.rsiFilters;

      // Check if RSI filter should be bypassed on strong trends
      const bypassOnStrongTrend = rsiConfig.bypassOnStrongTrend ?? false;
      const strongTrendGap = rsiConfig.strongTrendEmaGapPercent ?? 1.5;
      const isStrongTrend = trendResult.emaDiffPercent >= strongTrendGap;
      const shouldBypassRsi = bypassOnStrongTrend && isStrongTrend;

      if (!shouldBypassRsi) {
        if (direction === SignalDirection.LONG) {
          if (data.rsi < rsiConfig.longMinThreshold) {
            return {
              passed: false,
              blockedBy: 'LONG_RSI_TOO_LOW',
              reason: `RSI ${data.rsi.toFixed(1)} < ${rsiConfig.longMinThreshold}`,
              details,
              filtersChecked,
            };
          }
          if (data.rsi > rsiConfig.longMaxThreshold) {
            return {
              passed: false,
              blockedBy: 'LONG_RSI_TOO_HIGH',
              reason: `RSI ${data.rsi.toFixed(1)} > ${rsiConfig.longMaxThreshold}`,
              details,
              filtersChecked,
            };
          }
        }

        if (direction === SignalDirection.SHORT) {
          if (data.rsi < rsiConfig.shortMinThreshold) {
            return {
              passed: false,
              blockedBy: 'SHORT_RSI_TOO_LOW',
              reason: `RSI ${data.rsi.toFixed(1)} < ${rsiConfig.shortMinThreshold}`,
              details,
              filtersChecked,
            };
          }
          if (data.rsi > rsiConfig.shortMaxThreshold) {
            return {
              passed: false,
              blockedBy: 'SHORT_RSI_TOO_HIGH',
              reason: `RSI ${data.rsi.toFixed(1)} > ${rsiConfig.shortMaxThreshold}`,
              details,
              filtersChecked,
            };
          }
        }
      } else {
        details.rsiBypassedDueToStrongTrend = true;
      }
    }

    // ========================================================================
    // FILTER 4: EMA/Structure filters (strong trend detection)
    // ========================================================================
    if (this.config.emaFilters?.enabled) {
      filtersChecked.push('EMA_STRUCTURE');
      const emaConfig = this.config.emaFilters;

      const emaDowntrend = data.ema.fast < data.ema.slow;
      const rsiWeak = data.rsi < emaConfig.downtrend.rsiThreshold;
      const emaDiff = ((data.ema.slow - data.ema.fast) / data.ema.fast) * PERCENT_MULTIPLIER;
      const strongDowntrend = emaDiff > emaConfig.downtrend.emaDiffThreshold;

      // Block LONG in strong downtrend
      if (direction === SignalDirection.LONG && emaDowntrend && rsiWeak && strongDowntrend) {
        return {
          passed: false,
          blockedBy: 'STRONG_DOWNTREND',
          reason: `Strong downtrend (EMA diff ${emaDiff.toFixed(2)}%, RSI ${data.rsi.toFixed(1)})`,
          details: { ...details, emaDiff },
          filtersChecked,
        };
      }

      // Check market structure if available
      const marketStructure = data.context?.marketStructure;
      if (marketStructure) {
        if (direction === SignalDirection.LONG && marketStructure === 'LH') {
          return {
            passed: false,
            blockedBy: 'BEARISH_MARKET_STRUCTURE',
            reason: 'Bearish structure (Lower High pattern)',
            details: { ...details, marketStructure },
            filtersChecked,
          };
        }
        if (direction === SignalDirection.SHORT && marketStructure === 'HL') {
          return {
            passed: false,
            blockedBy: 'BULLISH_MARKET_STRUCTURE',
            reason: 'Bullish structure (Higher Low pattern)',
            details: { ...details, marketStructure },
            filtersChecked,
          };
        }
      }
    }

    // ========================================================================
    // FILTER 5: Trend alignment (optional)
    // ========================================================================
    if (this.config.requireTrendAlignment) {
      filtersChecked.push('TREND_ALIGNMENT');
      const isAligned = this.isTrendAligned(direction, data.trend);

      if (!isAligned) {
        return {
          passed: false,
          blockedBy: 'TREND_NOT_ALIGNED',
          reason: `${direction} not aligned with ${data.trend} trend`,
          details: { ...details, trend: data.trend },
          filtersChecked,
        };
      }
    }

    // All filters passed
    return {
      passed: true,
      blockedBy: null,
      reason: null,
      details,
      filtersChecked,
    };
  }

  /**
   * Calculate distance modifier
   * Closer to level = higher confidence
   */
  private calculateDistanceModifier(distancePercent: number): number {
    const distConfig = this.config.distanceModifier || {
      veryClosePercent: MULTIPLIERS.HALF,
      veryClosePenalty: 1.1,
      farPercent: 1.2,
      farPenalty: MULTIPLIERS.ZERO_NINE,
    };

    if (distancePercent < distConfig.veryClosePercent) {
      // Very close
      return distConfig.veryClosePenalty;
    } else if (distancePercent > distConfig.farPercent) {
      // Far
      return distConfig.farPenalty;
    }
    return 1.0; // Normal
  }

  /**
   * Build a trading signal
   * @param allLevels - Optional: all support/resistance levels for enhanced TP/SL calculation
   * @returns Signal or null if blocked by R:R Gate
   */
  private buildSignal(
    direction: SignalDirection,
    confidence: number,
    data: StrategyMarketData,
    reason: string,
    level: Level,
    allLevels?: { support: Level[]; resistance: Level[] },
    orderbookAnalysis?: OrderBookAnalysis | null,
  ): Signal | null {
    const price = data.currentPrice;
    const atrPercent = data.atr || 1.0; // ATR in percent (e.g., 1.5%)

    // Convert ATR from percent to absolute value
    const atrAbsolute = price * (atrPercent / PERCENT_MULTIPLIER);

    let stopLoss: number;
    let takeProfits: TakeProfit[] = [];

    // ========================================================================
    // ENHANCED EXIT SERVICE (if enabled) - Structure-based TP/SL
    // ========================================================================
    if (this.enhancedExitService && allLevels) {
      const enhancedResult = this.enhancedExitService.calculateEnhancedTPSL(
        price,
        direction,
        level.price, // reference level
        atrPercent,
        allLevels,
        data.swingPoints,
        data.liquidity?.zones, // liquidity zones if available
      );

      stopLoss = enhancedResult.stopLoss;
      takeProfits = enhancedResult.takeProfits;

      // Validate R:R before proceeding - BLOCK signal if R:R too low
      if (takeProfits.length > 0) {
        const rrValidation = this.enhancedExitService.validateRiskReward(
          price,
          stopLoss,
          takeProfits[0].price,
        );

        if (!rrValidation.valid) {
          this.logger.warn(`⚠️ ${this.name} R:R Gate BLOCKED - Signal rejected`, {
            rr: rrValidation.riskRewardRatio.toFixed(2),
            risk: rrValidation.riskPercent.toFixed(2) + '%',
            reward: rrValidation.rewardPercent.toFixed(2) + '%',
            recommendation: rrValidation.recommendation,
          });
          // CRITICAL: Return null to block signal when R:R is too low
          // This prevents entering trades with negative expected value
          return null;
        }

        this.logger.info(`✨ ${this.name} Enhanced Exit`, {
          slType: enhancedResult.slType,
          tpType: enhancedResult.tpType,
          rr: enhancedResult.riskRewardRatio.toFixed(2),
          sl: stopLoss.toFixed(DECIMAL_PLACES.PRICE),
          tp1: takeProfits[0]?.price.toFixed(DECIMAL_PLACES.PRICE),
          slReason: enhancedResult.details.slReason,
        });
      }
    } else {
      // ========================================================================
      // LEGACY TP/SL CALCULATION (fallback)
      // ========================================================================

      // Stop loss: below/above the level (using configurable ATR multiplier)
      // For LONG, use stopLossAtrMultiplierLong if configured, otherwise use default
      const slMultiplier =
        direction === SignalDirection.LONG && this.config.stopLossAtrMultiplierLong
          ? this.config.stopLossAtrMultiplierLong
          : this.config.stopLossAtrMultiplier;

      let stopLossDistance = atrAbsolute * slMultiplier;

      // Enforce minimum SL distance to avoid too tight stops (critical fix for low ATR markets)
      const MIN_SL_DISTANCE_PERCENT = MULTIPLIERS.NEUTRAL; // 1% minimum (prevents 0.2-0.7% stops that get hit immediately)
      const minSlDistance = price * (MIN_SL_DISTANCE_PERCENT / PERCENT_MULTIPLIER);
      stopLossDistance = Math.max(stopLossDistance, minSlDistance);

      // Apply session-based SL widening if enabled
      stopLossDistance = SessionDetector.applySessionBasedSL(
        stopLossDistance,
        this.config.sessionBasedSL,
        this.logger,
        this.name,
      );

      stopLoss =
        direction === SignalDirection.LONG
          ? level.price - stopLossDistance // Below support (correct!)
          : level.price + stopLossDistance; // Above resistance (correct!)

      // New R/R-based TP calculation
      if (this.config.rrRatio && this.config.rrRatio > 0) {
        const takeProfitDistance = stopLossDistance * this.config.rrRatio;
        const tpPrice =
          direction === SignalDirection.LONG
            ? price + takeProfitDistance
            : price - takeProfitDistance;

        takeProfits = [{
          level: 1,
          price: tpPrice,
          sizePercent: 100, // Close 100% at the single R/R-based TP
          percent: (takeProfitDistance / price) * 100, // Store the calculated percentage
          hit: false,
        }];
        this.logger.info(`✨ ${this.name} using R/R-based Take Profit`, {
          rrRatio: this.config.rrRatio,
          stopLossDistance: stopLossDistance.toFixed(4),
          takeProfitDistance: takeProfitDistance.toFixed(4),
          tpPrice: tpPrice.toFixed(DECIMAL_PLACES.PRICE),
        });
      } else {
        // Legacy percentage-based TP calculation
        takeProfits = (this.config.takeProfits || []).map(tp => ({
          level: tp.level,
          percent: tp.percent,
          sizePercent: tp.sizePercent,
          price:
            direction === SignalDirection.LONG
              ? price * (1 + tp.percent / PERCENT_MULTIPLIER)
              : price * (1 - tp.percent / PERCENT_MULTIPLIER),
          hit: false,
        }));
      }
    }

    // ========================================================================
    // MTF TP VALIDATION - Scale TP based on HTF confirmation
    // ========================================================================
    let mtfValidation: MTFTPValidationResult | null = null;
    if (this.mtfTPValidator && takeProfits.length > 0) {
      const tp1 = takeProfits[0];
      mtfValidation = this.mtfTPValidator.validateTP(
        tp1.price,
        price,
        direction,
        data.candlesTrend1,  // 15m candles
        data.candlesTrend2,  // 30m candles
        data.emaContext,     // 1h EMA
        data.timestamp,
      );

      // Apply scaling to all TP levels
      if (mtfValidation.scalingFactor !== 1.0) {
        for (const tp of takeProfits) {
          const originalPercent = tp.percent;
          tp.percent = this.mtfTPValidator.applyScaling(tp.percent, mtfValidation.scalingFactor);
          tp.price =
            direction === SignalDirection.LONG
              ? price * (1 + tp.percent / PERCENT_MULTIPLIER)
              : price * (1 - tp.percent / PERCENT_MULTIPLIER);

          this.logger.debug(`📊 MTF TP Scaling applied`, {
            level: tp.level,
            original: originalPercent.toFixed(2) + '%',
            scaled: tp.percent.toFixed(2) + '%',
            factor: mtfValidation.scalingFactor.toFixed(2),
          });
        }
      }

      // Log MTF validation summary
      if (mtfValidation.htfTPAligned || mtfValidation.trend2TPAligned) {
        this.logger.info(`✅ ${this.name} MTF TP Confirmed`, {
          htf: mtfValidation.htfTPAligned ? 'YES' : 'NO',
          trend2: mtfValidation.trend2TPAligned ? 'YES' : 'NO',
          context: mtfValidation.contextTrend,
          scale: mtfValidation.scalingFactor.toFixed(2),
          recommendation: mtfValidation.recommendation,
        });
      }
    }

    // ========================================================================
    // WHALE WALL TP/SL ADJUSTMENT - Adjust TP/SL based on orderbook walls
    // ========================================================================
    if (this.whaleWallTPService && orderbookAnalysis && orderbookAnalysis.walls.length > 0 && takeProfits.length > 0) {
      const whaleWallResult = this.whaleWallTPService.adjustTPSL(
        orderbookAnalysis.walls,
        price,
        direction,
        takeProfits[0].price,
        stopLoss,
      );

      // Apply TP adjustment
      if (whaleWallResult.tpAdjusted && whaleWallResult.adjustedTPPrice) {
        takeProfits = this.whaleWallTPService.applyTPAdjustment(
          takeProfits,
          whaleWallResult,
          price,
          direction,
        );
        this.logger.info(`🐋 ${this.name} Whale Wall TP adjusted`, {
          original: whaleWallResult.originalTPPrice?.toFixed(DECIMAL_PLACES.PRICE),
          adjusted: whaleWallResult.adjustedTPPrice.toFixed(DECIMAL_PLACES.PRICE),
          reason: whaleWallResult.tpReason,
        });
      }

      // Apply SL adjustment
      if (whaleWallResult.slAdjusted && whaleWallResult.adjustedSLPrice) {
        stopLoss = whaleWallResult.adjustedSLPrice;
        this.logger.info(`🐋 ${this.name} Whale Wall SL adjusted`, {
          original: whaleWallResult.originalSLPrice?.toFixed(DECIMAL_PLACES.PRICE),
          adjusted: whaleWallResult.adjustedSLPrice.toFixed(DECIMAL_PLACES.PRICE),
          reason: whaleWallResult.slReason,
        });
      }
    }

    // Calculate metrics for journal
    const distanceToLevel = Math.abs((price - level.price) / price) * PERCENT_MULTIPLIER;
    const distanceToEma = Math.abs((price - data.ema.slow) / price) * PERCENT_MULTIPLIER;
    const volumeAnalysis = this.volumeCalculator.calculate(data.candles);

    return {
      direction,
      type: SignalType.LEVEL_BASED,
      confidence,
      price,
      stopLoss,
      takeProfits,
      reason,
      timestamp: data.timestamp,
      marketData: {
        rsi: data.rsi,
        rsiTrend1: data.rsiTrend1,
        ema20: data.ema.fast,
        ema50: data.ema.slow,
        atr: data.atr || 1.0,
        volumeRatio: volumeAnalysis.volumeRatio,
        swingHighsCount: data.swingPoints.filter(s => s.type === 'HIGH').length,
        swingLowsCount: data.swingPoints.filter(s => s.type === 'LOW').length,
        trend: data.trend,
        nearestLevel: level.price,
        distanceToLevel,
        distanceToEma,
        stochastic: data.stochastic,
        bollingerBands: data.bollingerBands,
        breakoutPrediction: data.breakoutPrediction,
      },
    };
  }

  /**
   * Check candle pattern confirmation for entry
   * Unified logic for both LONG and SHORT entries
   */
  private checkCandleConfirmation(
    candle: Candle,
    direction: SignalDirection,
    config: NonNullable<LevelBasedConfig['entryConfirmation']>,
  ): { isValid: boolean; reason: string; details: Record<string, unknown> } {
    const candleRange = candle.high - candle.low || 1;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const bodySize = Math.abs(candle.close - candle.open);

    const upperWickRatio = upperWick / candleRange;
    const lowerWickRatio = lowerWick / candleRange;
    const bodyRatio = bodySize / candleRange;

    const isGreen = candle.close >= candle.open;
    const isRed = candle.close <= candle.open;

    // Configurable thresholds with defaults
    const hammerThreshold = config.hammerWickRatio ?? 0.6;
    const shootingStarThreshold = config.shootingStarWickRatio ?? 0.6;
    const extremeWickThreshold = 0.1; // Opposite wick must be small

    if (direction === SignalDirection.LONG) {
      const wickRatioMax = config.longWickRatioMax ?? 0.4;
      const isHammer = lowerWickRatio > hammerThreshold && upperWickRatio < extremeWickThreshold;
      const isValidBullish = isGreen && upperWickRatio < wickRatioMax;

      return {
        isValid: isValidBullish || isHammer,
        reason: isValidBullish ? 'Bullish candle confirmed' : isHammer ? 'Hammer pattern detected' : 'No bullish confirmation',
        details: {
          isGreen,
          isHammer,
          upperWickRatio: upperWickRatio.toFixed(3),
          lowerWickRatio: lowerWickRatio.toFixed(3),
          bodyRatio: bodyRatio.toFixed(3),
          wickRatioMax,
        },
      };
    } else {
      const wickRatioMax = config.shortWickRatioMax ?? 0.4;
      const isShootingStar = upperWickRatio > shootingStarThreshold && lowerWickRatio < extremeWickThreshold;
      const isValidBearish = isRed && lowerWickRatio < wickRatioMax;

      return {
        isValid: isValidBearish || isShootingStar,
        reason: isValidBearish ? 'Bearish candle confirmed' : isShootingStar ? 'Shooting star detected' : 'No bearish confirmation',
        details: {
          isRed,
          isShootingStar,
          upperWickRatio: upperWickRatio.toFixed(3),
          lowerWickRatio: lowerWickRatio.toFixed(3),
          bodyRatio: bodyRatio.toFixed(3),
          wickRatioMax,
        },
      };
    }
  }

  /**
   * Update volatility regime params based on current ATR
   * Called at the start of evaluate() to auto-adjust strategy parameters
   */
  private updateVolatilityRegime(atrPercent: number): void {
    if (!this.volatilityRegimeService) {
      this.currentRegimeParams = null;
      return;
    }

    const analysis = this.volatilityRegimeService.analyze(atrPercent);
    this.currentRegimeParams = analysis.params;

    this.logger.debug('📊 Volatility Regime Updated', {
      regime: analysis.regime,
      atrPercent: atrPercent.toFixed(3),
      params: {
        maxDistancePercent: analysis.params.maxDistancePercent,
        minTouchesRequired: analysis.params.minTouchesRequired,
        clusterThresholdPercent: analysis.params.clusterThresholdPercent,
        minConfidenceThreshold: analysis.params.minConfidenceThreshold,
      },
    });
  }

  /**
   * Get effective maxDistancePercent (regime-aware)
   */
  private getEffectiveMaxDistance(): number {
    if (this.currentRegimeParams) {
      return this.currentRegimeParams.maxDistancePercent;
    }
    return this.config.maxDistancePercent;
  }

  /**
   * Get effective minTouchesRequired (regime-aware)
   */
  private getEffectiveMinTouches(direction: 'LONG' | 'SHORT'): number {
    if (this.currentRegimeParams) {
      return this.currentRegimeParams.minTouchesRequired;
    }
    return direction === 'LONG'
      ? this.config.minTouchesRequiredLong ?? this.config.minTouchesRequired
      : this.config.minTouchesRequiredShort ?? this.config.minTouchesRequired;
  }

  /**
   * Get effective minConfidenceThreshold (regime-aware)
   */
  private getEffectiveMinConfidence(): number {
    if (this.currentRegimeParams) {
      return this.currentRegimeParams.minConfidenceThreshold;
    }
    return this.config.minConfidenceThreshold ?? CONFIDENCE_THRESHOLDS.LOW;
  }

  /**
   * Get effective clusterThresholdPercent (regime-aware)
   */
  private getEffectiveClusterThreshold(): number {
    if (this.currentRegimeParams) {
      return this.currentRegimeParams.clusterThresholdPercent;
    }
    return this.config.levelClustering?.clusterThresholdPercent ?? 0.3;
  }

  /**
   * Get current volatility regime (for logging/debugging)
   */
  getCurrentVolatilityRegime(): VolatilityRegime | null {
    if (!this.volatilityRegimeService) {
      return null;
    }
    return this.volatilityRegimeService.getCurrentRegime();
  }

  // ============================================================================
  // PHASE 3: MULTI-TIMEFRAME LEVEL CONFIRMATION
  // ============================================================================

  /**
   * Check if the current level aligns with a HTF (15m) level
   * Returns confidence boost if aligned, 0 otherwise
   */
  private checkHTFLevelConfirmation(
    level: Level,
    htfCandles: Candle[] | undefined,
    direction: SignalDirection,
    timestamp: number,
  ): { isConfirmed: boolean; confidenceBoost: number; htfLevel?: Level } {
    const mtfConfig = this.config.multiTimeframeConfirmation;

    // Not enabled or no HTF candles
    if (!mtfConfig?.enabled || !mtfConfig.htfLevelConfirmation?.enabled || !htfCandles || htfCandles.length < 20) {
      return { isConfirmed: false, confidenceBoost: 0 };
    }

    const alignmentThreshold = mtfConfig.htfLevelConfirmation.alignmentThresholdPercent ?? 0.3;
    const boostPercent = mtfConfig.htfLevelConfirmation.confidenceBoostPercent ?? 15;

    // Build HTF levels using a fresh ZigZag instance
    const htfZigzag = new ZigZagNRIndicator(INTEGER_MULTIPLIERS.TWO as number);
    const { swingHighs, swingLows } = htfZigzag.findSwingPoints(htfCandles);

    if (swingHighs.length < 2 || swingLows.length < 2) {
      this.logger.debug('📊 MTF: Not enough HTF swing points for level building');
      return { isConfirmed: false, confidenceBoost: 0 };
    }

    // Use LevelAnalyzer to build HTF levels with clustering
    const htfSwingPoints = [...swingHighs, ...swingLows];
    const htfLevels = this.levelAnalyzer.getAllLevels(htfSwingPoints, htfCandles, timestamp);

    // Select the relevant HTF levels based on direction
    const relevantHtfLevels = direction === SignalDirection.LONG
      ? htfLevels.support
      : htfLevels.resistance;

    // Check if current level aligns with any HTF level
    for (const htfLevel of relevantHtfLevels) {
      const distancePercent = Math.abs((level.price - htfLevel.price) / level.price) * PERCENT_MULTIPLIER;

      if (distancePercent <= alignmentThreshold) {
        this.logger.info('✅ MTF Level Confirmed!', {
          entryLevel: level.price.toFixed(DECIMAL_PLACES.PRICE),
          htfLevel: htfLevel.price.toFixed(DECIMAL_PLACES.PRICE),
          distance: distancePercent.toFixed(2) + '%',
          htfTouches: htfLevel.touches,
          confidenceBoost: '+' + boostPercent + '%',
        });

        return {
          isConfirmed: true,
          confidenceBoost: boostPercent / PERCENT_MULTIPLIER, // Convert to 0-1 scale
          htfLevel,
        };
      }
    }

    this.logger.debug('📊 MTF: No HTF level alignment found', {
      entryLevel: level.price.toFixed(DECIMAL_PLACES.PRICE),
      htfLevelsChecked: relevantHtfLevels.length,
      alignmentThreshold: alignmentThreshold + '%',
    });

    return { isConfirmed: false, confidenceBoost: 0 };
  }

  /**
   * Check if the current level aligns with a TREND2 (30m) level
   * Returns confidence boost if aligned, 0 otherwise
   */
  private checkTrend2LevelConfirmation(
    level: Level,
    trend2Candles: Candle[] | undefined,
    direction: SignalDirection,
    timestamp: number,
  ): { isConfirmed: boolean; confidenceBoost: number; trend2Level?: Level } {
    const mtfConfig = this.config.multiTimeframeConfirmation;

    // Not enabled or no TREND2 candles
    if (!mtfConfig?.enabled || !mtfConfig.trend2LevelConfirmation?.enabled || !trend2Candles || trend2Candles.length < 20) {
      return { isConfirmed: false, confidenceBoost: 0 };
    }

    const alignmentThreshold = mtfConfig.trend2LevelConfirmation.alignmentThresholdPercent ?? 0.4;
    const boostPercent = mtfConfig.trend2LevelConfirmation.confidenceBoostPercent ?? 10;

    // Build TREND2 levels using a fresh ZigZag instance
    const trend2Zigzag = new ZigZagNRIndicator(INTEGER_MULTIPLIERS.TWO as number);
    const { swingHighs, swingLows } = trend2Zigzag.findSwingPoints(trend2Candles);

    if (swingHighs.length < 2 || swingLows.length < 2) {
      this.logger.debug('📊 TREND2: Not enough 30m swing points for level building');
      return { isConfirmed: false, confidenceBoost: 0 };
    }

    // Use LevelAnalyzer to build TREND2 levels with clustering
    const trend2SwingPoints = [...swingHighs, ...swingLows];
    const trend2Levels = this.levelAnalyzer.getAllLevels(trend2SwingPoints, trend2Candles, timestamp);

    // Select the relevant TREND2 levels based on direction
    const relevantTrend2Levels = direction === SignalDirection.LONG
      ? trend2Levels.support
      : trend2Levels.resistance;

    // Check if current level aligns with any TREND2 level
    for (const trend2Level of relevantTrend2Levels) {
      const distancePercent = Math.abs((level.price - trend2Level.price) / level.price) * PERCENT_MULTIPLIER;

      if (distancePercent <= alignmentThreshold) {
        this.logger.info('✅ TREND2 (30m) Level Confirmed!', {
          entryLevel: level.price.toFixed(DECIMAL_PLACES.PRICE),
          trend2Level: trend2Level.price.toFixed(DECIMAL_PLACES.PRICE),
          distance: distancePercent.toFixed(2) + '%',
          trend2Touches: trend2Level.touches,
          confidenceBoost: '+' + boostPercent + '%',
        });

        return {
          isConfirmed: true,
          confidenceBoost: boostPercent / PERCENT_MULTIPLIER, // Convert to 0-1 scale
          trend2Level,
        };
      }
    }

    this.logger.debug('📊 TREND2: No 30m level alignment found', {
      entryLevel: level.price.toFixed(DECIMAL_PLACES.PRICE),
      trend2LevelsChecked: relevantTrend2Levels.length,
      alignmentThreshold: alignmentThreshold + '%',
    });

    return { isConfirmed: false, confidenceBoost: 0 };
  }

  /**
   * Check if 1h trend is opposite to signal direction
   * Returns blocking reason if opposite, null if OK
   */
  private checkContextTrendFilter(
    direction: SignalDirection,
    emaContext: { fast: number; slow: number } | undefined,
  ): { blocked: boolean; reason?: string } {
    const mtfConfig = this.config.multiTimeframeConfirmation;

    // Not enabled or no context EMA
    if (!mtfConfig?.enabled || !mtfConfig.contextTrendFilter?.enabled || !emaContext) {
      return { blocked: false };
    }

    const minGap = mtfConfig.contextTrendFilter.minEmaGapPercent ?? 0.5;

    // Calculate 1h EMA gap
    const emaGapPercent = Math.abs((emaContext.fast - emaContext.slow) / emaContext.slow) * PERCENT_MULTIPLIER;

    // Determine 1h trend
    let contextTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (emaGapPercent >= minGap) {
      contextTrend = emaContext.fast > emaContext.slow ? 'BULLISH' : 'BEARISH';
    }

    // Check if opposite
    const isLongAgainstDowntrend = direction === SignalDirection.LONG && contextTrend === 'BEARISH';
    const isShortAgainstUptrend = direction === SignalDirection.SHORT && contextTrend === 'BULLISH';

    if (isLongAgainstDowntrend || isShortAgainstUptrend) {
      const reason = `1h trend ${contextTrend} blocks ${direction}`;
      this.logger.info('🚫 MTF Context Trend Filter BLOCKED', {
        direction,
        contextTrend,
        emaGap: emaGapPercent.toFixed(2) + '%',
        emaFast1h: emaContext.fast.toFixed(DECIMAL_PLACES.PRICE),
        emaSlow1h: emaContext.slow.toFixed(DECIMAL_PLACES.PRICE),
      });
      return { blocked: true, reason };
    }

    this.logger.debug('📊 MTF Context Trend OK', {
      direction,
      contextTrend,
      emaGap: emaGapPercent.toFixed(2) + '%',
    });

    return { blocked: false };
  }

  /**
   * Analyze candles for sweep events (liquidity grabs)
   * Returns confidence boost if a sweep aligned with position direction is detected
   */
  private analyzeSweep(
    candles: Candle[],
    direction: SignalDirection,
    levels: { support: Level[]; resistance: Level[] },
  ): SweepAnalysis {
    if (!this.sweepDetector) {
      return {
        hasSweep: false,
        sweep: null,
        recentSweeps: [],
        suggestedSL: null,
        confidenceBoost: 0,
      };
    }

    // Extract level prices
    const supportPrices = levels.support.map(l => l.price);
    const resistancePrices = levels.resistance.map(l => l.price);

    // Determine the direction string for sweep detector
    const directionStr = direction === SignalDirection.LONG ? 'LONG' : 'SHORT';

    return this.sweepDetector.analyze(candles, supportPrices, resistancePrices, directionStr);
  }

  /**
   * Return no signal result
   */
  private noSignal(reason: string): StrategySignal {
    return {
      valid: false,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }
}
