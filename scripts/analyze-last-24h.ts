/**
 * Analyze Last 24 Hours of Trading
 *
 * Shows all trades from the last 24 hours with detailed statistics
 * Usage:
 *   npm run analyze-last-24h              (analyzes default journal)
 *   npm run analyze-last-24h <path>       (analyzes specific journal)
 */

import fs from 'fs';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

interface Trade {
  id?: string;
  tradeId?: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  openedAt: number | string;
  closedAt?: number | string;
  entryPrice: number;
  exitPrice?: number;
  quantity?: number;
  size?: number;
  realizedPnL?: number;
  pnl?: number;
  exitCondition?: {
    exitType?: string;
  };
  exitType?: string;
}

interface DailyStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  longTrades: number;
  shortTrades: number;
  longWins: number;
  shortWins: number;
  longWinRate: number;
  shortWinRate: number;
  trades: Trade[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseTimestamp(ts: number | string): number {
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime();
}

function formatTime(ts: number | string): string {
  const date = new Date(parseTimestamp(ts));
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDate(ts: number | string): string {
  const date = new Date(parseTimestamp(ts));
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

function getPnL(trade: Trade): number {
  return (trade.realizedPnL !== undefined ? trade.realizedPnL : trade.pnl) || 0;
}

function getExitType(trade: Trade): string {
  return trade.exitCondition?.exitType || trade.exitType || 'UNKNOWN';
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

function analyzeLast24Hours(trades: Trade[]): DailyStats {
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
      longTrades: 0,
      shortTrades: 0,
      longWins: 0,
      shortWins: 0,
      longWinRate: 0,
      shortWinRate: 0,
      trades: [],
    };
  }

  const wins = recentTrades.filter(t => getPnL(t) > 0);
  const losses = recentTrades.filter(t => getPnL(t) <= 0);
  const longTrades = recentTrades.filter(t => t.side === 'LONG');
  const shortTrades = recentTrades.filter(t => t.side === 'SHORT');
  const longWins = longTrades.filter(t => getPnL(t) > 0);
  const shortWins = shortTrades.filter(t => getPnL(t) > 0);

  const totalPnL = recentTrades.reduce((sum, t) => sum + getPnL(t), 0);
  const avgWin = wins.length > 0
    ? wins.reduce((sum, t) => sum + getPnL(t), 0) / wins.length
    : 0;
  const avgLoss = losses.length > 0
    ? Math.abs(losses.reduce((sum, t) => sum + getPnL(t), 0) / losses.length)
    : 0;

  return {
    totalTrades: recentTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: (wins.length / recentTrades.length) * 100,
    totalPnL,
    avgWin,
    avgLoss,
    longTrades: longTrades.length,
    shortTrades: shortTrades.length,
    longWins: longWins.length,
    shortWins: shortWins.length,
    longWinRate: longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0,
    shortWinRate: shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0,
    trades: recentTrades.sort((a, b) => parseTimestamp(a.openedAt) - parseTimestamp(b.openedAt)),
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatStats(stats: DailyStats): string {
  if (stats.totalTrades === 0) {
    return '\n⚠️  No trades in the last 24 hours\n';
  }

  let output = '';

  output += '\n═══════════════════════════════════════════════════════════════\n';
  output += '📊 LAST 24 HOURS ANALYSIS\n';
  output += '═══════════════════════════════════════════════════════════════\n\n';

  // Summary
  output += '📈 SUMMARY:\n';
  output += `  Total Trades:     ${stats.totalTrades}\n`;
  output += `  Win Rate:         ${stats.winRate.toFixed(1)}% (${stats.wins}W / ${stats.losses}L)\n`;
  output += `  Net PnL:          ${stats.totalPnL >= 0 ? '+' : ''}${stats.totalPnL.toFixed(2)} USDT\n`;
  output += `  Avg Win:          +${stats.avgWin.toFixed(2)} USDT\n`;
  output += `  Avg Loss:         -${stats.avgLoss.toFixed(2)} USDT\n`;
  output += `  W/L Ratio:        ${stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : 'N/A'}:1\n\n`;

  // By Direction
  output += '📊 BY DIRECTION:\n';
  output += `  LONG:  ${stats.longTrades} trades | WR: ${stats.longWinRate.toFixed(1)}%\n`;
  output += `  SHORT: ${stats.shortTrades} trades | WR: ${stats.shortWinRate.toFixed(1)}%\n\n`;

  // Trade List
  output += '📋 TRADES (last 24h):\n';
  output += '───────────────────────────────────────────────────────────────\n';

  stats.trades.forEach((trade, i) => {
    const time = formatTime(trade.openedAt);
    const date = formatDate(trade.openedAt);
    const pnl = getPnL(trade);
    const pnlStr = pnl >= 0 ? '+' : '';
    const status = pnl > 0 ? '✅' : pnl === 0 ? '⚪' : '❌';
    const exitType = getExitType(trade);

    output += `${status} ${i + 1}. [${date} ${time}] ${trade.side.padEnd(5)} @ ${trade.entryPrice} → ${trade.exitPrice || '?'} | ${pnlStr}${pnl.toFixed(2)} | ${exitType}\n`;
  });

  output += '\n═══════════════════════════════════════════════════════════════\n';

  return output;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    const args = process.argv.slice(2);
    const journalPath = args[0] || './data/trade-journal.json';

    if (!fs.existsSync(journalPath)) {
      console.error(`❌ Journal not found: ${journalPath}`);
      process.exit(1);
    }

    const content = fs.readFileSync(journalPath, 'utf-8');
    const rawData = JSON.parse(content);
    const trades = Array.isArray(rawData) ? rawData : rawData.trades || [];

    const stats = analyzeLast24Hours(trades);
    console.log(formatStats(stats));
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
