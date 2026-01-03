#!/usr/bin/env ts-node

/**
 * Verify PnL Calculations Against Bybit Exchange Data
 */

import * as fs from 'fs';
import * as path from 'path';

interface BybitPnL {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnL: number;
  timestamp: Date;
}

interface JournalTrade {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  realizedPnL?: number;
  closedAt?: number;
  status: string;
}

function parseBybitPnL(filePath: string): BybitPnL[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const pnls: BybitPnL[] = [];

  for (const line of lines) {
    const parts = line.split(/\s{2,}/);
    if (parts.length < 7) continue;

    const symbol = parts[0].trim();
    const sideStr = parts[1].trim();
    const qtyStr = parts[2].trim().replace(' APEX', '');
    const entryPrice = parseFloat(parts[3].trim());
    const exitPrice = parseFloat(parts[4].trim());
    const realizedPnL = parseFloat(parts[5].trim());
    const timestampStr = parts[7].trim();

    const side = sideStr.includes('Длинная') ? 'LONG' : 'SHORT';
    const quantity = parseFloat(qtyStr);

    const [datePart, timePart] = timestampStr.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute, second] = timePart.split(':').map(Number);
    const timestamp = new Date(year, month - 1, day, hour, minute, second);

    pnls.push({ symbol, side, quantity, entryPrice, exitPrice, realizedPnL, timestamp });
  }

  return pnls;
}

interface GroupedPosition {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  totalQuantity: number;
  weightedExitPrice: number;
  totalPnL: number;
  closes: number;
  firstCloseTime: Date;
  lastCloseTime: Date;
}

function groupPartialCloses(pnls: BybitPnL[]): GroupedPosition[] {
  // Group by side + entryPrice (within 0.0001 tolerance)
  const groups = new Map<string, BybitPnL[]>();

  for (const pnl of pnls) {
    // Create key: side_entryPrice (rounded to 4 decimals)
    const key = `${pnl.side}_${pnl.entryPrice.toFixed(4)}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(pnl);
  }

  // Aggregate each group
  const positions: GroupedPosition[] = [];

  for (const [key, closes] of groups.entries()) {
    const side = closes[0].side;
    const entryPrice = closes[0].entryPrice;
    const totalQuantity = closes.reduce((sum, c) => sum + c.quantity, 0);
    const totalPnL = closes.reduce((sum, c) => sum + c.realizedPnL, 0);

    // Calculate weighted average exit price
    const weightedExitPrice = closes.reduce((sum, c) => sum + c.exitPrice * c.quantity, 0) / totalQuantity;

    const times = closes.map(c => c.timestamp.getTime());
    const firstCloseTime = new Date(Math.min(...times));
    const lastCloseTime = new Date(Math.max(...times));

    positions.push({
      side,
      entryPrice,
      totalQuantity,
      weightedExitPrice,
      totalPnL,
      closes: closes.length,
      firstCloseTime,
      lastCloseTime,
    });
  }

  return positions.sort((a, b) => a.firstCloseTime.getTime() - b.firstCloseTime.getTime());
}

function main() {
  const bybitPnLPath = path.join(__dirname, '../data/bybit-pnl-raw.txt');
  const journalPath = path.join(__dirname, '../data/trade-journal.json');

  console.log('🔍 Parsing Bybit PnL data...');
  const pnls = parseBybitPnL(bybitPnLPath);
  console.log(`✅ Parsed ${pnls.length} PnL records (partial closes)`);

  console.log('\n🔗 Grouping partial closes into positions...');
  const positions = groupPartialCloses(pnls);
  console.log(`✅ Grouped into ${positions.length} positions`);

  const journalContent = fs.readFileSync(journalPath, 'utf-8');
  const journal: JournalTrade[] = JSON.parse(journalContent);
  const closedTrades = journal.filter((t) => t.status === 'CLOSED');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 BYBIT PnL vs BOT JOURNAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const bybitTotalPnL = positions.reduce((sum, p) => sum + p.totalPnL, 0);
  const journalTotalPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

  console.log(`Bybit Partial Closes:  ${pnls.length}`);
  console.log(`Bybit Positions:       ${positions.length}`);
  console.log(`Journal Closed Trades: ${closedTrades.length}`);
  console.log(`Position Difference:   ${Math.abs(positions.length - closedTrades.length)}`);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('💰 PnL COMPARISON:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Bybit Total PnL:   ${bybitTotalPnL.toFixed(4)} USDT`);
  console.log(`Journal Total PnL: ${journalTotalPnL.toFixed(4)} USDT`);
  console.log(`Difference:        ${Math.abs(bybitTotalPnL - journalTotalPnL).toFixed(4)} USDT`);

  const accuracy = bybitTotalPnL !== 0
    ? ((1 - Math.abs(bybitTotalPnL - journalTotalPnL) / Math.abs(bybitTotalPnL)) * 100).toFixed(2)
    : '0.00';
  console.log(`Accuracy:          ${accuracy}%`);

  // Side breakdown
  const bybitLong = positions.filter(p => p.side === 'LONG');
  const bybitShort = positions.filter(p => p.side === 'SHORT');
  const journalLong = closedTrades.filter(t => t.side === 'LONG');
  const journalShort = closedTrades.filter(t => t.side === 'SHORT');

  const bybitLongPnL = bybitLong.reduce((sum, p) => sum + p.totalPnL, 0);
  const bybitShortPnL = bybitShort.reduce((sum, p) => sum + p.totalPnL, 0);
  const journalLongPnL = journalLong.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
  const journalShortPnL = journalShort.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📊 LONG vs SHORT:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`\nLONG:`);
  console.log(`  Bybit:   ${bybitLong.length} positions | PnL: ${bybitLongPnL.toFixed(4)} USDT`);
  console.log(`  Journal: ${journalLong.length} trades    | PnL: ${journalLongPnL.toFixed(4)} USDT`);
  console.log(`  Diff:    ${Math.abs(bybitLongPnL - journalLongPnL).toFixed(4)} USDT`);

  console.log(`\nSHORT:`);
  console.log(`  Bybit:   ${bybitShort.length} positions | PnL: ${bybitShortPnL.toFixed(4)} USDT`);
  console.log(`  Journal: ${journalShort.length} trades    | PnL: ${journalShortPnL.toFixed(4)} USDT`);
  console.log(`  Diff:    ${Math.abs(bybitShortPnL - journalShortPnL).toFixed(4)} USDT`);

  // Detailed comparison
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('🔍 SAMPLE POSITIONS (First 10):');
  console.log('───────────────────────────────────────────────────────────────');

  for (let i = 0; i < Math.min(10, positions.length); i++) {
    const pos = positions[i];

    // Try to find matching journal trade
    const match = closedTrades.find(t => {
      const priceDiff = Math.abs(t.entryPrice - pos.entryPrice);
      const qtyDiff = Math.abs(t.quantity - pos.totalQuantity);
      return t.side === pos.side && priceDiff < 0.01 && qtyDiff < 1;
    });

    console.log(`\n${i + 1}. ${pos.side} @ ${pos.entryPrice} → ${pos.weightedExitPrice.toFixed(4)}`);
    console.log(`   Closes:   ${pos.closes} partial closes`);
    console.log(`   Qty:      ${pos.totalQuantity.toFixed(1)} APEX`);
    console.log(`   Bybit:    ${pos.totalPnL.toFixed(4)} USDT`);

    if (match) {
      const diff = Math.abs(pos.totalPnL - (match.realizedPnL || 0));
      const isMatch = diff < 0.5; // tolerance 0.5 USDT
      console.log(`   Bot:      ${(match.realizedPnL || 0).toFixed(4)} USDT`);
      console.log(`   Diff:     ${diff.toFixed(4)} USDT ${isMatch ? '✅' : '❌'}`);
    } else {
      console.log(`   Bot:      NO MATCH FOUND ❓`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main();
