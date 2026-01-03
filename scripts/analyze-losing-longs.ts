/**
 * Analyze Losing LONG Trades
 *
 * Analyzes all losing LONG trades to identify patterns and recommend config adjustments.
 * Specifically looks at Whale Hunter signals which tend to have lower success rates on LONGs.
 *
 * Usage:
 *   npx ts-node scripts/analyze-losing-longs.ts [path/to/journal.json]
 *   npm run analyze-losing-longs
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

interface LongAnalysis {
  id: string;
  pnl: number;
  exitType: string;
  strategy: string;
  confidence: number;
  reason: string;
  wallSize?: number;
  wallDuration?: number;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  // Get journal path from args or use default
  const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

  // Check if file exists
  if (!fs.existsSync(journalPath)) {
    console.error('❌ Journal file not found:', journalPath);
    process.exit(1);
  }

  // Load journal
  const journal: JournalTrade[] = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  // Filter for CLOSED LONG trades
  const allLongs = journal.filter((t) => t.status === 'CLOSED' && t.side === 'LONG');
  const winners = allLongs.filter((t) => t.realizedPnL > 0);
  const losers = allLongs.filter((t) => t.realizedPnL < 0);

  if (allLongs.length === 0) {
    console.log('ℹ️  No LONG trades found in journal');
    return;
  }

  // Calculate overall stats
  const totalPnl = allLongs.reduce((sum, t) => sum + t.realizedPnL, 0);
  const avgPnl = totalPnl / allLongs.length;
  const avgWin = winners.length > 0 ? winners.reduce((sum, t) => sum + t.realizedPnL, 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((sum, t) => sum + t.realizedPnL, 0) / losers.length : 0;
  const winRate = (winners.length / allLongs.length) * 100;

  // Print header
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 LOSING LONG TRADES ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Print overall stats
  console.log('📈 ALL LONG TRADES:');
  console.log(`   Total Longs: ${allLongs.length}`);
  console.log(`   Winners: ${winners.length} (${winRate.toFixed(1)}%)`);
  console.log(`   Losers: ${losers.length} (${((losers.length / allLongs.length) * 100).toFixed(1)}%)`);
  console.log('');
  console.log(`   Total PnL: ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT`);
  console.log(`   Average PnL per trade: ${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)} USDT`);
  console.log(`   Average Win: +${avgWin.toFixed(2)} USDT`);
  console.log(`   Average Loss: ${avgLoss.toFixed(2)} USDT`);
  console.log('');

  if (losers.length === 0) {
    console.log('✅ No losing LONG trades found! All LONGs are profitable.');
    return;
  }

  // Analyze losing longs
  const losingLongs: LongAnalysis[] = losers.map((t) => {
    const signal = t.entryCondition?.signal;
    const reason = signal?.reason || '';

    // Extract wall size if present (e.g., "15.6% volume" -> 15.6)
    const wallSizeMatch = reason.match(/(\d+\.?\d*)%\s*volume/);
    const wallSize = wallSizeMatch ? parseFloat(wallSizeMatch[1]) : undefined;

    // Extract wall duration if present (e.g., "existed 180s" -> 180)
    const durationMatch = reason.match(/existed\s+(\d+)s/);
    const wallDuration = durationMatch ? parseInt(durationMatch[1], 10) : undefined;

    return {
      id: t.id,
      pnl: t.realizedPnL,
      exitType: t.exitCondition?.exitType || 'UNKNOWN',
      strategy: signal?.type || 'UNKNOWN',
      confidence: signal?.confidence || 0,
      reason,
      wallSize,
      wallDuration,
    };
  });

  // Print losing longs
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`❌ LOSING LONG TRADES (${losers.length} trades):`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  losingLongs.forEach((t, idx) => {
    console.log(`${idx + 1}. ID: ${t.id}`);
    console.log(`   PnL: ${t.pnl.toFixed(2)} USDT`);
    console.log(`   Exit: ${t.exitType}`);
    console.log(`   Strategy: ${t.strategy}`);
    console.log(`   Confidence: ${(t.confidence * 100).toFixed(1)}%`);
    if (t.wallSize !== undefined) {
      console.log(`   Wall Size: ${t.wallSize.toFixed(1)}%`);
    }
    if (t.wallDuration !== undefined) {
      console.log(`   Wall Duration: ${t.wallDuration}s`);
    }
    console.log(`   Reason: ${t.reason}`);
    console.log('');
  });

  // Statistics
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 LOSING LONGS STATISTICS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  const avgConf = losingLongs.reduce((sum, t) => sum + t.confidence, 0) / losingLongs.length;
  console.log(`Average Confidence: ${(avgConf * 100).toFixed(1)}%`);

  // Wall size stats
  const withWallSize = losingLongs.filter((t) => t.wallSize !== undefined);
  if (withWallSize.length > 0) {
    const avgWallSize = withWallSize.reduce((sum, t) => sum + (t.wallSize || 0), 0) / withWallSize.length;
    const minWallSize = Math.min(...withWallSize.map((t) => t.wallSize || 0));
    const maxWallSize = Math.max(...withWallSize.map((t) => t.wallSize || 0));
    console.log(`Average Wall Size: ${avgWallSize.toFixed(1)}%`);
    console.log(`Min Wall Size: ${minWallSize.toFixed(1)}%`);
    console.log(`Max Wall Size: ${maxWallSize.toFixed(1)}%`);
  }

  // Wall duration stats
  const withWallDuration = losingLongs.filter((t) => t.wallDuration !== undefined);
  if (withWallDuration.length > 0) {
    const avgDuration = withWallDuration.reduce((sum, t) => sum + (t.wallDuration || 0), 0) / withWallDuration.length;
    const minDuration = Math.min(...withWallDuration.map((t) => t.wallDuration || 0));
    const maxDuration = Math.max(...withWallDuration.map((t) => t.wallDuration || 0));
    console.log(`Average Wall Duration: ${avgDuration.toFixed(0)}s`);
    console.log(`Min Wall Duration: ${minDuration}s`);
    console.log(`Max Wall Duration: ${maxDuration}s`);
  }

  console.log('');

  // Strategy breakdown
  const strategies: Record<string, number> = {};
  losingLongs.forEach((t) => {
    strategies[t.strategy] = (strategies[t.strategy] || 0) + 1;
  });
  console.log('By Strategy:');
  Object.entries(strategies)
    .sort((a, b) => b[1] - a[1])
    .forEach(([strat, count]) => {
      console.log(`  - ${strat}: ${count} (${((count / losingLongs.length) * 100).toFixed(1)}%)`);
    });

  console.log('');

  // Exit type breakdown
  const exitTypes: Record<string, number> = {};
  losingLongs.forEach((t) => {
    exitTypes[t.exitType] = (exitTypes[t.exitType] || 0) + 1;
  });
  console.log('By Exit Type:');
  Object.entries(exitTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} (${((count / losingLongs.length) * 100).toFixed(1)}%)`);
    });

  console.log('');

  // Recommendations
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Identify main issues
  const whaleHunterCount = losingLongs.filter((t) => t.strategy.includes('WHALE')).length;
  const lowConfidenceCount = losingLongs.filter((t) => t.confidence < 0.8).length;
  const smallWallCount = withWallSize.filter((t) => (t.wallSize || 0) < 15).length;
  const shortDurationCount = withWallDuration.filter((t) => (t.wallDuration || 0) < 180).length;

  if (whaleHunterCount > losingLongs.length * 0.5) {
    console.log('⚠️  PROBLEM: Majority of losing longs are from Whale Hunter strategies');
    console.log(
      `   ${whaleHunterCount}/${losingLongs.length} (${((whaleHunterCount / losingLongs.length) * 100).toFixed(1)}%) losing trades`,
    );
    console.log('');

    if (smallWallCount > 0) {
      console.log(`   ❌ Small Wall Size: ${smallWallCount} trades with wall <15%`);
      console.log('   → RECOMMENDATION: Increase minWallSize to 15% or higher');
    }

    if (lowConfidenceCount > 0) {
      console.log(`   ❌ Low Confidence: ${lowConfidenceCount} trades with confidence <80%`);
      console.log('   → RECOMMENDATION: Increase minConfidence to 80% or higher');
    }

    if (shortDurationCount > 0) {
      console.log(`   ❌ Short Wall Duration: ${shortDurationCount} trades with wall <180s`);
      console.log('   → RECOMMENDATION: Increase minWallDuration to 180000ms (3 minutes)');
    }

    console.log('');
    console.log('📝 SUGGESTED CONFIG CHANGES:');
    console.log('```json');
    console.log('{');
    console.log('  "whaleHunter": {');
    if (lowConfidenceCount > 0) {
      console.log(`    "minConfidence": 80,  // was ${(avgConf * 100).toFixed(0)}`);
    }
    console.log('    "detector": {');
    console.log('      "modes": {');
    if (smallWallCount > 0) {
      console.log('        "wallBreak": {');
      console.log(`          "minWallSize": 15  // current avg: ${withWallSize.length > 0 ? (withWallSize.reduce((sum, t) => sum + (t.wallSize || 0), 0) / withWallSize.length).toFixed(1) : 'N/A'}%`);
      console.log('        },');
    }
    if (shortDurationCount > 0) {
      console.log('        "wallDisappearance": {');
      console.log(
        `          "minWallDuration": 180000  // current avg: ${withWallDuration.length > 0 ? (withWallDuration.reduce((sum, t) => sum + (t.wallDuration || 0), 0) / withWallDuration.length).toFixed(0) : 'N/A'}s`,
      );
      console.log('        }');
    }
    console.log('      }');
    console.log('    }');
    console.log('  }');
    console.log('}');
    console.log('```');
  } else {
    console.log('✅ No clear pattern found in losing longs');
    console.log('   Losses seem to be distributed across different strategies');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
}

// Run
main();
