#!/usr/bin/env ts-node

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

interface GroupedPosition {
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  totalQuantity: number;
  weightedExitPrice: number;
  totalPnL: number;
  closes: number;
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

function groupPartialCloses(pnls: BybitPnL[]): GroupedPosition[] {
  const groups = new Map<string, BybitPnL[]>();

  for (const pnl of pnls) {
    const key = `${pnl.side}_${pnl.entryPrice.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(pnl);
  }

  const positions: GroupedPosition[] = [];

  for (const [key, closes] of groups.entries()) {
    const side = closes[0].side;
    const entryPrice = closes[0].entryPrice;
    const totalQuantity = closes.reduce((sum, c) => sum + c.quantity, 0);
    const totalPnL = closes.reduce((sum, c) => sum + c.realizedPnL, 0);
    const weightedExitPrice = closes.reduce((sum, c) => sum + c.exitPrice * c.quantity, 0) / totalQuantity;

    positions.push({
      side,
      entryPrice,
      totalQuantity,
      weightedExitPrice,
      totalPnL,
      closes: closes.length,
    });
  }

  return positions;
}

function main() {
  const bybitPath = path.join(__dirname, '../data/bybit-pnl-complete.txt');
  const journalPath = path.join(__dirname, '../data/trade-journal.json');

  console.log('🔍 Parsing complete Bybit PnL data...');
  const pnls = parseBybitPnL(bybitPath);
  console.log(`✅ Parsed ${pnls.length} PnL records`);

  console.log('\n🔗 Grouping partial closes...');
  const positions = groupPartialCloses(pnls);
  console.log(`✅ Grouped into ${positions.length} positions`);

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const closedTrades = journal.filter((t: any) => t.status === 'CLOSED');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 FINAL VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const bybitTotalPnL = positions.reduce((sum, p) => sum + p.totalPnL, 0);
  const journalTotalPnL = closedTrades.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);

  console.log(`Bybit Partial Closes:  ${pnls.length}`);
  console.log(`Bybit Positions:       ${positions.length}`);
  console.log(`Journal Closed Trades: ${closedTrades.length}`);
  console.log(`\nBybit Total PnL:   ${bybitTotalPnL.toFixed(4)} USDT`);
  console.log(`Journal Total PnL: ${journalTotalPnL.toFixed(4)} USDT`);
  console.log(`Difference:        ${Math.abs(bybitTotalPnL - journalTotalPnL).toFixed(4)} USDT`);

  const accuracy = bybitTotalPnL !== 0
    ? ((1 - Math.abs(bybitTotalPnL - journalTotalPnL) / Math.abs(bybitTotalPnL)) * 100).toFixed(2)
    : '0.00';
  
  console.log(`\n${accuracy === '100.00' || parseFloat(accuracy) > 99 ? '✅' : '❌'} Accuracy: ${accuracy}%`);

  const bybitLong = positions.filter(p => p.side === 'LONG');
  const bybitShort = positions.filter(p => p.side === 'SHORT');
  const journalLong = closedTrades.filter((t: any) => t.side === 'LONG');
  const journalShort = closedTrades.filter((t: any) => t.side === 'SHORT');

  const bybitLongPnL = bybitLong.reduce((sum, p) => sum + p.totalPnL, 0);
  const bybitShortPnL = bybitShort.reduce((sum, p) => sum + p.totalPnL, 0);
  const journalLongPnL = journalLong.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);
  const journalShortPnL = journalShort.reduce((sum: number, t: any) => sum + (t.realizedPnL || 0), 0);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📊 LONG vs SHORT:');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`\nLONG:  Bybit ${bybitLongPnL.toFixed(4)} | Journal ${journalLongPnL.toFixed(4)} | Diff ${Math.abs(bybitLongPnL - journalLongPnL).toFixed(4)}`);
  console.log(`SHORT: Bybit ${bybitShortPnL.toFixed(4)} | Journal ${journalShortPnL.toFixed(4)} | Diff ${Math.abs(bybitShortPnL - journalShortPnL).toFixed(4)}`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main();
