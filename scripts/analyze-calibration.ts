/**
 * Analyze whale calibration results
 */

import * as fs from 'fs';
import * as path from 'path';

const filePath = process.argv[2] || path.join(process.cwd(), 'whale-calibration-2025-11-19.json');

console.log(`\n🔍 Analyzing: ${filePath}\n`);

const results = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('═══════════════════════════════════════════════════');
console.log('📊 CALIBRATION RESULTS ANALYSIS');
console.log('═══════════════════════════════════════════════════\n');

console.log(`Total Results: ${results.length}\n`);

// Group by trade count
const byTrades: Record<number, number> = {};
results.forEach((r: any) => {
  const count = r.metrics.totalTrades;
  if (!byTrades[count]) byTrades[count] = 0;
  byTrades[count]++;
});

console.log('By Trade Count:');
Object.entries(byTrades)
  .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
  .forEach(([trades, count]) => {
    console.log(`  ${trades} trades: ${count} configs`);
  });

// LONG vs SHORT
const longOnly = results.filter((r: any) => r.metrics.longTrades > 0 && r.metrics.shortTrades === 0);
const shortOnly = results.filter((r: any) => r.metrics.longTrades === 0 && r.metrics.shortTrades > 0);
const both = results.filter((r: any) => r.metrics.longTrades > 0 && r.metrics.shortTrades > 0);
const noTrades = results.filter((r: any) => r.metrics.totalTrades === 0);

console.log('\nLONG vs SHORT:');
console.log(`  LONG only: ${longOnly.length} configs`);
console.log(`  SHORT only: ${shortOnly.length} configs`);
console.log(`  Both: ${both.length} configs`);
console.log(`  No trades: ${noTrades.length} configs\n`);

// Check uniqueness
const uniquePnl = new Set(results.map((r: any) => r.metrics.netPnlPercent.toFixed(4)));
const uniqueWR = new Set(results.map((r: any) => r.metrics.winRate.toFixed(1)));
const uniqueRR = new Set(results.map((r: any) => r.metrics.rrRatio.toFixed(2)));
const uniqueTrades = new Set(results.map((r: any) => r.metrics.totalTrades));

console.log('Unique values:');
console.log(`  Unique PnL%: ${uniquePnl.size}`);
console.log(`  Unique WR%: ${uniqueWR.size}`);
console.log(`  Unique R/R: ${uniqueRR.size}`);
console.log(`  Unique Trade counts: ${uniqueTrades.size}\n`);

// Best by R/R (with trades > 0)
const withTrades = results.filter((r: any) => r.metrics.totalTrades > 0);
const sortedByRR = [...withTrades].sort((a: any, b: any) => b.metrics.rrRatio - a.metrics.rrRatio);

console.log('🏆 TOP 10 by R/R (with trades):\n');
sortedByRR.slice(0, 10).forEach((r: any, i: number) => {
  console.log(
    `${i + 1}. R/R=${r.metrics.rrRatio.toFixed(2)}x | WR=${r.metrics.winRate.toFixed(1)}% | Trades=${r.metrics.totalTrades} (L:${r.metrics.longTrades} S:${r.metrics.shortTrades}) | PnL=${r.metrics.netPnlPercent.toFixed(2)}%`,
  );
  console.log(
    `   TP=${r.params.takeProfitPercent}% SL=${r.params.stopLossAtrMultiplier}x L_Conf=${r.params.minConfidenceLong}% S_Conf=${r.params.minConfidenceShort}% BREAK=${r.params.wallBreakEnabled ? '✅' : '❌'} DISAPP=${r.params.wallDisappearanceEnabled ? '✅' : '❌'}`,
  );
});

console.log('\n═══════════════════════════════════════════════════\n');
