/**
 * Entry Pattern Analysis - Find bad entry conditions
 */

import * as fs from 'fs';
import * as path from 'path';

interface Trade {
  id: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  openedAt: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  status: string;
  entryCondition: {
    signal: {
      type: string;
      confidence: number;
      reason: string;
      stopLoss: number;
      takeProfits: Array<{ level: number; price: number; hit: boolean }>;
    };
  };
  exitCondition?: {
    exitType: string;
    timestamp: number;
    pnlUsdt: number;
    pnlPercent: number;
  };
}

function main() {
  const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');
  const trades: Trade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

  const closed = trades.filter(t => t.status === 'CLOSED' && t.exitCondition);
  const losers = closed.filter(t => (t.exitCondition?.pnlUsdt || 0) < 0);
  const winners = closed.filter(t => (t.exitCondition?.pnlUsdt || 0) >= 0);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 ENTRY PATTERN ANALYSIS - FINDING BAD ENTRIES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total: ${closed.length} | Winners: ${winners.length} | Losers: ${losers.length}\n`);

  // Analyze LONG
  const longLosers = losers.filter(t => t.side === 'LONG');
  const longWinners = winners.filter(t => t.side === 'LONG');

  if (longLosers.length > 0) {
    console.log('───────────────────────────────────────────────────────────────');
    console.log(`📉 LONG LOSING ENTRIES (${longLosers.length} trades)`);
    console.log('───────────────────────────────────────────────────────────────\n');
    analyzeEntries(longLosers, longWinners, 'LONG');
  }

  // Analyze SHORT
  const shortLosers = losers.filter(t => t.side === 'SHORT');
  const shortWinners = winners.filter(t => t.side === 'SHORT');

  if (shortLosers.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log(`📉 SHORT LOSING ENTRIES (${shortLosers.length} trades)`);
    console.log('───────────────────────────────────────────────────────────────\n');
    analyzeEntries(shortLosers, shortWinners, 'SHORT');
  }

  // Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 ENTRY FIX RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  generateFixes(longLosers, longWinners, shortLosers, shortWinners);
}

function analyzeEntries(losers: Trade[], winners: Trade[], side: string) {
  // Show all losing entries with details
  console.log('❌ LOSING TRADES ENTRY CONDITIONS:\n');

  const sorted = [...losers].sort((a, b) => (a.exitCondition?.pnlUsdt || 0) - (b.exitCondition?.pnlUsdt || 0));

  sorted.forEach((t, i) => {
    const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
    const pnl = t.exitCondition?.pnlUsdt || 0;
    const reason = t.entryCondition.signal.reason;
    const conf = t.entryCondition.signal.confidence;

    console.log(`${i + 1}. ${t.id.slice(0, 20)}...`);
    console.log(`   PnL: ${pnl.toFixed(4)} USDT | Hold: ${holdTime.toFixed(1)}min`);
    console.log(`   Entry: ${t.entryPrice} → Exit: ${t.exitPrice}`);
    console.log(`   Confidence: ${conf}%`);
    console.log(`   Reason: "${reason}"`);
    console.log('');
  });

  // Extract patterns from reasons
  console.log('───────────────────────────────────────────────────────────────');
  console.log('🔍 PATTERN ANALYSIS:\n');

  const loserReasons = losers.map(t => t.entryCondition.signal.reason);
  const winnerReasons = winners.map(t => t.entryCondition.signal.reason);

  // Count "touches" mentions
  const loserTouches = analyzeKeyword(loserReasons, /(\d+)\s+touches?/i);
  const winnerTouches = analyzeKeyword(winnerReasons, /(\d+)\s+touches?/i);

  console.log('Touch Counts in Entry Reason:');
  console.log(`  Losers:  ${JSON.stringify(loserTouches)}`);
  console.log(`  Winners: ${JSON.stringify(winnerTouches)}`);

  // Check if "near resistance/support" is mentioned
  const loserNearLevel = loserReasons.filter(r => r.toLowerCase().includes('near')).length;
  const winnerNearLevel = winnerReasons.filter(r => r.toLowerCase().includes('near')).length;

  console.log(`\n"Near" level mentions:`);
  console.log(`  Losers:  ${loserNearLevel}/${losers.length} (${((loserNearLevel / losers.length) * 100).toFixed(1)}%)`);
  console.log(`  Winners: ${winnerNearLevel}/${winners.length} (${((winnerNearLevel / winners.length) * 100).toFixed(1)}%)`);

  // Confidence comparison
  const loserAvgConf = losers.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / losers.length;
  const winnerAvgConf = winners.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / winners.length;

  console.log(`\nConfidence:`);
  console.log(`  Losers:  ${loserAvgConf.toFixed(1)}%`);
  console.log(`  Winners: ${winnerAvgConf.toFixed(1)}%`);
  console.log(`  Delta:   ${(winnerAvgConf - loserAvgConf).toFixed(1)}%`);

  // Compare winners
  if (winners.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('✅ COMPARISON: Top 3 WINNING entries for reference:\n');

    const topWinners = [...winners]
      .sort((a, b) => (b.exitCondition?.pnlUsdt || 0) - (a.exitCondition?.pnlUsdt || 0))
      .slice(0, 3);

    topWinners.forEach((t, i) => {
      const pnl = t.exitCondition?.pnlUsdt || 0;
      const reason = t.entryCondition.signal.reason;
      const conf = t.entryCondition.signal.confidence;

      console.log(`${i + 1}. PnL: +${pnl.toFixed(4)} USDT`);
      console.log(`   Entry: ${t.entryPrice} → Exit: ${t.exitPrice}`);
      console.log(`   Confidence: ${conf}%`);
      console.log(`   Reason: "${reason}"`);
      console.log('');
    });
  }
}

function analyzeKeyword(reasons: string[], regex: RegExp): Record<string, number> {
  const counts: Record<string, number> = {};

  reasons.forEach(reason => {
    const match = reason.match(regex);
    if (match && match[1]) {
      const touchCount = match[1];
      counts[touchCount] = (counts[touchCount] || 0) + 1;
    }
  });

  return counts;
}

function generateFixes(
  longLosers: Trade[],
  longWinners: Trade[],
  shortLosers: Trade[],
  shortWinners: Trade[]
) {
  const fixes: string[] = [];

  // Check confidence issue
  const allTrades = [...longLosers, ...longWinners, ...shortLosers, ...shortWinners];
  const avgConf = allTrades.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / allTrades.length;

  if (avgConf < 50) {
    fixes.push(`⚠️ CONFIDENCE BUG: Average confidence is ${avgConf.toFixed(1)}%. This looks like a bug in signal generation. Check ConfirmationFilter service!`);
  }

  // Check touch patterns for LONG
  if (longLosers.length > 0) {
    const loserReasons = longLosers.map(t => t.entryCondition.signal.reason);
    const touchCounts = analyzeKeyword(loserReasons, /(\d+)\s+touches?/i);

    // Check if losers have mostly 2 touches
    const twoTouches = touchCounts['2'] || 0;
    if (twoTouches > longLosers.length * 0.5) {
      fixes.push(`⚠️ LONG: ${twoTouches}/${longLosers.length} losers had only 2 touches. Consider requiring MIN 3 touches for LONG entries at support.`);
    }

    // Check quick stop outs
    const quickStops = longLosers.filter(t => {
      const holdTime = ((t.exitCondition?.timestamp || 0) - t.openedAt) / 60000;
      return holdTime < 5;
    });

    if (quickStops.length > longLosers.length * 0.4) {
      fixes.push(`⚠️ LONG: ${quickStops.length}/${longLosers.length} (${((quickStops.length / longLosers.length) * 100).toFixed(1)}%) stopped out < 5min. ENTRY TOO EARLY! Consider:`);
      fixes.push(`   - Wait for confirmation candle close ABOVE support`);
      fixes.push(`   - Check RSI not oversold (< 30) when entering LONG`);
      fixes.push(`   - Require EMA crossover confirmation on 1m timeframe`);
    }
  }

  // Check touch patterns for SHORT
  if (shortLosers.length > 0) {
    const loserReasons = shortLosers.map(t => t.entryCondition.signal.reason);
    const touchCounts = analyzeKeyword(loserReasons, /(\d+)\s+touches?/i);

    const twoTouches = touchCounts['2'] || 0;
    if (twoTouches > shortLosers.length * 0.5) {
      fixes.push(`⚠️ SHORT: ${twoTouches}/${shortLosers.length} losers had only 2 touches. Consider requiring MIN 3 touches for SHORT entries at resistance.`);
    }
  }

  // Output
  if (fixes.length === 0) {
    console.log('✅ No obvious entry pattern issues found.');
  } else {
    fixes.forEach((fix, i) => {
      console.log(`${i + 1}. ${fix}`);
    });
  }

  console.log('');
}

main();
