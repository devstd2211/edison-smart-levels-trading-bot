#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface JournalTrade {
  id: string;
  side: string;
  entryPrice: number;
  exitPrice?: number;
  realizedPnL?: number;
  openedAt: number;
  closedAt?: number;
  status: string;
}

interface BybitPnL {
  entryPrice: number;
  exitPrice: number;
  side: string;
  realizedPnL: number;
}

function parseBybitPnL(filePath: string): BybitPnL[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const pnls: BybitPnL[] = [];

  for (const line of lines) {
    const parts = line.split(/\s{2,}/);
    if (parts.length < 7) continue;

    const sideStr = parts[1].trim();
    const entryPrice = parseFloat(parts[3].trim());
    const exitPrice = parseFloat(parts[4].trim());
    const realizedPnL = parseFloat(parts[5].trim());
    const side = sideStr.includes('Длинная') ? 'LONG' : 'SHORT';

    pnls.push({ entryPrice, exitPrice, side, realizedPnL });
  }

  return pnls;
}

function main() {
  const journalPath = path.join(__dirname, '../data/trade-journal.json');
  const bybitPath = path.join(__dirname, '../data/bybit-pnl-raw.txt');

  const journal: JournalTrade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const closedTrades = journal.filter(t => t.status === 'CLOSED');
  const bybitPnLs = parseBybitPnL(bybitPath);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 MISSING TRADES ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`Journal closed trades: ${closedTrades.length}`);
  console.log(`Bybit records: ${bybitPnLs.length}`);

  const missing: JournalTrade[] = [];

  for (const trade of closedTrades) {
    const found = bybitPnLs.find(b => 
      b.side === trade.side && 
      Math.abs(b.entryPrice - trade.entryPrice) < 0.01
    );

    if (!found) {
      missing.push(trade);
    }
  }

  console.log(`\nMissing from Bybit data: ${missing.length}`);

  if (missing.length > 0) {
    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('❌ MISSING TRADES:');
    console.log('───────────────────────────────────────────────────────────────');

    for (const trade of missing) {
      const openTime = new Date(trade.openedAt).toLocaleString('ru-RU');
      const closeTime = trade.closedAt ? new Date(trade.closedAt).toLocaleString('ru-RU') : 'OPEN';
      
      console.log(`\n${trade.side} @ ${trade.entryPrice} → ${trade.exitPrice}`);
      console.log(`  Opened:  ${openTime}`);
      console.log(`  Closed:  ${closeTime}`);
      console.log(`  PnL:     ${(trade.realizedPnL || 0).toFixed(4)} USDT`);
      console.log(`  ID:      ${trade.id}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main();
