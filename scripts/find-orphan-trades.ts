#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

function main() {
  const journalPath = path.join(__dirname, '../data/trade-journal.json');
  const bybitPath = path.join(__dirname, '../data/bybit-pnl-complete.txt');

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const closedTrades = journal.filter((t: any) => t.status === 'CLOSED');

  // Parse Bybit data
  const bybitContent = fs.readFileSync(bybitPath, 'utf-8');
  const bybitLines = bybitContent.trim().split('\n');
  const bybitEntries = new Set<string>();

  for (const line of bybitLines) {
    const parts = line.split(/\s{2,}/);
    if (parts.length < 7) continue;
    const sideStr = parts[1].trim();
    const entryPrice = parseFloat(parts[3].trim());
    const side = sideStr.includes('Длинная') ? 'LONG' : 'SHORT';
    const key = `${side}_${entryPrice.toFixed(4)}`;
    bybitEntries.add(key);
  }

  console.log('\n🔍 Looking for orphan trades (in journal but not on Bybit)...\n');

  const orphans = [];

  for (const trade of closedTrades) {
    const key = `${trade.side}_${trade.entryPrice.toFixed(4)}`;
    if (!bybitEntries.has(key)) {
      orphans.push(trade);
    }
  }

  if (orphans.length > 0) {
    console.log(`❌ Found ${orphans.length} orphan trades:\n`);
    
    for (const trade of orphans) {
      const openTime = new Date(trade.openedAt).toLocaleString('ru-RU');
      console.log(`${trade.side} @ ${trade.entryPrice} | PnL: ${(trade.realizedPnL || 0).toFixed(4)} USDT`);
      console.log(`  Opened: ${openTime}`);
      console.log(`  ID: ${trade.id}\n`);
    }
  } else {
    console.log('✅ No orphan trades found. All journal trades exist on Bybit.\n');
  }
}

main();
