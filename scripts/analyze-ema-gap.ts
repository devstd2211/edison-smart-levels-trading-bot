/**
 * Analyze EMA gap distribution and trend strength
 */
import * as fs from 'fs';
import * as path from 'path';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const dataFile = path.join(
  __dirname,
  '../data/historical/XRPUSDT_5m_2025-12-08_2026-01-08.json'
);

console.log('📊 Analyzing EMA gap distribution...\n');

const candles: Candle[] = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));

// Calculate EMAs
const emaFast = calculateEMA(candles.map(c => c.close), 9);
const emaSlow = calculateEMA(candles.map(c => c.close), 21);

// Calculate EMA gaps
const gaps: number[] = [];
const gapsForLong: number[] = [];
const gapsForShort: number[] = [];

for (let i = 0; i < candles.length; i++) {
  if (emaFast[i] === undefined || emaSlow[i] === undefined) continue;

  const gap = Math.abs(emaFast[i] - emaSlow[i]);
  const gapPercent = (gap / emaSlow[i]) * 100;
  gaps.push(gapPercent);

  // For LONG: EMA9 > EMA21 (bullish)
  if (emaFast[i] > emaSlow[i]) {
    gapsForLong.push(gapPercent);
  } else {
    // For SHORT: EMA9 < EMA21 (bearish)
    gapsForShort.push(gapPercent);
  }
}

// Statistics
const stats = (arr: number[]) => ({
  count: arr.length,
  min: Math.min(...arr),
  max: Math.max(...arr),
  avg: (arr.reduce((a, b) => a + b, 0) / arr.length),
  median: arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)],
  p90: arr.sort((a, b) => a - b)[Math.floor(arr.length * 0.9)],
  above05: arr.filter(g => g > 0.5).length,
  above10: arr.filter(g => g > 1.0).length,
});

const allStats = stats(gaps);
const longStats = stats(gapsForLong);
const shortStats = stats(gapsForShort);

console.log('📈 OVERALL EMA GAP STATISTICS:');
console.log(`├─ Total candles: ${gaps.length}`);
console.log(`├─ Gaps > 0.5%: ${allStats.above05} (${((allStats.above05 / gaps.length) * 100).toFixed(1)}%)`);
console.log(`├─ Gaps > 1.0%: ${allStats.above10} (${((allStats.above10 / gaps.length) * 100).toFixed(1)}%)`);
console.log(`├─ Min gap: ${allStats.min.toFixed(4)}%`);
console.log(`├─ Max gap: ${allStats.max.toFixed(4)}%`);
console.log(`├─ Avg gap: ${allStats.avg.toFixed(4)}%`);
console.log(`└─ Median gap: ${allStats.median.toFixed(4)}%\n`);

console.log('📈 LONG SIGNALS (EMA9 > EMA21):');
console.log(`├─ Count: ${longStats.count} candles (${((longStats.count / gaps.length) * 100).toFixed(1)}%)`);
console.log(`├─ Gaps > 0.5%: ${longStats.above05} (${((longStats.above05 / longStats.count) * 100).toFixed(1)}%)`);
console.log(`├─ Min gap: ${longStats.min.toFixed(4)}%`);
console.log(`├─ Max gap: ${longStats.max.toFixed(4)}%`);
console.log(`├─ Avg gap: ${longStats.avg.toFixed(4)}%`);
console.log(`└─ Median gap: ${longStats.median.toFixed(4)}%\n`);

console.log('📉 SHORT SIGNALS (EMA9 < EMA21):');
console.log(`├─ Count: ${shortStats.count} candles (${((shortStats.count / gaps.length) * 100).toFixed(1)}%)`);
console.log(`├─ Gaps > 0.5%: ${shortStats.above05} (${((shortStats.above05 / shortStats.count) * 100).toFixed(1)}%)`);
console.log(`├─ Min gap: ${shortStats.min.toFixed(4)}%`);
console.log(`├─ Max gap: ${shortStats.max.toFixed(4)}%`);
console.log(`├─ Avg gap: ${shortStats.avg.toFixed(4)}%`);
console.log(`└─ Median gap: ${shortStats.median.toFixed(4)}%\n`);

console.log('⚠️  ANALYSIS:\n');
if (longStats.above05 === 0) {
  console.log(`❌ PROBLEM: NO LONG signals passed EMA gap > 0.5% threshold!`);
  console.log(`   This explains 0 LONG trades in backtest.\n`);
  console.log(`Possible causes:`);
  console.log(`1. EMA9 > EMA21 never occurred with gap > 0.5%`);
  console.log(`2. Market was dominated by SHORT signals (${shortStats.count} vs ${longStats.count} candles)`);
  console.log(`3. Bullish trends were too weak (avg gap only ${longStats.avg.toFixed(4)}%)`);
} else {
  console.log(`✅ LONG signals DID exist with gap > 0.5%: ${longStats.above05}`);
  console.log(`   If 0 LONG trades, then block must be happening elsewhere`);
}

console.log('\n📊 TREND DISTRIBUTION:');
console.log(`Bullish (LONG): ${longStats.count} candles (${((longStats.count / gaps.length) * 100).toFixed(1)}%)`);
console.log(`Bearish (SHORT): ${shortStats.count} candles (${((shortStats.count / gaps.length) * 100).toFixed(1)}%)`);

function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA
  let sum = 0;
  for (let i = 0; i < Math.min(period, prices.length); i++) {
    sum += prices[i];
  }

  if (prices.length >= period) {
    ema[period - 1] = sum / period;

    for (let i = period; i < prices.length; i++) {
      ema[i] = prices[i] * multiplier + (ema[i - 1] || 0) * (1 - multiplier);
    }
  }

  return ema;
}

