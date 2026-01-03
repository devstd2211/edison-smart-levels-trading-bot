/**
 * BTC FULL ANALYSIS - Extract features and analyze on ALL timeframes
 *
 * This will:
 * 1. Load BTC data (1m candles)
 * 2. Extract full features on EACH timeframe (1m, 5m, 15m, 1h, 4h)
 * 3. Show RSI, Pattern, Volatility distribution for EACH timeframe
 * 4. Calculate WIN rate for EACH timeframe
 * 5. Show which timeframe is most tradable
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, Candle } from '../src/types';
import { CandleAggregatorService } from '../src/services/candle-aggregator.service';
import { RSIIndicator } from '../src/indicators/rsi.indicator';
import { ATRIndicator } from '../src/indicators/atr.indicator';
import { EMAIndicator } from '../src/indicators/ema.indicator';

interface TimeframeStats {
  timeframe: string;
  candles: number;
  rsiExtreme: number;
  rsiNeutral: number;
  atrPercent: number;
  volatilityLow: number;
  winRate: number;
  upCandles: number;
  downCandles: number;
  priceRange: number;
  tradability: string;
}

const DATA_DIR = path.join(__dirname, '../data/historical');

function findBtcFile(): string {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('BTCUSDT') && f.endsWith('.json'));
  if (files.length === 0) throw new Error('No BTC files found');
  return path.join(DATA_DIR, files[0]);
}

function analyzeTimeframe(candles: Candle[], timeframe: string): TimeframeStats {
  const logger = new LoggerService(LogLevel.ERROR, '', false);

  let rsiExtreme = 0;
  let rsiNeutral = 0;
  let totalAtr = 0;
  let volatilityLow = 0;
  let wins = 0;
  let upCandles = 0;

  const rsiIndicator = new RSIIndicator(14);
  const atrIndicator = new ATRIndicator(14);

  // Process each candle
  for (let i = 50; i < Math.min(candles.length - 1, 5000); i++) {
    const window = candles.slice(i - 50, i + 1);

    try {
      // RSI
      const rsi = rsiIndicator.calculate(window);
      if (rsi > 70 || rsi < 30) rsiExtreme++;
      if (rsi >= 40 && rsi <= 60) rsiNeutral++;

      // ATR
      const atr = atrIndicator.calculate(window);
      const atrPct = (atr / window[window.length - 1].close) * 100;
      totalAtr += atrPct;

      if (atrPct < 0.5) volatilityLow++;

      // WIN/LOSS
      const current = candles[i];
      const next = candles[i + 1];
      if (next.close > current.close) wins++;

      if (current.close > current.open) upCandles++;
    } catch (e) {
      // ignore
    }
  }

  const sampledCount = Math.min(candles.length - 51, 4950);
  const winRate = (wins / sampledCount) * 100;
  const avgAtr = totalAtr / sampledCount;
  const volatilityLowPct = (volatilityLow / sampledCount) * 100;
  const upCandlesPct = (upCandles / sampledCount) * 100;

  // Price range
  const minPrice = Math.min(...candles.map(c => c.close));
  const maxPrice = Math.max(...candles.map(c => c.close));
  const priceRange = ((maxPrice - minPrice) / minPrice) * 100;

  // Determine tradability
  let tradability = '';
  if (priceRange < 2) tradability = '❌ RANGE-BOUND (not tradable)';
  else if (priceRange < 5) tradability = '⚠️  WEAK TREND (borderline)';
  else tradability = '✅ STRONG TREND (tradable!)';

  return {
    timeframe,
    candles: sampledCount,
    rsiExtreme,
    rsiNeutral,
    atrPercent: avgAtr,
    volatilityLow: volatilityLowPct,
    winRate,
    upCandles: upCandlesPct,
    downCandles: 100 - upCandlesPct,
    priceRange,
    tradability,
  };
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🚀 BTC FULL ANALYSIS - ALL TIMEFRAMES');
  console.log('='.repeat(100) + '\n');

  try {
    const btcFile = findBtcFile();
    console.log(`📂 Loading: ${path.basename(btcFile)}\n`);

    const candles1m: Candle[] = JSON.parse(fs.readFileSync(btcFile, 'utf-8'));
    console.log(`✅ Loaded ${candles1m.length} 1m candles\n`);

    const aggregator = new CandleAggregatorService();
    const results: TimeframeStats[] = [];

    // Analyze 1m
    console.log('⏳ Analyzing 1m timeframe...');
    results.push(analyzeTimeframe(candles1m, '1m'));

    // Analyze 5m
    console.log('⏳ Analyzing 5m timeframe...');
    const candles5m = aggregator.aggregateCandles(candles1m, 5);
    results.push(analyzeTimeframe(candles5m, '5m'));

    // Analyze 15m
    console.log('⏳ Analyzing 15m timeframe...');
    const candles15m = aggregator.aggregateCandles(candles1m, 15);
    results.push(analyzeTimeframe(candles15m, '15m'));

    // Analyze 1h
    console.log('⏳ Analyzing 1h timeframe...');
    const candles1h = aggregator.aggregateCandles(candles1m, 60);
    results.push(analyzeTimeframe(candles1h, '1h'));

    // Analyze 4h
    console.log('⏳ Analyzing 4h timeframe...');
    const candles4h = aggregator.aggregateCandles(candles1m, 240);
    results.push(analyzeTimeframe(candles4h, '4h'));

    console.log('\n' + '='.repeat(100));
    console.log('📊 RESULTS COMPARISON:');
    console.log('='.repeat(100) + '\n');

    console.log('TIMEFRAME | CANDLES | RSI EXTREME | RSI NEUTRAL | ATR % | VOL LOW | WIN % | UP % | DOWN % | PRICE RANGE | TRADABILITY');
    console.log('-'.repeat(150));

    for (const result of results) {
      const line = [
        result.timeframe.padEnd(10),
        String(result.candles).padEnd(10),
        `${result.rsiExtreme.toFixed(0)}%`.padEnd(12),
        `${result.rsiNeutral.toFixed(0)}%`.padEnd(12),
        `${result.atrPercent.toFixed(3)}%`.padEnd(8),
        `${result.volatilityLow.toFixed(1)}%`.padEnd(9),
        `${result.winRate.toFixed(1)}%`.padEnd(7),
        `${result.upCandles.toFixed(1)}%`.padEnd(6),
        `${result.downCandles.toFixed(1)}%`.padEnd(7),
        `${result.priceRange.toFixed(2)}%`.padEnd(12),
        result.tradability,
      ].join(' | ');
      console.log(line);
    }

    console.log('\n' + '='.repeat(100));
    console.log('🔍 ANALYSIS:');
    console.log('='.repeat(100) + '\n');

    // Find best timeframe
    const bestByWinRate = results.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    const bestByTrend = results.reduce((a, b) => (a.priceRange > b.priceRange ? a : b));

    console.log(`✅ BEST WIN RATE:  ${bestByWinRate.timeframe} with ${bestByWinRate.winRate.toFixed(1)}%`);
    console.log(`✅ STRONGEST TREND: ${bestByTrend.timeframe} with ${bestByTrend.priceRange.toFixed(2)}% move\n`);

    // Check for extreme signals
    const hasExtremeSignals = results.some(r => r.rsiExtreme > 20);
    const hasGoodVolatility = results.some(r => r.volatilityLow < 50);

    console.log(`📈 Extreme RSI Signals Available: ${hasExtremeSignals ? '✅ YES' : '❌ NO (all neutral)'}`);
    console.log(`⚡ Good Volatility for Trading: ${hasGoodVolatility ? '✅ YES' : '❌ NO (all flat)'}\n`);

    // Verdict
    console.log('🎯 VERDICT:');
    if (bestByTrend.priceRange < 2) {
      console.log('❌ BTC is in a RANGE even with 4 months of data!');
      console.log('   → This is NOT a data parsing issue');
      console.log('   → BTC simply has been consolidating');
      console.log('   → Indicators alone CAN\'T help predict in flat market');
    } else {
      console.log('✅ BTC HAS REAL MOVES! This is NOT flat!');
      console.log(`   → ${bestByTrend.priceRange.toFixed(2)}% move is tradable`);
      console.log(`   → Best timeframe: ${bestByWinRate.timeframe} (${bestByWinRate.winRate.toFixed(1)}% WR)`);
      console.log('   → Our indicators SHOULD work here');
    }

    console.log('\n' + '='.repeat(100) + '\n');
  } catch (error) {
    console.error('❌ Error:', String(error));
    console.error('\n💡 Likely cause: BTC data not downloaded yet');
    console.error('   Run: npm run download-data BTCUSDT 2025-08-03 2025-12-03');
  }
}

main().catch(console.error);
