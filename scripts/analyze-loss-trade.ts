/**
 * Analyze Large Loss Trade
 */

const trade = {
  side: 'SHORT',
  entry: 1.1316,
  exit: 1.1428,
  qty: 88.4,
  leverage: 10,
  bybitPnL: -1.10066134,
};

console.log('═══════════════════════════════════════════════════════════════');
console.log('❌ LARGE LOSS TRADE ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log(`Side:     ${trade.side}`);
console.log(`Entry:    ${trade.entry} (sold SHORT)`);
console.log(`Exit:     ${trade.exit} (bought back)`);
console.log(`Quantity: ${trade.qty} APEX`);
console.log(`Leverage: ${trade.leverage}x\n`);

console.log('───────────────────────────────────────────────────────────────');
console.log('📊 PRICE MOVEMENT:');
console.log('───────────────────────────────────────────────────────────────\n');

const priceDiff = trade.exit - trade.entry;
const movePercent = (priceDiff / trade.entry) * 100;

console.log(`Price Diff:  ${priceDiff.toFixed(6)}`);
console.log(`Direction:   PRICE WENT UP ⬆️  (bad for SHORT)`);
console.log(`Move:        +${movePercent.toFixed(2)}%\n`);

console.log('───────────────────────────────────────────────────────────────');
console.log('💰 PNL CALCULATION:');
console.log('───────────────────────────────────────────────────────────────\n');

const pnlMultiplier = trade.side === 'LONG' ? 1 : -1;
const calculatedPnL = priceDiff * trade.qty * pnlMultiplier * trade.leverage;

console.log(`Formula: priceDiff × qty × multiplier × leverage`);
console.log(`       = ${priceDiff.toFixed(6)} × ${trade.qty} × ${pnlMultiplier} × ${trade.leverage}`);
console.log(`       = ${calculatedPnL.toFixed(6)} USDT\n`);

console.log(`Bybit PnL:     ${trade.bybitPnL.toFixed(4)} USDT`);
console.log(`Our calc:      ${calculatedPnL.toFixed(4)} USDT`);
console.log(`Match:         ${Math.abs(calculatedPnL - trade.bybitPnL) < 0.01 ? '✅' : '❌'}\n`);

console.log('───────────────────────────────────────────────────────────────');
console.log('🔍 WHY SO LARGE LOSS?');
console.log('───────────────────────────────────────────────────────────────\n');

// Calculate what SL should have been
const stopLossPercent = Math.abs(movePercent);
const expectedSL = trade.entry * (1 + stopLossPercent / 100);

console.log(`This is likely a STOP LOSS hit:\n`);
console.log(`Entry:        ${trade.entry}`);
console.log(`Stop Loss:    ${expectedSL.toFixed(4)} (~${stopLossPercent.toFixed(2)}% away)`);
console.log(`Exit Price:   ${trade.exit} (SL triggered)\n`);

console.log(`⚠️  Stop Loss was ${stopLossPercent.toFixed(2)}% from entry!`);

if (stopLossPercent > 1) {
  console.log(`❌ Stop Loss TOO WIDE! Should be 0.5-1% max`);
} else if (stopLossPercent < 0.5) {
  console.log(`⚠️  Stop Loss might be too tight (< 0.5%)`);
} else {
  console.log(`✅ Stop Loss distance is reasonable (0.5-1%)`);
}

console.log(`\n💡 With 10x leverage, ${stopLossPercent.toFixed(2)}% price move = ${(stopLossPercent * 10).toFixed(1)}% account loss\n`);

console.log('───────────────────────────────────────────────────────────────');
console.log('📋 CHECK IN JOURNAL:');
console.log('───────────────────────────────────────────────────────────────\n');

console.log(`Look for trade with:`);
console.log(`  - Entry: ~${trade.entry}`);
console.log(`  - Exit: ~${trade.exit}`);
console.log(`  - Side: SHORT`);
console.log(`  - exitType: STOP_LOSS`);
console.log(`  - Entry reason (to understand why signal was taken)\n`);
