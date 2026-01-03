/**
 * ПРОСТОЙ ТЕСТ: Какие конкретные условия имеют win rate > 50%?
 */

import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../data/pattern-validation/pattern-features-SOLUSDT-1h-2025-12-03T16-46-21-chunk-1-of-1.json');

console.log('\n='.repeat(100));
console.log('🔍 SIMPLE STRUCTURE TEST - Find conditions with >50% WR');
console.log('='.repeat(100) + '\n');

const features = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✅ Loaded ${features.length} features\n`);

interface Result {
  name: string;
  count: number;
  wins: number;
  wr: number;
}

const results: Result[] = [];

// Test 1: High RSI (>70)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi > 70);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI > 70 (overbought)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 2: Low RSI (<30)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi < 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI < 30 (oversold)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 3: RSI 20-30
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi >= 20 && f.technicalIndicators.rsi <= 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI 20-30 (extreme oversold)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 4: EMA above (bullish)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.emaTrend === 'ABOVE');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'EMA trend ABOVE (bullish)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 5: EMA below (bearish)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.emaTrend === 'BELOW');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'EMA trend BELOW (bearish)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 6: Volatility LOW
{
  const filtered = features.filter((f: any) => f.volatility?.volatilityRegime === 'LOW');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Volatility LOW (flat)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 7: Volatility HIGH
{
  const filtered = features.filter((f: any) => f.volatility?.volatilityRegime === 'HIGH');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Volatility HIGH (trending)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 8: Has engulfing bullish
{
  const filtered = features.filter((f: any) => f.chartPatterns?.engulfingBullish);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Engulfing Bullish pattern',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 9: RSI extreme (>70 or <30)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi > 70 || f.technicalIndicators.rsi < 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI Extreme (>70 or <30)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 10: RSI neutral (40-60)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi >= 40 && f.technicalIndicators.rsi <= 60);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI Neutral (40-60)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 11: EMA ABOVE + RSI <30
{
  const filtered = features.filter((f: any) => f.technicalIndicators.emaTrend === 'ABOVE' && f.technicalIndicators.rsi < 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'EMA ABOVE + RSI <30 (confluence)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 12: Stochastic K > 80
{
  const filtered = features.filter((f: any) => f.technicalIndicators.stochasticK > 80);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Stochastic K > 80 (overbought)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// 🔥 TEST COMBINATIONS (confluence)

// Combo 1: RSI 20-30 + EMA BELOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi >= 20 && f.technicalIndicators.rsi <= 30 &&
    f.technicalIndicators.emaTrend === 'BELOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI 20-30 + EMA BELOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 2: RSI <30 + VOL LOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 30 &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <30 + VOL LOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 3: RSI 20-30 + VOL LOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi >= 20 && f.technicalIndicators.rsi <= 30 &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI 20-30 + VOL LOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 4: EMA BELOW + VOL LOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.emaTrend === 'BELOW' &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] EMA BELOW + VOL LOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 5: RSI 20-30 + EMA BELOW + VOL LOW (triple)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi >= 20 && f.technicalIndicators.rsi <= 30 &&
    f.technicalIndicators.emaTrend === 'BELOW' &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI 20-30 + EMA BELOW + VOL LOW ⭐',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 6: RSI <30 + EMA BELOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 30 &&
    f.technicalIndicators.emaTrend === 'BELOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <30 + EMA BELOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 7: RSI <30 + EMA BELOW + VOL LOW
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 30 &&
    f.technicalIndicators.emaTrend === 'BELOW' &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <30 + EMA BELOW + VOL LOW',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 8: RSI <30 + Engulfing Bullish (reversal signal)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 30 &&
    f.chartPatterns?.engulfingBullish
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <30 + Engulfing Bullish',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Print results
console.log('CONDITION                                    | COUNT | WINS | WR %');
console.log('-'.repeat(75));

results.sort((a, b) => b.wr - a.wr);

for (const r of results) {
  const name = r.name.padEnd(45);
  const count = String(r.count).padStart(5);
  const wins = String(r.wins).padStart(5);
  const wr = r.wr.toFixed(1).padStart(5);

  const marker = r.wr > 50.5 ? '✅' : r.wr < 49.5 ? '❌' : '⚠️ ';

  console.log(`${marker} ${name} | ${count} | ${wins} | ${wr}%`);
}

console.log('-'.repeat(75));
console.log('\n📊 SUMMARY:');

const withEdge = results.filter(r => r.count > 50 && r.wr > 50.5);
const againstEdge = results.filter(r => r.count > 50 && r.wr < 49.5);

console.log(`✅ Conditions with EDGE (>50.5% WR): ${withEdge.length}`);
withEdge.forEach(r => console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% (${r.count} samples)`));

console.log(`\n❌ Conditions against EDGE (<49.5% WR): ${againstEdge.length}`);
againstEdge.forEach(r => console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% (${r.count} samples)`));

console.log(`\n🎯 CONCLUSION:`);
if (withEdge.length === 0) {
  console.log('   No single condition has >50.5% edge in this dataset');
  console.log('   Need to combine multiple conditions (confluence)');
} else {
  console.log(`   Found ${withEdge.length} conditions with positive edge`);
  console.log(`   Could build system around these`);
}

console.log('\n' + '='.repeat(100) + '\n');
