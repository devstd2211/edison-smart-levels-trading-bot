/**
 * Bybit Trading Statistics Comparison
 *
 * Fetches trading data from Bybit API and compares with bot journal.
 * Usage: npm run compare-bybit [startDate] [endDate]
 *
 * Example:
 *   npm run compare-bybit 2025-10-25 2025-10-26
 *   npm run compare-bybit  # defaults to last 24 hours
 */

import * as fs from 'fs';
import * as path from 'path';
import { RestClientV5 } from 'bybit-api';
import * as dotenv from 'dotenv';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

dotenv.config();

// ============================================================================
// TYPES
// ============================================================================

interface BybitClosedPosition {
  symbol: string;
  side: 'Buy' | 'Sell';
  qty: string;
  avgEntryPrice: string;
  avgExitPrice: string;
  closedPnl: string;
  closedSize: string;
  cumEntryValue: string;
  cumExitValue: string;
  createdTime: string;
  updatedTime: string;
  orderId: string;
  leverage: string;
  closedFee: string;
}

interface JournalTrade {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnL: number;
  openedAt: number;
  closedAt: number;
  exitCondition?: {
    tradingFees?: number;
    pnlGross?: number;
  };
}

interface ComparisonResult {
  matched: number;
  totalBybit: number;
  totalJournal: number;
  pnlDiffTotal: number;
  feesDiffTotal: number;
  missingInJournal: BybitClosedPosition[];
  missingInBybit: JournalTrade[];
  discrepancies: Array<{
    journal: JournalTrade;
    bybit: BybitClosedPosition;
    pnlDiff: number;
    feeDiff: number;
  }>;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`${ICONS.chart} BYBIT vs BOT JOURNAL COMPARISON
`);

  // Parse arguments
  const args = process.argv.slice(2);
  let startTime: number;
  let endTime: number;

  if (args.length >= 2) {
    // Custom date range
    const startDate = new Date(args[0] + ' 00:00:00 UTC');
    const endDate = new Date(args[1] + ' 23:59:59 UTC');
    startTime = startDate.getTime();
    endTime = endDate.getTime();
    console.log(`Period: ${args[0]} - ${args[1]} UTC`);
  } else {
    // Default: last 24 hours
    endTime = Date.now();
    startTime = endTime - 24 * 60 * 60 * 1000;
    console.log(`Period: Last 24 hours`);
  }

  console.log(`Start: ${new Date(startTime).toISOString()}`);
  console.log(`End: ${new Date(endTime).toISOString()}\n`);

  // Initialize Bybit client
  const client = new RestClientV5({
    key: process.env.BYBIT_API_KEY || '',
    secret: process.env.BYBIT_API_SECRET || '',
    testnet: false,
    baseUrl: 'https://api-demo.bybit.com', // Demo API
  });

  console.log(`${ICONS.refresh} Fetching data from Bybit...`);
  const bybitPositions = await fetchBybitClosedPnL(client, startTime, endTime);
  console.log(`${ICONS.success} Fetched ${bybitPositions.length} positions from Bybit
`);

  console.log(`${ICONS.book_open} Loading bot journal...`);
  const journalPath = path.join(__dirname, '../data/trade-journal.json');
  const journalTrades = loadJournal(journalPath, startTime, endTime);
  console.log(`${ICONS.success} Loaded ${journalTrades.length} trades from journal
`);

  // Compare
  console.log(`${ICONS.search} Comparing positions...
`);
  const result = comparePositions(bybitPositions, journalTrades);

  // Report
  printReport(result, bybitPositions, journalTrades);
}

// ============================================================================
// BYBIT API
// ============================================================================

async function fetchBybitClosedPnL(
  client: RestClientV5,
  startTime: number,
  endTime: number
): Promise<BybitClosedPosition[]> {
  const positions: BybitClosedPosition[] = [];

  try {
    let cursor = '';
    let hasMore = true;

    while (hasMore) {
      const response: any = await client.getClosedPnL({
        category: 'linear',
        symbol: 'APEXUSDT',
        startTime: startTime.toString(),
        endTime: endTime.toString(),
        limit: 100,
        cursor: cursor || undefined,
      });

      if (response.retCode !== 0) {
        console.error(`${ICONS.error} Bybit API error:`, response.retMsg);
        break;
      }

      const list = response.result?.list || [];
      positions.push(...list);

      cursor = response.result?.nextPageCursor || '';
      hasMore = !!cursor;
    }
  } catch (error) {
    console.error(`${ICONS.error} Error fetching Bybit data:`, error);
  }

  return positions;
}

// ============================================================================
// JOURNAL
// ============================================================================

function loadJournal(filePath: string, startTime: number, endTime: number): JournalTrade[] {
  if (!fs.existsSync(filePath)) {
    console.error(`${ICONS.error} Journal file not found: ${filePath}`);
    return [];
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  return data.filter((trade: JournalTrade) => {
    return trade.closedAt >= startTime && trade.closedAt <= endTime;
  });
}

// ============================================================================
// COMPARISON
// ============================================================================

function comparePositions(
  bybitPositions: BybitClosedPosition[],
  journalTrades: JournalTrade[]
): ComparisonResult {
  let matched = 0;
  const missingInJournal: BybitClosedPosition[] = [];
  const missingInBybit: JournalTrade[] = [];
  const discrepancies: any[] = [];

  let pnlDiffTotal = 0;
  let feesDiffTotal = 0;

  // Match Bybit positions with Journal trades
  const matchedJournal = new Set<string>();

  for (const bybitPos of bybitPositions) {
    const avgEntry = parseFloat(bybitPos.avgEntryPrice);
    const avgExit = parseFloat(bybitPos.avgExitPrice);
    const bybitSide = bybitPos.side === 'Buy' ? 'LONG' : 'SHORT';

    // Find matching journal trade (by entry price and side)
    const journalTrade = journalTrades.find((jt) => {
      if (matchedJournal.has(jt.id)) return false;
      if (jt.side !== bybitSide) return false;

      const entryDiff = Math.abs(jt.entryPrice - avgEntry) / avgEntry;
      const exitDiff = Math.abs(jt.exitPrice - avgExit) / avgExit;

      return entryDiff < 0.001 && exitDiff < 0.001; // 0.1% tolerance
    });

    if (journalTrade) {
      matched++;
      matchedJournal.add(journalTrade.id);

      // Compare PnL and fees
      const bybitPnl = parseFloat(bybitPos.closedPnl);
      const bybitFees = parseFloat(bybitPos.closedFee);
      const journalPnl = journalTrade.realizedPnL;
      const journalFees = journalTrade.exitCondition?.tradingFees || 0;

      const pnlDiff = Math.abs(bybitPnl - journalPnl);
      const feeDiff = Math.abs(bybitFees - journalFees);

      pnlDiffTotal += pnlDiff;
      feesDiffTotal += feeDiff;

      if (pnlDiff > 0.01 || feeDiff > 0.01) {
        discrepancies.push({
          journal: journalTrade,
          bybit: bybitPos,
          pnlDiff,
          feeDiff,
        });
      }
    } else {
      missingInJournal.push(bybitPos);
    }
  }

  // Find journal trades missing in Bybit
  for (const jt of journalTrades) {
    if (!matchedJournal.has(jt.id)) {
      missingInBybit.push(jt);
    }
  }

  return {
    matched,
    totalBybit: bybitPositions.length,
    totalJournal: journalTrades.length,
    pnlDiffTotal,
    feesDiffTotal,
    missingInJournal,
    missingInBybit,
    discrepancies,
  };
}

// ============================================================================
// REPORT
// ============================================================================

function printReport(
  result: ComparisonResult,
  bybitPositions: BybitClosedPosition[],
  journalTrades: JournalTrade[]
) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`${ICONS.chart} COMPARISON RESULTS`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`${ICONS.success} Matched: ${result.matched}/${result.totalBybit} positions`);
  console.log(
    `   Match Rate: ${((result.matched / result.totalBybit) * 100).toFixed(1)}%\n`
  );

  if (result.missingInJournal.length > 0) {
    console.log(`${ICONS.warning}  Missing in Journal: ${result.missingInJournal.length}`);
    result.missingInJournal.forEach((pos, i) => {
      console.log(
        `   ${i + 1}. ${pos.side} @ ${pos.avgEntryPrice} → ${pos.avgExitPrice} (PnL: ${pos.closedPnl})`
      );
    });
    console.log('');
  }

  if (result.missingInBybit.length > 0) {
    console.log(`${ICONS.warning}  Missing in Bybit: ${result.missingInBybit.length}`);
    result.missingInBybit.forEach((trade, i) => {
      const time = new Date(trade.closedAt).toISOString().slice(11, 19);
      console.log(
        `   ${i + 1}. ${time} ${trade.side} @ ${trade.entryPrice} → ${trade.exitPrice} (PnL: ${trade.realizedPnL.toFixed(2)})`
      );
    });
    console.log('');
  }

  console.log(`${ICONS.money} PnL COMPARISON:`);

  const bybitPnlTotal = bybitPositions.reduce(
    (sum, p) => sum + parseFloat(p.closedPnl),
    0
  );
  const journalPnlTotal = journalTrades.reduce((sum, t) => sum + t.realizedPnL, 0);

  console.log(`   Bybit Net PnL:   ${bybitPnlTotal.toFixed(4)} USDT`);
  console.log(`   Journal Net PnL: ${journalPnlTotal.toFixed(4)} USDT`);

  const pnlDiff = Math.abs(bybitPnlTotal - journalPnlTotal);
  const pnlDiffPercent = (pnlDiff / Math.abs(bybitPnlTotal)) * 100;

  if (pnlDiff < 0.1) {
    console.log(`   Difference: ${pnlDiff.toFixed(4)} USDT ${ICONS.success} MATCH`);
  } else {
    console.log(
      `   Difference: ${pnlDiff.toFixed(4)} USDT (${pnlDiffPercent.toFixed(2)}%) ${ICONS.warning}`
    );
  }

  console.log('');

  if (result.discrepancies.length > 0) {
    console.log(`${ICONS.warning}  Discrepancies Found: ${result.discrepancies.length}`);
    result.discrepancies.forEach((d, i) => {
      const time = new Date(d.journal.closedAt).toISOString().slice(11, 19);
      console.log(
        `   ${i + 1}. ${time} ${d.journal.side} | PnL diff: ${d.pnlDiff.toFixed(4)} | Fee diff: ${d.feeDiff.toFixed(4)}`
      );
    });
  } else {
    console.log(`${ICONS.success} All matched positions have consistent PnL and fees!`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');

  if (result.matched === result.totalBybit && result.discrepancies.length === 0) {
    console.log(`${ICONS.success} VALIDATION SUCCESSFUL - All data matches!`);
  } else {
    console.log(`${ICONS.warning}  VALIDATION WARNING - Please review discrepancies above`);
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run
main().catch(console.error);

