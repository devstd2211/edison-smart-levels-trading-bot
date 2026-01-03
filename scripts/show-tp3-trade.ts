import * as fs from 'fs';

const journal = JSON.parse(fs.readFileSync('data/trade-journal.json', 'utf-8'));
const tp3Trade = journal.find((t: any) => t.exitCondition?.exitType === 'TAKE_PROFIT_3');

console.log('═══════════════════════════════════════════════════════════════');
console.log('🎯 TP3 TRADE ANALYSIS');
console.log('═══════════════════════════════════════════════════════════════\n');

if (!tp3Trade) {
  console.log('No TP3 trade found');
  process.exit(0);
}

console.log(`ID: ${tp3Trade.id}`);
console.log(`Side: ${tp3Trade.side}`);
console.log(`Entry: ${tp3Trade.entryPrice}`);
console.log(`Exit: ${tp3Trade.exitPrice}`);
console.log(`Stop Loss: ${tp3Trade.entryCondition.signal.stopLoss}`);
console.log(``);
console.log(`Entry Reason: ${tp3Trade.entryCondition.signal.reason}`);
console.log(`Confidence: ${(tp3Trade.entryCondition.signal.confidence * 100).toFixed(1)}%`);
console.log(``);
console.log(`TP Levels Hit: ${tp3Trade.exitCondition.tpLevelsHit.join(', ')}`);
console.log(`Holding Time: ${tp3Trade.exitCondition.holdingTimeMinutes.toFixed(1)} min`);
console.log(``);
console.log(`✅ PROFIT: ${tp3Trade.realizedPnL.toFixed(2)} USDT (${tp3Trade.exitCondition.pnlPercent.toFixed(2)}%)`);
console.log(``);
console.log('Take Profit Prices:');
tp3Trade.entryCondition.signal.takeProfits.forEach((tp: any) => {
  console.log(`   TP${tp.level}: ${tp.price} (${tp.percent}%)`);
});
