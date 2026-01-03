/**
 * Market Data Preparation Service (Week 13 Extract)
 *
 * Extracted from trading-orchestrator.service.ts (lines 1987-2318)
 * Responsible for aggregating and preparing market data from all sources
 *
 * Responsibilities:
 * - Fetch and organize candle data by timeframe
 * - Calculate technical indicators (RSI, EMA, ATR, Stochastic, BB)
 * - Detect swing points and liquidity zones
 * - Analyze divergence and breakout predictions
 * - Prepare data for strategy evaluation
 * - Synchronize time with exchange
 */

import {
  LoggerService,
  StrategyMarketData,
  TimeframeRole,
  Candle,
  OrderBook,
  OrderbookLevel,
  TradingContext,
  ATRIndicator,
  RSIIndicator,
  ZigZagNRIndicator,
  StochasticIndicator,
  BollingerBandsIndicator,
  LiquidityDetector,
  DivergenceDetector,
  BreakoutPredictor,
} from '../types';
import {
  DECIMAL_PLACES,
  INTEGER_MULTIPLIERS,
  MULTIPLIER_VALUES,
  THRESHOLD_VALUES,
  CONFIDENCE_THRESHOLDS,
  PERCENT_MULTIPLIER,
} from '../constants';
import { CandleProvider } from '../providers/candle.provider';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { BybitService } from './bybit';
import { MultiTimeframeRSIAnalyzer } from '../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../analyzers/multi-timeframe-ema.analyzer';
import { DeltaAnalyzerService } from './delta-analyzer.service';
import { OrderbookImbalanceService } from './orderbook-imbalance.service';
import { OrchestratorConfig } from '../types';


/**
 * Market Data Preparation Service
 *
 * Aggregates data from multiple sources and prepares it for strategy evaluation
 */
export class MarketDataPreparationService {
  private currentOrderbook: OrderBook | null = null;
  private currentContext: TradingContext | null = null;

  constructor(
    private config: OrchestratorConfig,
    private candleProvider: CandleProvider,
    private timeframeProvider: TimeframeProvider,
    private bybitService: BybitService,
    private logger: LoggerService,
    // Indicators
    private rsiAnalyzer: MultiTimeframeRSIAnalyzer,
    private emaAnalyzer: MultiTimeframeEMAAnalyzer,
    private atrIndicator: ATRIndicator,
    private zigzagNRIndicator: ZigZagNRIndicator,
    // Detectors
    private liquidityDetector: LiquidityDetector,
    private divergenceDetector: DivergenceDetector,
    private breakoutPredictor: BreakoutPredictor,
    // Optional services
    private stochasticIndicator?: StochasticIndicator,
    private bollingerIndicator?: BollingerBandsIndicator,
    private deltaAnalyzerService?: DeltaAnalyzerService,
    private orderbookImbalanceService?: OrderbookImbalanceService,
  ) {}

  /**
   * Set current orderbook (called externally when orderbook updates)
   */
  setCurrentOrderbook(orderbook: OrderBook | null): void {
    this.currentOrderbook = orderbook;
  }

  /**
   * Set current context (called externally when context updates)
   */
  setCurrentContext(context: TradingContext | null): void {
    this.currentContext = context;
  }

  /**
   * Prepare minimal market data for whale hunter
   * Optimized for whale detection (doesn't need full indicator calculation)
   */
  async prepareMarketDataForWhale(): Promise<StrategyMarketData | null> {
    try {
      // Context is required for whale hunter (ATR%, BTC analysis)
      if (!this.currentContext) {
        return null;
      }

      // Get only ENTRY candles for current price (1 candle is enough)
      const entryCandles = await this.candleProvider.getCandles(TimeframeRole.ENTRY);
      if (!entryCandles || entryCandles.length < 1) {
        return null;
      }

      const currentPrice = entryCandles[entryCandles.length - 1].close;
      const currentTimestamp = entryCandles[entryCandles.length - 1].timestamp;

      // Return minimal market data (only what whale hunter needs)
      const marketData: StrategyMarketData = {
        timestamp: currentTimestamp,
        currentPrice,
        candles: entryCandles, // Only ENTRY candles (for current price)
        swingPoints: [], // Not needed for whale
        rsi: 0, // Not needed for whale
        rsiTrend1: undefined,
        ema: { fast: 0, slow: 0 }, // Not needed for whale
        emaTrend1: undefined,
        atr: undefined, // Will use from context if needed
        trend: this.currentContext.trend as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
        liquidity: undefined, // Not needed for whale
        divergence: undefined, // Not needed for whale
        orderbook: this.currentOrderbook ?? undefined, // CRITICAL: Fresh orderbook data
        context: this.currentContext, // Contains ATR%, BTC analysis
      };

      return marketData;
    } catch (error) {
      this.logger.error('Error preparing whale market data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Prepare full market data for strategies
   * Includes all technical indicators and analysis
   */
  async prepareMarketData(): Promise<StrategyMarketData | null> {
    try {
      // Get PRIMARY candles for swing points and market analysis (5m timeframe)
      const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY);
      if (!primaryCandles || primaryCandles.length < INTEGER_MULTIPLIERS.FIFTY) {
        this.logger.warn('Not enough PRIMARY candles for market data');
        return null;
      }

      const currentPrice = primaryCandles[primaryCandles.length - 1].close;
      const currentTimestamp = primaryCandles[primaryCandles.length - 1].timestamp;

      // Calculate indicators using MultiTimeframe analyzers
      const rsiAll = await this.rsiAnalyzer.calculateAll();
      const emaAll = await this.emaAnalyzer.calculateAll();
      const atr = this.atrIndicator.calculate(primaryCandles);

      // Extract PRIMARY timeframe data
      const rsi = rsiAll.primary ?? 0;
      const emaFast = emaAll.primary?.fast ?? 0;
      const emaSlow = emaAll.primary?.slow ?? 0;

      // Extract TREND1 (30m) timeframe data for higher timeframe confirmation
      const rsiTrend1 = rsiAll.trend1;
      const emaTrend1 = emaAll.trend1;

      // Extract CONTEXT (1h) timeframe data for trend blocking
      const emaContext = emaAll.context;

      // Fetch HTF candles for Multi-Timeframe Level Confirmation (Phase 3)
      let candlesTrend1: Candle[] | undefined;
      let candlesTrend2: Candle[] | undefined;
      let candlesContext: Candle[] | undefined;

      try {
        if (this.timeframeProvider.isTimeframeEnabled(TimeframeRole.TREND1)) {
          candlesTrend1 = await this.candleProvider.getCandles(TimeframeRole.TREND1);
        }
        if (this.timeframeProvider.isTimeframeEnabled(TimeframeRole.TREND2)) {
          candlesTrend2 = await this.candleProvider.getCandles(TimeframeRole.TREND2);
        }
        if (this.timeframeProvider.isTimeframeEnabled(TimeframeRole.CONTEXT)) {
          candlesContext = await this.candleProvider.getCandles(TimeframeRole.CONTEXT);
        }
      } catch (error) {
        this.logger.debug('HTF candles fetch error (non-critical)', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Calculate swing points on PRIMARY timeframe (5m) for better signal quality
      const { swingHighs, swingLows } = this.zigzagNRIndicator.findSwingPoints(primaryCandles);
      const swingPoints = [...swingHighs, ...swingLows].sort((a, b) => a.timestamp - b.timestamp);

      // Liquidity analysis on PRIMARY candles
      const liquidityAnalysis = this.liquidityDetector.analyze(swingPoints, primaryCandles, currentTimestamp);

      // RSI history for divergence using PRIMARY candles
      const rsiIndicator = new RSIIndicator(14);
      const rsiHistory = new Map<number, number>();
      primaryCandles.slice(-INTEGER_MULTIPLIERS.TWENTY).forEach((candle, idx) => {
        const candleRsi = rsiIndicator.calculate(
          primaryCandles.slice(0, primaryCandles.length - INTEGER_MULTIPLIERS.TWENTY + idx + 1),
        );
        rsiHistory.set(candle.timestamp, candleRsi);
      });

      // Divergence analysis
      const divergence = this.divergenceDetector.detect(swingPoints, rsiHistory);

      // Calculate Stochastic if enabled (on PRIMARY candles)
      let stochastic: StrategyMarketData['stochastic'];
      if (this.stochasticIndicator && this.config.indicators?.stochastic) {
        try {
          const result = this.stochasticIndicator.calculate(primaryCandles);
          const { oversoldThreshold, overboughtThreshold } = this.config.indicators.stochastic;
          stochastic = {
            k: result.k,
            d: result.d,
            isOversold: result.k < oversoldThreshold,
            isOverbought: result.k > overboughtThreshold,
          };

          // Log on INFO when extreme conditions
          if (stochastic.isOversold || stochastic.isOverbought) {
            this.logger.info('📊 Stochastic EXTREME detected', {
              k: result.k.toFixed(DECIMAL_PLACES.PERCENT),
              d: result.d.toFixed(DECIMAL_PLACES.PERCENT),
              condition: stochastic.isOversold ? 'OVERSOLD' : 'OVERBOUGHT',
              threshold: stochastic.isOversold ? `<${oversoldThreshold}` : `>${overboughtThreshold}`,
            });
          } else {
            this.logger.debug('Stochastic calculated for strategy', {
              k: result.k.toFixed(DECIMAL_PLACES.PERCENT),
              d: result.d.toFixed(DECIMAL_PLACES.PERCENT),
              oversold: stochastic.isOversold,
              overbought: stochastic.isOverbought,
            });
          }
        } catch (error) {
          this.logger.warn('Stochastic calculation failed', { error });
        }
      }

      // Calculate Bollinger Bands if enabled
      let bollingerBands: StrategyMarketData['bollingerBands'];
      if (this.bollingerIndicator && this.config.indicators?.bollingerBands) {
        try {
          // Apply adaptive params if enabled and ATR available
          if (this.config.indicators.bollingerBands.adaptiveParams && atr !== undefined) {
            const adaptiveParams = this.bollingerIndicator.getAdaptiveParams(atr, currentPrice);
            this.bollingerIndicator.applyAdaptiveParams(adaptiveParams);

            // Determine volatility category from stdDev
            const volatilityCategory = adaptiveParams.stdDev >= MULTIPLIER_VALUES.TWO_POINT_FIVE
              ? 'HIGH'
              : adaptiveParams.stdDev >= MULTIPLIER_VALUES.TWO
                ? 'MEDIUM'
                : 'LOW';

            // Log adaptive params on INFO (volatility-based adjustments are important)
            this.logger.info('🔧 BB Adaptive Params Applied', {
              volatility: volatilityCategory,
              period: adaptiveParams.period,
              stdDev: adaptiveParams.stdDev.toFixed(1),
              atr: atr.toFixed(DECIMAL_PLACES.PERCENT) + '%',
            });
          }

          const result = this.bollingerIndicator.calculate(primaryCandles);
          const isSqueeze = this.bollingerIndicator.isSqueeze(
            this.config.indicators.bollingerBands.squeezeThreshold,
          );

          bollingerBands = {
            upper: result.upper,
            middle: result.middle,
            lower: result.lower,
            width: result.width,
            percentB: result.percentB,
            isSqueeze,
          };

          // Determine position within bands
          const pricePosition = result.percentB <= THRESHOLD_VALUES.FIFTEEN_PERCENT
            ? 'NEAR_LOWER'
            : result.percentB >= THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT
              ? 'NEAR_UPPER'
              : result.percentB >= THRESHOLD_VALUES.THIRTY_PERCENT &&
                  result.percentB <= CONFIDENCE_THRESHOLDS.MODERATE
                ? 'MIDDLE_ZONE'
                : 'NORMAL';

          // Log on INFO when squeeze or near edges
          if (isSqueeze || pricePosition === 'NEAR_LOWER' || pricePosition === 'NEAR_UPPER') {
            this.logger.info('📈 Bollinger Bands EVENT', {
              upper: result.upper.toFixed(DECIMAL_PLACES.PRICE),
              middle: result.middle.toFixed(DECIMAL_PLACES.PRICE),
              lower: result.lower.toFixed(DECIMAL_PLACES.PRICE),
              currentPrice: currentPrice.toFixed(DECIMAL_PLACES.PRICE),
              width: result.width.toFixed(DECIMAL_PLACES.PERCENT) + '%',
              percentB: result.percentB.toFixed(DECIMAL_PLACES.PERCENT),
              position: pricePosition,
              squeeze: isSqueeze ? '🔥 YES' : 'no',
            });
          } else {
            this.logger.debug('Bollinger Bands calculated for strategy', {
              upper: result.upper.toFixed(DECIMAL_PLACES.PERCENT),
              middle: result.middle.toFixed(DECIMAL_PLACES.PERCENT),
              lower: result.lower.toFixed(DECIMAL_PLACES.PERCENT),
              width: result.width.toFixed(DECIMAL_PLACES.PERCENT) + '%',
              percentB: result.percentB.toFixed(DECIMAL_PLACES.PERCENT),
              squeeze: isSqueeze,
            });
          }
        } catch (error) {
          this.logger.warn('Bollinger Bands calculation failed', { error });
        }
      }

      // Predict breakout direction if BB squeeze detected
      let breakoutPrediction: StrategyMarketData['breakoutPrediction'];
      if (bollingerBands?.isSqueeze) {
        try {
          const recentVolumes = primaryCandles.slice(-INTEGER_MULTIPLIERS.TWENTY).map(c => c.volume);
          const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
          const currentVolume = primaryCandles[primaryCandles.length - 1].volume;
          const volumeRatio = currentVolume / avgVolume;

          const prediction = this.breakoutPredictor.predict(emaFast, emaSlow, rsi, volumeRatio);

          breakoutPrediction = {
            direction: prediction.direction,
            confidence: prediction.confidence,
            emaTrend: prediction.factors.emaTrend,
            rsiMomentum: prediction.factors.rsiMomentum,
            volumeStrength: prediction.factors.volumeStrength,
          };

          this.logger.info('🔮 Breakout prediction generated', {
            direction: prediction.direction,
            confidence: prediction.confidence.toFixed(1) + '%',
            reason: prediction.reason,
          });
        } catch (error) {
          this.logger.warn('Breakout prediction failed', { error });
        }
      }

      // Delta Analysis
      const deltaAnalysis = this.deltaAnalyzerService?.analyze();

      // Orderbook Imbalance Analysis
      let imbalanceAnalysis;
      if (this.orderbookImbalanceService && this.currentOrderbook) {
        const normalizeLevel = (level: OrderbookLevel): [number, number] => {
          if (Array.isArray(level)) {
            return level as [number, number];
          }
          const objLevel = level as { price: number; size: number };
          return [objLevel.price, objLevel.size];
        };

        imbalanceAnalysis = this.orderbookImbalanceService.analyze({
          bids: this.currentOrderbook.bids.map(normalizeLevel),
          asks: this.currentOrderbook.asks.map(normalizeLevel),
        });
      }

      const marketData: StrategyMarketData = {
        timestamp: currentTimestamp,
        currentPrice,
        candles: primaryCandles,
        swingPoints,
        rsi,
        rsiTrend1,
        ema: {
          fast: emaFast,
          slow: emaSlow,
        },
        emaTrend1,
        atr,
        trend: 'NEUTRAL',
        liquidity: liquidityAnalysis,
        divergence,
        ...(this.currentOrderbook && { orderbook: this.currentOrderbook }),
        context: null,
        stochastic,
        bollingerBands,
        breakoutPrediction,
        deltaAnalysis,
        imbalanceAnalysis,
        // Phase 3: Multi-Timeframe Level Confirmation
        candlesTrend1,
        candlesTrend2,
        candlesContext,
        emaContext,
      };

      return marketData;
    } catch (error) {
      this.logger.error('Error preparing market data', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Synchronize time with Bybit exchange
   * CRITICAL: Prevents timestamp errors when opening positions
   */
  async syncTimeWithExchange(): Promise<void> {
    try {
      const serverTime = await this.bybitService.getServerTime();
      const localTime = Date.now();
      const drift = localTime - serverTime;

      if (Math.abs(drift) > 5000) {
        this.logger.warn('⚠️ Large time drift detected', {
          drift: `${drift}ms`,
          serverTime,
          localTime,
          recommendation: 'Check system clock',
        });
      } else {
        this.logger.debug('Time synchronized with exchange', {
          drift: `${drift}ms`,
        });
      }
    } catch (error) {
      this.logger.error('Failed to sync time with exchange', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
