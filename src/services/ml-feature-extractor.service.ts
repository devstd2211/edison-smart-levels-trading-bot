/**
 * ML Feature Extractor Service
 *
 * Extracts ML feature sets from historical candles for pattern discovery.
 * Combines price action, technical indicators, volatility, and order flow data.
 * Supports multi-timeframe feature extraction (1m, 5m, 15m, 1h context).
 */

import { MLFeatureSet, Candle, LoggerService } from '../types';
import { CandleAggregatorService } from './candle-aggregator.service';
import {
  INTEGER_MULTIPLIERS,
  RATIO_MULTIPLIERS,
  THRESHOLD_VALUES,
  FIRST_INDEX,
  SECOND_INDEX,
  PERCENT_MULTIPLIER,
  MATH_BOUNDS,
} from '../constants/technical.constants';

export interface MultiTimeframeContext {
  candles1m: Candle[];
  candles5m: Candle[];
  candles15m: Candle[];
  candles1h: Candle[];
}

export class MLFeatureExtractorService {
  private aggregator: CandleAggregatorService;

  constructor(private logger: LoggerService) {
    this.aggregator = new CandleAggregatorService();
  }

  /**
   * Extract ML features from historical candles
   * @param candles - Historical candle data
   * @param patternType - Type of pattern detected
   * @param outcome - WIN or LOSS (based on next candle direction)
   * @returns MLFeatureSet for the candle
   */
  extractFeatures(
    candles: Candle[],
    patternType: string,
    outcome: 'WIN' | 'LOSS',
  ): MLFeatureSet {
    if (candles.length < (INTEGER_MULTIPLIERS.FIVE as number)) {
      throw new Error('Need at least 5 candles to extract features');
    }

    // Get last 5 candles for price action
    const last5 = candles.slice(-(INTEGER_MULTIPLIERS.FIVE as number));

    // Price Action Features
    const priceAction = this.extractPriceAction(last5);

    // Technical Indicators
    const technicalIndicators = this.extractTechnicalIndicators(candles);

    // Volatility (pass full candles for proper ATR and BB calculation)
    const volatility = this.extractVolatility(candles);

    // Order Flow (placeholder - would need orderbook data)
    const orderFlow = this.extractOrderFlow(last5);

    // Chart Patterns (placeholder - would need pattern detection)
    const chartPatterns = {
      trianglePattern: false,
      wedgePattern: false,
      flagPattern: false,
      engulfingBullish: false,
      engulfingBearish: false,
      doubleBottom: false,
      doubleTop: false,
      headAndShoulders: false,
    };

    // Level Analysis (placeholder - would need level detection)
    const levelAnalysis = {
      nearestLevelDistance: RATIO_MULTIPLIERS.FULL as number,
      levelStrength: INTEGER_MULTIPLIERS.FIFTY as number,
      touchCount: FIRST_INDEX as number,
      isStrongLevel: false,
      trendAligned: false,
    };

    // Price Action Signals (placeholder - would need signal detection)
    const priceActionSignals = {
      divergenceDetected: false,
      chochDetected: false,
      liquiditySweep: false,
      wickRejection: false,
    };

    return {
      priceAction,
      technicalIndicators,
      volatility,
      orderFlow,
      chartPatterns,
      levelAnalysis,
      priceActionSignals,
      label: outcome,
      patternType,
      timestamp: last5[last5.length - (SECOND_INDEX as number)].timestamp,
    };
  }

  /**
   * Extract price action features from last 5 candles
   */
  private extractPriceAction(candles: Candle[]): MLFeatureSet['priceAction'] {
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);

    // Calculate returns (close-to-close % change)
    const returns: number[] = [];
    for (let i = (SECOND_INDEX as number); i < closes.length; i++) {
      const ret = ((closes[i] - closes[i - (SECOND_INDEX as number)]) / closes[i - (SECOND_INDEX as number)]) * (PERCENT_MULTIPLIER as number);
      returns.push(ret);
    }
    returns.unshift(FIRST_INDEX as number); // First candle has no previous close

    return {
      highs,
      lows,
      closes,
      volumes,
      returns,
    };
  }

  /**
   * Extract technical indicator features
   */
  private extractTechnicalIndicators(candles: Candle[]): MLFeatureSet['technicalIndicators'] {
    // RSI (using all candles for proper calculation, 14-period)
    const rsiValues = this.calculateRSI(candles);
    const rsi = rsiValues.length > (FIRST_INDEX as number) ? rsiValues[rsiValues.length - (SECOND_INDEX as number)] : (INTEGER_MULTIPLIERS.FIFTY as number);

    // RSI trend (is RSI rising or falling?)
    const rsiTrend = rsiValues.length >= (INTEGER_MULTIPLIERS.TWO as number)
      ? rsiValues[rsiValues.length - (SECOND_INDEX as number)] > rsiValues[rsiValues.length - (INTEGER_MULTIPLIERS.TWO as number)] ? 'UP' : 'DOWN'
      : 'UP';

    // RSI strength classification
    const rsiStrength = this.classifyRSIStrength(rsi);

    // EMA (using last 20 and 50 candles)
    const ema20 = this.calculateEMA(candles, INTEGER_MULTIPLIERS.TWENTY as number);
    const ema50 = this.calculateEMA(candles, INTEGER_MULTIPLIERS.FIFTY as number);
    const currentPrice = candles[candles.length - (SECOND_INDEX as number)].close;

    // EMA trend
    const emaTrend = currentPrice > ema50 ? 'ABOVE' : 'BELOW';

    // EMA diff percent
    const emaDiffPercent = ema50 > (FIRST_INDEX as number) ? ((ema20 - ema50) / ema50) * (PERCENT_MULTIPLIER as number) : (FIRST_INDEX as number);

    // MACD (simplified - using EMA 12 and 26)
    const ema12 = this.calculateEMA(candles, 12);
    const ema26 = this.calculateEMA(candles, 26);
    const macdHistogram = ema12 - ema26;
    const macdTrend = macdHistogram > (FIRST_INDEX as number) ? 'POSITIVE' : 'NEGATIVE';

    // Stochastic (simplified - using RSI as proxy)
    const stochasticK = rsi;
    const stochasticD = rsi; // In production, use proper smoothing
    const stochasticTrend = rsiTrend;
    const stochasticStrength = rsi < (INTEGER_MULTIPLIERS.THIRTY as number) ? 'OVERSOLD' : rsi > (INTEGER_MULTIPLIERS.SEVENTY as number) ? 'OVERBOUGHT' : 'NORMAL';

    // Bollinger Bands (simplified)
    const closes = candles.map((c) => c.close);
    const { upper, lower, middle } = this.calculateBollingerBands(closes);
    const bbPosition = upper > lower ? (currentPrice - lower) / (upper - lower) : (RATIO_MULTIPLIERS.HALF as number);

    return {
      rsi,
      rsiTrend,
      rsiStrength,
      ema20,
      ema50,
      emaTrend,
      emaDiffPercent,
      macdHistogram,
      macdTrend,
      stochasticK,
      stochasticD,
      stochasticTrend,
      stochasticStrength,
      bbUpperBand: upper,
      bbLowerBand: lower,
      bbMiddleBand: middle,
      bbPosition,
    };
  }

  /**
   * Extract volatility features
   */
  private extractVolatility(candles: Candle[]): MLFeatureSet['volatility'] {
    const closes = candles.map((c) => c.close);
    const currentPrice = closes[closes.length - 1];

    // ATR (Average True Range) as % of current price
    const atrPercent = this.calculateATR(candles) / currentPrice;

    // Bollinger Bands width as % of price
    const { width } = this.calculateBollingerBands(closes);
    const bollingerWidth = width / currentPrice;

    // Volatility regime (LOW/NORMAL/HIGH)
    const volatilityRegime = this.classifyVolatility(atrPercent);

    // Flat market score (0-100, higher = flatter/more consolidation)
    const flatMarketScore = this.calculateFlatMarketScore(candles);

    return {
      atrPercent,
      bollingerWidth,
      volatilityRegime,
      flatMarketScore,
    };
  }

  /**
   * Extract order flow features (placeholder)
   */
  private extractOrderFlow(candles: Candle[]): MLFeatureSet['orderFlow'] {
    // In production, this would use real orderbook data
    // For now, we'll use price/volume imbalance as proxy

    const currentCandle = candles[candles.length - (SECOND_INDEX as number)];
    const prevCandle = candles[candles.length - (INTEGER_MULTIPLIERS.TWO as number)];

    // Simple imbalance: (current volume - prev volume) / total
    const volumeImbalance = (currentCandle.volume - prevCandle.volume) / (currentCandle.volume + prevCandle.volume);

    // Bid/ask imbalance (placeholder: based on close position in range)
    const range = currentCandle.high - currentCandle.low;
    const closePosition = currentCandle.close - currentCandle.low;
    const bidAskImbalance = range > (FIRST_INDEX as number) ? (closePosition / range - (RATIO_MULTIPLIERS.HALF as number)) * (INTEGER_MULTIPLIERS.TWO as number) : (FIRST_INDEX as number);

    // Microstructure (placeholder: based on close vs open)
    const microStructure = currentCandle.close > currentCandle.open
      ? 'BULLISH'
      : currentCandle.close < currentCandle.open
        ? 'BEARISH'
        : 'NEUTRAL';

    // Volume strength classification (based on avg volume)
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, FIRST_INDEX as number) / candles.length;
    const volumeStrength = currentCandle.volume > avgVolume * (RATIO_MULTIPLIERS.PLUS_50_PERCENT as number)
      ? 'VERY_HIGH'
      : currentCandle.volume > avgVolume * (RATIO_MULTIPLIERS.PLUS_20_PERCENT as number)
        ? 'HIGH'
        : currentCandle.volume < avgVolume * (THRESHOLD_VALUES.SEVENTY_PERCENT as number)
          ? 'VERY_LOW'
          : currentCandle.volume < avgVolume * (THRESHOLD_VALUES.EIGHTY_FIVE_PERCENT as number)
            ? 'LOW'
            : 'NORMAL';

    return {
      bidAskImbalance,
      bookDepth: PERCENT_MULTIPLIER as number, // Placeholder
      microStructure,
      volumeStrength,
    };
  }

  /**
   * Calculate RSI
   * Uses available data even if less than period (minimum 2 candles needed)
   */
  private calculateRSI(candles: Candle[], period: number = 14): number[] {
    const closes = candles.map((c) => c.close);
    const rsiValues: number[] = [];

    if (closes.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      return [];
    }

    // Use actual period up to available data
    const actualPeriod = Math.min(period, closes.length - (SECOND_INDEX as number));

    // Calculate changes
    const changes: number[] = [];
    for (let i = (SECOND_INDEX as number); i < closes.length; i++) {
      changes.push(closes[i] - closes[i - (SECOND_INDEX as number)]);
    }

    // Calculate average gains and losses
    let avgGain = FIRST_INDEX as number;
    let avgLoss = FIRST_INDEX as number;

    for (let i = (FIRST_INDEX as number); i < actualPeriod && i < changes.length; i++) {
      if (changes[i] > (FIRST_INDEX as number)) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }

    avgGain /= actualPeriod;
    avgLoss /= actualPeriod;

    // Calculate RSI for each subsequent candle
    for (let i = actualPeriod; i < changes.length; i++) {
      const gain = changes[i] > (FIRST_INDEX as number) ? changes[i] : (FIRST_INDEX as number);
      const loss = changes[i] < (FIRST_INDEX as number) ? Math.abs(changes[i]) : (FIRST_INDEX as number);

      avgGain = (avgGain * (actualPeriod - (SECOND_INDEX as number)) + gain) / actualPeriod;
      avgLoss = (avgLoss * (actualPeriod - (SECOND_INDEX as number)) + loss) / actualPeriod;

      // When no price movement (avgGain = avgLoss = 0), RSI = 50 (neutral)
      let rsi: number;
      if (avgGain === (FIRST_INDEX as number) && avgLoss === (FIRST_INDEX as number)) {
        rsi = INTEGER_MULTIPLIERS.FIFTY as number; // Neutral RSI for flat market
      } else if (avgLoss === (FIRST_INDEX as number)) {
        rsi = (PERCENT_MULTIPLIER as number); // Max RSI when no losses
      } else {
        const rs = avgGain / avgLoss;
        rsi = (PERCENT_MULTIPLIER as number) - (PERCENT_MULTIPLIER as number) / ((SECOND_INDEX as number) + rs);
      }

      rsiValues.push(rsi);
    }

    return rsiValues;
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(candles: Candle[], period: number): number {
    const closes = candles.map((c) => c.close);

    if (closes.length < period) {
      // Return SMA if not enough data
      return closes.reduce((a, b) => a + b, FIRST_INDEX as number) / closes.length;
    }

    const k = (INTEGER_MULTIPLIERS.TWO as number) / (period + (SECOND_INDEX as number));
    let ema = closes.slice(FIRST_INDEX as number, period).reduce((a, b) => a + b, FIRST_INDEX as number) / period;

    for (let i = period; i < closes.length; i++) {
      ema = closes[i] * k + ema * ((SECOND_INDEX as number) - k);
    }

    return ema;
  }

  /**
   * Calculate ATR (Average True Range)
   * Uses available data if less than period (instead of returning 0)
   */
  private calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < (INTEGER_MULTIPLIERS.TWO as number)) {
      return FIRST_INDEX as number;
    }

    const trValues: number[] = [];

    for (let i = (SECOND_INDEX as number); i < candles.length; i++) {
      const curr = candles[i];
      const prev = candles[i - (SECOND_INDEX as number)];

      const tr1 = curr.high - curr.low;
      const tr2 = Math.abs(curr.high - prev.close);
      const tr3 = Math.abs(curr.low - prev.close);

      const tr = Math.max(tr1, tr2, tr3);
      trValues.push(tr);
    }

    // Calculate ATR using available TR values (minimum of period or available)
    const actualPeriod = Math.min(period, trValues.length);
    if (actualPeriod === (FIRST_INDEX as number)) return FIRST_INDEX as number;

    const atr = trValues.slice(-actualPeriod).reduce((a, b) => a + b, FIRST_INDEX as number) / actualPeriod;
    return atr;
  }

  /**
   * Calculate Bollinger Bands
   * Uses available data if less than period (instead of returning 0)
   */
  private calculateBollingerBands(
    closes: number[],
    period: number = INTEGER_MULTIPLIERS.TWENTY as number,
    stdDev: number = INTEGER_MULTIPLIERS.TWO as number,
  ): { middle: number; upper: number; lower: number; width: number } {
    if (closes.length === (FIRST_INDEX as number)) {
      return {
        middle: FIRST_INDEX as number,
        upper: FIRST_INDEX as number,
        lower: FIRST_INDEX as number,
        width: FIRST_INDEX as number,
      };
    }

    // Use all available data if less than period
    const actualPeriod = Math.min(period, closes.length);
    const lastPrices = closes.slice(-actualPeriod);
    const middle = lastPrices.reduce((a, b) => a + b, FIRST_INDEX as number) / actualPeriod;

    const variance = lastPrices.reduce((sum, price) => sum + Math.pow(price - middle, INTEGER_MULTIPLIERS.TWO as number), FIRST_INDEX as number) / actualPeriod;
    const standardDev = Math.sqrt(variance);

    const upper = middle + stdDev * standardDev;
    const lower = middle - stdDev * standardDev;
    const width = upper - lower;

    return { middle, upper, lower, width };
  }

  /**
   * Classify volatility regime
   */
  private classifyVolatility(atrPercent: number): 'LOW' | 'NORMAL' | 'HIGH' {
    if (atrPercent < (THRESHOLD_VALUES.THIRTY_PERCENT as number)) return 'LOW';
    if (atrPercent > (RATIO_MULTIPLIERS.FULL as number)) return 'HIGH';
    return 'NORMAL';
  }

  /**
   * Extract ML features with multi-timeframe context
   * @param candles1m - 1-minute historical candles
   * @param patternType - Type of pattern detected
   * @param outcome - WIN or LOSS (based on next candle direction)
   * @param minCandlesFor1m - Minimum 1m candles needed (default: 50)
   * @returns MLFeatureSet with multi-timeframe features
   */
  extractFeaturesMultiTimeframe(
    candles1m: Candle[],
    patternType: string,
    outcome: 'WIN' | 'LOSS',
    minCandlesFor1m: number = INTEGER_MULTIPLIERS.FIFTY as number,
  ): MLFeatureSet {
    if (candles1m.length < minCandlesFor1m) {
      throw new Error(`Need at least ${minCandlesFor1m} 1m candles for multi-timeframe extraction`);
    }

    // Aggregate to different timeframes
    const candles5m = this.aggregator.getCandles5m(candles1m);
    const candles15m = this.aggregator.getCandles15m(candles1m);
    const candles1h = this.aggregator.getCandles1h(candles1m);

    // Extract price action from 1m (primary)
    const priceAction1m = this.extractPriceAction(candles1m.slice(-(INTEGER_MULTIPLIERS.FIVE as number)));

    // Extract technical indicators from multiple timeframes
    const indicators1m = this.extractTechnicalIndicators(candles1m);
    const indicators5m = candles5m.length > (FIRST_INDEX as number) ? this.extractTechnicalIndicators(candles5m) : indicators1m;
    const indicators15m = candles15m.length > (FIRST_INDEX as number) ? this.extractTechnicalIndicators(candles15m) : indicators1m;
    const indicators1h = candles1h.length > (FIRST_INDEX as number) ? this.extractTechnicalIndicators(candles1h) : indicators1m;

    // Extract volatility from different timeframes
    const volatility1m = this.extractVolatility(candles1m);
    const volatility5m = candles5m.length > (FIRST_INDEX as number) ? this.extractVolatility(candles5m) : volatility1m;
    const volatility15m = candles15m.length > (FIRST_INDEX as number) ? this.extractVolatility(candles15m) : volatility1m;
    const volatility1h = candles1h.length > (FIRST_INDEX as number) ? this.extractVolatility(candles1h) : volatility1m;

    // Order flow from 1m
    const orderFlow = this.extractOrderFlow(candles1m.slice(-(INTEGER_MULTIPLIERS.FIVE as number)));

    // Chart Patterns (placeholder)
    const chartPatterns = {
      trianglePattern: false,
      wedgePattern: false,
      flagPattern: false,
      engulfingBullish: false,
      engulfingBearish: false,
      doubleBottom: false,
      doubleTop: false,
      headAndShoulders: false,
    };

    // Level Analysis (placeholder)
    const levelAnalysis = {
      nearestLevelDistance: RATIO_MULTIPLIERS.FULL as number,
      levelStrength: INTEGER_MULTIPLIERS.FIFTY as number,
      touchCount: FIRST_INDEX as number,
      isStrongLevel: false,
      trendAligned: false,
    };

    // Price Action Signals (placeholder)
    const priceActionSignals = {
      divergenceDetected: false,
      chochDetected: false,
      liquiditySweep: false,
      wickRejection: false,
    };

    // Combine into extended feature set with multi-timeframe context
    return {
      priceAction: priceAction1m, // Primary 1m context
      technicalIndicators: indicators1m,
      volatility: volatility1m,
      orderFlow,
      chartPatterns,
      levelAnalysis,
      priceActionSignals,
      label: outcome,
      patternType,
      timestamp: candles1m[candles1m.length - (SECOND_INDEX as number)].timestamp,
      // Extended multi-timeframe fields
      multiTimeframeContext: {
        context5m: {
          technicalIndicators: indicators5m,
          volatility: volatility5m,
          chartPatterns,
        },
        context15m: {
          technicalIndicators: indicators15m,
          volatility: volatility15m,
          chartPatterns,
        },
        context30m: {
          technicalIndicators: indicators1m,
          volatility: volatility1m,
          chartPatterns,
        },
        context1h: {
          technicalIndicators: indicators1h,
          volatility: volatility1h,
          chartPatterns,
        },
      },
    };
  }

  /**
   * Classify RSI strength level
   */
  private classifyRSIStrength(
    rsi: number,
  ): 'EXTREME_OVERSOLD' | 'OVERSOLD' | 'STRONG' | 'MODERATE' | 'NEUTRAL' | 'MODERATE_OB' | 'OVERBOUGHT' | 'EXTREME_OVERBOUGHT' {
    if (rsi <= (INTEGER_MULTIPLIERS.TEN as number)) return 'EXTREME_OVERSOLD';
    if (rsi <= (INTEGER_MULTIPLIERS.THIRTY as number)) return 'OVERSOLD';
    if (rsi <= 40) return 'STRONG';
    if (rsi <= (INTEGER_MULTIPLIERS.FIFTY as number)) return 'MODERATE';
    if (rsi <= (INTEGER_MULTIPLIERS.SIXTY as number)) return 'NEUTRAL';
    if (rsi <= (INTEGER_MULTIPLIERS.SEVENTY as number)) return 'MODERATE_OB';
    if (rsi <= 90) return 'OVERBOUGHT';
    return 'EXTREME_OVERBOUGHT';
  }

  /**
   * Calculate flat market score (0-100, higher = flatter/consolidation)
   * Based on ATR, Bollinger band width, and range over past candles
   */
  private calculateFlatMarketScore(candles: Candle[]): number {
    if (candles.length < (INTEGER_MULTIPLIERS.FIVE as number)) {
      return INTEGER_MULTIPLIERS.FIFTY as number; // Default neutral score
    }

    const last10 = candles.slice(-(INTEGER_MULTIPLIERS.TEN as number));
    const highs = last10.map((c) => c.high);
    const lows = last10.map((c) => c.low);
    const closes = last10.map((c) => c.close);

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;
    const avgClose = closes.reduce((sum, c) => sum + c, FIRST_INDEX as number) / closes.length;

    // Range as % of average price
    const rangePercent = avgClose > (FIRST_INDEX as number) ? (range / avgClose) * (PERCENT_MULTIPLIER as number) : (FIRST_INDEX as number);

    // Flat if range is very small (<0.5%)
    // High consolidation if range is 0.5-1%
    // Normal trending if range is >1%
    if (rangePercent < (RATIO_MULTIPLIERS.HALF as number)) return 90; // Very flat
    if (rangePercent < (RATIO_MULTIPLIERS.FULL as number)) return INTEGER_MULTIPLIERS.SEVENTY as number; // Moderately flat
    if (rangePercent < (RATIO_MULTIPLIERS.DOUBLE as number)) return INTEGER_MULTIPLIERS.FIFTY as number; // Neutral
    return INTEGER_MULTIPLIERS.THIRTY as number; // Trending (lower flat score)
  }
}
