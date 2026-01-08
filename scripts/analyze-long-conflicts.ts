/**
 * Analyze why LONG trades were blocked in backtest
 */
import * as fs from 'fs';
import * as path from 'path';

const backestFile = path.join(
  __dirname,
  '../data/backtest/backtest_v2_2026-01-08T10-11-04-244Z.json'
);

interface BacktestResult {
  symbol: string;
  timeframe: string;
  trades: Array<{
    id: string;
    entryTime: number;
    exitTime: number;
    side: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    winRate?: number;
    reason?: string;
    confidence?: number;
    signals?: any;
  }>;
  summary: {
    totalTrades: number;
    longTrades: number;
    shortTrades: number;
    longWins: number;
    longLosses: number;
    shortWins: number;
    shortLosses: number;
  };
}

console.log('📊 Analyzing LONG trade blocks in backtest...\n');

const data: BacktestResult = JSON.parse(fs.readFileSync(backestFile, 'utf-8'));

console.log(`Period: 2025-12-08 to 2026-01-08\n`);
console.log(`Total Trades: ${data.summary.totalTrades}`);
console.log(`LONG Trades: ${data.summary.longTrades} (${((data.summary.longTrades / data.summary.totalTrades) * 100).toFixed(1)}%)`);
console.log(`SHORT Trades: ${data.summary.shortTrades} (${((data.summary.shortTrades / data.summary.totalTrades) * 100).toFixed(1)}%)`);

if (data.summary.longTrades === 0) {
  console.log(`\n⚠️  NO LONG TRADES TAKEN - All attempts were BLOCKED\n`);
  console.log('This means:');
  console.log('1. ✓ Conflict detection triggered on EVERY LONG attempt');
  console.log('2. ✓ Confidence was penalized below 65% threshold');
  console.log('3. ? Question: Was this CORRECT (real conflicts) or OVER-FILTERING (false blocks)?\n');
}

console.log(`\nSHORT Trade Performance:`);
console.log(`├─ Total SHORT: ${data.summary.shortTrades}`);
console.log(`├─ Wins: ${data.summary.shortWins} (${((data.summary.shortWins / data.summary.shortTrades) * 100).toFixed(1)}%)`);
console.log(`├─ Losses: ${data.summary.shortLosses} (${((data.summary.shortLosses / data.summary.shortTrades) * 100).toFixed(1)}%)`);

if (data.summary.longTrades > 0) {
  console.log(`\nLONG Trade Performance:`);
  console.log(`├─ Total LONG: ${data.summary.longTrades}`);
  console.log(`├─ Wins: ${data.summary.longWins} (${((data.summary.longWins / data.summary.longTrades) * 100).toFixed(1)}%)`);
  console.log(`├─ Losses: ${data.summary.longLosses} (${((data.summary.longLosses / data.summary.longTrades) * 100).toFixed(1)}%)`);
}

console.log('\n---\n');

// Check if we have any data about why trades were rejected
const trades = data.trades || [];
const longAttempts = trades.filter((t: any) => t.side === 'LONG' || t.reason?.includes('LONG'));

if (longAttempts.length > 0) {
  console.log(`LONG Trade Attempts (${longAttempts.length}):\n`);
  longAttempts.slice(0, 10).forEach((trade: any, i: number) => {
    console.log(`${i + 1}. ${new Date(trade.entryTime).toISOString()}`);
    if (trade.confidence) console.log(`   Confidence: ${trade.confidence}%`);
    if (trade.reason) console.log(`   Reason: ${trade.reason}`);
    if (trade.signals) {
      console.log(`   Signals: ${JSON.stringify(trade.signals, null, 2)}`);
    }
  });
} else {
  console.log('✓ No LONG attempts found in trade data');
  console.log('  (Blocks happened at coordinateSignals() level, before trade entry)\n');
}

console.log('\n💡 INTERPRETATION:\n');
if (data.summary.longTrades === 0) {
  console.log('The 0 LONG trades means:');
  console.log('');
  console.log('SCENARIO A: Conflict detection is CORRECT');
  console.log('├─ Market had consistent SHORT consensus vs LONG minority');
  console.log('├─ Example: 5-6 SHORT indicators vs 2-3 LONG every time');
  console.log('├─ Blocking these prevented losing LONG entries');
  console.log('└─ Result: Conservative but profitable approach ✅\n');
  console.log('SCENARIO B: Conflict detection is TOO STRICT');
  console.log('├─ Some LONG signals had valid 5+ consensus (no real conflict)');
  console.log('├─ Penalty math was too harsh');
  console.log('├─ Blocked legitimate LONG trades');
  console.log('└─ Result: Missing winning LONG opportunities ❌\n');
  console.log('ACTION: Need to review the penalty thresholds and parameters');
}
