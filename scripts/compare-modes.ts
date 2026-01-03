#!/usr/bin/env ts-node
/**
 * Compare Blocking vs Weight Mode Trade Journals
 *
 * Analyzes differences in trade entry/exit between modes to identify
 * why Weight System underperforms (Win/Loss 0.63x vs 1.21x)
 */

import * as fs from 'fs';

// ============================================================================
// CONSTANTS
// ============================================================================

const BYBIT_TAKER_FEE = 0.0006; // 0.06% for taker (market orders)
const BYBIT_MAKER_FEE = 0.0001; // 0.01% for maker (limit orders)
const DEFAULT_FEE_RATE = BYBIT_TAKER_FEE; // Assuming taker orders

// ============================================================================
// TYPES
// ============================================================================

interface TradeJournalEntry {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  entryCondition: {
    signal: {
      type: string;
      direction: string;
      price: number;
      stopLoss: number;
      confidence: number;
      reason: string;
      timestamp: number;
    };
  };
  openedAt: number;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitCondition?: {
    exitType: string;
    price: number;
    timestamp: number;
    reason: string;
    pnlUsdt: number;
    pnlPercent: number;
    realizedPnL: number;
    tpLevelsHit?: number[];
    tpLevelsHitCount?: number;
    holdingTimeMs?: number;
    stoppedOut?: boolean;
    slMovedToBreakeven?: boolean;
  };
  realizedPnL?: number;
  closedAt?: number;
}

interface TradeStats {
  total: number;
  profitable: number;
  unprofitable: number;
  winRate: number;
  totalPnL: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  totalFees: number;
  netPnL: number;
}

interface ModeComparison {
  blocking: TradeStats;
  weight: TradeStats;
  uniqueToBlocking: TradeJournalEntry[];
  uniqueToWeight: TradeJournalEntry[];
  commonTrades: Array<{ blocking: TradeJournalEntry; weight: TradeJournalEntry }>;
  confidenceDiff: number; // Avg confidence difference (weight - blocking)
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Calculate fees for a trade
 */
function calculateFees(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  leverage: number
): number {
  const positionValue = quantity * entryPrice;
  const entryFee = positionValue * DEFAULT_FEE_RATE;
  const exitFee = (quantity * exitPrice) * DEFAULT_FEE_RATE;
  return entryFee + exitFee;
}

/**
 * Analyze trades and return statistics
 */
function analyzeTrades(trades: TradeJournalEntry[]): TradeStats {
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');

  let profitable = 0;
  let unprofitable = 0;
  let totalPnL = 0;
  let totalWinPnL = 0;
  let totalLossPnL = 0;
  let totalFees = 0;

  for (const trade of closedTrades) {
    const pnl = trade.realizedPnL || 0;
    totalPnL += pnl;

    // Calculate fees
    const fees = calculateFees(
      trade.entryPrice,
      trade.exitPrice || trade.entryPrice,
      trade.quantity,
      trade.leverage
    );
    totalFees += fees;

    if (pnl > 0) {
      profitable++;
      totalWinPnL += pnl;
    } else if (pnl < 0) {
      unprofitable++;
      totalLossPnL += Math.abs(pnl);
    }
  }

  const winRate = closedTrades.length > 0 ? (profitable / closedTrades.length) * 100 : 0;
  const avgWin = profitable > 0 ? totalWinPnL / profitable : 0;
  const avgLoss = unprofitable > 0 ? totalLossPnL / unprofitable : 0;
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const netPnL = totalPnL - totalFees;

  return {
    total: closedTrades.length,
    profitable,
    unprofitable,
    winRate,
    totalPnL,
    avgWin,
    avgLoss,
    winLossRatio,
    totalFees,
    netPnL,
  };
}

/**
 * Find matching trade by timestamp proximity (within 5 minutes)
 */
function findMatchingTrade(
  trade: TradeJournalEntry,
  otherTrades: TradeJournalEntry[]
): TradeJournalEntry | null {
  const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  return otherTrades.find((other) => {
    const timeDiff = Math.abs(trade.openedAt - other.openedAt);
    const sameDirection = trade.side === other.side;
    const similarPrice = Math.abs(trade.entryPrice - other.entryPrice) < trade.entryPrice * 0.001; // 0.1%

    return timeDiff < TIME_WINDOW_MS && sameDirection && similarPrice;
  }) || null;
}

/**
 * Compare two trade journals
 */
function compareJournals(
  blockingPath: string,
  weightPath: string
): ModeComparison {
  // Load journals
  const blockingTrades: TradeJournalEntry[] = JSON.parse(
    fs.readFileSync(blockingPath, 'utf-8')
  );
  const weightTrades: TradeJournalEntry[] = JSON.parse(
    fs.readFileSync(weightPath, 'utf-8')
  );

  // Analyze each mode
  const blockingStats = analyzeTrades(blockingTrades);
  const weightStats = analyzeTrades(weightTrades);

  // Find unique and common trades
  const uniqueToBlocking: TradeJournalEntry[] = [];
  const uniqueToWeight: TradeJournalEntry[] = [];
  const commonTrades: Array<{ blocking: TradeJournalEntry; weight: TradeJournalEntry }> = [];

  const matchedWeightIds = new Set<string>();

  for (const blockingTrade of blockingTrades.filter((t) => t.status === 'CLOSED')) {
    const match = findMatchingTrade(blockingTrade, weightTrades);

    if (match) {
      commonTrades.push({ blocking: blockingTrade, weight: match });
      matchedWeightIds.add(match.id);
    } else {
      uniqueToBlocking.push(blockingTrade);
    }
  }

  for (const weightTrade of weightTrades.filter((t) => t.status === 'CLOSED')) {
    if (!matchedWeightIds.has(weightTrade.id)) {
      uniqueToWeight.push(weightTrade);
    }
  }

  // Calculate average confidence difference
  let totalConfidenceDiff = 0;
  for (const { blocking, weight } of commonTrades) {
    const blockingConf = blocking.entryCondition.signal.confidence;
    const weightConf = weight.entryCondition.signal.confidence;
    totalConfidenceDiff += (weightConf - blockingConf);
  }
  const confidenceDiff = commonTrades.length > 0 ? totalConfidenceDiff / commonTrades.length : 0;

  return {
    blocking: blockingStats,
    weight: weightStats,
    uniqueToBlocking,
    uniqueToWeight,
    commonTrades,
    confidenceDiff,
  };
}

/**
 * Print detailed comparison report
 */
function printReport(comparison: ModeComparison): void {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  📊 BLOCKING vs WEIGHT MODE COMPARISON                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // ============================================================================
  // SUMMARY STATISTICS
  // ============================================================================

  console.log('┌─ SUMMARY STATISTICS ────────────────────────────────────┐\n');

  const b = comparison.blocking;
  const w = comparison.weight;

  console.log('                      BLOCKING         WEIGHT');
  console.log('                      ────────         ──────');
  console.log(`Total Trades:         ${b.total.toString().padEnd(16)} ${w.total}`);
  console.log(`Profitable:           ${b.profitable.toString().padEnd(16)} ${w.profitable}`);
  console.log(`Unprofitable:         ${b.unprofitable.toString().padEnd(16)} ${w.unprofitable}`);
  console.log(`Win Rate:             ${b.winRate.toFixed(1)}%${(' ').repeat(11)} ${w.winRate.toFixed(1)}%`);
  console.log(`\nTotal PnL (gross):    ${b.totalPnL.toFixed(2)} USDT${(' ').repeat(6)} ${w.totalPnL.toFixed(2)} USDT`);
  console.log(`Total Fees:           ${b.totalFees.toFixed(2)} USDT${(' ').repeat(6)} ${w.totalFees.toFixed(2)} USDT`);
  console.log(`Net PnL:              ${b.netPnL.toFixed(2)} USDT${(' ').repeat(6)} ${w.netPnL.toFixed(2)} USDT`);
  console.log(`\nAvg Win:              ${b.avgWin.toFixed(2)} USDT${(' ').repeat(6)} ${w.avgWin.toFixed(2)} USDT`);
  console.log(`Avg Loss:             ${b.avgLoss.toFixed(2)} USDT${(' ').repeat(6)} ${w.avgLoss.toFixed(2)} USDT`);
  console.log(`Win/Loss Ratio:       ${b.winLossRatio.toFixed(2)}x${(' ').repeat(12)} ${w.winLossRatio.toFixed(2)}x`);

  const performanceDiff = ((w.winLossRatio - b.winLossRatio) / b.winLossRatio * 100).toFixed(1);
  const marker = w.winLossRatio < b.winLossRatio ? '❌' : '✅';
  console.log(`\n${marker} Weight System Performance: ${performanceDiff}% ${w.winLossRatio < b.winLossRatio ? 'WORSE' : 'BETTER'} than Blocking\n`);

  // ============================================================================
  // TRADE OVERLAP ANALYSIS
  // ============================================================================

  console.log('┌─ TRADE OVERLAP ANALYSIS ────────────────────────────────┐\n');

  console.log(`Common Trades (both modes): ${comparison.commonTrades.length}`);
  console.log(`Unique to Blocking:         ${comparison.uniqueToBlocking.length}`);
  console.log(`Unique to Weight:           ${comparison.uniqueToWeight.length}`);
  console.log(`\nAvg Confidence Diff (W-B):  ${comparison.confidenceDiff >= 0 ? '+' : ''}${(comparison.confidenceDiff * 100).toFixed(2)}%\n`);

  // ============================================================================
  // UNIQUE TO BLOCKING (trades weight system missed)
  // ============================================================================

  if (comparison.uniqueToBlocking.length > 0) {
    console.log('┌─ UNIQUE TO BLOCKING (Weight System MISSED) ─────────────┐\n');

    let totalPnL = 0;
    for (const trade of comparison.uniqueToBlocking) {
      totalPnL += trade.realizedPnL || 0;
      const pnlStr = (trade.realizedPnL || 0).toFixed(2);
      const marker = (trade.realizedPnL || 0) > 0 ? '✅' : '❌';
      console.log(`${marker} ${trade.side.padEnd(5)} @ ${trade.entryPrice.toFixed(4)} → ${pnlStr.padStart(7)} USDT`);
      console.log(`   Confidence: ${(trade.entryCondition.signal.confidence * 100).toFixed(1)}%`);
      console.log(`   Reason: ${trade.entryCondition.signal.reason}`);
      console.log(`   Exit: ${trade.exitCondition?.exitType}\n`);
    }

    console.log(`Total PnL from missed trades: ${totalPnL.toFixed(2)} USDT`);
    console.log(`→ Weight System missed ${totalPnL > 0 ? 'PROFITABLE' : 'UNPROFITABLE'} opportunities!\n`);
  }

  // ============================================================================
  // UNIQUE TO WEIGHT (trades blocking rejected)
  // ============================================================================

  if (comparison.uniqueToWeight.length > 0) {
    console.log('┌─ UNIQUE TO WEIGHT (Blocking REJECTED) ──────────────────┐\n');

    let totalPnL = 0;
    let profitable = 0;
    let unprofitable = 0;

    for (const trade of comparison.uniqueToWeight) {
      const pnl = trade.realizedPnL || 0;
      totalPnL += pnl;
      if (pnl > 0) profitable++;
      else if (pnl < 0) unprofitable++;

      const pnlStr = pnl.toFixed(2);
      const marker = pnl > 0 ? '✅' : '❌';
      console.log(`${marker} ${trade.side.padEnd(5)} @ ${trade.entryPrice.toFixed(4)} → ${pnlStr.padStart(7)} USDT`);
      console.log(`   Confidence: ${(trade.entryCondition.signal.confidence * 100).toFixed(1)}%`);
      console.log(`   Reason: ${trade.entryCondition.signal.reason}`);
      console.log(`   Exit: ${trade.exitCondition?.exitType}\n`);
    }

    const winRate = comparison.uniqueToWeight.length > 0 ? (profitable / comparison.uniqueToWeight.length) * 100 : 0;

    console.log(`Total PnL from extra trades: ${totalPnL.toFixed(2)} USDT`);
    console.log(`Win Rate: ${winRate.toFixed(1)}% (${profitable}W/${unprofitable}L)`);

    if (totalPnL < 0) {
      console.log(`→ ❌ Weight System allowed UNPROFITABLE trades that blocking correctly rejected!\n`);
    } else {
      console.log(`→ ✅ Weight System found additional profitable opportunities!\n`);
    }
  }

  // ============================================================================
  // COMMON TRADES OUTCOME COMPARISON
  // ============================================================================

  if (comparison.commonTrades.length > 0) {
    console.log('┌─ COMMON TRADES OUTCOME COMPARISON ──────────────────────┐\n');

    let blockingBetter = 0;
    let weightBetter = 0;
    let same = 0;
    let totalBlockingPnL = 0;
    let totalWeightPnL = 0;

    for (const { blocking, weight } of comparison.commonTrades) {
      const bPnL = blocking.realizedPnL || 0;
      const wPnL = weight.realizedPnL || 0;
      totalBlockingPnL += bPnL;
      totalWeightPnL += wPnL;

      if (Math.abs(bPnL - wPnL) < 0.01) {
        same++;
      } else if (bPnL > wPnL) {
        blockingBetter++;
        console.log(`⬆️  BLOCKING BETTER: ${blocking.side} @ ${blocking.entryPrice.toFixed(4)}`);
        console.log(`   Blocking: ${bPnL.toFixed(2)} USDT (conf: ${(blocking.entryCondition.signal.confidence * 100).toFixed(1)}%)`);
        console.log(`   Weight:   ${wPnL.toFixed(2)} USDT (conf: ${(weight.entryCondition.signal.confidence * 100).toFixed(1)}%)`);
        console.log(`   Exit: B=${blocking.exitCondition?.exitType}, W=${weight.exitCondition?.exitType}\n`);
      } else {
        weightBetter++;
        console.log(`⬇️  WEIGHT BETTER: ${weight.side} @ ${weight.entryPrice.toFixed(4)}`);
        console.log(`   Blocking: ${bPnL.toFixed(2)} USDT (conf: ${(blocking.entryCondition.signal.confidence * 100).toFixed(1)}%)`);
        console.log(`   Weight:   ${wPnL.toFixed(2)} USDT (conf: ${(weight.entryCondition.signal.confidence * 100).toFixed(1)}%)`);
        console.log(`   Exit: B=${blocking.exitCondition?.exitType}, W=${weight.exitCondition?.exitType}\n`);
      }
    }

    console.log(`\nCommon Trades Summary:`);
    console.log(`Blocking Better: ${blockingBetter} trades`);
    console.log(`Weight Better:   ${weightBetter} trades`);
    console.log(`Same Outcome:    ${same} trades`);
    console.log(`\nTotal PnL (common trades):`);
    console.log(`Blocking: ${totalBlockingPnL.toFixed(2)} USDT`);
    console.log(`Weight:   ${totalWeightPnL.toFixed(2)} USDT\n`);
  }

  // ============================================================================
  // CONCLUSION
  // ============================================================================

  console.log('┌─ 🎯 CONCLUSION ─────────────────────────────────────────┐\n');

  if (w.winLossRatio < b.winLossRatio) {
    console.log('❌ Weight System UNDERPERFORMS Blocking Mode\n');
    console.log('Possible Reasons:');

    if (comparison.uniqueToWeight.length > 0) {
      const uniqueWeightPnL = comparison.uniqueToWeight.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
      if (uniqueWeightPnL < 0) {
        console.log(`1. ⚠️  Weight System allows ${comparison.uniqueToWeight.length} extra trades that are unprofitable`);
        console.log(`   → Net loss: ${uniqueWeightPnL.toFixed(2)} USDT from trades blocking correctly rejected`);
      }
    }

    if (comparison.confidenceDiff < 0) {
      console.log(`2. ⚠️  Weight System reduces confidence too much (avg: ${(comparison.confidenceDiff * 100).toFixed(2)}%)`);
      console.log(`   → Lower confidence might affect SL/TP placement or risk management`);
    }

    console.log(`3. ⚠️  Avg Loss higher in Weight mode: ${w.avgLoss.toFixed(2)} vs ${b.avgLoss.toFixed(2)} USDT`);
    console.log(`   → Weight adjustments might affect SL distance or exit timing`);

    console.log('\n💡 Recommendations:');
    console.log('   - Keep Weight System DISABLED (weightSystem.enabled: false)');
    console.log('   - Use blocking mode for production trading');
    console.log('   - Weight System needs fundamental redesign or removal\n');
  } else {
    console.log('✅ Weight System OUTPERFORMS Blocking Mode\n');
    console.log('   → Consider enabling Weight System in production!\n');
  }
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: ts-node compare-modes.ts <blocking-journal.json> <weight-journal.json>');
    console.error('\nExample:');
    console.error('  npm run compare-modes data/trade-journal.json "data/trade-journal - wight.json"');
    process.exit(1);
  }

  const blockingPath = args[0];
  const weightPath = args[1];

  if (!fs.existsSync(blockingPath)) {
    console.error(`Error: Blocking journal not found: ${blockingPath}`);
    process.exit(1);
  }

  if (!fs.existsSync(weightPath)) {
    console.error(`Error: Weight journal not found: ${weightPath}`);
    process.exit(1);
  }

  const comparison = compareJournals(blockingPath, weightPath);
  printReport(comparison);
}

if (require.main === module) {
  main();
}
