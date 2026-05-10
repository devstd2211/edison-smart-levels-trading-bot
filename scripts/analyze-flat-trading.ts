/**
 * Analyze Flat Market Trading
 *
 * Diagnoses why bot is not trading in sideways/flat markets
 */

import { SqliteDataProvider } from './data-providers';
import { FlatMarketDetector } from '../packages/core/src/analyzers/flat-market.detector';
import { ZigZagIndicator } from '../packages/core/src/indicators/zigzag.indicator';
import { RSIIndicator } from '../packages/core/src/indicators/rsi.indicator';
import { EMAIndicator } from '../packages/core/src/indicators/ema.indicator';
import { LoggerService, LogLevel, Candle, MarketStructure, TradingContext, TrendBias } from '../packages/core/src/types';
import * as fs from 'fs';
import * as path from 'path';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`${ICONS.search} ANALYZING FLAT MARKET TRADING`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  const logger = new LoggerService(LogLevel.ERROR, './logs', false);

  // Load config
  const configPath = path.join(__dirname, '../config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // Load recent data from SQLite
  const provider = new SqliteDataProvider();
  console.log(`${ICONS.inbox} Loading recent data from SQLite...
`);

  const { candles5m } = await provider.loadCandles('APEXUSDT');
  await provider.close();

  // Take last 200 5m candles for analysis
  const recentCandles = candles5m.slice(-200);

  console.log(`${ICONS.chart} Analyzing last 200 5m candles...`);
  console.log(`   Time range: ${new Date(recentCandles[0].timestamp).toISOString()} → ${new Date(recentCandles[recentCandles.length - 1].timestamp).toISOString()}\n`);

  // Calculate indicators
  const rsiIndicator = new RSIIndicator(14);
  const emaFastIndicator = new EMAIndicator(20);
  const emaSlowIndicator = new EMAIndicator(50);
  const zigzag = new ZigZagIndicator(config.indicators.zigzagDepth || 12);

  const rsi = rsiIndicator.calculate(recentCandles as Candle[]);
  const emaFast = emaFastIndicator.calculate(recentCandles as Candle[]);
  const emaSlow = emaSlowIndicator.calculate(recentCandles as Candle[]);
  const lastCandle = recentCandles[recentCandles.length - 1];
  const currentPrice = lastCandle.close;

  // Calculate ATR
  const atrValues: number[] = [];
  for (let i = 14; i < recentCandles.length; i++) {
    const period = recentCandles.slice(i - 14, i + 1);
    let atrSum = 0;
    for (let j = 1; j < period.length; j++) {
      const tr = Math.max(
        period[j].high - period[j].low,
        Math.abs(period[j].high - period[j - 1].close),
        Math.abs(period[j].low - period[j - 1].close)
      );
      atrSum += tr;
    }
    atrValues.push(atrSum / 14);
  }
  const atr = atrValues[atrValues.length - 1] || 0;
  const atrPercent = (atr / currentPrice) * 100;

  // Determine market structure
  const highs = zigzag.findSwingHighs(recentCandles as Candle[]);
  const lows = zigzag.findSwingLows(recentCandles as Candle[]);

  let marketStructure: MarketStructure | null = null;
  if (highs.length >= 2 && lows.length >= 2) {
    const lastTwoHighs = highs.slice(-2);
    const lastTwoLows = lows.slice(-2);

    if (Math.abs(lastTwoHighs[1].price - lastTwoHighs[0].price) / lastTwoHighs[0].price < 0.005) {
      marketStructure = MarketStructure.EQUAL_HIGH;
    } else if (Math.abs(lastTwoLows[1].price - lastTwoLows[0].price) / lastTwoLows[0].price < 0.005) {
      marketStructure = MarketStructure.EQUAL_LOW;
    } else if (lastTwoHighs[1].price > lastTwoHighs[0].price) {
      marketStructure = MarketStructure.HIGHER_HIGH;
    } else if (lastTwoLows[1].price < lastTwoLows[0].price) {
      marketStructure = MarketStructure.LOWER_LOW;
    }
  }

  // Create mock TradingContext
  const tradingContext: TradingContext = {
    timestamp: lastCandle.timestamp,
    trend: emaFast && emaSlow ? (emaFast > emaSlow ? TrendBias.BULLISH : emaFast < emaSlow ? TrendBias.BEARISH : TrendBias.NEUTRAL) : TrendBias.NEUTRAL,
    atrPercent,
    ema50: emaSlow || 0,
    emaDistance: emaFast && emaSlow ? Math.abs(emaFast - emaSlow) / emaSlow * 100 : 0,
    marketStructure,
    atrModifier: 1,
    emaModifier: 1,
    trendModifier: 1,
    overallModifier: 1,
    isValidContext: true,
    blockedBy: [],
    warnings: [],
  };

  console.log(`${ICONS.chart_up} Market Indicators:`);
  console.log(`   Price: ${currentPrice.toFixed(4)}`);
  console.log(`   RSI: ${rsi?.toFixed(2)} (Oversold < 40, Overbought > 65)`);
  console.log(`   EMA Fast (20): ${emaFast?.toFixed(4)}`);
  console.log(`   EMA Slow (50): ${emaSlow?.toFixed(4)}`);
  console.log(`   EMA Distance: ${tradingContext.emaDistance.toFixed(2)}%`);
  console.log(`   ATR: ${atr.toFixed(4)} (${atrPercent.toFixed(2)}%)`);
  console.log(`   Trend: ${tradingContext.trend}`);
  console.log(`   Market Structure: ${marketStructure || 'N/A'}`);
  console.log(`   Swing Points: ${highs.length} highs, ${lows.length} lows\n`);

  // Run FlatMarketDetector
  const flatConfig = config.flatMarketDetection;
  const flatDetector = new FlatMarketDetector(flatConfig, logger);

  const flatResult = flatDetector.detect(
    recentCandles as Candle[],
    tradingContext,
    emaFast || 0,
    emaSlow || 0
  );

  console.log(`${ICONS.bolt} FLAT MARKET DETECTION:`);
  console.log(`   Decision: ${flatResult.isFlat ? '🟢 FLAT' : '🔴 TRENDING'}`);
  console.log(`   Confidence: ${flatResult.confidence.toFixed(1)}% (threshold: ${flatConfig.flatThreshold}%)`);
  console.log(`   Factors:`);
  console.log(`     - EMA Distance: ${flatResult.factors.emaDistance}/20 (threshold: ${flatConfig.emaThreshold}%)`);
  console.log(`     - ATR Volatility: ${flatResult.factors.atrVolatility}/20 (threshold: ${flatConfig.atrThreshold}%)`);
  console.log(`     - Price Range: ${flatResult.factors.priceRange}/15 (threshold: ${flatConfig.rangeThreshold}%)`);
  console.log(`     - ZigZag Pattern: ${flatResult.factors.zigzagPattern}/20`);
  console.log(`     - EMA Slope: ${flatResult.factors.emaSlope}/15 (threshold: ${flatConfig.slopeThreshold}°)`);
  console.log(`     - Volume Distribution: ${flatResult.factors.volumeDistribution}/10\n`);

  // Strategy analysis
  console.log(`${ICONS.target} STRATEGY ANALYSIS (Why bot is not trading):`);
  console.log('');

  // TrendFollowing
  console.log(`   ${ICONS.keycap_1} TrendFollowing Strategy:`);
  const trendRsiOk = rsi && (rsi < 30 || rsi > 70);
  const trendTrendOk = emaFast && emaSlow && Math.abs(emaFast - emaSlow) / currentPrice * 100 > 0.5;
  console.log(`      - RSI in reversal zone (< 30 or > 70): ${trendRsiOk ? '✅ YES' : `❌ NO (${rsi?.toFixed(2)})`}`);
  console.log(`      - Clear trend (EMA distance > 0.5%): ${trendTrendOk ? '✅ YES' : '❌ NO'}`);
  console.log(`      - Can trade: ${trendRsiOk && trendTrendOk ? '✅ YES' : '❌ NO'}\n`);

  // LevelBased
  console.log(`   ${ICONS.keycap_2} LevelBased Strategy:`);
  const levelSwingsOk = highs.length >= 2 && lows.length >= 2;
  console.log(`      - Swing points: ${highs.length} highs + ${lows.length} lows`);
  console.log(`      - Enough for trading (2+ each): ${levelSwingsOk ? '✅ YES' : `❌ NO`}`);
  console.log(`      - Can trade: ${levelSwingsOk ? '✅ YES (should be working!)' : '❌ NO'}\n`);

  // CounterTrend
  console.log(`   ${ICONS.keycap_3} CounterTrend Strategy:`);
  const counterRsiOk = rsi && (rsi < 40 || rsi > 65);
  console.log(`      - RSI in extreme zone (< 40 or > 65): ${counterRsiOk ? '✅ YES' : `❌ NO (${rsi?.toFixed(2)})`}`);
  console.log(`      - Can trade: ${counterRsiOk ? '✅ YES' : '❌ NO'}\n`);

  console.log(`${ICONS.light_bulb} RECOMMENDATIONS:`);
  console.log('');

  if (flatResult.isFlat) {
    console.log(`   ${ICONS.success} FLAT market CONFIRMED (confidence: ` + flatResult.confidence.toFixed(1) + '%)');
    console.log(`   ${ICONS.chart} FlatMarketDetector works correctly - adjusts TP to single target
`);

    if (!levelSwingsOk) {
      console.log(`   ${ICONS.error} PROBLEM: LevelBased strategy is BLOCKED (not enough swing points)`);
      console.log(`   ${ICONS.wrench} SOLUTION: This was already FIXED - bot now uses PRIMARY (5m) candles`);
      console.log(`   ${ICONS.warning}  Make sure fix is deployed to production!
`);
    } else {
      console.log(`   ${ICONS.success} LevelBased strategy CAN trade (has enough swing points)`);
      console.log(`   ${ICONS.thinking} If bot still not trading, check:`);
      console.log('      - Price is near support/resistance level?');
      console.log('      - Confirmation candle (rejection/bounce) happening?\n');
    }

    if (!counterRsiOk && !trendRsiOk) {
      console.log(`   ${ICONS.warning}  RSI is NEUTRAL (` + (rsi?.toFixed(2) || 'N/A') + ') - no extreme conditions');
      console.log(`   ${ICONS.thought} Consider:`);
      console.log('      - Expanding CounterTrend RSI thresholds (< 45 or > 60)?');
      console.log('      - Adding dedicated FLAT market strategy (range trading)?\n');
    }
  } else {
    console.log(`   ${ICONS.red_circle} Market is TRENDING (confidence: ` + flatResult.confidence.toFixed(1) + '%)');
    console.log(`   ${ICONS.chart} But strategies still require specific conditions:`);
    console.log('      - TrendFollowing: needs RSI reversal');
    console.log('      - LevelBased: needs price near level + confirmation');
    console.log('      - CounterTrend: needs RSI extreme\n');
  }

  // Price range analysis
  const prices = recentCandles.map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;
  const rangePercent = (range / minPrice) * 100;

  console.log(`${ICONS.ruler} Price Action Analysis (200 candles):`);
  console.log(`   Range: ${minPrice.toFixed(4)} - ${maxPrice.toFixed(4)} (${rangePercent.toFixed(2)}%)`);
  console.log(`   Current: ${currentPrice.toFixed(4)} (${((currentPrice - minPrice) / range * 100).toFixed(1)}% in range)`);

  if (rangePercent < 3) {
    console.log(`   ${ICONS.warning}  TIGHT range (< 3%) - classic sideways market`);
    console.log(`   ${ICONS.light_bulb} Perfect condition for range trading strategy!
`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error(`${ICONS.error} Error:`, error);
  process.exit(1);
});

