/**
 * FIND REAL EDGE
 *
 * После анализа структуры - ищем что реально дает >54% WR
 * Используем только доступные properties
 */

import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../data/pattern-validation/pattern-features-SOLUSDT-1h-2025-12-03T16-46-21-chunk-1-of-1.json');

console.log('\n' + '='.repeat(100));
console.log('🔥 FIND REAL EDGE - All available properties tested');
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

// Test 1: RSI Trend DOWN (bearish trend)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsiTrend === 'DOWN');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI Trend DOWN',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 2: RSI Trend UP
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsiTrend === 'UP');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI Trend UP',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 3: MACD Histogram POSITIVE
{
  const filtered = features.filter((f: any) => f.technicalIndicators.macdHistogram > 0);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'MACD Histogram POSITIVE',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 4: MACD Histogram NEGATIVE
{
  const filtered = features.filter((f: any) => f.technicalIndicators.macdHistogram < 0);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'MACD Histogram NEGATIVE',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 5: MACD Trend POSITIVE
{
  const filtered = features.filter((f: any) => f.technicalIndicators.macdTrend === 'POSITIVE');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'MACD Trend POSITIVE',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 6: Order Flow BEARISH (smart money selling)
{
  const filtered = features.filter((f: any) => f.orderFlow?.microStructure === 'BEARISH');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Order Flow BEARISH',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 7: Order Flow BULLISH
{
  const filtered = features.filter((f: any) => f.orderFlow?.microStructure === 'BULLISH');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Order Flow BULLISH',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 8: Bid Ask Imbalance NEGATIVE (selling pressure)
{
  const filtered = features.filter((f: any) => f.orderFlow?.bidAskImbalance < -0.5);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'BidAskImbalance < -0.5 (sellers)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 9: Bid Ask Imbalance POSITIVE (buying pressure)
{
  const filtered = features.filter((f: any) => f.orderFlow?.bidAskImbalance > 0.5);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'BidAskImbalance > 0.5 (buyers)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 10: RSI < 40 (weak bullish/oversold)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.rsi < 40);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'RSI < 40 (weak)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 11: Bollinger Width LOW (tight bands, waiting to break)
{
  const filtered = features.filter((f: any) => f.volatility?.bollingerWidth < 0.05);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Bollinger Width < 0.05 (tight)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test 12: Bollinger Width HIGH (loose bands, volatile)
{
  const filtered = features.filter((f: any) => f.volatility?.bollingerWidth > 0.15);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: 'Bollinger Width > 0.15 (loose)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Test COMBINATIONS

// Combo 1: RSI <40 + Order Flow BEARISH (oversold + selling)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 40 &&
    f.orderFlow?.microStructure === 'BEARISH'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <40 + OrdFlow BEARISH',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 2: RSI <40 + MACD NEGATIVE
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 40 &&
    f.technicalIndicators.macdHistogram < 0
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI <40 + MACD NEG',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Combo 3: RSI Trend DOWN + MACD Trend POSITIVE (bullish divergence)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsiTrend === 'DOWN' &&
    f.technicalIndicators.macdTrend === 'POSITIVE'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  results.push({
    name: '[COMBO] RSI↓ + MACD↑ (DIV)',
    count: filtered.length,
    wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
  });
}

// Print results
console.log('CONDITION                              | COUNT | WINS | WR %');
console.log('-'.repeat(75));

results.sort((a, b) => b.wr - a.wr);

for (const r of results) {
  const name = r.name.padEnd(40);
  const count = String(r.count).padStart(5);
  const wins = String(r.wins).padStart(5);
  const wr = r.wr.toFixed(1).padStart(5);

  const marker = r.wr > 50.5 ? '✅' : r.wr < 49.5 ? '❌' : '⚠️ ';

  console.log(`${marker} ${name} | ${count} | ${wins} | ${wr}%`);
}

console.log('-'.repeat(75));
console.log('\n📊 SUMMARY:');

const withEdge = results.filter(r => r.count > 30 && r.wr > 50.5);
const againstEdge = results.filter(r => r.count > 30 && r.wr < 49.5);

console.log(`\n✅ CONDITIONS WITH EDGE (>50.5%): ${withEdge.length}`);
withEdge.forEach(r => console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% (${r.count} samples)`));

console.log(`\n❌ CONDITIONS AGAINST EDGE (<49.5%): ${againstEdge.length}`);
againstEdge.forEach(r => console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% (${r.count} samples)`));

console.log('\n🎯 KEY INSIGHT:');
if (withEdge.length > 0) {
  const best = withEdge[0];
  console.log(`   ${best.name} has REAL EDGE: ${best.wr.toFixed(1)}%`);
  console.log(`   This can be foundation for scalping strategy!\n`);
}

console.log('='.repeat(100) + '\n');
