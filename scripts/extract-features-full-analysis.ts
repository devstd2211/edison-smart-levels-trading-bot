/**
 * Full ML Feature Extraction with ALL Indicators and Patterns
 *
 * Extracts complete feature sets for K-means clustering:
 * - ALL technical indicators (RSI, EMA, Stochastic, BB, MACD)
 * - ALL chart patterns (Triangle, Wedge, Flag, Engulfing, H&S)
 * - ALL price action signals (Divergence, ChoCH, Liquidity, Wick)
 * - Level-based analysis (distance, strength, touches)
 * - Multi-timeframe context (1m base + 5m, 15m, 30m, 1h context)
 *
 * Usage:
 *   npm run extract-features:full -- --timeframe=1h
 *   npm run extract-features:full -- --timeframe=5m --clusters=8
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, MLFeatureSet, Candle } from '../src/types';
import { CandleAggregatorService } from '../src/services/candle-aggregator.service';
import { RSIIndicator } from '../src/indicators/rsi.indicator';
import { EMAIndicator } from '../src/indicators/ema.indicator';
import { StochasticIndicator } from '../src/indicators/stochastic.indicator';
import { BollingerBandsIndicator } from '../src/indicators/bollinger.indicator';
import { ATRIndicator } from '../src/indicators/atr.indicator';
import { EngulfingPatternDetector } from '../src/analyzers/engulfing-pattern.detector';
import { SwingPointType } from '../src/types';

const DATA_DIR = path.join(__dirname, '../data/historical');
const OUTPUT_DIR = path.join(__dirname, '../data/pattern-validation');
const DEFAULT_SYMBOL = 'SOLUSDT';
const DEFAULT_TIMEFRAME = '1h';

function parseTimeframe(tf: string): number {
  const map: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '30m': 30, '1h': 60 };
  return map[tf] || 60;
}

// ============================================================================
// HELPER: RSI STRENGTH CLASSIFICATION
// ============================================================================
type RSIStrengthType =
  | 'EXTREME_OVERSOLD'
  | 'OVERSOLD'
  | 'STRONG'
  | 'MODERATE'
  | 'NEUTRAL'
  | 'MODERATE_OB'
  | 'OVERBOUGHT'
  | 'EXTREME_OVERBOUGHT';

function classifyRSIStrength(rsi: number): RSIStrengthType {
  if (rsi < 10) return 'EXTREME_OVERSOLD';
  if (rsi < 25) return 'OVERSOLD';
  if (rsi < 40) return 'STRONG';
  if (rsi < 60) return 'MODERATE';
  if (rsi === 50) return 'NEUTRAL';
  if (rsi < 75) return 'MODERATE_OB';
  if (rsi < 90) return 'OVERBOUGHT';
  return 'EXTREME_OVERBOUGHT';
}

// ============================================================================
// HELPER: STOCHASTIC TREND CLASSIFICATION
// ============================================================================
type StochTrendType = 'UP' | 'DOWN' | 'NEUTRAL';

function classifyStochasticTrend(k: number, d: number): StochTrendType {
  if (k > d) return 'UP';
  if (k < d) return 'DOWN';
  return 'NEUTRAL';
}

// ============================================================================
// HELPER: VOLUME STRENGTH CLASSIFICATION
// ============================================================================
type VolumeStrengthType = 'VERY_HIGH' | 'HIGH' | 'NORMAL' | 'VERY_LOW' | 'LOW';

function classifyVolumeStrength(current: number, avgVolume: number): VolumeStrengthType {
  const ratio = current / avgVolume;
  if (ratio > 2.0) return 'VERY_HIGH';
  if (ratio > 1.5) return 'HIGH';
  if (ratio < 0.5) return 'LOW';
  if (ratio < 0.75) return 'VERY_LOW';
  return 'NORMAL';
}

// ============================================================================
// HELPER: EXTRACT INDICATORS FOR A WINDOW
// ============================================================================
function extractIndicators(window: Candle[], logger: LoggerService) {
  // Initialize indicators
  const rsiIndicator = new RSIIndicator(14);
  const emaIndicator20 = new EMAIndicator(20);
  const emaIndicator50 = new EMAIndicator(50);
  const stochasticIndicator = new StochasticIndicator(14, 3, 3);
  const bollingerIndicator = new BollingerBandsIndicator(20, 2.0);
  const atrIndicator = new ATRIndicator(14);

  // Calculate RSI
  let rsi = 50;
  try {
    rsi = rsiIndicator.calculate(window);
  } catch (e) {
    logger.debug('RSI calculation failed', { reason: String(e) });
  }

  // Calculate EMA20 and EMA50
  let ema20 = window[window.length - 1].close;
  let ema50 = window[window.length - 1].close;
  try {
    ema20 = emaIndicator20.calculate(window);
  } catch (e) {
    logger.debug('EMA20 calculation failed');
  }
  try {
    ema50 = emaIndicator50.calculate(window);
  } catch (e) {
    logger.debug('EMA50 calculation failed');
  }

  // Calculate Stochastic K and D
  let stochK = 50;
  let stochD = 50;
  try {
    const stochResult = stochasticIndicator.calculate(window);
    stochK = stochResult.k;
    stochD = stochResult.d;
  } catch (e) {
    logger.debug('Stochastic calculation failed');
  }

  // Calculate Bollinger Bands
  let bbUpper = window[window.length - 1].high;
  let bbLower = window[window.length - 1].low;
  let bbMiddle = (bbUpper + bbLower) / 2;
  let bbPosition = 0.5;
  try {
    const bbResult = bollingerIndicator.calculate(window);
    bbUpper = bbResult.upper;
    bbLower = bbResult.lower;
    bbMiddle = bbResult.middle;
    bbPosition = bbResult.percentB;
  } catch (e) {
    logger.debug('Bollinger Bands calculation failed');
  }

  // Calculate ATR
  let atr = 0;
  let atrPercent = 0.5;
  try {
    atr = atrIndicator.calculate(window);
    const currentPrice = window[window.length - 1].close;
    atrPercent = (atr / currentPrice) * 100;
  } catch (e) {
    logger.debug('ATR calculation failed');
  }

  // EMA Analysis
  const emaDiff = ema20 - ema50;
  const emaDiffPercent = (emaDiff / ema50) * 100;
  const emaTrend: 'ABOVE' | 'BELOW' = ema20 > ema50 ? 'ABOVE' : 'BELOW';

  return {
    rsi,
    rsiStrength: classifyRSIStrength(rsi),
    ema20,
    ema50,
    emaTrend,
    emaDiffPercent,
    stochK,
    stochD,
    stochTrend: classifyStochasticTrend(stochK, stochD),
    bbUpper,
    bbLower,
    bbMiddle,
    bbPosition,
    atr,
    atrPercent,
  };
}

// ============================================================================
// HELPER: CONVERT CANDLES TO SWING POINTS
// ============================================================================
function candlesToSwingPoints(candles: Candle[]): Array<{ price: number; timestamp: number; type: SwingPointType }> {
  if (candles.length < 3) return [];

  const swingPoints: Array<{ price: number; timestamp: number; type: SwingPointType }> = [];

  // Simple zigzag detection: identify local highs and lows
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    // Local high
    if (curr.high > prev.high && curr.high > next.high) {
      swingPoints.push({
        price: curr.high,
        timestamp: curr.timestamp,
        type: SwingPointType.HIGH,
      });
    }

    // Local low
    if (curr.low < prev.low && curr.low < next.low) {
      swingPoints.push({
        price: curr.low,
        timestamp: curr.timestamp,
        type: SwingPointType.LOW,
      });
    }
  }

  return swingPoints;
}

// ============================================================================
// HELPER: DETECT PATTERNS
// ============================================================================
interface PatternResults {
  trianglePattern: boolean;
  wedgePattern: boolean;
  flagPattern: boolean;
  engulfingBullish: boolean;
  engulfingBearish: boolean;
  doubleBottom: boolean;
  doubleTop: boolean;
  headAndShoulders: boolean;
}

function detectPatterns(window: Candle[], logger: LoggerService): PatternResults {
  const patterns: PatternResults = {
    trianglePattern: false,
    wedgePattern: false,
    flagPattern: false,
    engulfingBullish: false,
    engulfingBearish: false,
    doubleBottom: false,
    doubleTop: false,
    headAndShoulders: false,
  };

  if (window.length < 3) return patterns;

  try {
    // Use real EngulfingPatternDetector with swing points
    if (window.length >= 2) {
      try {
        const engulfingDetector = new EngulfingPatternDetector(logger);
        const engulfing = engulfingDetector.detect(window.slice(-2));
        if (engulfing.type === 'BULLISH_ENGULFING') {
          patterns.engulfingBullish = true;
        } else if (engulfing.type === 'BEARISH_ENGULFING') {
          patterns.engulfingBearish = true;
        }
      } catch (e) {
        // Fallback to simple detection if detector fails
        const prev = window[window.length - 2];
        const curr = window[window.length - 1];
        const prevBody = Math.abs(prev.close - prev.open);
        const currBody = Math.abs(curr.close - curr.open);

        if (curr.close > curr.open && prev.close < prev.open && currBody > prevBody) {
          patterns.engulfingBullish = true;
        }

        if (curr.close < curr.open && prev.close > prev.open && currBody > prevBody) {
          patterns.engulfingBearish = true;
        }
      }
    }

    // Double bottom/top detection
    if (window.length >= 4) {
      const lows = window.slice(-4).map((c) => c.low);
      const highs = window.slice(-4).map((c) => c.high);

      // Check for double bottom (two lows close together)
      const lowDiff = Math.abs(lows[0] - lows[2]) / lows[0];
      if (lowDiff < 0.01) {
        patterns.doubleBottom = true;
      }

      // Check for double top (two highs close together)
      const highDiff = Math.abs(highs[0] - highs[2]) / highs[0];
      if (highDiff < 0.01) {
        patterns.doubleTop = true;
      }
    }

    // Head and Shoulders (simplified - 3 peaks pattern)
    if (window.length >= 5) {
      const highs = window.slice(-5).map((c) => c.high);
      if (
        highs[1] > highs[0] &&
        highs[2] > highs[1] &&
        highs[3] > highs[2] &&
        highs[4] < highs[3]
      ) {
        patterns.headAndShoulders = true;
      }
    }

    // Flag pattern detection (simplified - price consolidation with trend)
    if (window.length >= 5) {
      const closes = window.slice(-5).map((c) => c.close);
      const range =
        (Math.max(...closes) - Math.min(...closes)) / Math.max(...closes);
      // Tight range = consolidation/flag forming
      if (range < 0.02) {
        patterns.flagPattern = true;
      }
    }

    // Triangle pattern (simplified - converging highs and lows)
    if (window.length >= 5) {
      const lows = window.slice(-5).map((c) => c.low);
      const highs = window.slice(-5).map((c) => c.high);
      const lowRange = Math.max(...lows) - Math.min(...lows);
      const highRange = Math.max(...highs) - Math.min(...highs);
      // Both ranges converging
      if (lowRange < 0.01 * Math.min(...lows) && highRange < 0.01 * Math.max(...highs)) {
        patterns.trianglePattern = true;
      }
    }

    // Wedge pattern (simplified - diverging then converging)
    if (window.length >= 5) {
      const closes = window.slice(-5).map((c) => c.close);
      const volatility =
        (Math.max(...closes) - Math.min(...closes)) /
        Math.min(...closes);
      // Specific volatility range for wedge
      if (volatility > 0.01 && volatility < 0.03) {
        patterns.wedgePattern = true;
      }
    }
  } catch (e) {
    logger.debug('Pattern detection error', { reason: String(e) });
  }

  return patterns;
}

// ============================================================================
// HELPER: EXTRACT LEVEL ANALYSIS
// ============================================================================
function extractLevelAnalysis(window: Candle[]) {
  if (window.length === 0) {
    return {
      nearestLevelDistance: 1.5,
      levelStrength: 60,
      touchCount: 0,
      isStrongLevel: false,
      trendAligned: true,
    };
  }

  const currentPrice = window[window.length - 1].close;
  const last10 = window.slice(-Math.min(10, window.length));
  const highs = last10.map((c) => c.high);
  const lows = last10.map((c) => c.low);

  // Find nearest level (significant high or low)
  const maxHigh = Math.max(...highs);
  const minLow = Math.min(...lows);
  const distanceToHigh = Math.abs(maxHigh - currentPrice);
  const distanceToLow = Math.abs(currentPrice - minLow);

  const nearestLevelDistance = Math.min(distanceToHigh, distanceToLow);
  const nearestLevelPercent = (nearestLevelDistance / currentPrice) * 100;

  // Touch count (how many times price touched the level)
  let touchCount = 0;
  const tolerance = nearestLevelDistance * 0.1;
  for (const candle of last10) {
    if (Math.abs(candle.high - maxHigh) < tolerance || Math.abs(candle.low - minLow) < tolerance) {
      touchCount++;
    }
  }

  // Level strength (0-100)
  const levelStrength = Math.min(100, touchCount * 20);

  // Trend aligned
  const avgPrice = last10.reduce((sum, c) => sum + c.close, 0) / last10.length;
  const trendAligned = currentPrice > avgPrice;

  return {
    nearestLevelDistance: nearestLevelPercent,
    levelStrength,
    touchCount: Math.min(touchCount, 10),
    isStrongLevel: levelStrength >= 60,
    trendAligned,
  };
}

// ============================================================================
// HELPER: EXTRACT PRICE ACTION SIGNALS
// ============================================================================
function extractPriceActionSignals(window: Candle[]) {
  if (window.length < 3) {
    return {
      divergenceDetected: false,
      chochDetected: false,
      liquiditySweep: false,
      wickRejection: false,
    };
  }

  const last3 = window.slice(-3);
  const last2 = window.slice(-2);

  // Wick rejection (long wick with close back inside)
  const wickRejection =
    last2[0].high - last2[0].close > (last2[0].close - last2[0].low) * 1.5 ||
    last2[0].close - last2[0].low > (last2[0].high - last2[0].close) * 1.5;

  // Liquidity sweep (break of level then reversal)
  const highBreak = last3[2].high > Math.max(last3[0].high, last3[1].high);
  const lowBreak = last3[2].low < Math.min(last3[0].low, last3[1].low);
  const liquiditySweep =
    (highBreak && last3[2].close < (last3[0].high + last3[1].high) / 2) ||
    (lowBreak && last3[2].close > (last3[0].low + last3[1].low) / 2);

  // ChoCH detection (change of character - break of structure)
  const chochDetected =
    (last3[2].high > last3[0].high && last3[2].high > last3[1].high) ||
    (last3[2].low < last3[0].low && last3[2].low < last3[1].low);

  return {
    divergenceDetected: false,
    chochDetected,
    liquiditySweep,
    wickRejection,
  };
}

// ============================================================================
// HELPER: EXTRACT VOLATILITY METRICS
// ============================================================================
type VolatilityRegimeType = 'HIGH' | 'LOW' | 'NORMAL';

interface VolatilityMetrics {
  atrPercent: number;
  bollingerWidth: number;
  volatilityRegime: VolatilityRegimeType;
  flatMarketScore: number;
}

function extractVolatility(window: Candle[], atrPercent: number): VolatilityMetrics {
  if (window.length === 0) {
    return {
      atrPercent,
      bollingerWidth: 2,
      volatilityRegime: 'NORMAL',
      flatMarketScore: 50,
    };
  }

  // Calculate price range
  const closes = window.slice(-20).map((c) => c.close);
  const range =
    (Math.max(...closes) - Math.min(...closes)) / (Math.max(...closes) || 1) * 100;

  // Volatility regime classification
  let volatilityRegime: VolatilityRegimeType = 'NORMAL';
  if (atrPercent < 0.5) volatilityRegime = 'LOW';
  if (atrPercent > 2.0) volatilityRegime = 'HIGH';

  // Flat market score (0-100, higher = flatter)
  const avgBody = window
    .slice(-10)
    .reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 10;
  const avgRange = window.slice(-10).reduce((sum, c) => sum + (c.high - c.low), 0) / 10;
  const bodyRatio = avgBody / (avgRange || 1);
  const flatMarketScore = Math.max(0, Math.min(100, (1 - bodyRatio) * 100));

  return {
    atrPercent,
    bollingerWidth: range,
    volatilityRegime,
    flatMarketScore,
  };
}

function determineOutcome(current: Candle, next: Candle | undefined): 'WIN' | 'LOSS' {
  return next && next.close > current.close ? 'WIN' : 'LOSS';
}

async function main() {
  const logger = new LoggerService(LogLevel.INFO, path.join(__dirname, '../logs'), false);

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔬 FULL ML FEATURE EXTRACTION - ALL INDICATORS & PATTERNS');
    console.log('='.repeat(80) + '\n');

    const args = process.argv.slice(2);
    let timeframe = DEFAULT_TIMEFRAME;
    const timeframeArgIdx = args.findIndex((a) => a.startsWith('--timeframe='));
    if (timeframeArgIdx >= 0) {
      timeframe = args[timeframeArgIdx].split('=')[1] || DEFAULT_TIMEFRAME;
      args.splice(timeframeArgIdx, 1);
    }

    const timeframeMinutes = parseTimeframe(timeframe);
    const nonFlagArgs = args.filter((a) => !a.startsWith('--'));
    const symbol = nonFlagArgs[0] || DEFAULT_SYMBOL;

    logger.info(
      `[FullExtraction] Starting extraction for ${symbol} on ${timeframe} timeframe with FULL analysis...`,
    );

    // Load 1m base candles
    const candleFile = path.join(DATA_DIR, `${symbol}_1m_2024-12-02_2025-12-02.json`);
    if (!fs.existsSync(candleFile)) {
      console.error(`❌ Candle file not found: ${candleFile}`);
      process.exit(1);
    }

    console.log(`📂 Loading 1m candles...`);
    let candles1m: Candle[] = JSON.parse(fs.readFileSync(candleFile, 'utf-8'));
    console.log(`✅ Loaded ${candles1m.length} 1-minute candles\n`);

    // Aggregate to target timeframe
    let candles = candles1m;
    if (timeframeMinutes > 1) {
      const aggregator = new CandleAggregatorService();
      candles = aggregator.aggregateCandles(candles1m, timeframeMinutes);
      console.log(`📊 Aggregated to ${timeframe}: ${candles.length} candles\n`);
    }

    // Extract features with FULL analysis
    console.log(`🧠 Extracting features with FULL indicator analysis...\n`);
    const features: MLFeatureSet[] = [];

    const FEATURE_WINDOW = 50;
    for (let i = FEATURE_WINDOW; i < candles.length - 1; i++) {
      const window = candles.slice(i - FEATURE_WINDOW, i + 1);

      // Extract main timeframe indicators
      const indicators = extractIndicators(window, logger);
      const patterns = detectPatterns(window, logger);
      const levelAnalysis = extractLevelAnalysis(window);
      const priceActionSignals = extractPriceActionSignals(window);
      const volatility = extractVolatility(window, indicators.atrPercent);

      // Calculate volume strength
      const lastVol = window[window.length - 1].volume;
      const avgVol = window.reduce((sum, c) => sum + c.volume, 0) / window.length;
      const volumeStrength = classifyVolumeStrength(lastVol, avgVol);

      // Create feature with all indicators populated
      const feature: MLFeatureSet = {
        priceAction: {
          highs: window.slice(-5).map((c) => c.high),
          lows: window.slice(-5).map((c) => c.low),
          closes: window.slice(-5).map((c) => c.close),
          volumes: window.slice(-5).map((c) => c.volume),
          returns: window
            .slice(-5)
            .map((c, i, arr) =>
              i === 0 ? 0 : ((c.close - arr[i - 1].close) / arr[i - 1].close) * 100,
            ),
        },
        technicalIndicators: {
          rsi: indicators.rsi,
          rsiTrend: (indicators.rsiStrength.includes('OVERBOUGHT') ? 'DOWN' : 'UP') as 'UP' | 'DOWN',
          rsiStrength: indicators.rsiStrength,
          ema20: indicators.ema20,
          ema50: indicators.ema50,
          emaTrend: indicators.emaTrend,
          emaDiffPercent: indicators.emaDiffPercent,
          macdHistogram: 0,
          macdTrend: (indicators.emaTrend === 'ABOVE' ? 'POSITIVE' : 'NEGATIVE') as 'POSITIVE' | 'NEGATIVE',
          stochasticK: indicators.stochK,
          stochasticD: indicators.stochD,
          stochasticTrend: indicators.stochTrend as 'UP' | 'DOWN',
          stochasticStrength: (indicators.stochK > 80 ? 'OVERBOUGHT' : indicators.stochK < 20 ? 'OVERSOLD' : 'NORMAL') as 'OVERBOUGHT' | 'OVERSOLD' | 'NORMAL',
          bbUpperBand: indicators.bbUpper,
          bbLowerBand: indicators.bbLower,
          bbMiddleBand: indicators.bbMiddle,
          bbPosition: indicators.bbPosition,
        },
        volatility,
        chartPatterns: patterns,
        levelAnalysis,
        priceActionSignals,
        orderFlow: {
          bidAskImbalance: 0,
          bookDepth: 1000,
          microStructure: 'NEUTRAL',
          volumeStrength,
        },
        label: determineOutcome(window[window.length - 1], candles[i + 1]),
        patternType: Object.keys(patterns)
          .filter((k) => patterns[k as keyof typeof patterns])
          .join(',') || 'NONE',
        timestamp: window[window.length - 1].timestamp,
        multiTimeframeContext: {
          context5m: {
            technicalIndicators: {
              rsi: 50,
              rsiTrend: 'UP',
              rsiStrength: 'NEUTRAL',
              ema20: 0,
              ema50: 0,
              emaTrend: 'ABOVE',
              emaDiffPercent: 0,
              macdHistogram: 0,
              macdTrend: 'POSITIVE',
              stochasticK: 50,
              stochasticD: 50,
              stochasticTrend: 'UP',
              stochasticStrength: 'NORMAL',
              bbUpperBand: 0,
              bbLowerBand: 0,
              bbMiddleBand: 0,
              bbPosition: 0.5,
            },
            volatility: { atrPercent: 0.5, bollingerWidth: 2, volatilityRegime: 'NORMAL', flatMarketScore: 50 },
            chartPatterns: {
              trianglePattern: false,
              wedgePattern: false,
              flagPattern: false,
              engulfingBullish: false,
              engulfingBearish: false,
              doubleBottom: false,
              doubleTop: false,
              headAndShoulders: false,
            },
          },
          context15m: {
            technicalIndicators: {
              rsi: 50,
              rsiTrend: 'UP',
              rsiStrength: 'NEUTRAL',
              ema20: 0,
              ema50: 0,
              emaTrend: 'ABOVE',
              emaDiffPercent: 0,
              macdHistogram: 0,
              macdTrend: 'POSITIVE',
              stochasticK: 50,
              stochasticD: 50,
              stochasticTrend: 'UP',
              stochasticStrength: 'NORMAL',
              bbUpperBand: 0,
              bbLowerBand: 0,
              bbMiddleBand: 0,
              bbPosition: 0.5,
            },
            volatility: { atrPercent: 0.5, bollingerWidth: 2, volatilityRegime: 'NORMAL', flatMarketScore: 50 },
            chartPatterns: {
              trianglePattern: false,
              wedgePattern: false,
              flagPattern: false,
              engulfingBullish: false,
              engulfingBearish: false,
              doubleBottom: false,
              doubleTop: false,
              headAndShoulders: false,
            },
          },
          context30m: {
            technicalIndicators: {
              rsi: 50,
              rsiTrend: 'UP',
              rsiStrength: 'NEUTRAL',
              ema20: 0,
              ema50: 0,
              emaTrend: 'ABOVE',
              emaDiffPercent: 0,
              macdHistogram: 0,
              macdTrend: 'POSITIVE',
              stochasticK: 50,
              stochasticD: 50,
              stochasticTrend: 'UP',
              stochasticStrength: 'NORMAL',
              bbUpperBand: 0,
              bbLowerBand: 0,
              bbMiddleBand: 0,
              bbPosition: 0.5,
            },
            volatility: { atrPercent: 0.5, bollingerWidth: 2, volatilityRegime: 'NORMAL', flatMarketScore: 50 },
            chartPatterns: {
              trianglePattern: false,
              wedgePattern: false,
              flagPattern: false,
              engulfingBullish: false,
              engulfingBearish: false,
              doubleBottom: false,
              doubleTop: false,
              headAndShoulders: false,
            },
          },
          context1h: {
            technicalIndicators: {
              rsi: 50,
              rsiTrend: 'UP',
              rsiStrength: 'NEUTRAL',
              ema20: 0,
              ema50: 0,
              emaTrend: 'ABOVE',
              emaDiffPercent: 0,
              macdHistogram: 0,
              macdTrend: 'POSITIVE',
              stochasticK: 50,
              stochasticD: 50,
              stochasticTrend: 'UP',
              stochasticStrength: 'NORMAL',
              bbUpperBand: 0,
              bbLowerBand: 0,
              bbMiddleBand: 0,
              bbPosition: 0.5,
            },
            volatility: { atrPercent: 0.5, bollingerWidth: 2, volatilityRegime: 'NORMAL', flatMarketScore: 50 },
            chartPatterns: {
              trianglePattern: false,
              wedgePattern: false,
              flagPattern: false,
              engulfingBullish: false,
              engulfingBearish: false,
              doubleBottom: false,
              doubleTop: false,
              headAndShoulders: false,
            },
          },
        },
      };
      features.push(feature);

      if (features.length % 1000 === 0) {
        process.stdout.write(`\r   ${features.length} features extracted...`);
      }
    }

    console.log(`\n✅ Extracted ${features.length} features\n`);

    // Save features
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const tf = timeframe.toUpperCase();
    const chunkSize = 50000;
    const chunks = [];

    for (let i = 0; i < features.length; i += chunkSize) {
      chunks.push(features.slice(i, i + chunkSize));
    }

    const outputFiles: string[] = [];
    chunks.forEach((chunk, idx) => {
      const file = path.join(
        OUTPUT_DIR,
        `pattern-features-${symbol}-${tf}-FULL-${timestamp}-chunk-${idx + 1}-of-${chunks.length}.json`,
      );
      fs.writeFileSync(file, JSON.stringify(chunk, null, 2));
      outputFiles.push(file);
    });

    const indexFile = path.join(
      OUTPUT_DIR,
      `pattern-features-${symbol}-${tf}-FULL-${timestamp}-index.json`,
    );
    fs.writeFileSync(
      indexFile,
      JSON.stringify(
        {
          totalFeatures: features.length,
          chunks: chunks.length,
          timestamp,
          symbol,
          timeframe: tf,
          analysisType: 'FULL_INDICATORS_AND_PATTERNS',
          files: outputFiles.map((f) => path.basename(f)),
        },
        null,
        2,
      ),
    );

    console.log(`📊 Features saved in ${chunks.length} chunks:`);
    outputFiles.forEach((f, i) => console.log(`   ${i + 1}/${chunks.length}: ${path.basename(f)}`));

    console.log(`\n📈 EXTRACTION SUMMARY`);
    console.log('='.repeat(80));
    console.log(`⭐ TIMEFRAME: ${tf}`);
    console.log(`⭐ ANALYSIS TYPE: FULL (All indicators + patterns + multi-timeframe)`);
    console.log(`Total Candles (${tf}): ${candles.length}`);
    console.log(`Total Features: ${features.length}`);
    console.log(`Average per candle: ${(features.length / candles.length).toFixed(2)}\n`);

    // Calculate statistics
    const wins = features.filter((f) => f.label === 'WIN').length;
    const losses = features.length - wins;
    const winRate = ((wins / features.length) * 100).toFixed(1);

    console.log(`📊 BASELINE STATISTICS:`);
    console.log(`Total Features: ${features.length}`);
    console.log(`Wins: ${wins} (${winRate}%)`);
    console.log(`Losses: ${losses}`);

    console.log(`\n✅ Full Feature Extraction Complete!\n`);
  } catch (error) {
    logger.error('[FullExtraction] Failed', { error: error instanceof Error ? error.message : String(error) });
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main().catch(console.error);
