const j = require('./data/trade-journal.json');

const losses = j.trades.filter(t => t.pnl < 0);

console.log(`\n📊 RSI/EMA Analysis of ${losses.length} Losing Trades:\n`);

losses.forEach((t, i) => {
  const ctx = t.entryContext || {};
  console.log(`LOSS #${i+1}: ${t.side} ${t.strategy}`);
  console.log(`  RSI: ${ctx.rsi || 'N/A'}`);
  console.log(`  EMA Fast: ${ctx.emaFast || 'N/A'}, Slow: ${ctx.emaSlow || 'N/A'}`);
  console.log(`  EMA Distance: ${ctx.emaDistance ? ctx.emaDistance.toFixed(2) + '%' : 'N/A'}`);
  console.log(`  ATR: ${ctx.atr ? ctx.atr.toFixed(2) + '%' : 'N/A'}`);
  console.log(`  Confidence: ${(t.confidence*100).toFixed(1)}%`);
  console.log(`  Entry: ${t.entryPrice}, Exit: ${t.exitPrice}`);
  console.log(`  PnL: ${t.pnl.toFixed(2)} USDT\n`);
});

// Summary stats
const avgRSI = losses
  .map(t => t.entryContext?.rsi)
  .filter(r => r !== undefined)
  .reduce((sum, r, i, arr) => sum + r / arr.length, 0);

const avgEmaDistance = losses
  .map(t => t.entryContext?.emaDistance)
  .filter(d => d !== undefined)
  .reduce((sum, d, i, arr) => sum + d / arr.length, 0);

console.log(`📊 SUMMARY:`);
console.log(`  Avg RSI at entry: ${avgRSI.toFixed(1)}`);
console.log(`  Avg EMA Distance: ${avgEmaDistance.toFixed(2)}%`);
console.log(`  Avg Confidence: ${(losses.reduce((sum, t) => sum + t.confidence, 0) / losses.length * 100).toFixed(1)}%`);
