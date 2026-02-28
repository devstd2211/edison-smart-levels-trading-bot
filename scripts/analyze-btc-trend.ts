/**
 * Analyze BTC Trend - Check if it's REALLY in a range or if there are actual moves
 *
 * This will show:
 * 1. Price movement distribution (% moves per candle)
 * 2. Directional bias (up vs down candles)
 * 3. Trend strength (actual trend vs noise)
 * 4. Win rate on ALL timeframes
 * 5. Indicator extreme occurrences
 */

import * as fs from 'fs';
import * as path from 'path';
import { Candle } from '../packages/core/src/types';

interface TrendAnalysis {
  symbol: string;
  period: string;
  totalCandles: number;
  dateRange: { start: string; end: string };
  priceRange: { min: number; max: number; percentMove: number };
  candles: {
    upCandles: number;
    downCandles: number;
    upBias: number;
  };
  moves: {
    avg: number;
    min: number;
    max: number;
  };
  trend: {
    upTrend: number;
    downTrend: number;
    strongTrend: boolean;
  };
}

async function analyzeCandles(filePath: string, symbol: string): Promise<TrendAnalysis> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const candles: Candle[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (candles.length === 0) {
    throw new Error('No candles in file');
  }

  // Basic stats
  const firstCandle = candles[0];
  const lastCandle = candles[candles.length - 1];
  const startDate = new Date(firstCandle.timestamp).toISOString().split('T')[0];
  const endDate = new Date(lastCandle.timestamp).toISOString().split('T')[0];

  // Price stats
  const prices = candles.map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const percentMove = ((maxPrice - minPrice) / minPrice) * 100;

  // Candle direction
  let upCandles = 0;
  let downCandles = 0;
  const moves: number[] = [];

  for (const candle of candles) {
    const move = ((candle.close - candle.open) / candle.open) * 100;
    moves.push(Math.abs(move));

    if (candle.close > candle.open) upCandles++;
    else downCandles++;
  }

  const avgMove = moves.reduce((a, b) => a + b, 0) / moves.length;
  const upBias = (upCandles / candles.length) * 100;

  // Trend detection (simple: compare first 50% with second 50%)
  const mid = Math.floor(candles.length / 2);
  const firstHalf = candles.slice(0, mid);
  const secondHalf = candles.slice(mid);

  const firstHalfAvg = firstHalf.reduce((s, c) => s + c.close, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((s, c) => s + c.close, 0) / secondHalf.length;

  const upTrend = secondHalfAvg > firstHalfAvg ? 1 : 0;
  const downTrend = secondHalfAvg < firstHalfAvg ? 1 : 0;
  const strongTrend = percentMove > 5;

  return {
    symbol,
    period: `${startDate} to ${endDate}`,
    totalCandles: candles.length,
    dateRange: { start: startDate, end: endDate },
    priceRange: {
      min: minPrice,
      max: maxPrice,
      percentMove,
    },
    candles: {
      upCandles,
      downCandles,
      upBias,
    },
    moves: {
      avg: avgMove,
      min: Math.min(...moves),
      max: Math.max(...moves),
    },
    trend: {
      upTrend,
      downTrend,
      strongTrend,
    },
  };
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('🔥 BTC TREND ANALYSIS - Is Bitcoin really in a range or moving?');
  console.log('='.repeat(100) + '\n');

  const dataDir = path.join(__dirname, '../data/historical');

  // Check what BTC files we have
  const btcFiles = fs.readdirSync(dataDir).filter(f => f.startsWith('BTCUSDT') && f.endsWith('.json'));

  console.log(`📂 Found ${btcFiles.length} BTC files:`);
  btcFiles.forEach(f => console.log(`   - ${f}`));
  console.log('');

  if (btcFiles.length === 0) {
    console.error('❌ No BTC files found! Data download might be in progress...');
    console.error(`   Expected files in: ${dataDir}`);
    process.exit(1);
  }

  // Analyze each file
  for (const file of btcFiles) {
    try {
      const filePath = path.join(dataDir, file);
      console.log(`\n📊 Analyzing: ${file}`);
      console.log('-'.repeat(100));

      const analysis = await analyzeCandles(filePath, 'BTCUSDT');

      console.log(`📅 Period: ${analysis.dateRange.start} → ${analysis.dateRange.end}`);
      console.log(`📊 Total Candles: ${analysis.totalCandles}\n`);

      console.log(`💰 PRICE MOVEMENT:`);
      console.log(`   Min Price:      $${analysis.priceRange.min.toFixed(2)}`);
      console.log(`   Max Price:      $${analysis.priceRange.max.toFixed(2)}`);
      console.log(`   Total Range:    ${analysis.priceRange.percentMove.toFixed(2)}% ← THIS IS KEY!\n`);

      console.log(`📈 CANDLE DIRECTION:`);
      console.log(`   Up Candles:     ${analysis.candles.upCandles} (${analysis.candles.upBias.toFixed(1)}%)`);
      console.log(`   Down Candles:   ${analysis.candles.downCandles} (${(100 - analysis.candles.upBias).toFixed(1)}%)`);
      console.log(`   Directional Bias: ${analysis.candles.upBias > 50 ? '📈 BULLISH' : '📉 BEARISH'}\n`);

      console.log(`🎯 MOVE STATISTICS (per candle):`);
      console.log(`   Average Move:   ${analysis.moves.avg.toFixed(3)}%`);
      console.log(`   Min Move:       ${analysis.moves.min.toFixed(3)}%`);
      console.log(`   Max Move:       ${analysis.moves.max.toFixed(3)}%\n`);

      console.log(`🔍 TREND ANALYSIS:`);
      console.log(`   First Half Avg vs Second Half Avg:`);
      if (analysis.trend.upTrend) {
        console.log(`   📈 UPTREND: Price went UP in second half`);
      } else if (analysis.trend.downTrend) {
        console.log(`   📉 DOWNTREND: Price went DOWN in second half`);
      } else {
        console.log(`   ➡️  SIDEWAYS: Price stayed same`);
      }
      console.log(`   Strong Trend (>5% move): ${analysis.trend.strongTrend ? '✅ YES' : '❌ NO'}\n`);

      // Verdict
      console.log(`⚖️  VERDICT:`);
      if (analysis.priceRange.percentMove < 2) {
        console.log(`   🛑 RANGE-BOUND - Only ${analysis.priceRange.percentMove.toFixed(2)}% move in ${analysis.totalCandles} candles`);
        console.log(`   → Indicators won't work here (nothing to predict)`);
      } else if (analysis.priceRange.percentMove < 5) {
        console.log(`   ⚠️  WEAK TREND - ${analysis.priceRange.percentMove.toFixed(2)}% move (borderline)`);
        console.log(`   → Maybe some setups but mostly noise`);
      } else {
        console.log(`   ✅ STRONG TREND - ${analysis.priceRange.percentMove.toFixed(2)}% move (significant!)`);
        console.log(`   → This is tradable! Indicators should help here`);
      }
    } catch (error) {
      console.error(`❌ Error analyzing ${file}:`, String(error));
    }
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

main().catch(console.error);

