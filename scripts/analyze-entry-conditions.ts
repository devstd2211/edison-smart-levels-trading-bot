/**
 * Entry Conditions Analysis Utility
 *
 * Analyzes entry conditions of all trades (wins vs losses)
 * and identifies patterns in losing trades.
 *
 * Usage: npm run analyze-entries [path/to/journal.json]
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface Trade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  realizedPnL: number;
  openedAt: number;
  closedAt?: number;
  entryCondition: {
    signal: {
      type: string;
      direction: string;
      price: number;
      stopLoss: number;
      takeProfits: Array<{
        level: number;
        percent: number;
        sizePercent: number;
        price: number;
      }>;
      confidence: number;
      reason: string;
      timestamp: number;
    };
  };
  exitCondition?: {
    exitType: string;
    price: number;
    timestamp: number;
    reason: string;
    pnlUsdt: number;
    pnlPercent: number;
    holdingTimeMinutes: number;
    stoppedOut: boolean;
  };
}

interface EntryPattern {
  strategy: string;
  confidence: number;
  reason: string;
  slDistance: number;
  side: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgHoldTime: number;
  stopOutRate: number;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🔍 ENTRY CONDITIONS ANALYSIS\n');

  // Load journal
  const journalPath =
    process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

  if (!fs.existsSync(journalPath)) {
    console.error(`❌ Journal file not found: ${journalPath}`);
    process.exit(1);
  }

  const trades: Trade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const closedTrades = trades.filter((t) => t.closedAt);

  console.log(`✅ Loaded ${closedTrades.length} closed trades\n`);

  // Split wins and losses
  const wins = closedTrades.filter((t) => t.realizedPnL > 0);
  const losses = closedTrades.filter((t) => t.realizedPnL < 0);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log(`Total Trades:  ${closedTrades.length}`);
  console.log(`Wins:          ${wins.length} (${((wins.length / closedTrades.length) * 100).toFixed(1)}%)`);
  console.log(`Losses:        ${losses.length} (${((losses.length / closedTrades.length) * 100).toFixed(1)}%)\n`);

  // Analyze losses in detail
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('❌ LOSING TRADES - ENTRY CONDITIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (losses.length === 0) {
    console.log('✅ No losses - all trades profitable!\n');
  } else {
    analyzeLosses(losses);
  }

  // Analyze wins
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ WINNING TRADES - ENTRY CONDITIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (wins.length === 0) {
    console.log('❌ No wins yet\n');
  } else {
    analyzeWins(wins);
  }

  // Compare wins vs losses
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('⚖️  COMPARISON: WINS vs LOSSES');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (wins.length > 0 && losses.length > 0) {
    compareWinsVsLosses(wins, losses);
  }

  // Pattern detection
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 PATTERN DETECTION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  detectPatterns(closedTrades);

  // Recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  generateRecommendations(wins, losses);
}

// ============================================================================
// ANALYZE LOSSES
// ============================================================================

function analyzeLosses(losses: Trade[]) {
  const byStrategy = new Map<string, Trade[]>();
  const byReason = new Map<string, Trade[]>();
  const stopOuts = losses.filter((t) => t.exitCondition?.stoppedOut).length;

  losses.forEach((trade) => {
    const strategy = trade.entryCondition.signal.type;
    const reason = extractReasonType(trade.entryCondition.signal.reason);

    if (!byStrategy.has(strategy)) byStrategy.set(strategy, []);
    if (!byReason.has(reason)) byReason.set(reason, []);

    byStrategy.get(strategy)!.push(trade);
    byReason.get(reason)!.push(trade);
  });

  // Summary stats
  const avgConfidence =
    losses.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / losses.length;
  const avgSL =
    losses.reduce((sum, t) => {
      const entry = t.entryCondition.signal;
      return sum + (Math.abs(entry.stopLoss - entry.price) / entry.price) * 100;
    }, 0) / losses.length;
  const avgHoldTime =
    losses.reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) / losses.length;

  console.log(`Total Losses:       ${losses.length}`);
  console.log(`Stop Outs:          ${stopOuts}/${losses.length} (${((stopOuts / losses.length) * 100).toFixed(1)}%)`);
  console.log(`Avg Confidence:     ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Avg SL Distance:    ${avgSL.toFixed(2)}%`);
  console.log(`Avg Hold Time:      ${avgHoldTime.toFixed(1)} minutes\n`);

  // By Strategy
  console.log('By Strategy:');
  byStrategy.forEach((trades, strategy) => {
    const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
    const avgSLDist =
      trades.reduce((sum, t) => {
        const entry = t.entryCondition.signal;
        return sum + (Math.abs(entry.stopLoss - entry.price) / entry.price) * 100;
      }, 0) / trades.length;

    console.log(`  ${strategy}:`);
    console.log(`    Count: ${trades.length} | PnL: ${totalPnL.toFixed(2)} USDT`);
    console.log(`    Avg SL: ${avgSLDist.toFixed(2)}% | Avg Confidence: ${(trades.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / trades.length * 100).toFixed(1)}%`);
  });

  console.log('\nBy Entry Reason:');
  byReason.forEach((trades, reason) => {
    const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
    console.log(`  ${reason}: ${trades.length} losses (${totalPnL.toFixed(2)} USDT)`);
  });

  // Direction breakdown
  const longLosses = losses.filter((t) => t.side === 'LONG');
  const shortLosses = losses.filter((t) => t.side === 'SHORT');

  console.log('\nBy Direction:');
  console.log(`  LONG:  ${longLosses.length} losses (${longLosses.reduce((s, t) => s + t.realizedPnL, 0).toFixed(2)} USDT)`);
  console.log(`  SHORT: ${shortLosses.length} losses (${shortLosses.reduce((s, t) => s + t.realizedPnL, 0).toFixed(2)} USDT)`);

  // Common characteristics
  console.log('\n🔍 Common Characteristics:');
  const allSameConfidence = losses.every((t) => t.entryCondition.signal.confidence === losses[0].entryCondition.signal.confidence);
  const allSameSL = losses.every((t) => {
    const sl1 = (Math.abs(t.entryCondition.signal.stopLoss - t.entryCondition.signal.price) / t.entryCondition.signal.price) * 100;
    const sl0 = (Math.abs(losses[0].entryCondition.signal.stopLoss - losses[0].entryCondition.signal.price) / losses[0].entryCondition.signal.price) * 100;
    return Math.abs(sl1 - sl0) < 0.01;
  });

  if (allSameConfidence) {
    console.log(`  ⚠️  ALL losses have same confidence: ${(losses[0].entryCondition.signal.confidence * 100).toFixed(0)}%`);
  }
  if (allSameSL) {
    const slDist = (Math.abs(losses[0].entryCondition.signal.stopLoss - losses[0].entryCondition.signal.price) / losses[0].entryCondition.signal.price) * 100;
    console.log(`  ⚠️  ALL losses have same SL distance: ${slDist.toFixed(2)}%`);
  }
}

// ============================================================================
// ANALYZE WINS
// ============================================================================

function analyzeWins(wins: Trade[]) {
  const byStrategy = new Map<string, Trade[]>();
  const byReason = new Map<string, Trade[]>();

  wins.forEach((trade) => {
    const strategy = trade.entryCondition.signal.type;
    const reason = extractReasonType(trade.entryCondition.signal.reason);

    if (!byStrategy.has(strategy)) byStrategy.set(strategy, []);
    if (!byReason.has(reason)) byReason.set(reason, []);

    byStrategy.get(strategy)!.push(trade);
    byReason.get(reason)!.push(trade);
  });

  const avgConfidence =
    wins.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / wins.length;
  const avgSL =
    wins.reduce((sum, t) => {
      const entry = t.entryCondition.signal;
      return sum + (Math.abs(entry.stopLoss - entry.price) / entry.price) * 100;
    }, 0) / wins.length;
  const avgHoldTime =
    wins.reduce((sum, t) => sum + (t.exitCondition?.holdingTimeMinutes || 0), 0) / wins.length;

  console.log(`Total Wins:         ${wins.length}`);
  console.log(`Avg Confidence:     ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Avg SL Distance:    ${avgSL.toFixed(2)}%`);
  console.log(`Avg Hold Time:      ${avgHoldTime.toFixed(1)} minutes\n`);

  console.log('By Strategy:');
  byStrategy.forEach((trades, strategy) => {
    const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
    const avgSLDist =
      trades.reduce((sum, t) => {
        const entry = t.entryCondition.signal;
        return sum + (Math.abs(entry.stopLoss - entry.price) / entry.price) * 100;
      }, 0) / trades.length;

    console.log(`  ${strategy}:`);
    console.log(`    Count: ${trades.length} | PnL: ${totalPnL.toFixed(2)} USDT`);
    console.log(`    Avg SL: ${avgSLDist.toFixed(2)}% | Avg Confidence: ${(trades.reduce((sum, t) => sum + t.entryCondition.signal.confidence, 0) / trades.length * 100).toFixed(1)}%`);
  });

  console.log('\nBy Entry Reason:');
  byReason.forEach((trades, reason) => {
    const totalPnL = trades.reduce((sum, t) => sum + t.realizedPnL, 0);
    console.log(`  ${reason}: ${trades.length} wins (+${totalPnL.toFixed(2)} USDT)`);
  });
}

// ============================================================================
// COMPARE WINS VS LOSSES
// ============================================================================

function compareWinsVsLosses(wins: Trade[], losses: Trade[]) {
  const winsAvgConf = wins.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / wins.length;
  const lossesAvgConf = losses.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / losses.length;

  const winsAvgSL = wins.reduce((s, t) => {
    const e = t.entryCondition.signal;
    return s + (Math.abs(e.stopLoss - e.price) / e.price) * 100;
  }, 0) / wins.length;

  const lossesAvgSL = losses.reduce((s, t) => {
    const e = t.entryCondition.signal;
    return s + (Math.abs(e.stopLoss - e.price) / e.price) * 100;
  }, 0) / losses.length;

  const winsAvgHoldTime = wins.reduce((s, t) => s + (t.exitCondition?.holdingTimeMinutes || 0), 0) / wins.length;
  const lossesAvgHoldTime = losses.reduce((s, t) => s + (t.exitCondition?.holdingTimeMinutes || 0), 0) / losses.length;

  console.log('| Metric              | Wins             | Losses           | Difference       |');
  console.log('|---------------------|------------------|------------------|------------------|');
  console.log(`| Avg Confidence      | ${(winsAvgConf * 100).toFixed(1)}%           | ${(lossesAvgConf * 100).toFixed(1)}%           | ${((winsAvgConf - lossesAvgConf) * 100).toFixed(1)}% ${winsAvgConf > lossesAvgConf ? '✅' : '❌'}        |`);
  console.log(`| Avg SL Distance     | ${winsAvgSL.toFixed(2)}%          | ${lossesAvgSL.toFixed(2)}%          | ${(winsAvgSL - lossesAvgSL).toFixed(2)}% ${winsAvgSL > lossesAvgSL ? '✅' : '❌'}        |`);
  console.log(`| Avg Hold Time       | ${winsAvgHoldTime.toFixed(1)} min        | ${lossesAvgHoldTime.toFixed(1)} min        | ${(winsAvgHoldTime - lossesAvgHoldTime).toFixed(1)} min ${winsAvgHoldTime > lossesAvgHoldTime ? '✅' : '❌'}      |`);

  // Stop out comparison
  const winsStopOuts = wins.filter((t) => t.exitCondition?.stoppedOut).length;
  const lossesStopOuts = losses.filter((t) => t.exitCondition?.stoppedOut).length;

  console.log(`| Stop Out Rate       | ${((winsStopOuts / wins.length) * 100).toFixed(1)}%           | ${((lossesStopOuts / losses.length) * 100).toFixed(1)}%           | ${(((lossesStopOuts / losses.length) - (winsStopOuts / wins.length)) * 100).toFixed(1)}% ${winsStopOuts < lossesStopOuts ? '✅' : '❌'}       |`);
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

function detectPatterns(trades: Trade[]) {
  const patterns = new Map<string, EntryPattern>();

  trades.forEach((trade) => {
    const entry = trade.entryCondition.signal;
    const reasonType = extractReasonType(entry.reason);
    const slDistance = (Math.abs(entry.stopLoss - entry.price) / entry.price) * 100;

    const key = `${entry.type}_${reasonType}_${trade.side}_${slDistance.toFixed(1)}`;

    if (!patterns.has(key)) {
      patterns.set(key, {
        strategy: entry.type,
        confidence: entry.confidence,
        reason: reasonType,
        slDistance,
        side: trade.side,
        count: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalPnL: 0,
        avgHoldTime: 0,
        stopOutRate: 0,
      });
    }

    const pattern = patterns.get(key)!;
    pattern.count++;
    pattern.totalPnL += trade.realizedPnL;
    pattern.avgHoldTime += trade.exitCondition?.holdingTimeMinutes || 0;

    if (trade.realizedPnL > 0) {
      pattern.wins++;
    } else {
      pattern.losses++;
      if (trade.exitCondition?.stoppedOut) {
        pattern.stopOutRate++;
      }
    }
  });

  // Calculate rates
  patterns.forEach((pattern) => {
    pattern.winRate = pattern.wins / pattern.count;
    pattern.avgHoldTime = pattern.avgHoldTime / pattern.count;
    pattern.stopOutRate = pattern.stopOutRate / pattern.losses;
  });

  // Sort by count
  const sortedPatterns = Array.from(patterns.values()).sort((a, b) => b.count - a.count);

  console.log('Top Entry Patterns:\n');
  sortedPatterns.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.strategy} ${p.side} - ${p.reason}`);
    console.log(`   Count: ${p.count} | Win Rate: ${(p.winRate * 100).toFixed(1)}% | PnL: ${p.totalPnL.toFixed(2)} USDT`);
    console.log(`   SL: ${p.slDistance.toFixed(2)}% | Confidence: ${(p.confidence * 100).toFixed(0)}%`);
    console.log(`   Avg Hold: ${p.avgHoldTime.toFixed(1)} min | Stop Out: ${(p.stopOutRate * 100).toFixed(1)}%\n`);
  });
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function generateRecommendations(wins: Trade[], losses: Trade[]) {
  const recommendations: string[] = [];

  // SL distance comparison
  const winsAvgSL = wins.reduce((s, t) => {
    const e = t.entryCondition.signal;
    return s + (Math.abs(e.stopLoss - e.price) / e.price) * 100;
  }, 0) / wins.length;

  const lossesAvgSL = losses.reduce((s, t) => {
    const e = t.entryCondition.signal;
    return s + (Math.abs(e.stopLoss - e.price) / e.price) * 100;
  }, 0) / losses.length;

  if (lossesAvgSL < winsAvgSL * 0.8) {
    recommendations.push(
      `⚠️  Losses have narrower stops (${lossesAvgSL.toFixed(2)}%) than wins (${winsAvgSL.toFixed(2)}%)` +
      `\n   → Consider widening stop loss by ${((winsAvgSL / lossesAvgSL - 1) * 100).toFixed(0)}%`
    );
  }

  // Stop out rate
  const lossStopOuts = losses.filter((t) => t.exitCondition?.stoppedOut).length;
  const stopOutRate = lossStopOuts / losses.length;

  if (stopOutRate > 0.7) {
    recommendations.push(
      `⚠️  High stop out rate (${(stopOutRate * 100).toFixed(0)}% of losses)` +
      `\n   → Stops too tight or entering at wrong time`
    );
  }

  // Confidence comparison
  const winsAvgConf = wins.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / wins.length;
  const lossesAvgConf = losses.reduce((s, t) => s + t.entryCondition.signal.confidence, 0) / losses.length;

  if (lossesAvgConf < winsAvgConf * 0.9) {
    recommendations.push(
      `⚠️  Losses have lower confidence (${(lossesAvgConf * 100).toFixed(0)}%) than wins (${(winsAvgConf * 100).toFixed(0)}%)` +
      `\n   → Consider raising minimum confidence threshold to ${(lossesAvgConf * 100 + 5).toFixed(0)}%`
    );
  }

  // Entry reason analysis
  const lossReasons = new Map<string, number>();
  losses.forEach((t) => {
    const reason = extractReasonType(t.entryCondition.signal.reason);
    lossReasons.set(reason, (lossReasons.get(reason) || 0) + 1);
  });

  const topLossReason = Array.from(lossReasons.entries()).sort((a, b) => b[1] - a[1])[0];
  if (topLossReason && topLossReason[1] > losses.length * 0.6) {
    recommendations.push(
      `⚠️  ${((topLossReason[1] / losses.length) * 100).toFixed(0)}% of losses from "${topLossReason[0]}"` +
      `\n   → Review this entry condition or add additional filters`
    );
  }

  if (recommendations.length === 0) {
    console.log('✅ No major issues detected! Entry conditions look good.\n');
  } else {
    recommendations.forEach((rec) => console.log(rec + '\n'));
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function extractReasonType(reason: string): string {
  if (reason.includes('WHALE [WALL_BREAK]')) return 'Whale Wall Break';
  if (reason.includes('WHALE [WALL_DISAPPEAR]')) return 'Whale Wall Disappear';
  if (reason.includes('WHALE [IMBALANCE]')) return 'Whale Imbalance';
  if (reason.includes('Price near support')) return 'Support Level';
  if (reason.includes('Price near resistance')) return 'Resistance Level';
  if (reason.includes('divergence')) return 'Divergence';
  if (reason.includes('trend')) return 'Trend Following';
  return 'Other';
}

// Run
main().catch(console.error);
