#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface JournalTrade {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  realizedPnL?: number;
  openedAt: number;
  closedAt?: number;
  status: string;
}

function main() {
  const journalPath = path.join(__dirname, '../data/trade-journal.json');
  const journal: JournalTrade[] = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  
  const closedTrades = journal.filter(t => t.status === 'CLOSED');
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔍 JOURNAL DUPLICATE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`Total trades in journal: ${journal.length}`);
  console.log(`Closed trades: ${closedTrades.length}`);
  
  // Group by entry price + side
  const groups = new Map<string, JournalTrade[]>();
  
  for (const trade of closedTrades) {
    const key = `${trade.side}_${trade.entryPrice.toFixed(4)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(trade);
  }
  
  console.log(`\nUnique positions (by entry price): ${groups.size}`);
  console.log(`Difference from closed trades: ${closedTrades.length - groups.size}`);
  
  // Find duplicates
  const duplicates = Array.from(groups.entries()).filter(([_, trades]) => trades.length > 1);
  
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`📋 DUPLICATE POSITIONS: ${duplicates.length}`);
  console.log('───────────────────────────────────────────────────────────────');
  
  for (const [key, trades] of duplicates) {
    const [side, entryPrice] = key.split('_');
    console.log(`\n${side} @ ${entryPrice} - ${trades.length} trades:`);
    
    trades.forEach((t, i) => {
      const openTime = new Date(t.openedAt).toLocaleString('ru-RU');
      const closeTime = t.closedAt ? new Date(t.closedAt).toLocaleString('ru-RU') : 'OPEN';
      console.log(`  ${i + 1}. ID: ${t.id}`);
      console.log(`     Opened: ${openTime}`);
      console.log(`     Closed: ${closeTime}`);
      console.log(`     Qty: ${t.quantity.toFixed(1)} | Exit: ${t.exitPrice?.toFixed(4) || 'N/A'} | PnL: ${(t.realizedPnL || 0).toFixed(4)} USDT`);
    });
    
    // Calculate total PnL for this position
    const totalPnL = trades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const totalQty = trades.reduce((sum, t) => sum + t.quantity, 0);
    console.log(`  TOTAL: Qty ${totalQty.toFixed(1)} | PnL ${totalPnL.toFixed(4)} USDT`);
  }
  
  // Show ALL positions grouped
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📊 ALL POSITIONS GROUPED:');
  console.log('───────────────────────────────────────────────────────────────');
  
  const sorted = Array.from(groups.entries()).sort((a, b) => {
    const timeA = Math.min(...a[1].map(t => t.openedAt));
    const timeB = Math.min(...b[1].map(t => t.openedAt));
    return timeA - timeB;
  });
  
  let totalPnL = 0;
  
  for (const [key, trades] of sorted) {
    const [side, entryPrice] = key.split('_');
    const groupPnL = trades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const groupQty = trades.reduce((sum, t) => sum + t.quantity, 0);
    
    totalPnL += groupPnL;
    
    console.log(`${side.padEnd(5)} @ ${entryPrice.padEnd(8)} | Qty: ${groupQty.toFixed(1).padStart(6)} | Trades: ${trades.length} | PnL: ${groupPnL.toFixed(4).padStart(10)} USDT`);
  }
  
  console.log('\n───────────────────────────────────────────────────────────────');
  console.log(`TOTAL PnL (grouped): ${totalPnL.toFixed(4)} USDT`);
  console.log(`TOTAL PnL (journal): ${closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0).toFixed(4)} USDT`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main();
