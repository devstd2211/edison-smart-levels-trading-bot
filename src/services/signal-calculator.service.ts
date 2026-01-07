import { DECIMAL_PLACES, FIXED_EXIT_PERCENTAGES, PERCENT_MULTIPLIER } from '../constants';
import {
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  THRESHOLD_VALUES,
  MATH_BOUNDS,
} from '../constants/technical.constants';
/**
 * Signal Calculator Service
 *
 * Calculates signal prices:
 * - Entry price (current market price)
 * - Stop Loss (based on risk management config)
 * - Take Profits (multiple levels from config)
 *
 * Pure calculation logic - no external dependencies except config.
 * Extracted from SignalGeneratorService for better testability.
 */

import {
  Signal,
  SignalType,
  SignalDirection,
  Config,
  LoggerService,
  StrategyEvaluation,
  Candle,
  TradingContext,
  FlatMarketConfig,
  SwingPoint,
  BTCAnalysis,
  FlatMarketDetector,
} from '../types';
import { SessionDetector } from '../utils/session-detector';
import { StructureAwareExitService } from './structure-aware-exit.service';

// ============================================================================
// SIGNAL CALCULATOR SERVICE
// ============================================================================

export class SignalCalculator {
  private flatMarketDetector?: FlatMarketDetector;
  private structureAwareExitService?: StructureAwareExitService;

  constructor(
    private config: Config,
    private logger: LoggerService,
    flatMarketConfig?: FlatMarketConfig,
  ) {
    // Initialize FlatMarketDetector if config provided
    if (flatMarketConfig?.enabled) {
      this.flatMarketDetector = new FlatMarketDetector(flatMarketConfig, logger);
      this.logger.info('✅ FlatMarketDetector initialized', {
        threshold: flatMarketConfig.flatThreshold,
        factors: 6,
      });
    }

    // Initialize StructureAwareExitService if enabled
    if (config.structureAwareExit?.enabled) {
      this.structureAwareExitService = new StructureAwareExitService(config.structureAwareExit, logger);
      this.logger.info('✅ StructureAwareExitService initialized for dynamic TP2');
    }
  }

  /**
   * Create Signal object from strategy evaluation
   *
   * @param evaluation - Strategy evaluation result
   * @param currentPrice - Current market price
   * @param btcAnalysis - Optional BTC analysis data
   * @param marketBias - Market bias (BULLISH/BEARISH/NEUTRAL) for flat detection (legacy)
   * @param candles - Optional candles array for advanced flat detection
   * @param context - Optional trading context for advanced flat detection
   * @param ema20 - Optional EMA20 value for advanced flat detection
   * @param ema50 - Optional EMA50 value for advanced flat detection
   * @param bollingerBands - Optional Bollinger Bands data for dynamic SL/TP
   * @param atr - Optional ATR value for BB-based SL calculation
   * @param swingPoints - Optional swing points for dynamic TP2 from structure
   * @param liquidityZones - Optional liquidity zones for dynamic TP2 from structure
   * @param volumeProfile - Optional volume profile for dynamic TP2 from structure
   * @returns Complete Signal object
   */
  createSignal(
    evaluation: StrategyEvaluation,
    currentPrice: number,
    btcAnalysis?: BTCAnalysis,
    marketBias?: string,
    candles?: Candle[],
    context?: TradingContext,
    ema20?: number,
    ema50?: number,
    bollingerBands?: {
      upper: number;
      middle: number;
      lower: number;
      width: number;
      percentB: number;
      isSqueeze: boolean;
    },
    atr?: number,
    swingPoints?: SwingPoint[],
    liquidityZones?: any[],
    volumeProfile?: any,
  ): Signal {
    const direction = evaluation.direction;

    // Calculate Stop Loss (with BB support)
    const stopLoss = this.calculateStopLoss(direction, currentPrice, bollingerBands, atr);

    // Calculate Take Profits
    // In FLAT market: use single TP to capture quick profit
    let isFlat = false;
    let flatConfidence = 0;

    // Try advanced flat detection if FlatMarketDetector is available
    if (this.flatMarketDetector && candles && context && ema20 !== undefined && ema50 !== undefined) {
      const flatResult = this.flatMarketDetector.detect(candles, context, ema20, ema50);
      isFlat = flatResult.isFlat;
      flatConfidence = flatResult.confidence;

      this.logger.info(
        isFlat ? '⚡ FLAT market detected (multi-factor)' : '📈 TRENDING market (multi-factor)',
        {
          confidence: flatConfidence.toFixed(1) + '%',
          isFlat,
          factors: flatResult.explanation,
        },
      );
    } else {
      // Fallback to legacy simple check
      isFlat = marketBias === 'NEUTRAL';
      if (isFlat) {
        this.logger.info('⚡ FLAT market detected (legacy: marketBias=NEUTRAL)');
      }
    }

    const takeProfits = this.calculateTakeProfits(
      direction,
      currentPrice,
      isFlat,
      bollingerBands,
      evaluation.confidence,
      swingPoints,
      liquidityZones,
      volumeProfile,
    );

    // Create signal
    const signal: Signal = {
      type: SignalType.TREND_FOLLOWING,
      direction,
      price: currentPrice,
      stopLoss,
      takeProfits,
      confidence: evaluation.confidence ? Math.round(evaluation.confidence * PERCENT_MULTIPLIER) : (MATH_BOUNDS.MAX_PERCENTAGE as number),
      reason: evaluation.reason,
      timestamp: Date.now(),
    };

    // Add BTC data if available (entire BTCAnalysis object for complete ML analysis)
    if (btcAnalysis) {
      signal.btcData = btcAnalysis; // Store complete BTCAnalysis object
    }

    return signal;
  }

  /**
   * Calculate stop loss price
   *
   * BB.MD DYNAMIC SL:
   * If Bollinger Bands available: SL = bb.lower - (atr × 0.5) for LONG
   *                                SL = bb.upper + (atr × 0.5) for SHORT
   * This places SL beyond volatility band to avoid noise stop-outs.
   *
   * Fallback: fixed percentage from config
   *
   * @param direction - Signal direction (LONG/SHORT)
   * @param currentPrice - Current market price
   * @param bollingerBands - Optional BB data for dynamic SL
   * @param atr - Optional ATR value for BB-based SL
   * @returns Stop loss price
   */
  calculateStopLoss(
    direction: SignalDirection,
    currentPrice: number,
    bollingerBands?: {
      upper: number;
      middle: number;
      lower: number;
      width: number;
      percentB: number;
      isSqueeze: boolean;
    },
    atr?: number,
    swingPoints?: SwingPoint[],
    liquidityZones?: Array<{ price: number; type: 'BUY_SIDE' | 'SELL_SIDE'; timestamp: number }>,
    levels?: Array<{ price: number; strength: number; touches: number }>,
  ): number {
    const isLong = direction === SignalDirection.LONG;

    // Priority 1: BB.MD - BB-based dynamic SL (if available)
    if (
      bollingerBands &&
      atr !== undefined &&
      this.config.indicators.bollingerBands?.enabled
    ) {
      const atrBuffer = atr * (RATIO_MULTIPLIERS.HALF as number);
      let bbStopLoss: number;

      if (isLong) {
        // LONG: SL below lower band
        bbStopLoss = bollingerBands.lower - atrBuffer;
      } else {
        // SHORT: SL above upper band
        bbStopLoss = bollingerBands.upper + atrBuffer;
      }

      // Ensure SL is reasonable (max 5% from entry per BB.MD)
      const maxStopLoss = isLong
        ? currentPrice * (RATIO_MULTIPLIERS.FULL - THRESHOLD_VALUES.FIVE_PERCENT) // LONG: max 5% below entry (0.95)
        : currentPrice * (RATIO_MULTIPLIERS.FULL + THRESHOLD_VALUES.FIVE_PERCENT); // SHORT: max 5% above entry (1.05)

      const finalStopLoss = isLong
        ? Math.max(bbStopLoss, maxStopLoss) // LONG: pick higher (closer to entry)
        : Math.min(bbStopLoss, maxStopLoss); // SHORT: pick lower (closer to entry)

      this.logger.info('🎯 BB-based Dynamic SL', {
        direction,
        currentPrice,
        bbBand: isLong ? bollingerBands.lower : bollingerBands.upper,
        atrBuffer: atrBuffer.toFixed(DECIMAL_PLACES.PRICE),
        bbStopLoss: bbStopLoss.toFixed(DECIMAL_PLACES.PRICE),
        maxStopLoss: maxStopLoss.toFixed(DECIMAL_PLACES.PRICE),
        finalStopLoss: finalStopLoss.toFixed(DECIMAL_PLACES.PRICE),
        distance: (Math.abs((finalStopLoss - currentPrice) / currentPrice) * PERCENT_MULTIPLIER).toFixed(DECIMAL_PLACES.PERCENT) + '%',
      });

      return finalStopLoss;
    }

    // Priority 2: Percentage-based SL (fallback)
    let stopLossPercent = this.config.riskManagement.stopLossPercent;

    // Apply session-based SL widening if enabled
    if (this.config.sessionBasedSL?.enabled) {
      const currentSession = SessionDetector.getCurrentSession();
      const sessionMultiplier = this.getSessionMultiplier(currentSession);

      if (sessionMultiplier > 1.0) {
        stopLossPercent *= sessionMultiplier;

        this.logger.debug('📍 Session-based SL widening applied', {
          session: currentSession,
          multiplier: sessionMultiplier,
          baseSL: this.config.riskManagement.stopLossPercent + '%',
          adjustedSL: stopLossPercent.toFixed(DECIMAL_PLACES.PERCENT) + '%',
        });
      }
    }

    const stopLoss = isLong
      ? currentPrice * (1 - stopLossPercent / PERCENT_MULTIPLIER)
      : currentPrice * (1 + stopLossPercent / PERCENT_MULTIPLIER);

    this.logger.debug('Stop Loss calculated (percentage-based)', {
      direction,
      currentPrice,
      stopLossPercent,
      stopLoss,
    });

    return stopLoss;
  }

  /**
   * Get session-based SL multiplier
   *
   * @param session - Current trading session
   * @returns SL multiplier for the session
   */
  private getSessionMultiplier(session: string): number {
    const config = this.config.sessionBasedSL;
    if (!config) {
      return 1.0;
    }

    switch (session) {
    case 'OVERLAP':
      return config.overlapMultiplier;
    case 'LONDON':
      return config.londonMultiplier;
    case 'NY':
      return config.nyMultiplier;
    case 'ASIAN':
      return config.asianMultiplier;
    default:
      return 1.0;
    }
  }

  /**
   * Calculate take profit levels
   *
   * BB.MD DYNAMIC TP:
   * If BB available and signal strong:
   *  - Strength >= 80%: Target bb.upper (aggressive)
   *  - Strength >= 65%: Target bb.middle (moderate)
   *  - Strength < 65%: Conservative target (60% to middle)
   *
   * FLAT MARKET OPTIMIZATION:
   * In neutral/flat markets, use single TP to capture quick profit
   * and exit before reversal. Better to take TP1 and breakeven stop
   * than wait for TP2/TP3 that may never hit.
   *
   * @param direction - Signal direction (LONG/SHORT)
   * @param currentPrice - Current market price
   * @param isFlat - Is market in flat/neutral bias
   * @param bollingerBands - Optional BB data for dynamic TP
   * @param signalConfidence - Optional signal confidence (0-1)
   * @returns Array of take profit objects
   */
  calculateTakeProfits(
    direction: SignalDirection,
    currentPrice: number,
    isFlat: boolean = false,
    bollingerBands?: {
      upper: number;
      middle: number;
      lower: number;
      width: number;
      percentB: number;
      isSqueeze: boolean;
    },
    signalConfidence?: number,
    swingPoints?: SwingPoint[],
    liquidityZones?: any[],
    volumeProfile?: any,
  ): Array<{
    level: number;
    price: number;
    sizePercent: number;
    percent: number;
    hit: boolean;
  }> {
    const isLong = direction === SignalDirection.LONG;
    const tpConfig = this.config.riskManagement.takeProfits;

    // BB.MD: BB-based dynamic TP (if available and signal strong enough)
    if (
      bollingerBands &&
      signalConfidence !== undefined &&
      signalConfidence >= (THRESHOLD_VALUES.SIXTY_PERCENT + THRESHOLD_VALUES.FIVE_PERCENT) && // 0.65 (65%)
      this.config.indicators.bollingerBands?.enabled
    ) {
      const confidencePercent = signalConfidence * PERCENT_MULTIPLIER;
      let dynamicTP: number;

      if (confidencePercent >= (INTEGER_MULTIPLIERS.EIGHTY as number)) {
        // Very strong signal: target upper/lower band
        dynamicTP = isLong ? bollingerBands.upper : bollingerBands.lower;
        this.logger.info('🎯 BB Dynamic TP: AGGRESSIVE (target band)', {
          confidence: confidencePercent.toFixed(1) + '%',
          target: dynamicTP.toFixed(DECIMAL_PLACES.PRICE),
        });
      } else if (confidencePercent >= (INTEGER_MULTIPLIERS.SIXTY + INTEGER_MULTIPLIERS.FIVE as number)) { // 65
        // Medium signal: target middle band
        dynamicTP = bollingerBands.middle;
        this.logger.info('🎯 BB Dynamic TP: MODERATE (target middle)', {
          confidence: confidencePercent.toFixed(1) + '%',
          target: dynamicTP.toFixed(DECIMAL_PLACES.PRICE),
        });
      } else {
        // Should not reach here (confidence < 65)
        dynamicTP = currentPrice;
      }

      // Calculate TP distance
      const tpDistance = Math.abs((dynamicTP - currentPrice) / currentPrice) * PERCENT_MULTIPLIER;

      // Create TPs: TP1 at BB target, TP2/TP3 scaled from config
      const takeProfits = tpConfig.map((tp, index) => {
        let tpPrice: number;

        if (index === 0) {
          // TP1: Use BB-based target
          tpPrice = dynamicTP;
        } else {
          // TP2/TP3: Scale from config percentages
          tpPrice = isLong
            ? currentPrice * (1 + tp.percent / PERCENT_MULTIPLIER)
            : currentPrice * (1 - tp.percent / PERCENT_MULTIPLIER);
        }

        return {
          level: tp.level,
          price: tpPrice,
          sizePercent: tp.sizePercent,
          percent: index === 0 ? tpDistance : tp.percent,
          hit: false,
        };
      });

      return takeProfits;
    }

    // FLAT MARKET: Single TP at TP1 price, close 100% position
    if (isFlat) {
      const firstTP = tpConfig[0];
      const takeProfits = [
        {
          level: 1,
          price: isLong
            ? currentPrice * (1 + firstTP.percent / PERCENT_MULTIPLIER)
            : currentPrice * (1 - firstTP.percent / PERCENT_MULTIPLIER),
          sizePercent: FIXED_EXIT_PERCENTAGES.FULL, // Close 100% on TP1 in flat
          percent: firstTP.percent,
          hit: false,
        },
      ];

      this.logger.info('⚡ FLAT market detected - using single TP for quick profit', {
        direction,
        currentPrice,
        tpPrice: takeProfits[0].price.toFixed(DECIMAL_PLACES.PRICE),
        tpPercent: firstTP.percent,
      });

      return takeProfits;
    }

    // TRENDING MARKET: Multiple TPs as configured
    const takeProfits = tpConfig.map((tp) => ({
      level: tp.level,
      price: isLong
        ? currentPrice * (1 + tp.percent / PERCENT_MULTIPLIER)
        : currentPrice * (1 - tp.percent / PERCENT_MULTIPLIER),
      sizePercent: tp.sizePercent,
      percent: tp.percent,
      hit: false,
    }));

    // DYNAMIC TP2: Replace TP2 with structure-aware price
    if (this.structureAwareExitService && swingPoints && takeProfits.length >= 2) {
      const structureLevel = this.structureAwareExitService.detectNearestResistance(
        currentPrice,
        direction,
        swingPoints,
        liquidityZones || [],
        volumeProfile || null,
      );

      if (structureLevel) {
        const dynamicTP2 = this.structureAwareExitService.calculateDynamicTP2(
          currentPrice,
          direction,
          structureLevel,
        );

        // Update TP2 (level 2)
        const tp2Index = takeProfits.findIndex((tp) => tp.level === 2);
        if (tp2Index !== -1) {
          takeProfits[tp2Index].price = dynamicTP2.price;
          takeProfits[tp2Index].percent = dynamicTP2.percent;

          this.logger.info('✅ TP2 updated with structure-aware price', {
            configTP2Percent: tpConfig[tp2Index].percent,
            dynamicTP2Percent: dynamicTP2.percent.toFixed(2) + '%',
            structureType: dynamicTP2.structureType,
            structurePrice: dynamicTP2.structureLevel.toFixed(DECIMAL_PLACES.PRICE),
            finalTP2Price: dynamicTP2.price.toFixed(DECIMAL_PLACES.PRICE),
          });
        }
      }
    }

    this.logger.debug('Take Profits calculated', {
      direction,
      currentPrice,
      levels: takeProfits.length,
      takeProfits: takeProfits.map((tp) => `TP${tp.level}: ${tp.price.toFixed(DECIMAL_PLACES.PRICE)}`),
    });

    return takeProfits;
  }
}
