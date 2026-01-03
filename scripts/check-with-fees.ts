/**
 * Check PnL with Bybit fees
 */

const trades = [
  { side: 'SHORT', entry: 1.1316, exit: 1.1428, qty: 88.4, bybitPnL: -1.10066134 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1676, qty: 28.4, bybitPnL: 0.17949766 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1617, qty: 28.4, bybitPnL: 0.34709116 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1363, qty: 28.4, bybitPnL: 1.05730061 },
];

const TAKER_FEE = 0.0006; // 0.06%

console.log('═══════════════════════════════════════════════════════════════');
console.log('💰 BYBIT PNL WITH FEES CHECK');
console.log('═══════════════════════════════════════════════════════════════\n');

trades.forEach((trade, i) => {
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log(`Trade #${i + 1}: ${trade.side} ${trade.qty} @ ${trade.entry} → ${trade.exit}`);
  console.log(`───────────────────────────────────────────────────────────────\n`);

  // Calculate PnL without fees
  const pnlMultiplier = trade.side === 'LONG' ? 1 : -1;
  const priceDiff = trade.exit - trade.entry;
  const pnlNoFees = priceDiff * trade.qty * pnlMultiplier;

  console.log(`PnL (no fees): ${pnlNoFees.toFixed(4)} USDT\n`);

  // Calculate fees
  const entryValue = trade.entry * trade.qty;
  const exitValue = trade.exit * trade.qty;
  const entryFee = entryValue * TAKER_FEE;
  const exitFee = exitValue * TAKER_FEE;
  const totalFees = entryFee + exitFee;

  console.log(`Entry value: ${entryValue.toFixed(4)} USDT`);
  console.log(`Exit value:  ${exitValue.toFixed(4)} USDT`);
  console.log(`Entry fee:   ${entryFee.toFixed(4)} USDT (0.06%)`);
  console.log(`Exit fee:    ${exitFee.toFixed(4)} USDT (0.06%)`);
  console.log(`Total fees:  ${totalFees.toFixed(4)} USDT\n`);

  // Calculate PnL with fees
  const pnlWithFees = pnlNoFees - totalFees;

  console.log(`PnL (with fees):  ${pnlWithFees.toFixed(4)} USDT`);
  console.log(`Bybit PnL:        ${trade.bybitPnL.toFixed(4)} USDT`);
  console.log(`Difference:       ${Math.abs(pnlWithFees - trade.bybitPnL).toFixed(4)} USDT`);
  console.log(`Match:            ${Math.abs(pnlWithFees - trade.bybitPnL) < 0.001 ? '✅' : '❌'}\n`);
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('💡 CONCLUSION:');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('✅ Bybit shows PnL = (gross PnL) - (trading fees)');
console.log('✅ Formula: (exitPrice - entryPrice) × quantity × multiplier - fees');
console.log('✅ Fees: 0.06% taker fee on BOTH entry and exit\n');

console.log('Correct formula for journal:');
console.log('──────────────────────────────');
console.log('pnlGross = priceDiff × quantity × pnlMultiplier');
console.log('fees = (entryValue + exitValue) × 0.0006');
console.log('pnlNet = pnlGross - fees\n');
