/**
 * Analyze Recent Bot Inactivity
 *
 * Analyzes why bot is not trading on recent market data from SQLite
 */

import { SqliteDataProvider } from './data-providers';
import { ZigZagIndicator } from '../src/indicators/zigzag.indicator';
import { RSIIndicator } from '../src/indicators/rsi.indicator';
import { EMAIndicator } from '../src/indicators/ema.indicator';
import { LoggerService, LogLevel, Candle } from '../src/types';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 ANALYZING RECENT BOT INACTIVITY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const logger = new LoggerService(LogLevel.ERROR, './logs', false);

  // Load recent data from SQLite
  const provider = new SqliteDataProvider();
  console.log('📥 Loading recent data from SQLite...\n');

  const { candles1m, candles5m, candles15m } = await provider.loadCandles('APEXUSDT');
  await provider.close();

  // Take last 200 5m candles for analysis
  const recentCandles = candles5m.slice(-200);

  console.log(`\n📊 Analyzing last 200 5m candles...`);
  console.log(`   Time range: ${new Date(recentCandles[0].timestamp).toISOString()} → ${new Date(recentCandles[recentCandles.length - 1].timestamp).toISOString()}\n`);

  // Test different zigzag depths
  const depths = [5, 8, 10, 12, 15];

  console.log('🔧 Testing ZigZag depths to find swing points:\n');

  for (const depth of depths) {
    const zigzag = new ZigZagIndicator(depth);
    const highs = zigzag.findSwingHighs(recentCandles as Candle[]);
    const lows = zigzag.findSwingLows(recentCandles as Candle[]);

    console.log(`   Depth ${depth.toString().padEnd(2)}: ${highs.length} highs, ${lows.length} lows | Total: ${highs.length + lows.length} swing points`);

    // Show recent swing points
    if (highs.length > 0 || lows.length > 0) {
      const allSwings = [...highs, ...lows].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);
      console.log(`             Last 3: ${allSwings.map(s => `${s.type}@${s.price.toFixed(4)}`).join(', ')}`);
    }
  }

  console.log('\n📈 Market Indicators (last candle):');

  const rsi = new RSIIndicator(14);
  const emaFast = new EMAIndicator(20);
  const emaSlow = new EMAIndicator(50);

  const currentRSI = rsi.calculate(recentCandles as Candle[]);
  const currentEMAFast = emaFast.calculate(recentCandles as Candle[]);
  const currentEMASlow = emaSlow.calculate(recentCandles as Candle[]);

  const lastCandle = recentCandles[recentCandles.length - 1];

  console.log(`   Price: ${lastCandle.close.toFixed(4)}`);
  console.log(`   RSI: ${currentRSI?.toFixed(2)} (Oversold < 40, Overbought > 65)`);
  console.log(`   EMA Fast (20): ${currentEMAFast?.toFixed(4)}`);
  console.log(`   EMA Slow (50): ${currentEMASlow?.toFixed(4)}`);
  console.log(`   Trend: ${currentEMAFast && currentEMASlow ? (currentEMAFast > currentEMASlow ? 'BULLISH' : currentEMAFast < currentEMASlow ? 'BEARISH' : 'NEUTRAL') : 'N/A'}`);

  // Price range analysis
  const prices = recentCandles.map(c => c.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice;
  const rangePercent = (range / minPrice) * 100;

  console.log(`\n📏 Price Range Analysis (200 candles):` );
  console.log(`   Min: ${minPrice.toFixed(4)}`);
  console.log(`   Max: ${maxPrice.toFixed(4)}`);
  console.log(`   Range: ${range.toFixed(4)} (${rangePercent.toFixed(2)}%)`);
  console.log(`   Current: ${lastCandle.close.toFixed(4)} (${((lastCandle.close - minPrice) / range * 100).toFixed(1)}% in range)`);

  // Last 20 candles volatility
  const last20 = recentCandles.slice(-20);
  const avgBodySize = last20.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / last20.length;
  const avgBodyPercent = (avgBodySize / lastCandle.close) * 100;

  console.log(`\n📊 Recent Volatility (last 20 candles):`);
  console.log(`   Avg body size: ${avgBodySize.toFixed(4)} (${avgBodyPercent.toFixed(2)}%)`);
  console.log(`   Volatility: ${avgBodyPercent < 0.3 ? '🟢 LOW' : avgBodyPercent < 0.5 ? '🟡 MEDIUM' : '🔴 HIGH'}`);

  // Strategy checks
  console.log(`\n🎯 Strategy Analysis:`);

  console.log(`\n   1️⃣ TrendFollowing:`);
  console.log(`      - RSI in reversal zone (< 30 or > 70): ${currentRSI ? (currentRSI < 30 || currentRSI > 70 ? '✅ YES' : '❌ NO (' + currentRSI.toFixed(2) + ')') : '❌ N/A'}`);
  console.log(`      - Clear trend: ${currentEMAFast && currentEMASlow && Math.abs(currentEMAFast - currentEMASlow) / lastCandle.close * 100 > 0.5 ? '✅ YES' : '❌ NO (neutral/flat)'}`);

  console.log(`\n   2️⃣ LevelBased (depth=12):`);
  const zigzag12 = new ZigZagIndicator(12);
  const highs12 = zigzag12.findSwingHighs(recentCandles as Candle[]);
  const lows12 = zigzag12.findSwingLows(recentCandles as Candle[]);
  console.log(`      - Swing points: ${highs12.length} highs + ${lows12.length} lows = ${highs12.length + lows12.length} total`);
  console.log(`      - Enough for trading: ${highs12.length >= 2 && lows12.length >= 2 ? '✅ YES' : `❌ NO (need 2+ each, got ${highs12.length}/${lows12.length})`}`);

  console.log(`\n   3️⃣ CounterTrend:`);
  console.log(`      - RSI in extreme zone (< 40 or > 65): ${currentRSI ? (currentRSI < 40 || currentRSI > 65 ? '✅ YES' : '❌ NO (' + currentRSI.toFixed(2) + ')') : '❌ N/A'}`);

  console.log(`\n💡 Recommendations:`);

  if (highs12.length < 2 || lows12.length < 2) {
    console.log(`   - Consider reducing zigzagDepth from 12 to 8-10 for more swing points in low volatility`);
  }

  if (currentRSI && currentRSI > 35 && currentRSI < 65) {
    console.log(`   - RSI is neutral (${currentRSI.toFixed(2)}), market might be consolidating`);
  }

  if (rangePercent < 3) {
    console.log(`   - Price range is tight (${rangePercent.toFixed(2)}%), sideways market detected`);
    console.log(`   - Ensure flat market strategies are enabled and configured properly`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
