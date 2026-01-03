/**
 * Market Regime Analyzer (Simplified)
 *
 * Analyzes trade journal by TIME PERIODS to identify when LONG vs SHORT performed best.
 * Groups trades by date and shows performance patterns.
 *
 * This helps answer:
 * - "When did LONG work well but SHORT failed?"
 * - "When did SHORT work well but LONG failed?"
 * - "What time periods to avoid?"
 *
 * Usage:
 *   npm run analyze-regimes
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface JournalTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  realizedPnL: number;
  openedAt: string | number;
  closedAt?: string | number;
  entryPrice: number;
  exitPrice?: number;
  entryCondition?: {
    signal?: {
      type: string;
      confidence: number;
      reason: string;
    };
  };
  exitCondition?: {
    exitType: string;
  };
}

interface PeriodStats {
  date: string;
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  longWins: number;
  shortWins: number;
  longWinRate: number;
  shortWinRate: number;
  longPnL: number;
  shortPnL: number;
  stopLossRate: number;
  avgHoldTime: number;
}

// ============================================================================
// UTILITIES
// ============================================================================

function getDateKey(timestamp: string | number): string {
  const date = new Date(typeof timestamp === 'number' ? timestamp : timestamp);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getHoldTimeMinutes(openedAt: string | number, closedAt: string | number): number {
  const opened = new Date(typeof openedAt === 'number' ? openedAt : openedAt).getTime();
  const closed = new Date(typeof closedAt === 'number' ? closedAt : closedAt).getTime();
  return (closed - opened) / 1000 / 60; // minutes
}

// ============================================================================
// STATISTICS
// ============================================================================

function analyzePeriod(trades: JournalTrade[], date: string): PeriodStats {
  const periodTrades = trades.filter((t) => getDateKey(t.openedAt) === date);

  const longs = periodTrades.filter((t) => t.side === 'LONG');
  const shorts = periodTrades.filter((t) => t.side === 'SHORT');

  const longWins = longs.filter((t) => t.realizedPnL > 0);
  const shortWins = shorts.filter((t) => t.realizedPnL > 0);

  const longPnL = longs.reduce((sum, t) => sum + t.realizedPnL, 0);
  const shortPnL = shorts.reduce((sum, t) => sum + t.realizedPnL, 0);

  const stopLosses = periodTrades.filter((t) => t.exitCondition?.exitType === 'STOP_LOSS');
  const stopLossRate = periodTrades.length > 0 ? (stopLosses.length / periodTrades.length) * 100 : 0;

  // Calculate avg hold time
  const holdTimes = periodTrades
    .filter((t) => t.closedAt)
    .map((t) => getHoldTimeMinutes(t.openedAt, t.closedAt!));
  const avgHoldTime = holdTimes.length > 0 ? holdTimes.reduce((sum, t) => sum + t, 0) / holdTimes.length : 0;

  return {
    date,
    totalTrades: periodTrades.length,
    longTrades: longs.length,
    shortTrades: shorts.length,
    longWins: longWins.length,
    shortWins: shortWins.length,
    longWinRate: longs.length > 0 ? (longWins.length / longs.length) * 100 : 0,
    shortWinRate: shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0,
    longPnL,
    shortPnL,
    stopLossRate,
    avgHoldTime,
  };
}

// ============================================================================
// REGIME DETECTION
// ============================================================================

function detectRegimeFromStats(stats: PeriodStats): string {
  const longGood = stats.longWinRate >= 60 && stats.longPnL > 0;
  const shortGood = stats.shortWinRate >= 60 && stats.shortPnL > 0;
  const highStopRate = stats.stopLossRate > 40;
  const quickExits = stats.avgHoldTime < 10;

  if (highStopRate || quickExits) {
    return '🌪️ VOLATILE/CHOPPY';
  }

  if (longGood && !shortGood) {
    return '📈 TRENDING UP (LONG favored)';
  }

  if (shortGood && !longGood) {
    return '📉 TRENDING DOWN (SHORT favored)';
  }

  if (longGood && shortGood) {
    return '✅ BALANCED (both work)';
  }

  return '⚠️ DIFFICULT (both struggle)';
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(allStats: PeriodStats[]): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 KEY INSIGHTS & RECOMMENDATIONS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Find best LONG periods
  const goodLongPeriods = allStats.filter((s) => s.longWinRate >= 60 && s.longPnL > 0);
  const goodShortPeriods = allStats.filter((s) => s.shortWinRate >= 60 && s.shortPnL > 0);
  const badLongPeriods = allStats.filter((s) => s.longWinRate < 50 && s.longPnL < 0);
  const badShortPeriods = allStats.filter((s) => s.shortWinRate < 50 && s.shortPnL < 0);

  // Overall LONG vs SHORT performance
  const totalLongTrades = allStats.reduce((sum, s) => sum + s.longTrades, 0);
  const totalShortTrades = allStats.reduce((sum, s) => sum + s.shortTrades, 0);
  const totalLongWins = allStats.reduce((sum, s) => sum + s.longWins, 0);
  const totalShortWins = allStats.reduce((sum, s) => sum + s.shortWins, 0);
  const totalLongPnL = allStats.reduce((sum, s) => sum + s.longPnL, 0);
  const totalShortPnL = allStats.reduce((sum, s) => sum + s.shortPnL, 0);

  const overallLongWR = totalLongTrades > 0 ? (totalLongWins / totalLongTrades) * 100 : 0;
  const overallShortWR = totalShortTrades > 0 ? (totalShortWins / totalShortTrades) * 100 : 0;

  console.log('📊 **OVERALL PERFORMANCE:**');
  console.log('');
  console.log(`LONG: ${totalLongTrades} trades, ${overallLongWR.toFixed(1)}% WR, ${totalLongPnL >= 0 ? '+' : ''}${totalLongPnL.toFixed(2)} USDT`);
  console.log(`SHORT: ${totalShortTrades} trades, ${overallShortWR.toFixed(1)}% WR, ${totalShortPnL >= 0 ? '+' : ''}${totalShortPnL.toFixed(2)} USDT`);
  console.log('');

  // Recommendation
  if (totalLongPnL > 0 && totalShortPnL > 0) {
    console.log('✅ **Both LONG and SHORT profitable overall - continue balanced trading**');
  } else if (totalLongPnL < 0 && totalShortPnL > 0) {
    console.log('⚠️ **LONG is LOSING MONEY - consider disabling LONG or stricter filters**');
    console.log('');
    console.log('🔧 Suggested config:');
    console.log('```json');
    console.log('{');
    console.log('  "levelBased": {');
    console.log('    "minTouchesRequiredLong": 3,  // Stricter LONG entries');
    console.log('    "blockLongInDowntrend": true  // Already enabled');
    console.log('  }');
    console.log('}');
    console.log('```');
  } else if (totalLongPnL > 0 && totalShortPnL < 0) {
    console.log('⚠️ **SHORT is LOSING MONEY - consider disabling SHORT or stricter filters**');
    console.log('');
    console.log('🔧 Suggested config:');
    console.log('```json');
    console.log('{');
    console.log('  "levelBased": {');
    console.log('    "minTouchesRequiredShort": 2,  // Stricter SHORT entries');
    console.log('    "requireTrendAlignment": true');
    console.log('  }');
    console.log('}');
    console.log('```');
  } else {
    console.log('❌ **BOTH LOSING MONEY - review strategy parameters**');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📅 **GOOD LONG PERIODS** (Win Rate ≥60%, PnL >0):');
  console.log('═══════════════════════════════════════════════════════════');
  if (goodLongPeriods.length === 0) {
    console.log('   No periods found with good LONG performance');
  } else {
    goodLongPeriods.forEach((s) => {
      console.log(`   ${s.date}: ${s.longWinRate.toFixed(1)}% WR, ${s.longPnL >= 0 ? '+' : ''}${s.longPnL.toFixed(2)} USDT (${s.longTrades} trades)`);
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📅 **GOOD SHORT PERIODS** (Win Rate ≥60%, PnL >0):');
  console.log('═══════════════════════════════════════════════════════════');
  if (goodShortPeriods.length === 0) {
    console.log('   No periods found with good SHORT performance');
  } else {
    goodShortPeriods.forEach((s) => {
      console.log(`   ${s.date}: ${s.shortWinRate.toFixed(1)}% WR, ${s.shortPnL >= 0 ? '+' : ''}${s.shortPnL.toFixed(2)} USDT (${s.shortTrades} trades)`);
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚠️ **BAD LONG PERIODS** (Win Rate <50%, PnL <0):');
  console.log('═══════════════════════════════════════════════════════════');
  if (badLongPeriods.length === 0) {
    console.log('   No bad LONG periods found');
  } else {
    badLongPeriods.forEach((s) => {
      console.log(`   ${s.date}: ${s.longWinRate.toFixed(1)}% WR, ${s.longPnL.toFixed(2)} USDT (${s.longTrades} trades)`);
    });
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('⚠️ **BAD SHORT PERIODS** (Win Rate <50%, PnL <0):');
  console.log('═══════════════════════════════════════════════════════════');
  if (badShortPeriods.length === 0) {
    console.log('   No bad SHORT periods found');
  } else {
    badShortPeriods.forEach((s) => {
      console.log(`   ${s.date}: ${s.shortWinRate.toFixed(1)}% WR, ${s.shortPnL.toFixed(2)} USDT (${s.shortTrades} trades)`);
    });
  }

  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  // Load all journal files
  const dataDir = path.join(__dirname, '../data');
  const journalFiles = fs
    .readdirSync(dataDir)
    .filter((f) => f.includes('journal') && f.endsWith('.json'))
    .map((f) => path.join(dataDir, f));

  if (journalFiles.length === 0) {
    console.error('❌ No journal files found');
    process.exit(1);
  }

  console.log(`Found ${journalFiles.length} journal files:`);
  journalFiles.forEach((f) => console.log(`  - ${path.basename(f)}`));
  console.log('');

  // Load and merge
  let allTrades: JournalTrade[] = [];
  journalFiles.forEach((file) => {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(data)) {
        allTrades = allTrades.concat(data);
      }
    } catch (err) {
      console.warn(`⚠️  Could not load ${path.basename(file)}`);
    }
  });

  // Remove duplicates
  const uniqueTrades = new Map<string, JournalTrade>();
  allTrades.forEach((t) => uniqueTrades.set(t.id, t));
  allTrades = Array.from(uniqueTrades.values());

  // Filter closed trades
  const closedTrades = allTrades.filter((t) => t.status === 'CLOSED');

  if (closedTrades.length === 0) {
    console.log('ℹ️  No closed trades found');
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 PERIOD-BASED MARKET ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Analyzing ${closedTrades.length} closed trades...`);
  console.log('');

  // Get unique dates
  const dates = Array.from(new Set(closedTrades.map((t) => getDateKey(t.openedAt)))).sort();

  // Analyze each period
  const allStats = dates.map((date) => analyzePeriod(closedTrades, date));

  // Print table
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📅 DAILY PERFORMANCE:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  allStats.forEach((stats) => {
    const regime = detectRegimeFromStats(stats);
    console.log(`${stats.date} - ${regime}`);
    console.log(`  Trades: ${stats.totalTrades} (LONG: ${stats.longTrades}, SHORT: ${stats.shortTrades})`);
    console.log(`  LONG: ${stats.longWinRate.toFixed(1)}% WR, ${stats.longPnL >= 0 ? '+' : ''}${stats.longPnL.toFixed(2)} USDT`);
    console.log(`  SHORT: ${stats.shortWinRate.toFixed(1)}% WR, ${stats.shortPnL >= 0 ? '+' : ''}${stats.shortPnL.toFixed(2)} USDT`);
    console.log(`  Stop-Out Rate: ${stats.stopLossRate.toFixed(1)}%`);
    console.log(`  Avg Hold Time: ${stats.avgHoldTime.toFixed(1)} min`);
    console.log('');
  });

  // Generate recommendations
  generateRecommendations(allStats);

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Analysis complete!');
  console.log('═══════════════════════════════════════════════════════════');
}

// Run
main();
