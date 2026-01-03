/**
 * Analyze SHORT trades performance
 */

import * as fs from 'fs';
import * as path from 'path';

interface Trade {
  id: string;
  strategy: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  exitType: string;
  quantity: number;
  leverage: number;
  tpLevelsHit?: string[];
  stopLoss?: {
    initial: number;
    final: number;
    breakeven?: boolean;
    trailing?: boolean;
  };
}

const journalPath = process.argv[2] || path.join(process.cwd(), 'data', 'trade-journal.json');

console.log(`\n🔍 Loading trade journal from: ${journalPath}\n`);

const journal: Trade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
const shortTrades = journal.filter((t) => t.direction === 'SHORT');

console.log('═══════════════════════════════════════════════════════════════');
console.log(`📊 SHORT TRADES ANALYSIS (${shortTrades.length} trades)`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Group by exit type
const byExitType: Record<string, Trade[]> = {};
shortTrades.forEach((t) => {
  const exit = t.exitType || 'UNKNOWN';
  if (!byExitType[exit]) byExitType[exit] = [];
  byExitType[exit].push(t);
});

console.log('📊 BY EXIT TYPE:\n');
Object.entries(byExitType).forEach(([exitType, trades]) => {
  const avgPnl = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winRate = (trades.filter((t) => t.pnl > 0).length / trades.length) * 100;

  console.log(`${exitType}:`);
  console.log(`  Count: ${trades.length}`);
  console.log(`  Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`  Avg PnL: ${avgPnl.toFixed(2)} USDT`);
  console.log(`  Total: ${totalPnl.toFixed(2)} USDT`);
  console.log('');
});

// Wins vs Losses
const wins = shortTrades.filter((t) => t.pnl > 0);
const losses = shortTrades.filter((t) => t.pnl <= 0);

console.log('═══════════════════════════════════════════════════════════════');
console.log('📈 WINS vs LOSSES:\n');

console.log(`WINS (${wins.length}):`);
console.log(`  Avg PnL: +${(wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length).toFixed(2)} USDT`);
console.log(`  Avg % Move: ${(wins.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / wins.length).toFixed(2)}%`);
console.log(`  Avg Holding: ${Math.round(wins.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / wins.length / 60000)} min\n`);

console.log(`LOSSES (${losses.length}):`);
console.log(`  Avg PnL: ${(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length).toFixed(2)} USDT`);
console.log(`  Avg % Move: ${(losses.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / losses.length).toFixed(2)}%`);
console.log(`  Avg Holding: ${Math.round(losses.reduce((sum, t) => sum + (t.exitTime - t.entryTime), 0) / losses.length / 60000)} min\n`);

// Distance analysis
const avgWinDist = wins.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / wins.length;
const avgLossDist = losses.reduce((sum, t) => sum + Math.abs(t.pnlPercent), 0) / losses.length;

console.log('═══════════════════════════════════════════════════════════════');
console.log('📏 DISTANCE ANALYSIS:\n');
console.log(`Avg WIN distance: ${avgWinDist.toFixed(2)}% (TP reached)`);
console.log(`Avg LOSS distance: ${avgLossDist.toFixed(2)}% (SL hit)`);
console.log(`W/L Distance Ratio: ${(avgWinDist / avgLossDist).toFixed(2)}x`);

if (avgLossDist > avgWinDist) {
  console.log('\n⚠️  PROBLEM: Loss distance > Win distance');
  console.log(`   SL is ${((avgLossDist / avgWinDist - 1) * 100).toFixed(0)}% further than TP!`);
  console.log('   → Need to either INCREASE TP or DECREASE SL for SHORT');
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📋 DETAILED SHORT TRADES:\n');

shortTrades
  .sort((a, b) => a.entryTime - b.entryTime)
  .forEach((t, i) => {
    const result = t.pnl > 0 ? '✅ WIN' : '❌ LOSS';
    const priceMove = ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100;

    console.log(`${i + 1}. ${result} | ${t.exitType}`);
    console.log(`   Entry: ${t.entryPrice.toFixed(4)} → Exit: ${t.exitPrice.toFixed(4)}`);
    console.log(`   Price Move: ${priceMove.toFixed(2)}% | PnL: ${t.pnl.toFixed(2)} USDT (${t.pnlPercent.toFixed(2)}%)`);
    console.log(`   Holding: ${Math.round((t.exitTime - t.entryTime) / 60000)} min`);

    if (t.tpLevelsHit && t.tpLevelsHit.length > 0) {
      console.log(`   TP Hit: ${t.tpLevelsHit.join(', ')}`);
    }

    if (t.stopLoss) {
      const slDist = ((t.stopLoss.final - t.entryPrice) / t.entryPrice) * 100;
      console.log(`   SL: ${t.stopLoss.final.toFixed(4)} (distance: ${Math.abs(slDist).toFixed(2)}%)`);
    }

    console.log('');
  });

console.log('═══════════════════════════════════════════════════════════════\n');
