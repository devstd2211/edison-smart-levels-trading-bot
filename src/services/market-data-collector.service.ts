import { DECIMAL_PLACES } from '../constants';
/**
 * Market Data Collector Service
 *
 * Collects market data from multiple sources:
 * - Current price (Bybit)
 * - RSI data (Multi-timeframe)
 * - EMA data (Multi-timeframe)
 * - ZigZag swing points (Highs/Lows)
 * - Market structure (Pattern/Bias)
 * - Stochastic oscillator (optional)
 * - Bollinger Bands (optional)
 * - ATR for adaptive BB params
 *
 * Extracted from SignalGeneratorService for better testability and SRP.
 */

import {
  SwingPoint,
  Candle,
  TimeframeRole,
  LoggerService,
  MarketData,
  Config,
  RSIValues,
  EMAValues,
  StochasticIndicator,
  BollingerBandsIndicator,
  ATRIndicator,
  VWAPIndicator,
  MarketStructureAnalyzer,
} from '../types';
import { MultiTimeframeRSIAnalyzer } from '../analyzers/multi-timeframe-rsi.analyzer';
import { MultiTimeframeEMAAnalyzer } from '../analyzers/multi-timeframe-ema.analyzer';
import { TFAlignmentService } from './tf-alignment.service';
import { CandleProvider } from '../providers/candle.provider';
import { BybitService } from './bybit';

// ============================================================================
// MARKET DATA COLLECTOR SERVICE
// ============================================================================

export class MarketDataCollector {
  private stochasticIndicator?: StochasticIndicator;
  private bollingerIndicator?: BollingerBandsIndicator;
  private atrIndicator: ATRIndicator;
  private vwapIndicator: VWAPIndicator;
  private tfAlignmentService?: TFAlignmentService;

  constructor(
    private rsiAnalyzer: MultiTimeframeRSIAnalyzer,
    private emaAnalyzer: MultiTimeframeEMAAnalyzer,

    private structureAnalyzer: MarketStructureAnalyzer,
    private candleProvider: CandleProvider,
    private bybitService: BybitService,
    private logger: LoggerService,
    private config: Config,
  ) {
    // Initialize Stochastic if enabled
    if (config.indicators.stochastic?.enabled) {
      const stochConfig = config.indicators.stochastic;
      this.stochasticIndicator = new StochasticIndicator({
        kPeriod: stochConfig.kPeriod,
        dPeriod: stochConfig.dPeriod,
        smooth: stochConfig.smooth,
      });
      this.logger.info('✅ StochasticIndicator initialized', { kPeriod: stochConfig.kPeriod, dPeriod: stochConfig.dPeriod, smooth: stochConfig.smooth });
    }

    // Initialize Bollinger Bands if enabled
    if (config.indicators.bollingerBands?.enabled) {
      const { period, stdDev } = config.indicators.bollingerBands;
      this.bollingerIndicator = new BollingerBandsIndicator(period, stdDev);
      this.logger.info('✅ BollingerBandsIndicator initialized', { period, stdDev });
    }

    // Always initialize ATR (used for adaptive BB and strategies)
    this.atrIndicator = new ATRIndicator(config.indicators.atrPeriod);

    // Always initialize VWAP (PHASE 6)
    this.vwapIndicator = new VWAPIndicator();
    this.logger.info('✅ VWAPIndicator initialized (PHASE 6)');

    // Initialize TFAlignmentService if enabled (PHASE 6)
    if (config.tfAlignment?.enabled) {
      this.tfAlignmentService = new TFAlignmentService(config.tfAlignment, logger);
      this.logger.info('✅ TFAlignmentService initialized (PHASE 6)', {
        minAlignmentScore: config.tfAlignment.minAlignmentScore,
      });
    }
  }

  /**
   * Collect all market data from sources
   *
   * @returns MarketData object or null if collection fails
   */
  async collect(): Promise<MarketData | null> {
    try {
      // Get current price
      const currentPrice = await this.getCurrentPrice();
      this.logger.debug('Current price', { price: currentPrice });

      // Get RSI data
      const rsi = await this.getRSIData();
      this.logger.debug('RSI data collected', {
        primary: rsi[TimeframeRole.PRIMARY]?.toFixed(DECIMAL_PLACES.PERCENT),
        entry: rsi[TimeframeRole.ENTRY]?.toFixed(DECIMAL_PLACES.PERCENT),
        trend1: rsi[TimeframeRole.TREND1]?.toFixed(DECIMAL_PLACES.PERCENT),
      });

      // Get EMA data
      const ema = await this.getEMAData();
      this.logger.debug('EMA data collected', {
        primary: ema[TimeframeRole.PRIMARY]
          ? `fast=${ema[TimeframeRole.PRIMARY].fast?.toFixed(DECIMAL_PLACES.PERCENT)}, slow=${ema[TimeframeRole.PRIMARY].slow?.toFixed(DECIMAL_PLACES.PERCENT)}`
          : 'N/A',
        entry: ema[TimeframeRole.ENTRY]
          ? `fast=${ema[TimeframeRole.ENTRY].fast?.toFixed(DECIMAL_PLACES.PERCENT)}, slow=${ema[TimeframeRole.ENTRY].slow?.toFixed(DECIMAL_PLACES.PERCENT)}`
          : 'N/A',
      });

      // Get ZigZag data (PRIMARY timeframe)
      const primaryCandles = await this.candleProvider.getCandles(TimeframeRole.PRIMARY);
      if (!primaryCandles || primaryCandles.length === 0) {
        this.logger.warn('No PRIMARY candles available');
        return null;
      }

      const zigzagHighs: SwingPoint[] = []; // Deprecated
      const zigzagLows: SwingPoint[] = []; // Deprecated

      this.logger.debug('ZigZag data collection deprecated.');

      // Analyze structure - using empty arrays for compilation
      let pattern: any = null;
      let bias: any = null;

      try {
        pattern = this.structureAnalyzer.getLastPattern(zigzagHighs, zigzagLows);
        bias = this.structureAnalyzer.getTrendBias(zigzagHighs, zigzagLows);
      } catch (error) {
        this.logger.warn('Market structure analysis failed (empty zigzag data)', { error });
      }

      this.logger.info('📊 Market structure (zigzag-based analysis deprecated)', {
        pattern,
        bias,
      });

      // Calculate ATR (always available)
      let atr: number | undefined;
      try {
        atr = this.atrIndicator.calculate(primaryCandles);
        this.logger.debug('ATR calculated', { atr: atr?.toFixed(DECIMAL_PLACES.PRICE) });
      } catch (error) {
        this.logger.warn('ATR calculation failed', { error });
      }

      // Calculate Stochastic if enabled
      let stochastic: MarketData['stochastic'];
      if (this.stochasticIndicator && this.config.indicators.stochastic) {
        try {
          const result = this.stochasticIndicator.calculate(primaryCandles);
          const { oversoldThreshold, overboughtThreshold } = this.config.indicators.stochastic;
          stochastic = {
            k: result.k,
            d: result.d,
            isOversold: result.k < oversoldThreshold,
            isOverbought: result.k > overboughtThreshold,
          };
          this.logger.debug('Stochastic calculated', {
            k: result.k.toFixed(DECIMAL_PLACES.PERCENT),
            d: result.d.toFixed(DECIMAL_PLACES.PERCENT),
            oversold: stochastic.isOversold,
            overbought: stochastic.isOverbought,
          });
        } catch (error) {
          this.logger.warn('Stochastic calculation failed', { error });
        }
      }

      // Calculate Bollinger Bands if enabled
      let bollingerBands: MarketData['bollingerBands'];
      if (this.bollingerIndicator && this.config.indicators.bollingerBands) {
        try {
          // Apply adaptive params if enabled and ATR available
          if (this.config.indicators.bollingerBands.adaptiveParams && atr !== undefined) {
            const adaptiveParams = this.bollingerIndicator.getAdaptiveParams(atr, currentPrice);
            this.bollingerIndicator.applyAdaptiveParams(adaptiveParams);
            this.logger.debug('BB adaptive params applied', {
              period: adaptiveParams.period,
              stdDev: adaptiveParams.stdDev,
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

          this.logger.debug('Bollinger Bands calculated', {
            upper: result.upper.toFixed(DECIMAL_PLACES.PERCENT),
            middle: result.middle.toFixed(DECIMAL_PLACES.PERCENT),
            lower: result.lower.toFixed(DECIMAL_PLACES.PERCENT),
            width: result.width.toFixed(DECIMAL_PLACES.PERCENT) + '%',
            percentB: result.percentB.toFixed(DECIMAL_PLACES.PERCENT),
            squeeze: isSqueeze,
          });
        } catch (error) {
          this.logger.warn('Bollinger Bands calculation failed', { error });
        }
      }

      // Calculate TF Alignment (PHASE 6)
      let tfAlignment: MarketData['tfAlignment'];
      if (this.tfAlignmentService && ema[TimeframeRole.ENTRY] && ema[TimeframeRole.PRIMARY] && ema[TimeframeRole.TREND1]) {
        try {
          const longAlignment = this.tfAlignmentService.calculateAlignment('LONG', currentPrice, {
            entry: { ema20: ema[TimeframeRole.ENTRY]?.fast ?? 0 },
            primary: { ema20: ema[TimeframeRole.PRIMARY]?.fast ?? 0, ema50: ema[TimeframeRole.PRIMARY]?.slow ?? 0 },
            trend1: { ema20: ema[TimeframeRole.TREND1]?.fast ?? 0, ema50: ema[TimeframeRole.TREND1]?.slow ?? 0 },
          });

          const shortAlignment = this.tfAlignmentService.calculateAlignment(
            'SHORT',
            currentPrice,
            {
              entry: { ema20: ema[TimeframeRole.ENTRY]?.fast ?? 0 },
              primary: { ema20: ema[TimeframeRole.PRIMARY]?.fast ?? 0, ema50: ema[TimeframeRole.PRIMARY]?.slow ?? 0 },
              trend1: { ema20: ema[TimeframeRole.TREND1]?.fast ?? 0, ema50: ema[TimeframeRole.TREND1]?.slow ?? 0 },
            },
          );

          tfAlignment = {
            long: longAlignment,
            short: shortAlignment,
          };

          this.logger.debug('TF Alignment calculated (PHASE 6)', {
            long: `${longAlignment.score.toFixed(0)}% (${longAlignment.aligned ? 'aligned' : 'not aligned'})`,
            short: `${shortAlignment.score.toFixed(0)}% (${shortAlignment.aligned ? 'aligned' : 'not aligned'})`,
          });
        } catch (error) {
          this.logger.warn('TF Alignment calculation failed', { error });
        }
      }

      // Calculate VWAP (PHASE 6)
      let vwap: MarketData['vwap'];
      try {
        const entryCandles = await this.candleProvider.getCandles(TimeframeRole.ENTRY);
        const trend1Candles = await this.candleProvider.getCandles(TimeframeRole.TREND1);

        if (primaryCandles && primaryCandles.length > 0) {
          const vwapPrimary = this.vwapIndicator.calculate(primaryCandles);

          let vwapTrend1 = 0;
          if (trend1Candles && trend1Candles.length > 0) {
            vwapTrend1 = this.vwapIndicator.calculate(trend1Candles);
          }

          vwap = {
            primary: vwapPrimary,
            trend1: vwapTrend1,
          };

          this.logger.debug('VWAP calculated (PHASE 6)', {
            primary: vwapPrimary.toFixed(DECIMAL_PLACES.PERCENT),
            trend1: vwapTrend1.toFixed(DECIMAL_PLACES.PERCENT),
          });
        }
      } catch (error) {
        this.logger.warn('VWAP calculation failed', { error });
      }

      return {
        rsi,
        ema,
        zigzagHighs: [],
        zigzagLows: [],
        currentPrice,
        candles: primaryCandles,
        pattern,
        bias,
        stochastic,
        bollingerBands,
        atr,
        tfAlignment,
        vwap,
      };
    } catch (error) {
      this.logger.error('Error collecting market data', { error });
      return null;
    }
  }

  /**
   * Get current price from exchange
   *
   * @returns Current price
   * @throws Error if fetch fails
   */
  async getCurrentPrice(): Promise<number> {
    return await this.bybitService.getCurrentPrice();
  }

  /**
   * Get RSI data from all timeframes
   *
   * @returns RSI values from all timeframes
   */
  async getRSIData(): Promise<RSIValues> {
    return (await this.rsiAnalyzer.calculateAll()) as RSIValues;
  }

  /**
   * Get EMA data from all timeframes
   *
   * @returns EMA values from all timeframes
   */
  async getEMAData(): Promise<EMAValues> {
    return (await this.emaAnalyzer.calculateAll()) as EMAValues;
  }


}
