const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'whale-calibration-2025-11-18.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('Total configs tested:', data.length);
console.log('\nTop 5 configs by R/R:\n');

const top5 = data.slice(0, 5);
top5.forEach((r, i) => {
  console.log(`${i+1}. R/R ${r.metrics.rrRatio.toFixed(2)}x | WR ${r.metrics.winRate.toFixed(1)}% | PnL ${r.metrics.netPnlUsdt.toFixed(2)} USDT`);
  console.log(`   TP: ${r.params.takeProfitPercent}% | SL: ${r.params.stopLossAtrMultiplier}x ATR`);
  console.log(`   Confidence LONG: ${r.params.minConfidenceLong}% | SHORT: ${r.params.minConfidenceShort}%`);
  console.log(`   WALL_BREAK: ${r.params.wallBreakEnabled ? 'ON' : 'OFF'} | DISAPPEAR: ${r.params.wallDisappearanceEnabled ? 'ON' : 'OFF'}`);
  console.log(`   Trades: ${r.metrics.totalTrades} (LONG: ${r.metrics.longTrades} WR:${r.metrics.longWinRate.toFixed(1)}% | SHORT: ${r.metrics.shortTrades})`);
  console.log();
});

console.log('\n=== BEST CONFIG (Rank #1) ===\n');
const best = data[0];
console.log(JSON.stringify(best.params, null, 2));
