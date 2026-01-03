/**
 * Analyze Last 24 Hours - All Strategies
 *
 * Analyzes all active bots from the last 24 hours in one go.
 * Usage:
 *   npm run analyze-all:last-24h
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ============================================================================
// TYPES
// ============================================================================

interface StrategyStats {
  name: string;
  symbol: string;
  folder: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  wlRatio: number;
  longTrades: number;
  shortTrades: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STRATEGIES = [
  {
    name: 'Tick Delta',
    symbol: 'STRKUSDT',
    folder: 'D:/src/Edison - tickdelta',
  },
  {
    name: 'Ladder TP',
    symbol: 'HYPEUSDT',
    folder: 'D:/src/Edison - laddertp',
  },
  {
    name: 'Limit Order',
    symbol: 'ADAUSDT',
    folder: 'D:/src/Edison - limitorder',
  },
  {
    name: 'Block (LevelBased)',
    symbol: 'APEXUSDT',
    folder: 'D:/src/Edison - block',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTimestamp(ts: number | string): number {
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime();
}

function getPnL(trade: any): number {
  return (trade.realizedPnL !== undefined ? trade.realizedPnL : trade.pnl) || 0;
}

// ============================================================================
// ANALYSIS
// ============================================================================

function analyzeLast24Hours(trades: any[]): {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  wlRatio: number;
  longTrades: number;
  shortTrades: number;
} {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  const recentTrades = trades.filter(t => {
    const tradeTime = parseTimestamp(t.openedAt);
    return tradeTime >= last24h && tradeTime <= now;
  });

  if (recentTrades.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      wlRatio: 0,
      longTrades: 0,
      shortTrades: 0,
    };
  }

  const wins = recentTrades.filter(t => getPnL(t) > 0);
  const losses = recentTrades.filter(t => getPnL(t) <= 0);
  const longTrades = recentTrades.filter(t => t.side === 'LONG').length;
  const shortTrades = recentTrades.filter(t => t.side === 'SHORT').length;

  const totalPnL = recentTrades.reduce((sum, t) => sum + getPnL(t), 0);
  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + getPnL(t), 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, t) => sum + getPnL(t), 0) / losses.length)
    : 0;
  const wlRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  return {
    totalTrades: recentTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / recentTrades.length) * 100,
    totalPnL,
    avgWin,
    avgLoss,
    wlRatio,
    longTrades,
    shortTrades,
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 LAST 24 HOURS - ALL BOTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const allStats: StrategyStats[] = [];
  let totalTrades = 0;
  let totalWins = 0;
  let totalPnL = 0;

  for (const strategy of STRATEGIES) {
    const journalPath = path.join(strategy.folder, 'data', 'trade-journal.json');

    try {
      if (!fs.existsSync(journalPath)) {
        console.log(`⚠️  ${strategy.name.padEnd(18)} | Journal not found\n`);
        continue;
      }

      const content = fs.readFileSync(journalPath, 'utf-8');
      const rawData = JSON.parse(content);
      const trades = Array.isArray(rawData) ? rawData : rawData.trades || [];

      const stats = analyzeLast24Hours(trades);

      if (stats.totalTrades === 0) {
        console.log(`⚪ ${strategy.name.padEnd(18)} | ${strategy.symbol.padEnd(10)} | No trades\n`);
        continue;
      }

      const status = stats.totalPnL > 0 ? '✅' : stats.totalPnL < 0 ? '❌' : '⚪';
      const pnlStr = stats.totalPnL >= 0 ? '+' : '';

      console.log(`${status} ${strategy.name.padEnd(18)} | ${strategy.symbol.padEnd(10)}`);
      console.log(`   ${stats.totalTrades.toString().padEnd(3)} trades | WR: ${stats.winRate.toFixed(1)}% | PnL: ${pnlStr}${stats.totalPnL.toFixed(2)} | Ratio: ${stats.wlRatio.toFixed(2)}:1`);
      console.log(`   L/S: ${stats.longTrades}/${stats.shortTrades} | Avg Win: +${stats.avgWin.toFixed(2)} | Avg Loss: -${stats.avgLoss.toFixed(2)}\n`);

      allStats.push({
        name: strategy.name,
        symbol: strategy.symbol,
        folder: strategy.folder,
        ...stats,
      });

      totalTrades += stats.totalTrades;
      totalWins += stats.wins;
      totalPnL += stats.totalPnL;
    } catch (error) {
      console.log(`❌ ${strategy.name.padEnd(18)} | Error: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 SUMMARY (last 24h):\n');
  console.log(`Total Trades:     ${totalTrades}`);
  console.log(`Total Wins:       ${totalWins}`);
  console.log(`Overall WR:       ${totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) : 0}%`);
  console.log(`Net PnL:          ${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} USDT`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');

  // Ranking
  if (allStats.length > 0) {
    console.log('🏆 RANKING (by PnL):\n');
    const ranked = allStats.sort((a, b) => b.totalPnL - a.totalPnL);
    ranked.forEach((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      const pnlStr = s.totalPnL >= 0 ? '+' : '';
      console.log(`${medal} ${(i + 1)}. ${s.name.padEnd(18)} | ${pnlStr}${s.totalPnL.toFixed(2)} USDT (${s.totalTrades} trades)\n`);
    });
  }
}

main().catch(console.error);
