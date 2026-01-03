/**
 * INSPECT DATA STRUCTURE
 *
 * Посмотрим что реально есть в данных
 */

import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, '../data/pattern-validation/pattern-features-SOLUSDT-1h-2025-12-03T16-46-21-chunk-1-of-1.json');

console.log('\n' + '='.repeat(100));
console.log('🔍 INSPECT DATA STRUCTURE');
console.log('='.repeat(100) + '\n');

const features = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
console.log(`✅ Loaded ${features.length} features\n`);

// Show first 3 features
console.log('📋 FIRST 3 FEATURES:\n');
for (let i = 0; i < Math.min(3, features.length); i++) {
  const f = features[i];
  console.log(`\n--- Feature ${i + 1} ---`);
  console.log(JSON.stringify(f, null, 2).slice(0, 1500) + '...\n');
}

// Check which properties exist and what values they have
console.log('\n' + '='.repeat(100));
console.log('📊 PROPERTY ANALYSIS:\n');

const props: Record<string, Set<any>> = {};

features.slice(0, 100).forEach((f: any) => {
  // Top-level properties
  Object.keys(f).forEach(key => {
    if (!props[`${key} (top)`]) props[`${key} (top)`] = new Set();
    if (typeof f[key] !== 'object') {
      props[`${key} (top)`].add(String(f[key]).slice(0, 30));
    }
  });

  // technicalIndicators
  if (f.technicalIndicators) {
    Object.keys(f.technicalIndicators).forEach(key => {
      if (!props[`technicalIndicators.${key}`]) props[`technicalIndicators.${key}`] = new Set();
      const val = f.technicalIndicators[key];
      if (typeof val === 'number') {
        props[`technicalIndicators.${key}`].add(`[number: ${val.toFixed(2)}]`);
      } else {
        props[`technicalIndicators.${key}`].add(String(val));
      }
    });
  }

  // volatility
  if (f.volatility) {
    Object.keys(f.volatility).forEach(key => {
      if (!props[`volatility.${key}`]) props[`volatility.${key}`] = new Set();
      const val = f.volatility[key];
      if (typeof val === 'number') {
        props[`volatility.${key}`].add(`[number: ${val.toFixed(2)}]`);
      } else {
        props[`volatility.${key}`].add(String(val));
      }
    });
  }

  // chartPatterns
  if (f.chartPatterns) {
    Object.keys(f.chartPatterns).forEach(key => {
      if (!props[`chartPatterns.${key}`]) props[`chartPatterns.${key}`] = new Set();
      props[`chartPatterns.${key}`].add(String(f.chartPatterns[key]));
    });
  }
});

Object.keys(props)
  .sort()
  .forEach(key => {
    const values = Array.from(props[key]).slice(0, 5);
    console.log(`✅ ${key}`);
    console.log(`   Values: ${values.join(', ')}`);
  });

console.log('\n' + '='.repeat(100) + '\n');
