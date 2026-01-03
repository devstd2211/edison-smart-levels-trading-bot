/**
 * Loss Pattern Analysis Script
 *
 * Analyzes losing trades to find common patterns in entry conditions
 * that lead to losses. Helps identify weak signals to filter out.
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
  openedAt: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  entryCondition: {
    signal: {
      type: string;
      confidence: number;
      stopLoss: number;
      takeProfits: Array<{ level: number; price: number; hit: boolean }>;
    };
  };
  exitCondition?: {
    exitType: string;
    timestamp: number;
    pnlUsdt: number;
    pnlPercent: number;
    tpLevelsHit?: number[];
  };
  status: string;
}

interface LossPattern {
  pattern: string;
  count: number;
  avgLoss: number;
  totalLoss: number;
  examples: string[];
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function loadJournal(journalPath: string): Trade[] {
  if (!fs.existsSync(journalPath)) {
    console.error(`❌ Journal not found: ${journalPath}`);
    process.exit(1);
  }

  const data = fs.readFileSync(journalPath, 'utf-8');
  return JSON.parse(data);
}

function analyzeLosingTrades(trades: Trade[]) {
  const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.exitCondition);
  const losingTrades = closedTrades.filter(t => (t.exitCondition?.pnlUsdt || 0) < 0);
  const winningTrades = closedTrades.filter(t => (t.exitCondition?.pnlUsdt || 0) >= 0);

  const longLosing = losingTrades.filter(t => t.side === 'LONG');
  const shortLosing = losingTrades.filter(t => t.side === 'SHORT');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 LOSS PATTERN ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Total Closed Trades:  ${closedTrades.length}`);
  console.log(`Winning Trades:       ${winningTrades.length} (${((winningTrades.length / closedTrades.length) * 100).toFixed(1)}%)`);
  console.log(`Losing Trades:        ${losingTrades.length} (${((losingTrades.length / closedTrades.length) * 100).toFixed(1)}%)`);
  console.log(`  - LONG losses:      ${longLosing.length}`);
  console.log(`  - SHORT losses:     ${shortLosing.length}\n`);

  // Analyze LONG losses
  console.log('───────────────────────────────────────────────────────────────');
  console.log('📉 LONG LOSING TRADES ANALYSIS');
  console.log('───────────────────────────────────────────────────────────────\n');
  analyzeSide(longLosing, 'LONG');

  // Analyze SHORT losses
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📉 SHORT LOSING TRADES ANALYSIS');
  console.log('───────────────────────────────────────────────────────────────\n');
  analyzeSide(shortLosing, 'SHORT');

  // Compare with winners
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('✅ COMPARISON: LOSERS vs WINNERS');
  console.log('───────────────────────────────────────────────────────────────\n');
  compareWinnersAndLosers(losingTrades, winningTrades);

  // Overall recommendations
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('💡 RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  generateRecommendations(losingTrades, winningTrades);
}

function analyzeSide(trades: Trade[], side: 'LONG' | 'SHORT') {
  if (trades.length === 0) {
    console.log(`No ${side} losing trades found.\n`);
    return;
  }

  const totalLoss = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const avgLoss = totalLoss / trades.length;
  const avgLossPercent = trades.reduce((sum, t) => sum + Math.abs(t.pnlPercent || 0), 0) / trades.length;

  console.log(`Total Loss:    ${totalLoss.toFixed(4)} USDT`);
  console.log(`Average Loss:  ${avgLoss.toFixed(4)} USDT (${avgLossPercent.toFixed(2)}%)\n`);

  // Pattern 1: Exit reason
  console.log('🔍 Exit Reasons:');
  const exitReasons = groupBy(trades, t => t.exitReason || 'UNKNOWN');
  Object.entries(exitReasons).forEach(([reason, trades]) => {
    const reasonLoss = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    console.log(`  ${reason.padEnd(20)} ${trades.length.toString().padStart(3)} trades | Loss: ${reasonLoss.toFixed(4)} USDT`);
  });

  // Pattern 2: Strategy
  console.log('\n🔍 Strategy Performance:');
  const strategies = groupBy(trades, t => t.strategy || 'UNKNOWN');
  Object.entries(strategies).forEach(([strategy, trades]) => {
    const strategyLoss = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgConfidence = trades.reduce((sum, t) => sum + (t.confidence || 0), 0) / trades.length;
    console.log(`  ${strategy.padEnd(20)} ${trades.length.toString().padStart(3)} trades | Loss: ${strategyLoss.toFixed(4)} USDT | Avg Confidence: ${avgConfidence.toFixed(1)}%`);
  });

  // Pattern 3: Confidence levels
  console.log('\n🔍 Confidence Distribution:');
  const lowConfidence = trades.filter(t => (t.confidence || 0) < 80);
  const medConfidence = trades.filter(t => (t.confidence || 0) >= 80 && (t.confidence || 0) < 90);
  const highConfidence = trades.filter(t => (t.confidence || 0) >= 90);

  console.log(`  < 80%:   ${lowConfidence.length.toString().padStart(3)} trades | Loss: ${lowConfidence.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT`);
  console.log(`  80-90%:  ${medConfidence.length.toString().padStart(3)} trades | Loss: ${medConfidence.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT`);
  console.log(`  > 90%:   ${highConfidence.length.toString().padStart(3)} trades | Loss: ${highConfidence.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT`);

  // Pattern 4: Stop loss distance
  console.log('\n🔍 Stop Loss Distance (% from entry):');
  const slDistances = trades.map(t => {
    const distance = side === 'LONG'
      ? ((t.entryPrice - t.stopLoss) / t.entryPrice) * 100
      : ((t.stopLoss - t.entryPrice) / t.entryPrice) * 100;
    return { trade: t, distance };
  });

  const avgSlDistance = slDistances.reduce((sum, item) => sum + item.distance, 0) / slDistances.length;
  const tightSl = slDistances.filter(item => item.distance < 1.5);
  const normalSl = slDistances.filter(item => item.distance >= 1.5 && item.distance < 2.5);
  const wideSl = slDistances.filter(item => item.distance >= 2.5);

  console.log(`  Average SL distance: ${avgSlDistance.toFixed(2)}%`);
  console.log(`  < 1.5%:  ${tightSl.length.toString().padStart(3)} trades | Loss: ${tightSl.reduce((s, i) => s + (i.trade.pnl || 0), 0).toFixed(4)} USDT`);
  console.log(`  1.5-2.5%: ${normalSl.length.toString().padStart(3)} trades | Loss: ${normalSl.reduce((s, i) => s + (i.trade.pnl || 0), 0).toFixed(4)} USDT`);
  console.log(`  > 2.5%:  ${wideSl.length.toString().padStart(3)} trades | Loss: ${wideSl.reduce((s, i) => s + (i.trade.pnl || 0), 0).toFixed(4)} USDT`);

  // Pattern 5: Quick stop outs (< 5 minutes)
  console.log('\n🔍 Holding Time Before Stop:');
  const quickStops = trades.filter(t => {
    if (!t.exitTime || t.exitReason !== 'STOP_LOSS') return false;
    const holdingTime = (t.exitTime - t.entryTime) / 60000; // minutes
    return holdingTime < 5;
  });

  const mediumStops = trades.filter(t => {
    if (!t.exitTime || t.exitReason !== 'STOP_LOSS') return false;
    const holdingTime = (t.exitTime - t.entryTime) / 60000;
    return holdingTime >= 5 && holdingTime < 15;
  });

  const slowStops = trades.filter(t => {
    if (!t.exitTime || t.exitReason !== 'STOP_LOSS') return false;
    const holdingTime = (t.exitTime - t.entryTime) / 60000;
    return holdingTime >= 15;
  });

  console.log(`  < 5 min:   ${quickStops.length.toString().padStart(3)} trades | Loss: ${quickStops.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT ⚠️ BAD ENTRY`);
  console.log(`  5-15 min:  ${mediumStops.length.toString().padStart(3)} trades | Loss: ${mediumStops.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT`);
  console.log(`  > 15 min:  ${slowStops.length.toString().padStart(3)} trades | Loss: ${slowStops.reduce((s, t) => s + (t.pnl || 0), 0).toFixed(4)} USDT`);

  // Show worst trades
  console.log('\n🔍 Top 5 Worst Trades:');
  const worst = [...trades].sort((a, b) => (a.pnl || 0) - (b.pnl || 0)).slice(0, 5);
  worst.forEach((t, i) => {
    const holdingTime = t.exitTime ? ((t.exitTime - t.entryTime) / 60000).toFixed(1) : 'N/A';
    console.log(`  ${i + 1}. ${t.id.slice(0, 10)}... | Loss: ${(t.pnl || 0).toFixed(4)} USDT | ${t.strategy} | Conf: ${t.confidence}% | Hold: ${holdingTime}min`);
  });
}

function compareWinnersAndLosers(losers: Trade[], winners: Trade[]) {
  const loserAvgConf = losers.reduce((sum, t) => sum + (t.confidence || 0), 0) / losers.length;
  const winnerAvgConf = winners.reduce((sum, t) => sum + (t.confidence || 0), 0) / winners.length;

  console.log('Confidence:');
  console.log(`  Losers:  ${loserAvgConf.toFixed(1)}%`);
  console.log(`  Winners: ${winnerAvgConf.toFixed(1)}%`);
  console.log(`  Delta:   ${(winnerAvgConf - loserAvgConf).toFixed(1)}% ${winnerAvgConf > loserAvgConf ? '✅ Winners higher' : '⚠️ No difference'}`);

  console.log('\nStrategy Distribution:');
  const loserStrategies = groupBy(losers, t => t.strategy || 'UNKNOWN');
  const winnerStrategies = groupBy(winners, t => t.strategy || 'UNKNOWN');

  const allStrategies = new Set([...Object.keys(loserStrategies), ...Object.keys(winnerStrategies)]);
  allStrategies.forEach(strategy => {
    const lCount = (loserStrategies[strategy] || []).length;
    const wCount = (winnerStrategies[strategy] || []).length;
    const winRate = wCount / (lCount + wCount) * 100;
    console.log(`  ${strategy.padEnd(20)} Win Rate: ${winRate.toFixed(1)}% (${wCount}W / ${lCount}L)`);
  });
}

function generateRecommendations(losers: Trade[], winners: Trade[]) {
  const recommendations: string[] = [];

  // Check confidence threshold
  const loserAvgConf = losers.reduce((sum, t) => sum + (t.confidence || 0), 0) / losers.length;
  const winnerAvgConf = winners.reduce((sum, t) => sum + (t.confidence || 0), 0) / winners.length;

  if (winnerAvgConf - loserAvgConf > 5) {
    recommendations.push(`⚠️ INCREASE CONFIDENCE THRESHOLD: Winners have ${(winnerAvgConf - loserAvgConf).toFixed(1)}% higher confidence. Consider raising min confidence from current to ${Math.ceil(loserAvgConf + 5)}%`);
  }

  // Check for quick stop outs
  const quickStops = losers.filter(t => {
    if (!t.exitTime || t.exitReason !== 'STOP_LOSS') return false;
    const holdingTime = (t.exitTime - t.entryTime) / 60000;
    return holdingTime < 5;
  });

  if (quickStops.length > losers.length * 0.3) {
    const quickStopLoss = quickStops.reduce((s, t) => s + (t.pnl || 0), 0);
    recommendations.push(`⚠️ TOO MANY QUICK STOP OUTS: ${quickStops.length}/${losers.length} (${((quickStops.length / losers.length) * 100).toFixed(1)}%) stopped in < 5min, costing ${quickStopLoss.toFixed(4)} USDT. Bad entry timing!`);
  }

  // Check strategy performance
  const loserStrategies = groupBy(losers, t => t.strategy || 'UNKNOWN');
  const winnerStrategies = groupBy(winners, t => t.strategy || 'UNKNOWN');

  Object.keys(loserStrategies).forEach(strategy => {
    const lCount = loserStrategies[strategy].length;
    const wCount = (winnerStrategies[strategy] || []).length;
    const winRate = wCount / (lCount + wCount) * 100;

    if (winRate < 40) {
      recommendations.push(`⚠️ POOR STRATEGY: ${strategy} has only ${winRate.toFixed(1)}% win rate. Consider disabling or fixing this strategy.`);
    }
  });

  // Check LONG vs SHORT performance
  const longLosers = losers.filter(t => t.side === 'LONG');
  const shortLosers = losers.filter(t => t.side === 'SHORT');
  const longWinners = winners.filter(t => t.side === 'LONG');
  const shortWinners = winners.filter(t => t.side === 'SHORT');

  const longWinRate = longWinners.length / (longLosers.length + longWinners.length) * 100;
  const shortWinRate = shortWinners.length / (shortLosers.length + shortWinners.length) * 100;

  if (Math.abs(longWinRate - shortWinRate) > 20) {
    const worse = longWinRate < shortWinRate ? 'LONG' : 'SHORT';
    recommendations.push(`⚠️ DIRECTIONAL BIAS: ${worse} trades performing much worse (${worse === 'LONG' ? longWinRate.toFixed(1) : shortWinRate.toFixed(1)}% win rate). Review ${worse} entry filters.`);
  }

  // Output recommendations
  if (recommendations.length === 0) {
    console.log('✅ No critical issues found. Keep monitoring.');
  } else {
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}\n`);
    });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const journalPath = args[0] || path.join(__dirname, '../data/trade-journal.json');

  console.log(`📖 Loading journal: ${journalPath}\n`);
  const journal = loadJournal(journalPath);

  analyzeLosingTrades(journal);
}

main();
