/**
 * Check Bybit PnL Formula
 */

const trades = [
  { side: 'SHORT', entry: 1.1316, exit: 1.1428, qty: 88.4, bybitPnL: -1.10066134 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1676, qty: 28.4, bybitPnL: 0.17949766 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1617, qty: 28.4, bybitPnL: 0.34709116 },
  { side: 'SHORT', entry: 1.1748, exit: 1.1363, qty: 28.4, bybitPnL: 1.05730061 },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 BYBIT PNL FORMULA CHECK');
console.log('═══════════════════════════════════════════════════════════════\n');

trades.forEach((trade, i) => {
  console.log(`───────────────────────────────────────────────────────────────`);
  console.log(`Trade #${i + 1}: ${trade.side} ${trade.qty} @ ${trade.entry} → ${trade.exit}`);
  console.log(`───────────────────────────────────────────────────────────────\n`);

  // Formula 1: With leverage
  const pnlWithLeverage = (trade.exit - trade.entry) * trade.qty * -1 * 10;
  console.log(`Formula 1: (exit - entry) × qty × -1 × 10`);
  console.log(`         = ${pnlWithLeverage.toFixed(4)} USDT`);
  console.log(`Match:     ${Math.abs(pnlWithLeverage - trade.bybitPnL) < 0.01 ? '✅' : '❌'}\n`);

  // Formula 2: Without leverage
  const pnlWithoutLeverage = (trade.exit - trade.entry) * trade.qty * -1;
  console.log(`Formula 2: (exit - entry) × qty × -1`);
  console.log(`         = ${pnlWithoutLeverage.toFixed(4)} USDT`);
  console.log(`Match:     ${Math.abs(pnlWithoutLeverage - trade.bybitPnL) < 0.01 ? '✅' : '❌'}\n`);

  // Formula 3: Absolute difference
  const pnlAbsolute = Math.abs(trade.exit - trade.entry) * trade.qty;
  const pnlSigned = trade.exit > trade.entry ? -pnlAbsolute : pnlAbsolute;
  console.log(`Formula 3: |exit - entry| × qty × sign`);
  console.log(`         = ${pnlSigned.toFixed(4)} USDT`);
  console.log(`Match:     ${Math.abs(pnlSigned - trade.bybitPnL) < 0.01 ? '✅' : '❌'}\n`);

  console.log(`Bybit PnL: ${trade.bybitPnL.toFixed(4)} USDT\n`);
});

console.log('═══════════════════════════════════════════════════════════════');
console.log('💡 CONCLUSION:');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Bybit shows PnL WITHOUT leverage multiplier!');
console.log('Correct formula: (exit - entry) × quantity × direction_multiplier');
console.log('Where direction_multiplier: LONG = +1, SHORT = -1\n');

console.log('⚠️  Leverage affects MARGIN, not PnL display!');
console.log('10x leverage means:');
console.log('  - You only need 10% margin');
console.log('  - But PnL shown is for FULL position value (no 10x multiplier)\n');
