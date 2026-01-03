/**
 * Analyze SL distances from entry
 */

import * as fs from 'fs';
import * as path from 'path';

const journalPath = path.join(__dirname, '..', 'data', 'trade-journal.json');
const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));

console.log("=== АНАЛИЗ SL РАССТОЯНИЙ (сегодняшние сделки) ===\n");

const slDistances: number[] = [];
const entryDistances: number[] = [];

journal.forEach((trade: any, i: number) => {
  const entry = trade.entryPrice;
  const sl = trade.entryCondition.signal.stopLoss;

  const levelMatch = trade.entryCondition.signal.reason.match(/level ([\d.]+)/);
  const level = parseFloat(levelMatch[1]);

  const slDist = Math.abs((sl - entry) / entry * 100);
  const entryDist = Math.abs((entry - level) / level * 100);

  slDistances.push(slDist);
  entryDistances.push(entryDist);

  const exitType = trade.exitCondition.exitType;
  const pnl = trade.realizedPnL;
  const icon = trade.exitCondition.stoppedOut ? '❌' : '✅';

  console.log(`Trade ${i+1}: ${icon} ${exitType}`);
  console.log(`  Entry: ${entry.toFixed(4)} | Level: ${level.toFixed(4)} | SL: ${sl.toFixed(4)}`);
  console.log(`  Entry → Level: ${entryDist.toFixed(3)}% (max allowed 0.5%)`);
  console.log(`  Entry → SL: ${slDist.toFixed(3)}%`);
  console.log(`  PnL: ${pnl.toFixed(2)} USDT`);
  console.log();
});

console.log("=== СТАТИСТИКА SL РАССТОЯНИЙ ===");
console.log(`SL Distance from Entry:`);
console.log(`  Min: ${Math.min(...slDistances).toFixed(3)}%`);
console.log(`  Max: ${Math.max(...slDistances).toFixed(3)}%`);
console.log(`  Avg: ${(slDistances.reduce((a,b) => a+b, 0) / slDistances.length).toFixed(3)}%`);
console.log();
console.log(`Entry Distance from Level:`);
console.log(`  Min: ${Math.min(...entryDistances).toFixed(3)}%`);
console.log(`  Max: ${Math.max(...entryDistances).toFixed(3)}%`);
console.log(`  Avg: ${(entryDistances.reduce((a,b) => a+b, 0) / entryDistances.length).toFixed(3)}%`);

console.log(`\n=== ВЫВОДЫ ===`);
const avgSlDist = slDistances.reduce((a,b) => a+b, 0) / slDistances.length;
const avgEntryDist = entryDistances.reduce((a,b) => a+b, 0) / entryDistances.length;

if (avgEntryDist <= 0.5) {
  console.log(`✅ Entry distance OK (${avgEntryDist.toFixed(3)}% <= 0.5%)`);
} else {
  console.log(`❌ Entry distance TOO WIDE (${avgEntryDist.toFixed(3)}% > 0.5%)`);
}

if (avgSlDist <= 1.0) {
  console.log(`✅ SL distance OK (${avgSlDist.toFixed(3)}% <= 1.0%)`);
} else {
  console.log(`⚠️  SL distance WIDE (${avgSlDist.toFixed(3)}% > 1.0%)`);
}
