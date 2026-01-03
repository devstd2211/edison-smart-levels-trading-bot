#!/usr/bin/env ts-node
/**
 * Trade Journal Analyzer
 *
 * Analyzes trade-journal.json and provides comprehensive statistics.
 * Usage: npm run analyze-journal [journal-file-path]
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
  quantity: number;
  leverage: number;
  entryCondition: {
    signal: {
      type: string;
      direction: string;
      confidence: number;
      reason: string;
    };
  };
  status: 'OPEN' | 'CLOSED';
  exitCondition?: {
    exitType: string;
    pnlUsdt: number;
    pnlPercent: number;
    realizedPnL: number;
    tpLevelsHit: number[];
    holdingTimeMinutes: number;
    stoppedOut: boolean;
    slMovedToBreakeven: boolean;
  };
  realizedPnL?: number;
  openedAt: number;
  closedAt?: number;
}

interface JournalStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;

  // PnL Stats
  totalPnL: number;
  totalPnLWithFees: number; // After Bybit fees
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinLossRatio: number;
  maxWin: number;
  maxLoss: number;

  // Strategy Stats
  byStrategy: Record<string, {
    count: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
  }>;

  // Direction Stats
  longStats: {
    count: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };
  shortStats: {
    count: number;
    wins: number;
    losses: number;
    totalPnL: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
  };

  // Exit Type Stats
  byExitType: Record<string, {
    count: number;
    totalPnL: number;
    avgPnL: number;
  }>;

  // Time Stats
  avgHoldingTime: number;

  // TP Stats
  tpHitRate: {
    tp1: number;
    tp2: number;
    tp3: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BYBIT_TAKER_FEE = 0.0006; // 0.06% for taker (market orders)
const BYBIT_MAKER_FEE = 0.0001; // 0.01% for maker (limit orders)

// Assuming market orders (taker fee)
const DEFAULT_FEE_RATE = BYBIT_TAKER_FEE;

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Calculate Bybit trading fees
 */
function calculateFees(entryPrice: number, exitPrice: number, quantity: number, leverage: number): number {
  const positionValue = quantity * entryPrice;
  const entryFee = positionValue * DEFAULT_FEE_RATE;
  const exitFee = (quantity * exitPrice) * DEFAULT_FEE_RATE;

  return entryFee + exitFee;
}

/**
 * Load and parse journal file
 */
function loadJournal(filePath: string): Trade[] {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`❌ File not found: ${absolutePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Analyze journal and compute statistics
 */
function analyzeJournal(trades: Trade[]): JournalStats {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const openTrades = trades.filter(t => t.status === 'OPEN');

  // Initialize stats
  const stats: JournalStats = {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    openTrades: openTrades.length,
    totalPnL: 0,
    totalPnLWithFees: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    avgWinLossRatio: 0,
    maxWin: -Infinity,
    maxLoss: Infinity,
    byStrategy: {},
    longStats: {
      count: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
    },
    shortStats: {
      count: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
    },
    byExitType: {},
    avgHoldingTime: 0,
    tpHitRate: {
      tp1: 0,
      tp2: 0,
      tp3: 0,
    },
  };

  const winPnLs: number[] = [];
  const lossPnLs: number[] = [];
  let totalHoldingTime = 0;
  let tp1Count = 0, tp2Count = 0, tp3Count = 0;

  // Analyze each closed trade
  for (const trade of closedTrades) {
    if (!trade.exitCondition) continue;

    const pnl = trade.exitCondition.realizedPnL;
    const fees = calculateFees(
      trade.entryPrice,
      trade.exitPrice!,
      trade.quantity,
      trade.leverage
    );
    const pnlAfterFees = pnl - fees;

    stats.totalPnL += pnl;
    stats.totalPnLWithFees += pnlAfterFees;

    // Win/Loss
    if (pnlAfterFees > 0) {
      stats.wins++;
      winPnLs.push(pnlAfterFees);
      stats.maxWin = Math.max(stats.maxWin, pnlAfterFees);
    } else {
      stats.losses++;
      lossPnLs.push(pnlAfterFees);
      stats.maxLoss = Math.min(stats.maxLoss, pnlAfterFees);
    }

    // By Strategy
    const strategyType = trade.entryCondition.signal.type;
    if (!stats.byStrategy[strategyType]) {
      stats.byStrategy[strategyType] = {
        count: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
        winRate: 0,
      };
    }
    stats.byStrategy[strategyType].count++;
    stats.byStrategy[strategyType].totalPnL += pnlAfterFees;
    if (pnlAfterFees > 0) {
      stats.byStrategy[strategyType].wins++;
    } else {
      stats.byStrategy[strategyType].losses++;
    }

    // By Direction
    const directionStats = trade.side === 'LONG' ? stats.longStats : stats.shortStats;
    directionStats.count++;
    directionStats.totalPnL += pnlAfterFees;
    if (pnlAfterFees > 0) {
      directionStats.wins++;
    } else {
      directionStats.losses++;
    }

    // By Exit Type
    const exitType = trade.exitCondition.exitType;
    if (!stats.byExitType[exitType]) {
      stats.byExitType[exitType] = {
        count: 0,
        totalPnL: 0,
        avgPnL: 0,
      };
    }
    stats.byExitType[exitType].count++;
    stats.byExitType[exitType].totalPnL += pnlAfterFees;

    // Holding Time
    totalHoldingTime += trade.exitCondition.holdingTimeMinutes;

    // TP Hit Rate
    const tpLevels = trade.exitCondition.tpLevelsHit || [];
    if (tpLevels.includes(1)) tp1Count++;
    if (tpLevels.includes(2)) tp2Count++;
    if (tpLevels.includes(3)) tp3Count++;
  }

  // Calculate averages
  stats.winRate = closedTrades.length > 0 ? (stats.wins / closedTrades.length) * 100 : 0;
  stats.avgWin = winPnLs.length > 0 ? winPnLs.reduce((a, b) => a + b, 0) / winPnLs.length : 0;
  stats.avgLoss = lossPnLs.length > 0 ? lossPnLs.reduce((a, b) => a + b, 0) / lossPnLs.length : 0;
  stats.avgWinLossRatio = stats.avgLoss !== 0 ? Math.abs(stats.avgWin / stats.avgLoss) : 0;
  stats.avgHoldingTime = closedTrades.length > 0 ? totalHoldingTime / closedTrades.length : 0;

  // LONG/SHORT stats
  if (stats.longStats.count > 0) {
    stats.longStats.winRate = (stats.longStats.wins / stats.longStats.count) * 100;
    const longWins = closedTrades
      .filter(t => t.side === 'LONG' && t.exitCondition && (t.exitCondition.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage)) > 0)
      .map(t => t.exitCondition!.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage));
    const longLosses = closedTrades
      .filter(t => t.side === 'LONG' && t.exitCondition && (t.exitCondition.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage)) <= 0)
      .map(t => t.exitCondition!.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage));
    stats.longStats.avgWin = longWins.length > 0 ? longWins.reduce((a, b) => a + b, 0) / longWins.length : 0;
    stats.longStats.avgLoss = longLosses.length > 0 ? longLosses.reduce((a, b) => a + b, 0) / longLosses.length : 0;
  }

  if (stats.shortStats.count > 0) {
    stats.shortStats.winRate = (stats.shortStats.wins / stats.shortStats.count) * 100;
    const shortWins = closedTrades
      .filter(t => t.side === 'SHORT' && t.exitCondition && (t.exitCondition.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage)) > 0)
      .map(t => t.exitCondition!.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage));
    const shortLosses = closedTrades
      .filter(t => t.side === 'SHORT' && t.exitCondition && (t.exitCondition.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage)) <= 0)
      .map(t => t.exitCondition!.realizedPnL - calculateFees(t.entryPrice, t.exitPrice!, t.quantity, t.leverage));
    stats.shortStats.avgWin = shortWins.length > 0 ? shortWins.reduce((a, b) => a + b, 0) / shortWins.length : 0;
    stats.shortStats.avgLoss = shortLosses.length > 0 ? shortLosses.reduce((a, b) => a + b, 0) / shortLosses.length : 0;
  }

  // Strategy winrates
  for (const key in stats.byStrategy) {
    const strat = stats.byStrategy[key];
    strat.winRate = strat.count > 0 ? (strat.wins / strat.count) * 100 : 0;
  }

  // Exit type averages
  for (const key in stats.byExitType) {
    const exit = stats.byExitType[key];
    exit.avgPnL = exit.count > 0 ? exit.totalPnL / exit.count : 0;
  }

  // TP hit rates
  stats.tpHitRate.tp1 = closedTrades.length > 0 ? (tp1Count / closedTrades.length) * 100 : 0;
  stats.tpHitRate.tp2 = closedTrades.length > 0 ? (tp2Count / closedTrades.length) * 100 : 0;
  stats.tpHitRate.tp3 = closedTrades.length > 0 ? (tp3Count / closedTrades.length) * 100 : 0;

  return stats;
}

/**
 * Print statistics in a nice format
 */
function printStats(stats: JournalStats, journalPath: string): void {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 TRADE JOURNAL ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📁 File: ${journalPath}`);
  console.log('');

  // Overall Stats
  console.log('📈 OVERALL STATISTICS:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Total Trades:        ${stats.totalTrades}`);
  console.log(`Closed Trades:       ${stats.closedTrades}`);
  console.log(`Open Trades:         ${stats.openTrades}`);
  console.log('');

  // PnL Stats
  console.log('💰 PnL STATISTICS:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Total PnL (gross):   ${stats.totalPnL.toFixed(4)} USDT`);
  console.log(`Total Fees:          ${(stats.totalPnL - stats.totalPnLWithFees).toFixed(4)} USDT (${DEFAULT_FEE_RATE * 100}% taker)`);
  console.log(`Total PnL (net):     ${stats.totalPnLWithFees >= 0 ? '✅' : '❌'} ${stats.totalPnLWithFees.toFixed(4)} USDT`);
  console.log('');
  console.log(`Wins:                ${stats.wins} (${stats.winRate.toFixed(1)}%)`);
  console.log(`Losses:              ${stats.losses} (${(100 - stats.winRate).toFixed(1)}%)`);
  console.log(`Avg Win:             +${stats.avgWin.toFixed(4)} USDT`);
  console.log(`Avg Loss:            ${stats.avgLoss.toFixed(4)} USDT`);
  console.log(`Avg Win/Loss Ratio:  ${stats.avgWinLossRatio >= 2 ? '✅' : stats.avgWinLossRatio >= 1 ? '⚠️' : '❌'} ${stats.avgWinLossRatio.toFixed(2)}x`);
  console.log(`Max Win:             +${stats.maxWin.toFixed(4)} USDT`);
  console.log(`Max Loss:            ${stats.maxLoss.toFixed(4)} USDT`);
  console.log('');

  // Direction Stats
  console.log('📊 LONG vs SHORT:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`LONG:  ${stats.longStats.count} trades | Win Rate: ${stats.longStats.winRate.toFixed(1)}% | PnL: ${stats.longStats.totalPnL >= 0 ? '+' : ''}${stats.longStats.totalPnL.toFixed(4)} USDT`);
  if (stats.longStats.count > 0) {
    console.log(`       Avg Win: +${stats.longStats.avgWin.toFixed(4)} | Avg Loss: ${stats.longStats.avgLoss.toFixed(4)}`);
  }
  console.log(`SHORT: ${stats.shortStats.count} trades | Win Rate: ${stats.shortStats.winRate.toFixed(1)}% | PnL: ${stats.shortStats.totalPnL >= 0 ? '+' : ''}${stats.shortStats.totalPnL.toFixed(4)} USDT`);
  if (stats.shortStats.count > 0) {
    console.log(`       Avg Win: +${stats.shortStats.avgWin.toFixed(4)} | Avg Loss: ${stats.shortStats.avgLoss.toFixed(4)}`);
  }
  console.log('');

  // Strategy Stats
  console.log('🎯 BY STRATEGY:');
  console.log('───────────────────────────────────────────────────────────────');
  for (const [strategy, data] of Object.entries(stats.byStrategy)) {
    console.log(`${strategy}:`);
    console.log(`  Trades: ${data.count} | Win Rate: ${data.winRate.toFixed(1)}% | PnL: ${data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(4)} USDT`);
  }
  console.log('');

  // Exit Type Stats
  console.log('🚪 BY EXIT TYPE:');
  console.log('───────────────────────────────────────────────────────────────');
  for (const [exitType, data] of Object.entries(stats.byExitType)) {
    console.log(`${exitType}:`);
    console.log(`  Count: ${data.count} | Avg PnL: ${data.avgPnL >= 0 ? '+' : ''}${data.avgPnL.toFixed(4)} USDT | Total: ${data.totalPnL >= 0 ? '+' : ''}${data.totalPnL.toFixed(4)} USDT`);
  }
  console.log('');

  // Time & TP Stats
  console.log('⏱️  OTHER STATISTICS:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Avg Holding Time:    ${stats.avgHoldingTime.toFixed(1)} minutes (${(stats.avgHoldingTime / 60).toFixed(2)} hours)`);
  console.log(`TP1 Hit Rate:        ${stats.tpHitRate.tp1.toFixed(1)}%`);
  console.log(`TP2 Hit Rate:        ${stats.tpHitRate.tp2.toFixed(1)}%`);
  console.log(`TP3 Hit Rate:        ${stats.tpHitRate.tp3.toFixed(1)}%`);
  console.log('');

  // Key Insights
  console.log('💡 KEY INSIGHTS:');
  console.log('───────────────────────────────────────────────────────────────');

  if (stats.avgWinLossRatio >= 2) {
    console.log('✅ Excellent win/loss ratio (>2x)');
  } else if (stats.avgWinLossRatio >= 1) {
    console.log('⚠️  Win/loss ratio acceptable but could be better');
  } else {
    console.log('❌ Poor win/loss ratio (<1x) - avg losses bigger than avg wins!');
  }

  if (stats.winRate >= 70) {
    console.log('✅ Excellent win rate (>70%)');
  } else if (stats.winRate >= 50) {
    console.log('⚠️  Win rate acceptable but could be better');
  } else {
    console.log('❌ Poor win rate (<50%)');
  }

  if (stats.totalPnLWithFees > 0) {
    console.log('✅ Net profitable after fees');
  } else {
    console.log('❌ Net unprofitable after fees');
  }

  if (stats.longStats.count > 0 && stats.shortStats.count > 0) {
    if (Math.abs(stats.longStats.winRate - stats.shortStats.winRate) > 30) {
      const betterDirection = stats.longStats.winRate > stats.shortStats.winRate ? 'LONG' : 'SHORT';
      console.log(`⚠️  Large win rate gap between LONG/SHORT - ${betterDirection} performing much better`);
    }
  }

  if (stats.tpHitRate.tp2 < 10 && stats.tpHitRate.tp3 < 5) {
    console.log('⚠️  TP2/TP3 rarely hit - consider adjusting TP levels or SL strategy');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const args = process.argv.slice(2);
  const journalPath = args[0] || 'data/trade-journal.json';

  console.log('🔍 Loading trade journal...');
  const trades = loadJournal(journalPath);

  console.log(`✅ Loaded ${trades.length} trades`);

  const stats = analyzeJournal(trades);
  printStats(stats, journalPath);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { analyzeJournal, loadJournal, JournalStats, Trade };
