/**
 * Fix Journal PnL Script
 *
 * Recalculates PnL for all trades in journal with correct formula for LONG/SHORT positions.
 *
 * Bug fixed:
 * - OLD: realizedPnL = (exitPrice - entryPrice) * quantity
 * - NEW: realizedPnL = (exitPrice - entryPrice) * quantity * pnlMultiplier * leverage
 *   where pnlMultiplier = 1 for LONG, -1 for SHORT
 */

import * as fs from 'fs';
import * as path from 'path';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

// ============================================================================
// TYPES
// ============================================================================

interface JournalEntry {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  leverage: number;
  exitPrice?: number;
  realizedPnL?: number;
  exitCondition?: {
    exitType: string;
    price: number;
    timestamp: number;
    reason: string;
    pnlUsdt: number;
    pnlPercent: number;
    realizedPnL: number;
    [key: string]: any;
  };
  [key: string]: any;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

function fixJournalPnL(journalPath: string): void {
  console.log(`${ICONS.search} Loading trade journal...`);

  // Read journal
  const journalData = fs.readFileSync(journalPath, 'utf-8');
  const trades: JournalEntry[] = JSON.parse(journalData);

  console.log(`${ICONS.success} Loaded ${trades.length} trades
`);

  let fixedCount = 0;

  // Process each trade
  for (const trade of trades) {
    if (!trade.exitPrice || !trade.exitCondition) {
      continue; // Skip open trades
    }

    const { entryPrice, exitPrice, quantity, leverage, side } = trade;

    // Calculate correct PnL
    const priceDiff = exitPrice - entryPrice;
    const isLong = side === 'LONG';
    const pnlMultiplier = isLong ? 1 : -1;

    const correctPnL = priceDiff * quantity * pnlMultiplier * leverage;
    const correctPnLPercent = (priceDiff / entryPrice) * 100 * pnlMultiplier;

    const oldPnL = trade.realizedPnL || 0;

    // Check if PnL needs fixing
    if (Math.abs(correctPnL - oldPnL) > 0.001) {
      console.log(`${ICONS.wrench} Fixing trade ${trade.id}:`);
      console.log(`   Side: ${side}`);
      console.log(`   Entry: ${entryPrice} → Exit: ${exitPrice}`);
      console.log(`   Old PnL: ${oldPnL.toFixed(4)} USDT`);
      console.log(`   New PnL: ${correctPnL.toFixed(4)} USDT`);
      console.log(`   Diff: ${(correctPnL - oldPnL).toFixed(4)} USDT\n`);

      // Update trade
      trade.realizedPnL = correctPnL;
      trade.exitCondition.pnlUsdt = correctPnL;
      trade.exitCondition.pnlPercent = correctPnLPercent;
      trade.exitCondition.realizedPnL = correctPnL;

      // Fix maxProfit/maxDrawdown
      if (correctPnL > 0) {
        trade.exitCondition.maxProfitPercent = Math.abs(correctPnLPercent);
        trade.exitCondition.maxDrawdownPercent = 0;
      } else {
        trade.exitCondition.maxProfitPercent = 0;
        trade.exitCondition.maxDrawdownPercent = Math.abs(correctPnLPercent);
      }

      fixedCount++;
    }
  }

  // Save fixed journal
  if (fixedCount > 0) {
    // Backup original
    const backupPath = journalPath.replace('.json', '.backup.json');
    fs.copyFileSync(journalPath, backupPath);
    console.log(`${ICONS.save} Backup saved: ${backupPath}`);

    // Write fixed journal
    fs.writeFileSync(journalPath, JSON.stringify(trades, null, 2), 'utf-8');
    console.log(`${ICONS.success} Fixed ${fixedCount} trades`);
    console.log(`${ICONS.save} Updated journal: ${journalPath}
`);
  } else {
    console.log(`${ICONS.success} No fixes needed - all PnL values are correct!
`);
  }
}

// ============================================================================
// CLI
// ============================================================================

const journalPath = process.argv[2] || path.join(__dirname, '../data/trade-journal.json');

if (!fs.existsSync(journalPath)) {
  console.error(`${ICONS.error} Journal file not found: ${journalPath}`);
  process.exit(1);
}

fixJournalPnL(journalPath);

