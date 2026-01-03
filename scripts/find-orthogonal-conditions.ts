/**
 * FIND ORTHOGONAL CONDITIONS
 *
 * Задача: Найти условия которые независимы от RSI 20-30
 * Логика: Если добавить условие которое не коррелирует, WR возрастет
 */

import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../data/pattern-validation/pattern-features-SOLUSDT-1h-2025-12-03T16-46-21-chunk-1-of-1.json');

console.log('\n' + '='.repeat(100));
console.log('🔍 FIND ORTHOGONAL CONDITIONS (independent from RSI 20-30)');
console.log('='.repeat(100) + '\n');

const features = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✅ Loaded ${features.length} features\n`);

interface TestResult {
  name: string;
  total: number;
  wins: number;
  losses: number;
  wr: number;
  rsi2030Overlap: number;  // сколько % из этого условия совпадает с RSI 20-30
  orthogonality: number;   // 0-100: 0 = полностью коррелирует, 100 = независимо
}

const rsi2030 = new Set(
  features
    .map((f: any, i: number) => f.technicalIndicators.rsi >= 20 && f.technicalIndicators.rsi <= 30 ? i : -1)
    .filter((i: number) => i !== -1)
);

console.log(`📌 Base condition: RSI 20-30 = ${rsi2030.size} samples\n`);

const results: TestResult[] = [];

// Test 1: Stochastic K <30 (oversold)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.stochasticK < 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'Stochastic K < 30',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 2: Stochastic K 20-30
{
  const filtered = features.filter((f: any) => f.technicalIndicators.stochasticK >= 20 && f.technicalIndicators.stochasticK <= 30);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'Stochastic K 20-30',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 3: Bollinger Band (price below lower band)
{
  const filtered = features.filter((f: any) => f.technicalIndicators.bollingerBandPosition === 'BELOW_LOWER');
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'Bollinger Band - BELOW LOWER',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 4: Bollinger Band distance (far from middle)
{
  const filtered = features.filter((f: any) => Math.abs(f.technicalIndicators.bollingerBandDistance) > 2.0);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'Bollinger Band - FAR FROM MIDDLE (>2.0)',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 5: High ATR (volatile)
{
  const filtered = features.filter((f: any) => f.volatility?.atrPercent > 2.0);
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'High ATR (>2.0%)',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 6: Multiple timeframe confirmation (EMA BELOW on both 1h and 5m)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.emaTrend === 'BELOW' &&
    f.rsiMultiframe?.rsi5m < 30
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'EMA BELOW + RSI5m < 30',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 7: Price action (has engulfing or doji recently)
{
  const filtered = features.filter((f: any) =>
    f.chartPatterns?.engulfingBullish ||
    f.chartPatterns?.engulfingBearish
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'Engulfing Pattern (any)',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Test 8: Volume context (was rising + now RSI low = smart money selling?)
{
  const filtered = features.filter((f: any) =>
    f.technicalIndicators.rsi < 30 &&
    f.volatility?.volatilityRegime === 'LOW'
  );
  const wins = filtered.filter((f: any) => f.label === 'WIN').length;
  const overlap = filtered.filter((f: any, i: number) => rsi2030.has(i)).length;

  results.push({
    name: 'RSI <30 + VOL LOW',
    total: filtered.length,
    wins,
    losses: filtered.length - wins,
    wr: filtered.length > 0 ? (wins / filtered.length) * 100 : 0,
    rsi2030Overlap: overlap,
    orthogonality: overlap > 0 ? ((filtered.length - overlap) / filtered.length) * 100 : 100,
  });
}

// Print results sorted by orthogonality (высокая ортогональность = независимое условие)
console.log('CONDITION                               | SAMPLES | WR %  | OVERLAP % | ORTHOGONAL %');
console.log('-'.repeat(100));

results.sort((a, b) => b.orthogonality - a.orthogonality);

for (const r of results) {
  const name = r.name.padEnd(40);
  const samples = String(r.total).padStart(6);
  const wr = r.wr.toFixed(1).padStart(5);
  const overlap = r.rsi2030Overlap.toString().padStart(8);
  const ortho = r.orthogonality.toFixed(1).padStart(10);

  const marker = r.orthogonality > 80 ? '✅' : r.orthogonality > 50 ? '⚠️ ' : '❌';

  console.log(`${marker} ${name} | ${samples} | ${wr}% | ${overlap}% | ${ortho}%`);
}

console.log('-'.repeat(100));
console.log('\n📊 RECOMMENDATIONS:\n');

const highOrtho = results.filter(r => r.orthogonality > 80);
const mediumOrtho = results.filter(r => r.orthogonality > 50 && r.orthogonality <= 80);

if (highOrtho.length > 0) {
  console.log('✅ HIGHLY ORTHOGONAL CONDITIONS (can add to RSI 20-30):');
  highOrtho.forEach(r => {
    console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% WR, ${r.orthogonality.toFixed(1)}% independent`);
  });
  console.log('');
}

if (mediumOrtho.length > 0) {
  console.log('⚠️  MEDIUM ORTHOGONAL (may help but correlated):');
  mediumOrtho.forEach(r => {
    console.log(`   - ${r.name}: ${r.wr.toFixed(1)}% WR, ${r.orthogonality.toFixed(1)}% independent`);
  });
  console.log('');
}

// Test combo with best orthogonal conditions
const bestOrtho = results.filter(r => r.orthogonality > 80).sort((a, b) => b.wr - a.wr)[0];

if (bestOrtho && bestOrtho.wr > 50.5) {
  console.log(`\n🚀 TRY THIS COMBO:\n`);
  console.log(`   RSI 20-30 (54.1%) + ${bestOrtho.name} (${bestOrtho.wr.toFixed(1)}%)`);
  console.log(`   Expected combined WR: ~55-56%+ if truly independent\n`);
}

console.log('='.repeat(100) + '\n');
