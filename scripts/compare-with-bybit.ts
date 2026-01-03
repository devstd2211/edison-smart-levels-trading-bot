/**
 * Compare Journal with Bybit Data
 */

// Bybit data (from user)
const bybitTrades = [
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.4, entry: 1.1748, exit: 1.1363, pnl: 1.05730061, time: '2025-10-23 16:23:31' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.4, entry: 1.1748, exit: 1.1617, pnl: 0.34709116, time: '2025-10-23 15:52:07' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.4, entry: 1.1748, exit: 1.1676, pnl: 0.17949766, time: '2025-10-23 15:51:04' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.8, entry: 1.1582, exit: 1.1562, pnl: 0.02093989, time: '2025-10-23 15:25:27' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.7, entry: 1.1582, exit: 1.1481, pnl: 0.26499771, time: '2025-10-23 15:20:07' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 28.7, entry: 1.1582, exit: 1.1539, pnl: 0.09850443, time: '2025-10-23 15:19:53' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 58.5, entry: 1.1413, exit: 1.1396, pnl: 0.02606203, time: '2025-10-23 15:18:32' },
  { symbol: 'APEXUSDT', side: 'SHORT', qty: 29.2, entry: 1.1413, exit: 1.1342, pnl: 0.18236700, time: '2025-10-23 15:18:13' },
  { symbol: 'APEXUSDT', side: 'LONG', qty: 86.8, entry: 1.1517, exit: 1.1492, pnl: -0.32684497, time: '???' },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 BYBIT DATA ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Total Trades: ${bybitTrades.length}`);
console.log(`Total PnL (from Bybit): ${bybitTrades.reduce((sum, t) => sum + t.pnl, 0).toFixed(4)} USDT\n`);

console.log('───────────────────────────────────────────────────────────────');
console.log('🔍 KEY OBSERVATION:');
console.log('───────────────────────────────────────────────────────────────\n');

// Group by entry price to find partial closes
const groupedByEntry = bybitTrades.reduce((acc, trade) => {
  const key = `${trade.side}_${trade.entry}`;
  if (!acc[key]) {
    acc[key] = [];
  }
  acc[key].push(trade);
  return acc;
}, {} as Record<string, typeof bybitTrades>);

console.log('📍 PARTIAL CLOSES DETECTED:\n');

Object.entries(groupedByEntry).forEach(([key, trades]) => {
  if (trades.length > 1) {
    const [side, entry] = key.split('_');
    const totalQty = trades.reduce((sum, t) => sum + t.qty, 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);

    console.log(`${side} @ ${entry}:`);
    console.log(`  Total Quantity: ${totalQty.toFixed(1)} APEX`);
    console.log(`  Partial Closes: ${trades.length} times`);
    trades.forEach((t, i) => {
      console.log(`    TP${i + 1}: ${t.qty} APEX @ ${t.exit} = ${t.pnl.toFixed(4)} USDT`);
    });
    console.log(`  Total PnL: ${totalPnL.toFixed(4)} USDT\n`);
  }
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('💡 EXPLANATION:');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('⚠️  PARTIAL CLOSES vs FULL POSITION PnL:\n');
console.log('Bybit shows EACH partial close separately:');
console.log('  - TP1: 33.33% of position closed');
console.log('  - TP2: 33.33% of position closed');
console.log('  - TP3: 33.34% of position closed\n');

console.log('Our journal calculates FULL position PnL:');
console.log('  - Total quantity × price move × leverage\n');

console.log('Example: SHORT @ 1.1748');
console.log('  Bybit shows 3 separate closes:');
console.log('    TP1: 28.4 APEX @ 1.1676 = 0.1795 USDT');
console.log('    TP2: 28.4 APEX @ 1.1617 = 0.3471 USDT');
console.log('    TP3: 28.4 APEX @ 1.1363 = 1.0573 USDT');
console.log('    Total: 85.2 APEX, Total PnL: 1.5839 USDT\n');

console.log('Our journal would calculate:');
console.log('  Full position: 85.2 APEX × (1.1748 - 1.1363) × 10 = 32.81 USDT\n');

console.log('❓ WHY THE DIFFERENCE?');
console.log('───────────────────────────────────────────────────────────────');
console.log('Our formula assumes FULL position closed at FINAL exit price.');
console.log('But actually, position closed in 3 parts at DIFFERENT prices!\n');

console.log('Bybit calculation (correct):');
console.log('  = (1.1748 - 1.1676) × 28.4 × 10');
console.log('  + (1.1748 - 1.1617) × 28.4 × 10');
console.log('  + (1.1748 - 1.1363) × 28.4 × 10');
console.log('  = 0.1795 + 0.3471 + 1.0573');
console.log('  = 1.5839 USDT ✅\n');

console.log('Our calculation (wrong for partial closes):');
console.log('  = (1.1748 - 1.1363) × 85.2 × 10');
console.log('  = 32.81 USDT ❌ (assumes all closed at 1.1363)\n');
