/**
 * Calculate Real Statistics from Bybit Data
 */

// All Bybit trades from today (user provided)
const bybitTrades = [
  // First position (LOSS)
  { side: 'SHORT', entry: 1.1316, exit: 1.1428, qty: 88.4, pnl: -1.10066134, time: '2025-10-23 07:10:02', type: 'STOP_LOSS' },

  // Position with 3 partial closes (TP1, TP2, TP3)
  { side: 'SHORT', entry: 1.1748, exit: 1.1676, qty: 28.4, pnl: 0.17949766, time: '2025-10-23 15:51:04', type: 'TP1' },
  { side: 'SHORT', entry: 1.1748, exit: 1.1617, qty: 28.4, pnl: 0.34709116, time: '2025-10-23 15:52:07', type: 'TP2' },
  { side: 'SHORT', entry: 1.1748, exit: 1.1363, qty: 28.4, pnl: 1.05730061, time: '2025-10-23 16:23:31', type: 'TP3' },

  // Position with 3 partial closes
  { side: 'SHORT', entry: 1.1582, exit: 1.1539, qty: 28.7, pnl: 0.09850443, time: '2025-10-23 15:19:53', type: 'TP1' },
  { side: 'SHORT', entry: 1.1582, exit: 1.1481, qty: 28.7, pnl: 0.26499771, time: '2025-10-23 15:20:07', type: 'TP2' },
  { side: 'SHORT', entry: 1.1582, exit: 1.1562, qty: 28.8, pnl: 0.02093989, time: '2025-10-23 15:25:27', type: 'TP?' },

  // Position with 2 partial closes
  { side: 'SHORT', entry: 1.1413, exit: 1.1396, qty: 58.5, pnl: 0.02606203, time: '2025-10-23 15:18:32', type: 'TP?' },
  { side: 'SHORT', entry: 1.1413, exit: 1.1342, qty: 29.2, pnl: 0.18236700, time: '2025-10-23 15:18:13', type: 'TP?' },

  // LONG position (LOSS)
  { side: 'LONG', entry: 1.1517, exit: 1.1492, qty: 86.8, pnl: -0.32684497, time: '???', type: 'STOP_LOSS' },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 REAL TRADING STATISTICS (from Bybit data)');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Date: 2025-10-23`);
console.log(`Total Trades (partials): ${bybitTrades.length}\n`);

// Calculate totals
const totalPnL = bybitTrades.reduce((sum, t) => sum + t.pnl, 0);
const wins = bybitTrades.filter(t => t.pnl > 0);
const losses = bybitTrades.filter(t => t.pnl < 0);

console.log('───────────────────────────────────────────────────────────────');
console.log('💰 PNL STATISTICS:');
console.log('───────────────────────────────────────────────────────────────\n');

console.log(`Total PnL:       ${totalPnL > 0 ? '✅' : '❌'} ${totalPnL.toFixed(4)} USDT`);
console.log(``);
console.log(`Wins:            ${wins.length} (${((wins.length / bybitTrades.length) * 100).toFixed(1)}%)`);
console.log(`Losses:          ${losses.length} (${((losses.length / bybitTrades.length) * 100).toFixed(1)}%)`);
console.log(``);

const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
const avgLoss = losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length;
const winLossRatio = Math.abs(avgWin / avgLoss);

console.log(`Avg Win:         +${avgWin.toFixed(4)} USDT`);
console.log(`Avg Loss:        ${avgLoss.toFixed(4)} USDT`);
console.log(`Win/Loss Ratio:  ${winLossRatio > 2 ? '✅' : '❌'} ${winLossRatio.toFixed(2)}x\n`);

// By side
const longTrades = bybitTrades.filter(t => t.side === 'LONG');
const shortTrades = bybitTrades.filter(t => t.side === 'SHORT');

console.log('───────────────────────────────────────────────────────────────');
console.log('📊 BY SIDE:');
console.log('───────────────────────────────────────────────────────────────\n');

const longPnL = longTrades.reduce((sum, t) => sum + t.pnl, 0);
const shortPnL = shortTrades.reduce((sum, t) => sum + t.pnl, 0);

console.log(`LONG:  ${longTrades.length} trades | PnL: ${longPnL.toFixed(4)} USDT`);
console.log(`SHORT: ${shortTrades.length} trades | PnL: ${shortPnL.toFixed(4)} USDT\n`);

// Group by position (unique entry prices)
console.log('───────────────────────────────────────────────────────────────');
console.log('🎯 BY POSITION (grouped by entry):');
console.log('───────────────────────────────────────────────────────────────\n');

const positions = bybitTrades.reduce((acc, trade) => {
  const key = `${trade.side}_${trade.entry}`;
  if (!acc[key]) {
    acc[key] = [];
  }
  acc[key].push(trade);
  return acc;
}, {} as Record<string, typeof bybitTrades>);

let positionIndex = 1;
Object.entries(positions).forEach(([key, trades]) => {
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const [side, entry] = key.split('_');

  console.log(`Position ${positionIndex}: ${side} @ ${entry}`);
  console.log(`  Closes: ${trades.length}x`);
  trades.forEach((t, i) => {
    console.log(`    ${i + 1}. ${t.qty} @ ${t.exit} = ${t.pnl > 0 ? '+' : ''}${t.pnl.toFixed(4)} USDT`);
  });
  console.log(`  Total PnL: ${totalPnL > 0 ? '✅' : '❌'} ${totalPnL.toFixed(4)} USDT\n`);
  positionIndex++;
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('💡 SUMMARY:');
console.log('═══════════════════════════════════════════════════════════════\n');

const uniquePositions = Object.keys(positions).length;
const winningPositions = Object.values(positions).filter(
  (trades) => trades.reduce((sum, t) => sum + t.pnl, 0) > 0
).length;

console.log(`Unique Positions:   ${uniquePositions}`);
console.log(`Winning Positions:  ${winningPositions} (${((winningPositions / uniquePositions) * 100).toFixed(1)}%)`);
console.log(`Losing Positions:   ${uniquePositions - winningPositions}`);
console.log(``);
console.log(`Net Result:         ${totalPnL > 0 ? '✅ PROFIT' : '❌ LOSS'} ${totalPnL.toFixed(2)} USDT\n`);

if (totalPnL > 0) {
  console.log('🎉 Profitable day!\n');
} else {
  console.log('⚠️  Unprofitable day - review strategy\n');
}
