/**
 * Analyze Win/Loss Patterns - All Strategies (Last 24h)
 *
 * Analyzes winning and losing trade patterns to identify what works and what doesn't.
 * Usage:
 *   npm run analyze-all:patterns
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
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  pnl?: number;
  exitCondition?: {
    exitType?: string;
    holdingTimeMs?: number;
  };
  exitType?: string;
  holdingTimeMs?: number;
  entryReason?: {
    confidence?: number;
    patterns?: string[];
  };
}

interface PatternStats {
  name: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
}

interface StrategyPatterns {
  strategyName: string;
  symbol: string;
  totalTrades: number;
  winPatterns: PatternStats[];
  lossPatterns: PatternStats[];
  exitTypeStats: { [key: string]: { count: number; winRate: number; avgPnL: number } };
  directionStats: {
    long: { trades: number; wins: number; winRate: number; avgPnL: number };
    short: { trades: number; wins: number; winRate: number; avgPnL: number };
  };
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

function getPnL(trade: Trade): number {
  return (trade.realizedPnL !== undefined ? trade.realizedPnL : trade.pnl) || 0;
}

function getExitType(trade: Trade): string {
  return trade.exitCondition?.exitType || trade.exitType || 'UNKNOWN';
}

function getHoldingTime(trade: Trade): number {
  return trade.exitCondition?.holdingTimeMs || trade.holdingTimeMs || 0;
}

// ============================================================================
// ANALYSIS
// ============================================================================

function analyzeLast24Hours(trades: Trade[]): Trade[] {
  const now = Date.now();
  const last24h = now - 24 * 60 * 60 * 1000;

  return trades.filter(t => {
    const tradeTime = parseTimestamp(t.openedAt);
    return tradeTime >= last24h && tradeTime <= now;
  });
}

function analyzePatterns(trades: Trade[]): StrategyPatterns {
  if (trades.length === 0) {
    return {
      strategyName: '',
      symbol: '',
      totalTrades: 0,
      winPatterns: [],
      lossPatterns: [],
      exitTypeStats: {},
      directionStats: {
        long: { trades: 0, wins: 0, winRate: 0, avgPnL: 0 },
        short: { trades: 0, wins: 0, winRate: 0, avgPnL: 0 },
      },
    };
  }

  const wins = trades.filter(t => getPnL(t) > 0);
  const losses = trades.filter(t => getPnL(t) <= 0);

  // Pattern Analysis
  const patternMap = new Map<string, { count: number; wins: number; pnlSum: number; winPnL: number; lossPnL: number }>();

  trades.forEach(trade => {
    const patterns = trade.entryReason?.patterns || [];
    patterns.forEach(pattern => {
      const existing = patternMap.get(pattern) || { count: 0, wins: 0, pnlSum: 0, winPnL: 0, lossPnL: 0 };
      existing.count++;
      const pnl = getPnL(trade);
      existing.pnlSum += pnl;
      if (pnl > 0) {
        existing.wins++;
        existing.winPnL += pnl;
      } else {
        existing.lossPnL += Math.abs(pnl);
      }
      patternMap.set(pattern, existing);
    });
  });

  // Convert to PatternStats
  const patternStats = Array.from(patternMap.entries()).map(([name, stats]) => ({
    name,
    count: stats.count,
    wins: stats.wins,
    losses: stats.count - stats.wins,
    winRate: (stats.wins / stats.count) * 100,
    totalPnL: stats.pnlSum,
    avgPnL: stats.pnlSum / stats.count,
    avgWin: stats.wins > 0 ? stats.winPnL / stats.wins : 0,
    avgLoss: stats.count - stats.wins > 0 ? stats.lossPnL / (stats.count - stats.wins) : 0,
  }));

  // Exit Type Analysis
  const exitTypeMap = new Map<string, { count: number; wins: number; pnlSum: number }>();
  trades.forEach(trade => {
    const exitType = getExitType(trade);
    const existing = exitTypeMap.get(exitType) || { count: 0, wins: 0, pnlSum: 0 };
    existing.count++;
    const pnl = getPnL(trade);
    if (pnl > 0) existing.wins++;
    existing.pnlSum += pnl;
    exitTypeMap.set(exitType, existing);
  });

  const exitTypeStats: { [key: string]: { count: number; winRate: number; avgPnL: number } } = {};
  exitTypeMap.forEach((stats, exitType) => {
    exitTypeStats[exitType] = {
      count: stats.count,
      winRate: (stats.wins / stats.count) * 100,
      avgPnL: stats.pnlSum / stats.count,
    };
  });

  // Direction Analysis
  const longTrades = trades.filter(t => t.side === 'LONG');
  const shortTrades = trades.filter(t => t.side === 'SHORT');

  const longWins = longTrades.filter(t => getPnL(t) > 0);
  const shortWins = shortTrades.filter(t => getPnL(t) > 0);

  const longPnL = longTrades.reduce((sum, t) => sum + getPnL(t), 0);
  const shortPnL = shortTrades.reduce((sum, t) => sum + getPnL(t), 0);

  return {
    strategyName: trades[0].symbol || 'Unknown',
    symbol: trades[0].symbol || 'Unknown',
    totalTrades: trades.length,
    winPatterns: patternStats.filter(p => p.wins > p.losses).sort((a, b) => b.avgPnL - a.avgPnL),
    lossPatterns: patternStats.filter(p => p.losses >= p.wins).sort((a, b) => b.avgPnL - a.avgPnL),
    exitTypeStats,
    directionStats: {
      long: {
        trades: longTrades.length,
        wins: longWins.length,
        winRate: longTrades.length > 0 ? (longWins.length / longTrades.length) * 100 : 0,
        avgPnL: longTrades.length > 0 ? longPnL / longTrades.length : 0,
      },
      short: {
        trades: shortTrades.length,
        wins: shortWins.length,
        winRate: shortTrades.length > 0 ? (shortWins.length / shortTrades.length) * 100 : 0,
        avgPnL: shortTrades.length > 0 ? shortPnL / shortTrades.length : 0,
      },
    },
  };
}

// ============================================================================
// FORMATTING
// ============================================================================

function formatStats(strategyName: string, stats: StrategyPatterns): string {
  if (stats.totalTrades === 0) {
    return `⚪ ${strategyName} | No trades\n`;
  }

  let output = '';

  output += `\n${'═'.repeat(70)}\n`;
  output += `📊 ${strategyName} (${stats.totalTrades} trades)\n`;
  output += `${'═'.repeat(70)}\n\n`;

  // Win Patterns
  if (stats.winPatterns.length > 0) {
    output += '✅ WINNING PATTERNS:\n';
    stats.winPatterns.slice(0, 5).forEach((pattern, i) => {
      output += `  ${i + 1}. ${pattern.name.padEnd(25)} | ${pattern.count.toString().padEnd(3)} trades | WR: ${pattern.winRate.toFixed(1)}% | PnL: +${pattern.avgPnL.toFixed(2)}\n`;
    });
    output += '\n';
  }

  // Loss Patterns
  if (stats.lossPatterns.length > 0) {
    output += '❌ LOSING PATTERNS:\n';
    stats.lossPatterns.slice(0, 5).forEach((pattern, i) => {
      output += `  ${i + 1}. ${pattern.name.padEnd(25)} | ${pattern.count.toString().padEnd(3)} trades | WR: ${pattern.winRate.toFixed(1)}% | PnL: ${pattern.avgPnL.toFixed(2)}\n`;
    });
    output += '\n';
  }

  // Exit Type Stats
  output += '📤 EXIT TYPE ANALYSIS:\n';
  Object.entries(stats.exitTypeStats)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .forEach(([exitType, data]) => {
      output += `  ${exitType.padEnd(18)} | ${data.count.toString().padEnd(3)} | WR: ${data.winRate.toFixed(1)}% | Avg: ${data.avgPnL >= 0 ? '+' : ''}${data.avgPnL.toFixed(2)}\n`;
    });
  output += '\n';

  // Direction Analysis
  output += '📈 DIRECTION ANALYSIS:\n';
  output += `  LONG:  ${stats.directionStats.long.trades.toString().padEnd(3)} | WR: ${stats.directionStats.long.winRate.toFixed(1)}% | Avg: ${stats.directionStats.long.avgPnL >= 0 ? '+' : ''}${stats.directionStats.long.avgPnL.toFixed(2)}\n`;
  output += `  SHORT: ${stats.directionStats.short.trades.toString().padEnd(3)} | WR: ${stats.directionStats.short.winRate.toFixed(1)}% | Avg: ${stats.directionStats.short.avgPnL >= 0 ? '+' : ''}${stats.directionStats.short.avgPnL.toFixed(2)}\n`;
  output += '\n';

  return output;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('🎯 WIN/LOSS PATTERNS ANALYSIS - ALL BOTS (Last 24h)');
  console.log('═══════════════════════════════════════════════════════════════════════════');

  for (const strategy of STRATEGIES) {
    const journalPath = path.join(strategy.folder, 'data', 'trade-journal.json');

    try {
      if (!fs.existsSync(journalPath)) {
        continue;
      }

      const content = fs.readFileSync(journalPath, 'utf-8');
      const rawData = JSON.parse(content);
      const trades = Array.isArray(rawData) ? rawData : rawData.trades || [];

      const recentTrades = analyzeLast24Hours(trades);
      const patterns = analyzePatterns(recentTrades);

      console.log(formatStats(strategy.name, patterns));
    } catch (error) {
      console.log(`❌ ${strategy.name} | Error: ${error instanceof Error ? error.message : 'Unknown'}\n`);
    }
  }

  console.log('═══════════════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
