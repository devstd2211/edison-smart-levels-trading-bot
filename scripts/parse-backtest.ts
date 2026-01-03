/**
 * Backtest JSON Parser & Analyzer
 *
 * Парсит результаты бэктеста и выводит ключевые метрики
 */

import * as fs from 'fs';
import * as path from 'path';

interface BacktestStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalFees: number;
  netPnl: number;
  netPnlPercent: number;
  winLossRatio: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgHoldingTime: number;
}

interface Trade {
  entryTime: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  size: number;
  stopLoss: number;
  takeProfits: Array<{
    level: number;
    price: number;
    closePercent: number;
  }>;
  confidence: number;
  strategyName: string;
  exitTime: number;
  exitPrice: number;
  exitReason: string;
  pnl: number;
  pnlPercent: number;
  fees: number;
  holding: number;
}

interface BacktestResult {
  stats: BacktestStats;
  trades: Trade[];
  equityCurve: Array<{ time: number; balance: number }>;
}

export function parseBacktestFile(filePath: string): BacktestResult {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return {
    stats: {
      totalTrades: data.totalTrades,
      winningTrades: data.winningTrades,
      losingTrades: data.losingTrades,
      winRate: data.winRate,
      totalPnl: data.totalPnl,
      totalFees: data.totalFees,
      netPnl: data.netPnl,
      netPnlPercent: data.netPnlPercent,
      winLossRatio: data.winLossRatio,
      profitFactor: data.profitFactor,
      avgWin: data.avgWin,
      avgLoss: data.avgLoss,
      maxDrawdown: data.maxDrawdown,
      maxDrawdownPercent: data.maxDrawdownPercent,
      sharpeRatio: data.sharpeRatio,
      avgHoldingTime: data.avgHoldingTime,
    },
    trades: data.trades,
    equityCurve: data.equityCurve,
  };
}

export function analyzeBacktest(result: BacktestResult): void {
  const s = result.stats;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 BACKTEST ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Key metrics
  console.log('📈 PERFORMANCE:');
  console.log(`  Total Trades: ${s.totalTrades}`);
  console.log(`  ✅ Wins: ${s.winningTrades} (${s.winRate.toFixed(2)}%)`);
  console.log(`  ❌ Losses: ${s.losingTrades} (${(100 - s.winRate).toFixed(2)}%)`);
  console.log();

  console.log('💰 PROFITABILITY:');
  console.log(`  Gross PnL: ${s.totalPnl > 0 ? '+' : ''}${s.totalPnl.toFixed(2)} USDT`);
  console.log(`  Fees: -${s.totalFees.toFixed(2)} USDT`);
  console.log(`  Net PnL: ${s.netPnl > 0 ? '+' : ''}${s.netPnl.toFixed(2)} USDT (${s.netPnlPercent.toFixed(2)}%)`);
  console.log();

  console.log('⚖️ RISK/REWARD:');
  console.log(`  Avg Win: ${s.avgWin.toFixed(4)} USDT`);
  console.log(`  Avg Loss: ${s.avgLoss.toFixed(4)} USDT`);
  console.log(`  W/L Ratio: ${s.winLossRatio.toFixed(2)}:1 ${s.winLossRatio >= 2 ? '✅' : '❌'}`);
  console.log(`  Profit Factor: ${s.profitFactor.toFixed(2)} ${s.profitFactor > 1.5 ? '✅' : '❌'}`);
  console.log();

  console.log('📉 RISK METRICS:');
  console.log(`  Max Drawdown: ${s.maxDrawdown.toFixed(2)} USDT (${s.maxDrawdownPercent.toFixed(2)}%)`);
  console.log(`  Sharpe Ratio: ${s.sharpeRatio.toFixed(2)}`);
  console.log(`  Avg Holding Time: ${(s.avgHoldingTime / 1000 / 60).toFixed(0)} min`);
  console.log();

  // Analysis
  console.log('🔍 ANALYSIS:');

  if (s.netPnl < 0) {
    console.log(`  ❌ LOSING STRATEGY (Net: ${s.netPnl.toFixed(2)} USDT)`);
  } else if (s.netPnl > 0) {
    console.log(`  ✅ Profitable (Net: +${s.netPnl.toFixed(2)} USDT)`);
  }

  if (s.winLossRatio < 1.5) {
    console.log(`  ⚠️  W/L Ratio too low (${s.winLossRatio.toFixed(2)}:1, target: 2:1+)`);
    console.log(`      Average loss is ${(s.avgLoss / s.avgWin).toFixed(1)}x larger than avg win`);
  }

  if (s.totalFees > s.totalPnl) {
    console.log(`  ⚠️  Fees (${s.totalFees.toFixed(2)}) exceed gross profit (${s.totalPnl.toFixed(2)})`);
  }

  if (s.maxDrawdownPercent > 20) {
    console.log(`  ⚠️  Drawdown too high (${s.maxDrawdownPercent.toFixed(2)}%, target: <10%)`);
  }

  console.log();

  // Losing trades analysis
  const losingTrades = result.trades.filter(t => t.pnl < 0);
  if (losingTrades.length > 0) {
    console.log('📍 LOSING TRADES ANALYSIS:');
    console.log(`  Total losing trades: ${losingTrades.length}`);
    console.log(`  Total loss: ${losingTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)} USDT`);

    const avgLossSize = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length;
    console.log(`  Avg loss per trade: ${avgLossSize.toFixed(4)} USDT`);

    const maxLoss = Math.min(...losingTrades.map(t => t.pnl));
    console.log(`  Max loss (single trade): ${maxLoss.toFixed(4)} USDT`);

    const veryBadTrades = losingTrades.filter(t => t.pnlPercent < -2);
    if (veryBadTrades.length > 0) {
      console.log(`  🔴 Very bad trades (>-2%): ${veryBadTrades.length}`);
      console.log(`     Total from them: ${veryBadTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(2)} USDT`);
    }
    console.log();
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const filePath = args[0] || path.join(__dirname, '../data/backtest/backtest_v2_latest.json');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📂 Parsing: ${path.basename(filePath)}`);
  const result = parseBacktestFile(filePath);
  analyzeBacktest(result);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
