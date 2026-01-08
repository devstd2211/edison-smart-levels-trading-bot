/**
 * Analyze why LONG R:R is too low
 */
import * as fs from 'fs';
import * as path from 'path';

const backestFile = path.join(
  __dirname,
  '../data/backtest/backtest_v2_2026-01-08T10-26-19-342Z.json'
);

console.log('📊 Analyzing LONG TP/SL configuration...\n');

const logSnippet = `
✅ LevelBased Level Pattern Found | {"direction":"LONG","levelPrice":"2.1693","levelType":"SUPPORT","touches":11,"strength":"0.40"}
📊 LevelBased Levels Detected | {"support":3,"resistance":2,"supportPrices":["2.1535","2.1693","2.1616"],"resistancePrices":["2.1782","2.1959"]}
⚠️ LevelBased R:R Gate BLOCKED - Signal rejected | {"rr":"0.07","risk":"1.00%","reward":"0.07%","recommendation":"R:R 0.07 < minimum 1.5. Skip trade."}
`;

console.log('Log Analysis:\n');
console.log('Support found: 2.1693 (11 touches, strength 0.40)');
console.log('Resistances found: 2.1782, 2.1959\n');

const supportPrice = 2.1693;
const nearestResistance = 2.1782;
const farthestResistance = 2.1959;

const entry = supportPrice;
const tp1Percent = 1.0; // 1% above entry
const tp2Percent = 2.0; // 2% above entry

const tp1Price = entry * (1 + tp1Percent / 100);
const tp2Price = entry * (1 + tp2Percent / 100);

const slPercent = 1.5; // 1.5% SL
const slPrice = entry * (1 - slPercent / 100);

console.log('TP/SL Calculation:');
console.log(`Entry: ${entry.toFixed(4)}`);
console.log(`TP1 (1.0%): ${tp1Price.toFixed(4)}`);
console.log(`TP2 (2.0%): ${tp2Price.toFixed(4)}`);
console.log(`SL (1.5%): ${slPrice.toFixed(4)}\n`);

console.log('Nearest Resistance: ' + nearestResistance.toFixed(4));
console.log(`Distance Support → Resistance: ${((nearestResistance - supportPrice) / supportPrice * 100).toFixed(2)}%\n`);

const riskDistance = entry - slPrice;
const rewardDistance1 = tp1Price - entry;
const rewardDistance2 = tp2Price - entry;
const resistanceDistance = nearestResistance - entry;

console.log('Reward Distances:');
console.log(`Risk (to SL): ${(riskDistance / entry * 100).toFixed(2)}%`);
console.log(`Reward TP1: ${(rewardDistance1 / entry * 100).toFixed(2)}%`);
console.log(`Reward TP2: ${(rewardDistance2 / entry * 100).toFixed(2)}%`);
console.log(`Nearest Resistance: ${(resistanceDistance / entry * 100).toFixed(2)}%\n`);

const rr1 = (rewardDistance1 / riskDistance).toFixed(2);
const rr2 = (rewardDistance2 / riskDistance).toFixed(2);
const rrResistance = (resistanceDistance / riskDistance).toFixed(2);

console.log('Risk/Reward Ratios:');
console.log(`TP1: ${rr1} (vs minimum 1.5 required)`);
console.log(`TP2: ${rr2}`);
console.log(`Nearest Resistance: ${rrResistance}\n`);

console.log('⚠️  ANALYSIS:\n');
console.log(`The R:R is low (${rr1}) because:`);
console.log(`1. TP levels (1-2%) are too close to Entry`);
console.log(`2. Support (2.1693) and Resistance (2.1782) are only ${((nearestResistance - supportPrice) / supportPrice * 100).toFixed(2)}% apart`);
console.log(`3. With 1.5% SL, we need 2.25%+ reward to achieve R:R 1.5`);
console.log(`\nSolutions:`);
console.log(`A) Use Resistance levels as TP instead of fixed percentages`);
console.log(`   - TP1 at Resistance 2.1782 = ${((nearestResistance - entry) / riskDistance).toFixed(2)} R:R ✓`);
console.log(`   - TP2 at Resistance 2.1959 = ${((farthestResistance - entry) / riskDistance).toFixed(2)} R:R ✓`);
console.log(`B) Increase ATR-based SL configuration to tighter SL`);
console.log(`C) Lower minimum R:R requirement from 1.5 to 0.5 or 0.7`);
