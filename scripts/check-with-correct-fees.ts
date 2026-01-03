/**
 * Check PnL with correct Bybit fees (0.055%)
 */

const TAKER_FEE = 0.00055; // 0.055%

const trade = {
  side: 'SHORT',
  entry: 1.1316,
  exit: 1.1428,
  qty: 88.4,
  bybitPnL: -1.10066134
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('💰 BYBIT PNL WITH CORRECT FEES (0.055%)');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Trade: ${trade.side} ${trade.qty} APEX @ ${trade.entry} → ${trade.exit}\n`);

// Calculate PnL
const priceDiff = trade.exit - trade.entry;
const pnlMultiplier = trade.side === 'LONG' ? 1 : -1;
const pnlGross = priceDiff * trade.qty * pnlMultiplier;

console.log(`Price Diff:   ${priceDiff.toFixed(6)}`);
console.log(`PnL Gross:    ${pnlGross.toFixed(4)} USDT\n`);

// Calculate fees
const entryValue = trade.entry * trade.qty;
const exitValue = trade.exit * trade.qty;
const fees = (entryValue + exitValue) * TAKER_FEE;

console.log(`Entry Value:  ${entryValue.toFixed(4)} USDT`);
console.log(`Exit Value:   ${exitValue.toFixed(4)} USDT`);
console.log(`Fees (0.055%): ${fees.toFixed(4)} USDT\n`);

// Net PnL
const pnlNet = pnlGross - fees;

console.log(`PnL Net:      ${pnlNet.toFixed(4)} USDT`);
console.log(`Bybit PnL:    ${trade.bybitPnL.toFixed(4)} USDT`);
console.log(`Difference:   ${Math.abs(pnlNet - trade.bybitPnL).toFixed(4)} USDT`);
console.log(`Match:        ${Math.abs(pnlNet - trade.bybitPnL) < 0.01 ? '✅' : '❌'}\n`);

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 STOP LOSS ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Entry Price:       ${trade.entry}`);
console.log(`Stop Loss:         1.1418 (from journal)`);
console.log(`Actual Exit:       ${trade.exit}\n`);

const slippage = trade.exit - 1.1418;
const slippagePercent = (slippage / trade.entry) * 100;

if (Math.abs(slippage) > 0.0001) {
  console.log(`⚠️  SLIPPAGE DETECTED!`);
  console.log(`   Expected SL:    1.1418`);
  console.log(`   Actual Exit:    ${trade.exit}`);
  console.log(`   Slippage:       ${slippage.toFixed(4)} (${slippagePercent.toFixed(3)}%)\n`);

  if (slippage > 0) {
    console.log(`   Type: NEGATIVE slippage (worse exit for SHORT)`);
    console.log(`   Possible causes:`);
    console.log(`     - Price gapped up through stop loss`);
    console.log(`     - Low liquidity at stop loss level`);
    console.log(`     - Market order execution delay\n`);
  }
} else {
  console.log(`✅ No slippage - SL executed at expected price\n`);
}
