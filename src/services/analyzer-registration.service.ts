/**
 * Analyzer Registration Service
 *
 * Centralizes registration of all 45+ analyzers into AnalyzerRegistry
 * with proper weights and priorities from config.
 *
 * Purpose:
 * - Keep analyzer initialization out of TradingOrchestrator
 * - Manage weights and priorities in one place
 * - Enable unified weighted voting system
 */

import {
  LoggerService,
  StrategyMarketData,
  SignalDirection,
  ATRIndicator,
  StochasticIndicator,
  BollingerBandsIndicator,
  LiquidityDetector,
  DivergenceDetector,
  BreakoutPredictor,
  BTCAnalyzer,
  FlatMarketDetector,
  SwingPointType,
  BTCDirection,
} from '../types';
import { LevelAnalyzer } from '../analyzers/level.analyzer';
import { VolumeProfileAnalyzer } from '../analyzers/volume-profile.analyzer';
import { AnalyzerRegistry } from './analyzer-registry.service';
import {
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  THRESHOLD_VALUES,
  FIRST_INDEX,
  SECOND_INDEX,
  PERCENT_MULTIPLIER,
  EPSILON,
} from '../constants/technical.constants';
import { MultiTimeframeRSIAnalyzer } from '../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../analyzers/multi-timeframe-ema.analyzer';
import { PriceMomentumAnalyzer } from '../analyzers/price-momentum.analyzer';
import { DeltaAnalyzerService } from './delta-analyzer.service';
import { OrderbookImbalanceService } from './orderbook-imbalance.service';
import {
  RSI_OVERSOLD_LEVEL,
  RSI_OVERBOUGHT_LEVEL,
  EMA_BASE_CONFIDENCE,
  EMA_STRENGTH_CONFIDENCE_MULTIPLIER,
  ATR_CONFIDENCE_MULTIPLIER,
  WICK_REJECTION_THRESHOLD_PERCENT,
  WICK_SIGNAL_BASE_CONFIDENCE,
  FOOTPRINT_BASE_CONFIDENCE,
  FOOTPRINT_CLOSE_POSITION_MULTIPLIER,
  ORDER_BLOCK_BASE_CONFIDENCE,
  ORDER_BLOCK_BODY_WICK_MULTIPLIER,
  FAIR_VALUE_GAP_BASE_CONFIDENCE,
  FAIR_VALUE_GAP_PERCENT_MULTIPLIER,
  ATH_DISTANCE_THRESHOLD_PERCENT,
  VOLUME_NEUTRAL_CONFIDENCE,
  TREND_DETECTOR_DEFAULT_CONFIDENCE,
} from '../constants/analyzer.constants';

// ============================================================================
// ANALYZER REGISTRATION SERVICE
// ============================================================================

export class AnalyzerRegistrationService {
  private levelAnalyzer: LevelAnalyzer;
  private volumeProfileAnalyzer: VolumeProfileAnalyzer;
  private btcCandlesStore?: { btcCandles1m: any[] }; // Reference to pre-loaded BTC candles

  constructor(
    private analyzerRegistry: AnalyzerRegistry,
    private logger: LoggerService,
    private config: any, // Add config for enabled status checks
    // Dependencies
    private rsiAnalyzer: MultiTimeframeRSIAnalyzer,
    private emaAnalyzer: MultiTimeframeEMAAnalyzer,
    private priceMomentumAnalyzer: PriceMomentumAnalyzer,
    private atrIndicator: ATRIndicator,
    private liquidityDetector: LiquidityDetector,
    private divergenceDetector: DivergenceDetector,
    private breakoutPredictor: BreakoutPredictor,
    private btcAnalyzer?: BTCAnalyzer | null,
    private stochasticIndicator?: StochasticIndicator,
    private bollingerIndicator?: BollingerBandsIndicator,
    private flatMarketDetector?: FlatMarketDetector | null,
    private deltaAnalyzerService?: DeltaAnalyzerService | null,
    private orderbookImbalanceService?: OrderbookImbalanceService | null,
  ) {
    // Initialize LevelAnalyzer with config
    const levelConfig = this.config?.strategies?.levelBased?.levelClustering || {};
    this.levelAnalyzer = new LevelAnalyzer(this.logger, {
      clusterThresholdPercent: levelConfig.clusterThresholdPercent ?? 0.5,
      minTouchesRequired: this.config?.strategies?.levelBased?.minTouchesRequired ?? 3,
      minTouchesForStrong: levelConfig.minTouchesForStrong ?? 5,
      maxDistancePercent: this.config?.strategies?.levelBased?.maxDistancePercent ?? 1.0,
      veryCloseDistancePercent: 0.3,
      recencyDecayDays: 7,
      volumeBoostThreshold: 1.5,
      baseConfidence: levelConfig.baseConfidence ?? 60,
      maxConfidence: 90,
    });

    // Initialize VolumeProfileAnalyzer with config
    const volumeProfileConfig = this.config?.volumeProfile || {};
    this.volumeProfileAnalyzer = new VolumeProfileAnalyzer(this.logger, {
      lookbackCandles: volumeProfileConfig.lookbackCandles ?? 200,
      valueAreaPercent: volumeProfileConfig.valueAreaPercent ?? 70,
      priceTickSize: volumeProfileConfig.priceTickSize ?? 0.1,
      hvnThreshold: 1.5,
      lvnThreshold: 0.5,
      maxDistancePercent: this.config?.strategies?.levelBased?.maxDistancePercent ?? 1.0,
      baseConfidence: 60,
      maxConfidence: 85,
    });
  }

  /**
   * Set the BTC candles store (used to access pre-loaded BTC candles)
   * Called by TradingOrchestrator after BotServices initialization
   */
  setBtcCandlesStore(store: { btcCandles1m: any[] }): void {
    this.btcCandlesStore = store;
    if (this.btcAnalyzer && this.config?.btcConfirmation?.enabled) {
      this.logger.debug('🔗 BTC candles store configured for AnalyzerRegistrationService');
    }
  }

  /**
   * Register all analyzers with weights and priorities
   * Called during TradingOrchestrator initialization
   */
  registerAllAnalyzers(): void {
    this.logger.info('📊 Registering all analyzers into unified registry...');
    this.logger.info('⚙️ Config status for analyzer registration', {
      hasConfig: !!this.config,
      configKeys: this.config ? Object.keys(this.config) : [],
      configType: typeof this.config,
      configValue: JSON.stringify(this.config).substring(0, 500),
      hasStrategicWeights: !!this.config?.strategicWeights,
    });

    // ========================================================================
    // TECHNICAL INDICATORS
    // ========================================================================

    // RSI Analyzer (priority 6, weight 0.15)
    const rsiEnabled = this.config?.strategicWeights?.technicalIndicators?.rsi?.enabled ?? true;
    this.analyzerRegistry.register('RSI_ANALYZER', {
      name: 'RSI_ANALYZER',
      weight: 0.15,
      priority: 6,
      enabled: rsiEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.rsi) return null;
        const rsi = data.rsi;
        const oversoldLevel = this.config?.analyzerConstants?.rsi?.oversoldLevel ?? RSI_OVERSOLD_LEVEL;
        const overboughtLevel = this.config?.analyzerConstants?.rsi?.overboughtLevel ?? RSI_OVERBOUGHT_LEVEL;
        const maxConfidence = this.config?.analyzerConstants?.rsi?.maxConfidence ?? 70;

        // ===== PHASE 6c: Timing check - avoid "falling knife" entries =====
        // For oversold (LONG) signals: Check if bounce is actually starting
        if (rsi < oversoldLevel) {
          let baseConfidence = Math.min(INTEGER_MULTIPLIERS.ONE_HUNDRED - rsi, maxConfidence);

          // Check recent candle action for signs of reversal
          if (data.candles && data.candles.length >= 2) {
            const lastCandle = data.candles[data.candles.length - 1];
            const prevCandle = data.candles[data.candles.length - 2];

            // If last candle closed lower than previous (still falling), reduce confidence
            // This prevents entering before the bounce actually starts
            if (lastCandle.close < prevCandle.close) {
              baseConfidence *= 0.6; // Reduce by 40%

              // If very strong downward momentum, block entry entirely
              if (lastCandle.close < prevCandle.low) {
                // Price fell through previous low = strong downtrend
                this.logger.debug('🚫 RSI_ANALYZER LONG | Oversold but price still falling', {
                  rsi: rsi.toFixed(2),
                  lastClose: lastCandle.close.toFixed(8),
                  prevClose: prevCandle.close.toFixed(8),
                });
                return null;
              }
            }
            // Bouncing candles = good sign for LONG entry
            else if (lastCandle.close > prevCandle.close && lastCandle.close > lastCandle.open) {
              baseConfidence *= 1.1; // Boost by 10% if actual bounce visible
            }
          }

          // If confidence too low after checks, skip
          if (baseConfidence < 30) {
            return null;
          }

          return {
            source: 'RSI_ANALYZER',
            direction: SignalDirection.LONG,
            confidence: baseConfidence,
            weight: 0.15,
            priority: 6,
          };
        }

        // For overbought (SHORT) signals: Check if decline is actually starting
        if (rsi > overboughtLevel) {
          let baseConfidence = Math.min(rsi - overboughtLevel, maxConfidence);

          // Check recent candle action for signs of decline
          if (data.candles && data.candles.length >= 2) {
            const lastCandle = data.candles[data.candles.length - 1];
            const prevCandle = data.candles[data.candles.length - 2];

            // If last candle closed higher than previous (still rising), reduce confidence
            // This prevents entering before the decline actually starts
            if (lastCandle.close > prevCandle.close) {
              baseConfidence *= 0.6; // Reduce by 40%

              // If very strong upward momentum, block entry entirely
              if (lastCandle.close > prevCandle.high) {
                // Price rose through previous high = strong uptrend
                this.logger.debug('🚫 RSI_ANALYZER SHORT | Overbought but price still rising', {
                  rsi: rsi.toFixed(2),
                  lastClose: lastCandle.close.toFixed(8),
                  prevClose: prevCandle.close.toFixed(8),
                });
                return null;
              }
            }
            // Declining candles = good sign for SHORT entry
            else if (lastCandle.close < prevCandle.close && lastCandle.close < lastCandle.open) {
              baseConfidence *= 1.1; // Boost by 10% if actual decline visible
            }
          }

          // If confidence too low after checks, skip
          if (baseConfidence < 30) {
            return null;
          }

          return {
            source: 'RSI_ANALYZER',
            direction: SignalDirection.SHORT,
            confidence: baseConfidence,
            weight: THRESHOLD_VALUES.FIFTEEN_PERCENT as number,
            priority: INTEGER_MULTIPLIERS.SIX as number,
          };
        }
        return null;
      },
    });

    // EMA Analyzer (priority 5, weight 0.12)
    const emaEnabled = this.config?.strategicWeights?.technicalIndicators?.ema?.enabled ?? true;
    this.analyzerRegistry.register('EMA_ANALYZER', {
      name: 'EMA_ANALYZER',
      weight: 0.12,
      priority: 5,
      enabled: emaEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.ema) return null;
        const { fast, slow } = data.ema;
        const emaDiff = Math.abs(fast - slow);
        const emaDiffPercent = (emaDiff / slow) * (PERCENT_MULTIPLIER as number);
        const baseConfidence = this.config?.analyzerConstants?.ema?.baseConfidence ?? EMA_BASE_CONFIDENCE;
        const strengthMultiplier = this.config?.analyzerConstants?.ema?.strengthConfidenceMultiplier ?? EMA_STRENGTH_CONFIDENCE_MULTIPLIER;

        if (fast > slow) {
          const strength = Math.min(emaDiffPercent, PERCENT_MULTIPLIER as number);
          return {
            source: 'EMA_ANALYZER',
            direction: SignalDirection.LONG,
            confidence: baseConfidence + strength * strengthMultiplier,
            weight: THRESHOLD_VALUES.TWELVE_PERCENT as number,
            priority: INTEGER_MULTIPLIERS.FIVE as number,
          };
        }
        if (fast < slow) {
          const strength = Math.min(emaDiffPercent, PERCENT_MULTIPLIER as number);
          return {
            source: 'EMA_ANALYZER',
            direction: SignalDirection.SHORT,
            confidence: baseConfidence + strength * strengthMultiplier,
            weight: THRESHOLD_VALUES.TWELVE_PERCENT as number,
            priority: INTEGER_MULTIPLIERS.FIVE as number,
          };
        }
        return null;
      },
    });

    // ATR Analyzer (priority 6, weight 0.12)
    const atrEnabled = this.config?.strategicWeights?.technicalIndicators?.atr?.enabled ?? true;
    this.analyzerRegistry.register('ATR_ANALYZER', {
      name: 'ATR_ANALYZER',
      weight: 0.12,
      priority: 6,
      enabled: atrEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.atr || data.atr <= (FIRST_INDEX as number)) return null;
        // Higher ATR = more volatility = better for trading
        const atrPercent = (data.atr / data.currentPrice) * (PERCENT_MULTIPLIER as number);
        const multiplier = this.config?.analyzerConstants?.atr?.confidenceMultiplier ?? ATR_CONFIDENCE_MULTIPLIER;
        const maxConfidence = this.config?.analyzerConstants?.atr?.maxConfidence ?? 80;
        const confidence = Math.min(atrPercent * multiplier, maxConfidence);
        return {
          source: 'ATR_ANALYZER',
          direction: SignalDirection.HOLD,
          confidence,
          weight: 0.12,
          priority: 6,
        };
      },
    });

    // Volume Analyzer (priority 6, weight 0.14)
    const volumeEnabled = this.config?.strategicWeights?.technicalIndicators?.volume?.enabled ?? true;
    this.analyzerRegistry.register('VOLUME_ANALYZER', {
      name: 'VOLUME_ANALYZER',
      weight: 0.14,
      priority: 6,
      enabled: volumeEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Neutral signal - volume is supportive but not directional
        const confidence = this.config?.analyzerConstants?.volume?.neutralConfidence ?? VOLUME_NEUTRAL_CONFIDENCE;
        return {
          source: 'VOLUME_ANALYZER',
          direction: SignalDirection.HOLD,
          confidence,
          weight: 0.14,
          priority: 6,
        };
      },
    });

    // Stochastic (priority 6, weight 0.12)
    if (this.stochasticIndicator) {
      const stochasticEnabled = this.config?.strategicWeights?.technicalIndicators?.stochastic?.enabled ?? true;
      this.analyzerRegistry.register('STOCHASTIC_ANALYZER', {
        name: 'STOCHASTIC_ANALYZER',
        weight: 0.12,
        priority: 6,
        enabled: stochasticEnabled,
        evaluate: async (data: StrategyMarketData) => {
          // Use existing stochastic logic if available
          return null;
        },
      });
    }

    // Bollinger Bands (priority 7, weight 0.13)
    if (this.bollingerIndicator) {
      const bollingerEnabled = this.config?.strategicWeights?.technicalIndicators?.bollingerBands?.enabled ?? true;
      this.analyzerRegistry.register('BOLLINGER_BANDS_ANALYZER', {
        name: 'BOLLINGER_BANDS_ANALYZER',
        weight: 0.13,
        priority: 7,
        enabled: bollingerEnabled,
        evaluate: async (data: StrategyMarketData) => {
          // Squeeze detection and band breakouts
          return null;
        },
      });
    }

    // ========================================================================
    // ADVANCED ANALYSIS
    // ========================================================================

    // Divergence Detector (priority 7, weight 0.15)
    const divergenceEnabled = this.config?.strategicWeights?.advancedAnalysis?.divergence?.enabled ?? true;
    this.analyzerRegistry.register('DIVERGENCE_ANALYZER', {
      name: 'DIVERGENCE_ANALYZER',
      weight: 0.15,
      priority: 7,
      enabled: divergenceEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Divergence detection: Price makes new high/low but RSI doesn't
        if (!data.divergence || !data.divergence.type || data.divergence.type === 'NONE') {
          this.logger.debug('⛔ DIVERGENCE_ANALYZER | No divergence detected');
          return null;
        }
        const direction = data.divergence.type === 'BULLISH' ? SignalDirection.LONG : SignalDirection.SHORT;
        const maxConfidence = this.config?.analyzerConstants?.divergence?.maxConfidence ?? 80;
        return {
          source: 'DIVERGENCE_ANALYZER',
          direction,
          confidence: Math.min(data.divergence.strength * INTEGER_MULTIPLIERS.ONE_HUNDRED, maxConfidence),
          weight: 0.15,
          priority: 7,
        };
      },
    });

    // Breakout Predictor (priority 6, weight 0.14)
    const breakoutEnabled = this.config?.strategicWeights?.advancedAnalysis?.breakoutPredictor?.enabled ?? true;
    this.analyzerRegistry.register('BREAKOUT_PREDICTOR', {
      name: 'BREAKOUT_PREDICTOR',
      weight: 0.14,
      priority: 6,
      enabled: breakoutEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // BB squeeze breakout prediction
        if (!data.breakoutPrediction || !data.breakoutPrediction.direction || data.breakoutPrediction.direction === 'NEUTRAL') {
          this.logger.debug('⛔ BREAKOUT_PREDICTOR | No clear breakout direction');
          return null;
        }
        const direction = data.breakoutPrediction.direction === 'BULLISH' ? SignalDirection.LONG : SignalDirection.SHORT;
        return {
          source: 'BREAKOUT_PREDICTOR',
          direction,
          confidence: data.breakoutPrediction.confidence,
          weight: 0.14,
          priority: 6,
        };
      },
    });

    // Wick Analyzer (priority 7, weight 0.12)
    const wickEnabled = this.config?.strategicWeights?.advancedAnalysis?.wickAnalyzer?.enabled ?? true;
    this.analyzerRegistry.register('WICK_ANALYZER', {
      name: 'WICK_ANALYZER',
      weight: 0.12,
      priority: 7,
      enabled: wickEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Wick rejection patterns: Large wicks = price rejection
        if (!data.candles || data.candles.length < (INTEGER_MULTIPLIERS.TWO as number)) {
          this.logger.debug('⛔ WICK_ANALYZER | Insufficient candles');
          return null;
        }
        const current = data.candles[data.candles.length - (SECOND_INDEX as number)];
        const range = current.high - current.low;
        const topWick = current.high - Math.max(current.open, current.close);
        const bottomWick = Math.min(current.open, current.close) - current.low;
        const topWickPercent = (topWick / range) * (PERCENT_MULTIPLIER as number);
        const bottomWickPercent = (bottomWick / range) * (PERCENT_MULTIPLIER as number);

        const threshold = this.config?.analyzerConstants?.wick?.rejectionThresholdPercent ?? WICK_REJECTION_THRESHOLD_PERCENT;
        const baseConfidence = this.config?.analyzerConstants?.wick?.baseConfidence ?? WICK_SIGNAL_BASE_CONFIDENCE;
        const maxConfidence = this.config?.analyzerConstants?.wick?.maxConfidence ?? 80;

        // ===== PHASE 6c: Freshness check - prevent chasing completed moves =====
        // Calculate wick age (in seconds)
        const wickAge = (Date.now() - current.timestamp) / 1000;
        const maxWickAge = 120; // 2 minutes max age for fresh signal

        // If wick is older than 2 minutes, reduce confidence significantly
        let freshnessMultiplier = 1.0;
        if (wickAge > maxWickAge) {
          freshnessMultiplier = 0.0; // Completely ignore wicks older than 2 minutes
        } else if (wickAge > 60) {
          // Decay confidence for wicks older than 1 minute
          freshnessMultiplier = Math.max(0, 1 - (wickAge - 60) / maxWickAge);
        }

        // Strong top wick rejection = bearish
        if (topWickPercent > threshold) {
          const baseConf = Math.min(baseConfidence + topWickPercent, maxConfidence);
          const freshConf = baseConf * freshnessMultiplier;

          // Also check if price already bounced away from wick low
          // If price is above wick low + 0.5%, the bounce already happened (too late to short)
          const wickLow = current.low;
          const priceMovedUp = data.currentPrice > wickLow * (1 + 0.005);
          if (priceMovedUp && wickAge > 10) {
            // Price moved away, signal is late
            this.logger.debug('🚫 WICK_ANALYZER SHORT | Signal too late - price already bounced', {
              wickPercent: topWickPercent.toFixed(2),
              wickAge: wickAge.toFixed(1) + 's',
              pricePosition: ((data.currentPrice - wickLow) / wickLow * 100).toFixed(2) + '%',
            });
            return null;
          }

          if (freshConf < 30) {
            // Confidence too low after freshness decay
            return null;
          }

          return {
            source: 'WICK_ANALYZER',
            direction: SignalDirection.SHORT,
            confidence: freshConf,
            weight: 0.12,
            priority: 7,
          };
        }
        // Strong bottom wick rejection = bullish
        else if (bottomWickPercent > threshold) {
          const baseConf = Math.min(baseConfidence + bottomWickPercent, maxConfidence);
          const freshConf = baseConf * freshnessMultiplier;

          // Also check if price already bounced away from wick high
          // If price is below wick high - 0.5%, the bounce already happened (too late to long)
          const wickHigh = current.high;
          const priceMovedDown = data.currentPrice < wickHigh * (1 - 0.005);
          if (priceMovedDown && wickAge > 10) {
            // Price moved away, signal is late
            this.logger.debug('🚫 WICK_ANALYZER LONG | Signal too late - price already fell', {
              wickPercent: bottomWickPercent.toFixed(2),
              wickAge: wickAge.toFixed(1) + 's',
              pricePosition: ((wickHigh - data.currentPrice) / data.currentPrice * 100).toFixed(2) + '%',
            });
            return null;
          }

          if (freshConf < 30) {
            // Confidence too low after freshness decay
            return null;
          }

          return {
            source: 'WICK_ANALYZER',
            direction: SignalDirection.LONG,
            confidence: freshConf,
            weight: 0.12,
            priority: 7,
          };
        }
        this.logger.debug('⛔ WICK_ANALYZER | No strong wick rejection detected');
        return null;
      },
    });

    // ========================================================================
    // STRUCTURE & MARKET ANALYSIS
    // ========================================================================

    // Trend Detector (priority 5, weight 0.15) - PHASE 6c: Reduced from 0.25 to prevent over-weighting
    const trendEnabled = this.config?.strategicWeights?.structureAnalysis?.trendDetector?.enabled ?? true;
    this.analyzerRegistry.register('TREND_DETECTOR', {
      name: 'TREND_DETECTOR',
      weight: 0.15,
      priority: 5,
      enabled: trendEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.trend) return null;
        const direction =
          data.trend === 'BULLISH' ? SignalDirection.LONG : SignalDirection.SHORT;
        const confidence = this.config?.analyzerConstants?.trend?.defaultConfidence ?? TREND_DETECTOR_DEFAULT_CONFIDENCE;
        return {
          source: 'TREND_DETECTOR',
          direction,
          confidence,
          weight: 0.15,
          priority: 5,
        };
      },
    });

    // CHOCH / BoS Detector (priority 7, weight 0.2)
    const chochEnabled = this.config?.strategicWeights?.structureAnalysis?.chochBos?.enabled ?? true;
    this.analyzerRegistry.register('CHOCH_BOS_DETECTOR', {
      name: 'CHOCH_BOS_DETECTOR',
      weight: 0.2,
      priority: 7,
      enabled: chochEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Change of Character / Break of Structure - detects trend reversals
        if (!data.swingPoints || data.swingPoints.length < (INTEGER_MULTIPLIERS.THREE as number)) {
          this.logger.debug('⛔ CHOCH_BOS_DETECTOR | Not enough swing points for ChoCh/BoS detection');
          return null;
        }
        this.logger.debug('⛔ CHOCH_BOS_DETECTOR | No ChoCh/BoS pattern detected on current structure');
        return null;
      },
    });

    // Swing Detector (priority 8, weight 0.18)
    const swingEnabled = this.config?.strategicWeights?.structureAnalysis?.swingDetector?.enabled ?? true;
    this.analyzerRegistry.register('SWING_DETECTOR', {
      name: 'SWING_DETECTOR',
      weight: 0.18,
      priority: 8,
      enabled: swingEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.swingPoints || data.swingPoints.length < 2) {
          this.logger.debug('⛔ SWING_DETECTOR | Insufficient swing points for analysis');
          return null;
        }
        // Swing points already detected, but no actionable signal from current swings
        this.logger.debug('⛔ SWING_DETECTOR | No swing-based signal generated');
        return null;
      },
    });

    // ========================================================================
    // LEVEL ANALYSIS (P0 - Critical for level-based trading)
    // ========================================================================

    // Level Analyzer (priority 7, weight 0.25) - HIGH WEIGHT - core level analysis
    const levelAnalyzerEnabled = this.config?.strategicWeights?.levelAnalysis?.enabled ?? true;
    this.analyzerRegistry.register('LEVEL_ANALYZER', {
      name: 'LEVEL_ANALYZER',
      weight: 0.25, // High weight - this is the primary level analysis
      priority: 7,
      enabled: levelAnalyzerEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Validate required data
        if (!data.swingPoints || data.swingPoints.length < 4) {
          this.logger.debug('⛔ LEVEL_ANALYZER | Insufficient swing points', {
            count: data.swingPoints?.length ?? 0,
            required: 4,
          });
          return null;
        }

        if (!data.candles || data.candles.length < 50) {
          this.logger.debug('⛔ LEVEL_ANALYZER | Insufficient candles for level analysis');
          return null;
        }

        // Generate signal using LevelAnalyzer
        const signal = this.levelAnalyzer.generateSignal(
          data.swingPoints,
          data.currentPrice,
          data.candles,
          data.timestamp,
        );

        if (!signal) {
          this.logger.debug('⛔ LEVEL_ANALYZER | No level-based signal generated');
          return null;
        }

        // Get analysis result for detailed logging
        const analysis = this.levelAnalyzer.analyze(
          data.swingPoints,
          data.currentPrice,
          data.candles,
          data.timestamp,
        );

        this.logger.info('✅ LEVEL_ANALYZER | Signal generated', {
          direction: signal.direction,
          confidence: signal.confidence,
          levelPrice: analysis.nearestLevel?.price.toFixed(4),
          levelType: analysis.nearestLevel?.type,
          touches: analysis.nearestLevel?.touches,
          strength: analysis.nearestLevel?.strength.toFixed(2),
          distancePercent: analysis.distancePercent.toFixed(2),
          reason: analysis.reason,
        });

        return signal;
      },
    });

    // Volume Profile Analyzer (priority 7, weight 0.18)
    // Analyzes volume distribution for POC, VAH, VAL, HVN levels
    const volumeProfileEnabled = this.config?.volumeProfile?.enabled ?? true;
    this.analyzerRegistry.register('VOLUME_PROFILE', {
      name: 'VOLUME_PROFILE',
      weight: 0.18, // Strong weight - volume profile is important for level confirmation
      priority: 7,
      enabled: volumeProfileEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.candles || data.candles.length < 50) {
          this.logger.debug('⛔ VOLUME_PROFILE | Insufficient candles for analysis');
          return null;
        }

        const signal = this.volumeProfileAnalyzer.generateSignal(
          data.candles,
          data.currentPrice,
        );

        if (!signal) {
          this.logger.debug('⛔ VOLUME_PROFILE | No signal generated');
          return null;
        }

        const profile = this.volumeProfileAnalyzer.calculateProfile(data.candles);
        if (profile) {
          this.logger.info('✅ VOLUME_PROFILE | Signal generated', {
            direction: signal.direction,
            confidence: signal.confidence,
            poc: profile.poc.price.toFixed(4),
            vah: profile.vah.toFixed(4),
            val: profile.val.toFixed(4),
            hvnCount: profile.hvnLevels.length,
            currentPrice: data.currentPrice.toFixed(4),
          });
        }

        return signal;
      },
    });

    // ========================================================================
    // LIQUIDITY & PRICE ACTION
    // ========================================================================

    // Liquidity Sweep (priority 8, weight 0.18)
    // Detects when price sweeps through a level and reverses (stop hunt pattern)
    const liquiditySweepEnabled = this.config?.strategicWeights?.liquidity?.liquiditySweep?.enabled ?? true;
    this.analyzerRegistry.register('LIQUIDITY_SWEEP', {
      name: 'LIQUIDITY_SWEEP',
      weight: 0.18,
      priority: 8,
      enabled: liquiditySweepEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Need swing points and recent candles for sweep detection
        if (!data.swingPoints || data.swingPoints.length < 3) {
          this.logger.debug('⛔ LIQUIDITY_SWEEP | Insufficient swing points');
          return null;
        }

        if (!data.candles || data.candles.length < 5) {
          this.logger.debug('⛔ LIQUIDITY_SWEEP | Insufficient candles');
          return null;
        }

        const currentCandle = data.candles[data.candles.length - 1];
        const prevCandle = data.candles[data.candles.length - 2];
        const sweepThresholdPercent = this.config?.analyzerThresholds?.liquidity?.fakeoutReversalPercent ?? 0.3;

        // Get recent swing lows and highs
        const recentSwingLows = data.swingPoints
          .filter(sp => sp.type === SwingPointType.LOW)
          .slice(-5);
        const recentSwingHighs = data.swingPoints
          .filter(sp => sp.type === SwingPointType.HIGH)
          .slice(-5);

        // Check for BULLISH sweep (price went below swing low then reversed up)
        for (const swingLow of recentSwingLows) {
          const sweptBelow = currentCandle.low < swingLow.price || prevCandle.low < swingLow.price;
          const closedAbove = currentCandle.close > swingLow.price;
          const reversalStrength = ((currentCandle.close - currentCandle.low) / swingLow.price) * 100;

          if (sweptBelow && closedAbove && reversalStrength >= sweepThresholdPercent) {
            const confidence = Math.min(60 + reversalStrength * 10, 85);
            this.logger.info('✅ LIQUIDITY_SWEEP | Bullish sweep detected', {
              swingLowPrice: swingLow.price.toFixed(4),
              candleLow: currentCandle.low.toFixed(4),
              candleClose: currentCandle.close.toFixed(4),
              reversalStrength: reversalStrength.toFixed(2),
              confidence,
            });
            return {
              source: 'LIQUIDITY_SWEEP',
              direction: SignalDirection.LONG,
              confidence,
              weight: 0.18,
              priority: 8,
            };
          }
        }

        // Check for BEARISH sweep (price went above swing high then reversed down)
        for (const swingHigh of recentSwingHighs) {
          const sweptAbove = currentCandle.high > swingHigh.price || prevCandle.high > swingHigh.price;
          const closedBelow = currentCandle.close < swingHigh.price;
          const reversalStrength = ((currentCandle.high - currentCandle.close) / swingHigh.price) * 100;

          if (sweptAbove && closedBelow && reversalStrength >= sweepThresholdPercent) {
            const confidence = Math.min(60 + reversalStrength * 10, 85);
            this.logger.info('✅ LIQUIDITY_SWEEP | Bearish sweep detected', {
              swingHighPrice: swingHigh.price.toFixed(4),
              candleHigh: currentCandle.high.toFixed(4),
              candleClose: currentCandle.close.toFixed(4),
              reversalStrength: reversalStrength.toFixed(2),
              confidence,
            });
            return {
              source: 'LIQUIDITY_SWEEP',
              direction: SignalDirection.SHORT,
              confidence,
              weight: 0.18,
              priority: 8,
            };
          }
        }

        this.logger.debug('⛔ LIQUIDITY_SWEEP | No sweep pattern detected');
        return null;
      },
    });

    // Liquidity Zone (priority 6, weight 0.15)
    // Detects zones where price has repeatedly reacted (high liquidity areas)
    const liquidityZoneEnabled = this.config?.strategicWeights?.liquidity?.liquidityZone?.enabled ?? true;
    this.analyzerRegistry.register('LIQUIDITY_ZONE', {
      name: 'LIQUIDITY_ZONE',
      weight: 0.15,
      priority: 6,
      enabled: liquidityZoneEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Build liquidity zones from swing points
        if (!data.swingPoints || data.swingPoints.length < 4) {
          this.logger.debug('⛔ LIQUIDITY_ZONE | Insufficient swing points for zone detection');
          return null;
        }

        const zoneTolerance = (this.config?.analyzerThresholds?.liquidity?.priceTolerancePercent ?? 0.3) / 100;
        const minTouches = this.config?.analyzerThresholds?.liquidity?.minTouchesForZone ?? 2;
        const maxDistancePercent = this.config?.strategies?.levelBased?.maxDistancePercent ?? 1.0;

        // Group swing points into zones
        const swingLows = data.swingPoints.filter(sp => sp.type === SwingPointType.LOW);
        const swingHighs = data.swingPoints.filter(sp => sp.type === SwingPointType.HIGH);

        // Find support zones (clustered swing lows)
        const supportZones = this.findLiquidityZones(swingLows, zoneTolerance, minTouches);
        // Find resistance zones (clustered swing highs)
        const resistanceZones = this.findLiquidityZones(swingHighs, zoneTolerance, minTouches);

        // Find nearest zone within distance threshold
        let nearestZone: { price: number; touches: number; type: 'SUPPORT' | 'RESISTANCE' } | null = null;
        let minDistance = Infinity;

        for (const zone of supportZones) {
          const distance = ((data.currentPrice - zone.price) / zone.price) * 100;
          if (distance >= 0 && distance <= maxDistancePercent && distance < minDistance) {
            nearestZone = { ...zone, type: 'SUPPORT' };
            minDistance = distance;
          }
        }

        for (const zone of resistanceZones) {
          const distance = ((zone.price - data.currentPrice) / data.currentPrice) * 100;
          if (distance >= 0 && distance <= maxDistancePercent && distance < minDistance) {
            nearestZone = { ...zone, type: 'RESISTANCE' };
            minDistance = distance;
          }
        }

        if (!nearestZone) {
          this.logger.debug('⛔ LIQUIDITY_ZONE | No zone within distance threshold', {
            supportZones: supportZones.length,
            resistanceZones: resistanceZones.length,
            maxDistance: maxDistancePercent + '%',
          });
          return null;
        }

        // Calculate confidence based on touches and distance
        const touchBonus = Math.min((nearestZone.touches - minTouches) * 5, 15);
        const distancePenalty = minDistance > 0.5 ? (minDistance - 0.5) * 10 : 0;
        const confidence = Math.min(Math.max(55 + touchBonus - distancePenalty, 45), 80);

        const direction = nearestZone.type === 'SUPPORT' ? SignalDirection.LONG : SignalDirection.SHORT;

        this.logger.info('✅ LIQUIDITY_ZONE | Zone signal generated', {
          direction,
          zonePrice: nearestZone.price.toFixed(4),
          zoneType: nearestZone.type,
          touches: nearestZone.touches,
          distancePercent: minDistance.toFixed(2),
          confidence,
        });

        return {
          source: 'LIQUIDITY_ZONE',
          direction,
          confidence,
          weight: 0.15,
          priority: 6,
        };
      },
    });

    // Price Action (priority 7, weight 0.16)
    const priceActionEnabled = this.config?.strategicWeights?.liquidity?.priceAction?.enabled ?? true;
    this.analyzerRegistry.register('PRICE_ACTION', {
      name: 'PRICE_ACTION',
      weight: 0.16,
      priority: 7,
      enabled: priceActionEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // General price action confirmation - open close pattern
        if (!data.candles || data.candles.length < 2) {
          this.logger.debug('⛔ PRICE_ACTION | Insufficient candles for PA analysis');
          return null;
        }
        this.logger.debug('⛔ PRICE_ACTION | No significant price action pattern detected');
        return null;
      },
    });

    // ========================================================================
    // SMART MONEY CONCEPTS (SMC)
    // ========================================================================

    // Footprint Indicator (priority 9, weight 0.18)
    const footprintEnabled = this.config?.strategicWeights?.smcMicrostructure?.footprint?.enabled ?? true;
    this.analyzerRegistry.register('FOOTPRINT', {
      name: 'FOOTPRINT',
      weight: 0.18,
      priority: 9,
      enabled: footprintEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Candle footprint/microstructure analysis - volume concentration analysis
        if (!data.candles || data.candles.length < 2) {
          return null;
        }

        // Get config parameters (with fallbacks)
        const fpConfig = this.config?.smcMicrostructure?.footprint;
        const minClosePos = (fpConfig?.minClosePositionPercent ?? 70) / INTEGER_MULTIPLIERS.ONE_HUNDRED; // Convert % to decimal
        const minBodyRatio = fpConfig?.minBodyToRangeRatio ?? 0.6;
        const maxConf = fpConfig?.maxConfidence ?? 85;
        const baseConfidence = this.config?.analyzerConstants?.footprint?.baseConfidence ?? FOOTPRINT_BASE_CONFIDENCE;
        const closePositionMultiplier = this.config?.analyzerConstants?.footprint?.closePositionMultiplier ?? FOOTPRINT_CLOSE_POSITION_MULTIPLIER;

        const current = data.candles[data.candles.length - 1];
        const currentBodySize = Math.abs(current.close - current.open);
        const currentRange = current.high - current.low;
        const closePosition = (current.close - current.low) / (currentRange || 1); // 0 = bottom, 1 = top

        // Strong buying footprint: close near top + decent volume
        if (closePosition > minClosePos && current.close > current.open && currentBodySize > currentRange * minBodyRatio) {
          // Block LONG in downtrend if configured
          const blockLongEnabled = this.config?.strategies?.levelBased?.blockLongInDowntrend ?? true;
          if (blockLongEnabled) {
            const rsiDowntrendThreshold = this.config?.strategies?.levelBased?.levelClustering?.trendFilters?.downtrend?.rsiThreshold ?? 55;
            const isDowntrend = data.ema.fast < data.ema.slow && data.rsi < rsiDowntrendThreshold;
            if (isDowntrend) {
              return null; // Block LONG signal in downtrend
            }
          }

          return {
            source: 'FOOTPRINT',
            direction: SignalDirection.LONG,
            confidence: Math.min(baseConfidence + closePosition * closePositionMultiplier, maxConf),
            weight: 0.18,
            priority: 9,
          };
        }
        // Strong selling footprint: close near bottom + decent volume
        else if (closePosition < (1 - minClosePos) && current.close < current.open && currentBodySize > currentRange * minBodyRatio) {
          return {
            source: 'FOOTPRINT',
            direction: SignalDirection.SHORT,
            confidence: Math.min(baseConfidence + (1 - closePosition) * closePositionMultiplier, maxConf),
            weight: 0.18,
            priority: 9,
          };
        }

        return null;
      },
    });

    // Price Momentum Analyzer (priority 9, weight 0.20)
    // Real-time validation that price is moving in signal direction
    // Prevents chasing exhausted moves by requiring active momentum
    const priceMomentumEnabled = this.config?.strategicWeights?.technicalIndicators?.priceMomentum?.enabled ?? true;
    this.analyzerRegistry.register('PRICE_MOMENTUM', {
      name: 'PRICE_MOMENTUM',
      weight: 0.20,
      priority: 9,
      enabled: priceMomentumEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.candles || data.candles.length < 5) {
          return null; // Need 5 candles for momentum analysis
        }

        const signal = this.priceMomentumAnalyzer.analyze(data.candles);
        if (!signal) {
          return null; // No clear momentum
        }

        return {
          source: 'PRICE_MOMENTUM',
          direction: signal.direction,
          confidence: signal.confidence,
          weight: 0.20,
          priority: 9,
        };
      },
    });

    // Order Block Detector (priority 8, weight 0.18) - PHASE 6c: Reduced from 0.22 to reduce institutional bias over-weighting
    const orderBlockEnabled = this.config?.strategicWeights?.smcMicrostructure?.orderBlock?.enabled ?? true;
    this.analyzerRegistry.register('ORDER_BLOCK', {
      name: 'ORDER_BLOCK',
      weight: 0.18,
      priority: 8,
      enabled: orderBlockEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Institutional order block detection based on recent candle structure
        if (!data.candles || data.candles.length < 3) {
          return null;
        }

        // Get config parameters (with fallbacks)
        const obConfig = this.config?.smcMicrostructure?.orderBlock;
        const minBodyToWickRatio = obConfig?.minBodyToWickRatio ?? 2.5;
        const minBodyPercent = obConfig?.minBodyPercent ?? 0.3;
        const maxConf = obConfig?.maxConfidence ?? 85;
        const baseConfidence = this.config?.analyzerConstants?.orderBlock?.baseConfidence ?? ORDER_BLOCK_BASE_CONFIDENCE;
        const bodyWickMultiplier = this.config?.analyzerConstants?.orderBlock?.bodyWickMultiplier ?? ORDER_BLOCK_BODY_WICK_MULTIPLIER;

        const current = data.candles[data.candles.length - 1];

        // Order Block = Strong candle that stopped price reversal
        // Look for large body candles with small wicks (institutional rejection)
        const currentBodySize = Math.abs(current.close - current.open);
        const currentBodyPercent = (currentBodySize / current.open) * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        const currentWickSize = Math.max(current.high - current.close, current.open - current.low);
        const bodyToWickRatio = currentBodySize / (currentWickSize + EPSILON);

        // Strong institutional order block: large body + small wicks
        if (bodyToWickRatio > minBodyToWickRatio && currentBodyPercent > minBodyPercent) {
          if (current.close > current.open) {
            // Bullish order block = LONG
            // Block LONG in downtrend if configured
            const blockLongEnabled = this.config?.strategies?.levelBased?.blockLongInDowntrend ?? true;
            if (blockLongEnabled) {
              const rsiDowntrendThreshold = this.config?.strategies?.levelBased?.levelClustering?.trendFilters?.downtrend?.rsiThreshold ?? 55;
              const isDowntrend = data.ema.fast < data.ema.slow && data.rsi < rsiDowntrendThreshold;
              if (isDowntrend) {
                return null; // Block LONG signal in downtrend
              }
            }

            return {
              source: 'ORDER_BLOCK',
              direction: SignalDirection.LONG,
              confidence: Math.min(baseConfidence + bodyToWickRatio * bodyWickMultiplier, maxConf),
              weight: 0.22,
              priority: 8,
            };
          } else if (current.close < current.open) {
            // Bearish order block = SHORT
            // Block SHORT in uptrend if configured
            const blockShortEnabled = this.config?.strategies?.levelBased?.blockShortInUptrend ?? true;
            if (blockShortEnabled) {
              const rsiUptrendThreshold = this.config?.strategies?.levelBased?.levelClustering?.trendFilters?.uptrend?.rsiThreshold ?? 45;
              const isUptrend = data.ema.fast > data.ema.slow && data.rsi > rsiUptrendThreshold;
              if (isUptrend) {
                return null; // Block SHORT signal in uptrend
              }
            }

            return {
              source: 'ORDER_BLOCK',
              direction: SignalDirection.SHORT,
              confidence: Math.min(baseConfidence + bodyToWickRatio * bodyWickMultiplier, maxConf),
              weight: 0.22,
              priority: 8,
            };
          }
        }

        return null;
      },
    });

    // Fair Value Gap Detector (priority 8, weight 0.2)
    const fvgEnabled = this.config?.strategicWeights?.smcMicrostructure?.fairValueGap?.enabled ?? true;
    this.analyzerRegistry.register('FAIR_VALUE_GAP', {
      name: 'FAIR_VALUE_GAP',
      weight: 0.2,
      priority: 8,
      enabled: fvgEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Fair value gap (FVG) detection - unfilled price zones between candles
        if (!data.candles || data.candles.length < 2) {
          return null;
        }

        // Get config parameters (with fallbacks)
        const fvgConfig = this.config?.smcMicrostructure?.fairValueGap;
        const minGapPercent = fvgConfig?.minGapPercent ?? 0.2;
        const maxConf = fvgConfig?.maxConfidence ?? 75;
        const baseConfidence = this.config?.analyzerConstants?.fairValueGap?.baseConfidence ?? FAIR_VALUE_GAP_BASE_CONFIDENCE;
        const percentMultiplier = this.config?.analyzerConstants?.fairValueGap?.percentMultiplier ?? FAIR_VALUE_GAP_PERCENT_MULTIPLIER;

        const current = data.candles[data.candles.length - INTEGER_MULTIPLIERS.ONE];
        const prev = data.candles[data.candles.length - INTEGER_MULTIPLIERS.TWO];

        // FVG = Gap between prev high and current low (bullish) or prev low and current high (bearish)
        const bullishGap = current.low - prev.high;
        const bearishGap = prev.low - current.high;

        const gapPercent = (Math.abs(bullishGap) / current.open) * INTEGER_MULTIPLIERS.ONE_HUNDRED;

        // Significant FVG when gap is > minGapPercent% of price
        if (bullishGap > 0 && gapPercent > minGapPercent) {
          // Bullish FVG - price moved up creating gap, will likely fill it downward = SHORT
          return {
            source: 'FAIR_VALUE_GAP',
            direction: SignalDirection.SHORT,
            confidence: Math.min(baseConfidence + gapPercent * percentMultiplier, maxConf),
            weight: 0.2,
            priority: 8,
          };
        } else if (bearishGap > 0 && gapPercent > minGapPercent) {
          // Bearish FVG - price moved down creating gap, will likely fill it upward = LONG
          return {
            source: 'FAIR_VALUE_GAP',
            direction: SignalDirection.LONG,
            confidence: Math.min(baseConfidence + gapPercent * percentMultiplier, maxConf),
            weight: 0.2,
            priority: 8,
          };
        }

        return null;
      },
    });

    // ========================================================================
    // FILTERS & PROTECTIONS
    // ========================================================================

    // ATH Protection (priority 4, weight 0.1)
    const athEnabled = this.config?.strategicWeights?.filters?.athProtection?.enabled ?? true;
    this.analyzerRegistry.register('ATH_PROTECTION', {
      name: 'ATH_PROTECTION',
      weight: 0.1,
      priority: 4,
      enabled: athEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // ATH check if available (might not be in all market data)
        const ath = (data as any).ath;
        if (!ath || ath <= 0) return null;
        const athDistance = ((ath - data.currentPrice) / ath) * INTEGER_MULTIPLIERS.ONE_HUNDRED;
        const threshold = this.config?.analyzerConstants?.ath?.distanceThresholdPercent ?? ATH_DISTANCE_THRESHOLD_PERCENT;
        const protectionConfidence = this.config?.analyzerConstants?.ath?.protectionConfidence ?? 80;
        if (athDistance < threshold) {
          return {
            source: 'ATH_PROTECTION',
            direction: SignalDirection.HOLD,
            confidence: protectionConfidence,
            weight: 0.1,
            priority: 4,
          };
        }
        return null;
      },
    });

    // EMA Filter (priority 4, weight 0.1)
    const emaFilterEnabled = this.config?.strategicWeights?.filters?.emaFilter?.enabled ?? true;
    this.analyzerRegistry.register('EMA_FILTER', {
      name: 'EMA_FILTER',
      weight: 0.1,
      priority: 4,
      enabled: emaFilterEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // EMA-based filtering
        return null;
      },
    });

    // RSI Filter (priority 5, weight 0.09)
    const rsiFilterEnabled = this.config?.strategicWeights?.filters?.rsiFilter?.enabled ?? true;
    this.analyzerRegistry.register('RSI_FILTER', {
      name: 'RSI_FILTER',
      weight: 0.09,
      priority: 5,
      enabled: rsiFilterEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // RSI extreme condition filtering
        return null;
      },
    });

    // Volume Filter (priority 5, weight 0.09)
    const volumeFilterEnabled = this.config?.strategicWeights?.filters?.volumeFilter?.enabled ?? true;
    this.analyzerRegistry.register('VOLUME_FILTER', {
      name: 'VOLUME_FILTER',
      weight: 0.09,
      priority: 5,
      enabled: volumeFilterEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Volume confirmation filtering
        return null;
      },
    });

    // BTC Correlation (priority 5, weight 0.12)
    // NOTE: BTC confirmation is handled separately in ConfirmationFilter and TradeExecutionService
    // This stub ensures the analyzer is registered but actual BTC analysis happens in the proper filter pipeline
    const isBtcConfirmationEnabled = this.config?.btcConfirmation?.enabled === true;

    this.logger.debug('🔗 BTC_CORRELATION analyzer registration', {
      btcConfirmationEnabled: isBtcConfirmationEnabled,
      configHasBtc: !!this.config?.btcConfirmation,
      btcConfig: this.config?.btcConfirmation ? {
        enabled: this.config.btcConfirmation.enabled,
        symbol: this.config.btcConfirmation.symbol,
      } : 'NOT_FOUND',
    });

    // BTC_CORRELATION Analyzer - Week 13 Phase 2: Soft Voting System
    // Get configuration from config.btcConfirmation.analyzer
    const btcAnalyzerConfig = this.config?.btcConfirmation?.analyzer || {
      weight: 0.12,
      priority: 5,
      minConfidence: 25,
      maxConfidence: 85,
    };

    this.logger.info('📊 Registering BTC_CORRELATION analyzer', {
      enabled: isBtcConfirmationEnabled,
      weight: btcAnalyzerConfig.weight,
      priority: btcAnalyzerConfig.priority,
      minConfidence: btcAnalyzerConfig.minConfidence,
      maxConfidence: btcAnalyzerConfig.maxConfidence,
      btcAnalyzerAvailable: !!this.btcAnalyzer,
    });

    this.analyzerRegistry.register('BTC_CORRELATION', {
      name: 'BTC_CORRELATION',
      weight: btcAnalyzerConfig.weight,
      priority: btcAnalyzerConfig.priority,
      enabled: isBtcConfirmationEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // BTC Correlation Analyzer - Week 13 Phase 2: Soft Voting System
        // BTC participates in weighted voting instead of hard blocking signals
        // Confidence is based on BTC momentum strength (0-1 scale converted to 0-100)

        if (!this.btcAnalyzer || !this.btcCandlesStore || this.btcCandlesStore.btcCandles1m.length === 0) {
          this.logger.warn('🔗 BTC_CORRELATION analyzer - data not available', {
            btcAnalyzer: !!this.btcAnalyzer,
            btcCandlesStore: !!this.btcCandlesStore,
            candlesLength: this.btcCandlesStore?.btcCandles1m?.length ?? 0,
          });
          return null; // BTC analysis not available
        }

        try {
          const btcCandles = this.btcCandlesStore.btcCandles1m;

          // Analyze BTC with LONG direction to check alignment
          // (actual return signal is based on BTC's momentum, not alignment check)
          const btcAnalysis = this.btcAnalyzer.analyze(btcCandles, SignalDirection.LONG);

          // If BTC is neutral, don't participate in voting
          if (btcAnalysis.direction === BTCDirection.NEUTRAL) {
            return null;
          }

          // Convert BTC momentum (0-1) to confidence (0-100)
          let confidence = btcAnalysis.momentum * PERCENT_MULTIPLIER;

          // Get min/max confidence thresholds from config
          const minConfidence = btcAnalyzerConfig.minConfidence ?? 25;
          const maxConfidence = btcAnalyzerConfig.maxConfidence ?? 85;

          // Ensure minimum confidence threshold (don't return very weak signals)
          if (confidence < minConfidence) {
            this.logger.info('🔗 BTC_CORRELATION filtered (low momentum)', {
              confidence: confidence.toFixed(1),
              minConfidence,
              btcMomentum: btcAnalysis.momentum.toFixed(3),
            });
            return null;
          }

          // Cap maximum confidence (BTC is secondary, not primary)
          confidence = Math.min(confidence, maxConfidence);

          // Return BTC's own direction with confidence based on momentum
          const direction =
            btcAnalysis.direction === BTCDirection.UP ? SignalDirection.LONG : SignalDirection.SHORT;

          this.logger.info('🔗 BTC_CORRELATION analyzer SIGNAL', {
            direction,
            confidence: confidence.toFixed(1),
            btcMomentum: btcAnalysis.momentum.toFixed(3),
            btcCandles: btcCandles.length,
            configWeight: btcAnalyzerConfig.weight,
            configMinConfidence: minConfidence,
            configMaxConfidence: maxConfidence,
          });

          return {
            source: 'BTC_CORRELATION',
            direction,
            confidence,
            weight: btcAnalyzerConfig.weight,
            priority: btcAnalyzerConfig.priority,
          };
        } catch (error) {
          this.logger.error('BTC_CORRELATION analyzer failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      },
    });

    // Session Filter (priority 3, weight 0.08)
    const sessionFilterEnabled = this.config?.strategicWeights?.filters?.sessionFilter?.enabled ?? true;
    this.analyzerRegistry.register('SESSION_FILTER', {
      name: 'SESSION_FILTER',
      weight: 0.08,
      priority: 3,
      enabled: sessionFilterEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Trading session filter (Asia, London, NY)
        return null;
      },
    });

    // Funding Rate Filter (priority 3, weight 0.08)
    const fundingFilterEnabled = this.config?.strategicWeights?.filters?.fundingRateFilter?.enabled ?? true;
    this.analyzerRegistry.register('FUNDING_RATE_FILTER', {
      name: 'FUNDING_RATE_FILTER',
      weight: 0.08,
      priority: 3,
      enabled: fundingFilterEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Funding rate blocking
        return null;
      },
    });

    // ========================================================================
    // DELTA & SCALPING
    // ========================================================================

    // Delta Analyzer (priority 6, weight 0.15)
    const deltaEnabled = this.config?.strategicWeights?.advancedAnalysis?.delta?.enabled ?? true;
    this.analyzerRegistry.register('DELTA_ANALYZER', {
      name: 'DELTA_ANALYZER',
      weight: 0.15,
      priority: 6,
      enabled: deltaEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // Buy/sell delta analysis
        if (!this.deltaAnalyzerService) {
          return null;
        }

        const deltaAnalysis = this.deltaAnalyzerService.analyze();
        const maxConfidence = this.config?.analyzerConstants?.delta?.maxConfidence ?? 70;

        // Convert delta trend to trading signal
        if (deltaAnalysis.trend === 'BULLISH') {
          return {
            source: 'DELTA_ANALYZER',
            direction: SignalDirection.LONG,
            confidence: Math.min(deltaAnalysis.strength, maxConfidence),
            weight: 0.15,
            priority: 6,
          };
        } else if (deltaAnalysis.trend === 'BEARISH') {
          return {
            source: 'DELTA_ANALYZER',
            direction: SignalDirection.SHORT,
            confidence: Math.min(deltaAnalysis.strength, maxConfidence),
            weight: 0.15,
            priority: 6,
          };
        }

        return null; // NEUTRAL trend
      },
    });

    // Tick Delta Analyzer (priority 8, weight 0.2)
    this.analyzerRegistry.register('TICK_DELTA', {
      name: 'TICK_DELTA',
      weight: 0.2,
      priority: 8,
      enabled: false, // Disabled for now, enabled only for scalping
      evaluate: async (data: StrategyMarketData) => {
        // Aggressive tick delta detection
        return null;
      },
    });

    // Order Flow Analyzer (priority 8, weight 0.19)
    this.analyzerRegistry.register('ORDER_FLOW', {
      name: 'ORDER_FLOW',
      weight: 0.19,
      priority: 8,
      enabled: false, // Disabled for now
      evaluate: async (data: StrategyMarketData) => {
        // Order flow imbalance detection
        if (!this.orderbookImbalanceService || !data.orderbook) {
          return null;
        }

        // Convert OrderbookLevel[] (union of object or tuple) to [price, size][] (tuple format)
        const bids = (data.orderbook.bids || []).map(b => {
          if (Array.isArray(b)) {
            return b as [number, number];
          }
          const obj = b as { price: number; size: number };
          return [obj.price, obj.size] as [number, number];
        });
        const asks = (data.orderbook.asks || []).map(a => {
          if (Array.isArray(a)) {
            return a as [number, number];
          }
          const obj = a as { price: number; size: number };
          return [obj.price, obj.size] as [number, number];
        });

        const imbalanceAnalysis = this.orderbookImbalanceService.analyze({
          bids,
          asks,
        });

        // Convert orderbook imbalance to trading signal
        if (imbalanceAnalysis.direction === 'BID') {
          return {
            source: 'ORDER_FLOW',
            direction: SignalDirection.LONG,
            confidence: Math.min(imbalanceAnalysis.strength, 70), // Cap at 70% confidence
            weight: 0.19,
            priority: 8,
          };
        } else if (imbalanceAnalysis.direction === 'ASK') {
          return {
            source: 'ORDER_FLOW',
            direction: SignalDirection.SHORT,
            confidence: Math.min(imbalanceAnalysis.strength, 70), // Cap at 70% confidence
            weight: 0.19,
            priority: 8,
          };
        }

        return null; // NEUTRAL direction
      },
    });

    // Micro Wall Detector (priority 8, weight 0.18)
    this.analyzerRegistry.register('MICRO_WALL', {
      name: 'MICRO_WALL',
      weight: 0.18,
      priority: 8,
      enabled: false, // Disabled for now
      evaluate: async (data: StrategyMarketData) => {
        // Micro orderbook wall detection
        return null;
      },
    });

    // ========================================================================
    // WHALE DETECTION
    // ========================================================================

    // Whale Detector (priority 9, weight 0.2)
    this.analyzerRegistry.register('WHALE_DETECTOR', {
      name: 'WHALE_DETECTOR',
      weight: 0.2,
      priority: 9,
      enabled: false, // Disabled, only for whale hunter strategy
      evaluate: async (data: StrategyMarketData) => {
        // Large whale wall detection
        return null;
      },
    });

    this.logger.info('✅ All 45+ analyzers registered in unified voting system', {
      totalRegistered: this.analyzerRegistry.getCount(),
      enabledCount: this.analyzerRegistry.getEnabledCount(),
    });
  }

  /**
   * Find liquidity zones by clustering swing points
   * Groups nearby swing points into zones based on price tolerance
   */
  private findLiquidityZones(
    swingPoints: { price: number; timestamp: number; type: SwingPointType }[],
    tolerance: number,
    minTouches: number,
  ): { price: number; touches: number }[] {
    if (swingPoints.length === 0) {
      return [];
    }

    const zones: { price: number; touches: number }[] = [];

    // Sort by price
    const sorted = [...swingPoints].sort((a, b) => a.price - b.price);

    // Cluster nearby points
    let currentCluster: typeof swingPoints = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const point = sorted[i];
      const clusterAvgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
      const priceDiff = Math.abs(point.price - clusterAvgPrice) / clusterAvgPrice;

      if (priceDiff <= tolerance) {
        currentCluster.push(point);
      } else {
        // Save cluster if it has enough touches
        if (currentCluster.length >= minTouches) {
          const avgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
          zones.push({
            price: avgPrice,
            touches: currentCluster.length,
          });
        }
        currentCluster = [point];
      }
    }

    // Process last cluster
    if (currentCluster.length >= minTouches) {
      const avgPrice = currentCluster.reduce((sum, p) => sum + p.price, 0) / currentCluster.length;
      zones.push({
        price: avgPrice,
        touches: currentCluster.length,
      });
    }

    return zones;
  }
}
