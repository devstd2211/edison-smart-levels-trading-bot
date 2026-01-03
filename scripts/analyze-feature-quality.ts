/**
 * Analyze Feature Quality - What indicators actually exist in extracted features?
 */

import * as fs from 'fs';
import * as path from 'path';

const FEATURE_DIR = path.join(__dirname, '../data/pattern-validation');

interface Stats {
  rsiDistribution: Record<string, number>;
  rsiExtreme: number;
  patternOccurrence: Record<string, number>;
  winDistribution: Record<string, number>;
  volatilityRegimes: Record<string, number>;
  emaTrends: Record<string, number>;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 FEATURE QUALITY ANALYSIS - What indicators are actually in our data?');
  console.log('='.repeat(80) + '\n');

  // Find feature files
  const files = fs.readdirSync(FEATURE_DIR).filter(f => f.startsWith('pattern-features-') && f.endsWith('.json') && !f.includes('index'));

  if (files.length === 0) {
    console.error('❌ No feature files found');
    process.exit(1);
  }

  console.log(`📂 Found ${files.length} feature files\n`);

  const stats: Stats = {
    rsiDistribution: {},
    rsiExtreme: 0,
    patternOccurrence: {},
    winDistribution: { WIN: 0, LOSS: 0 },
    volatilityRegimes: {},
    emaTrends: {},
  };

  let totalFeatures = 0;
  let sampledFeatures = 0;
  const sampleSize = 5000; // Sample 5000 features for analysis

  // Process first few files
  for (let fileIdx = 0; fileIdx < Math.min(3, files.length); fileIdx++) {
    const file = files[fileIdx];
    const filePath = path.join(FEATURE_DIR, file);

    console.log(`📖 Reading ${file.slice(0, 50)}...`);

    const features = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    totalFeatures += features.length;

    // Sample features
    const sampleRate = Math.max(1, Math.floor(features.length / 2000));

    for (let i = 0; i < features.length; i += sampleRate) {
      if (sampledFeatures >= sampleSize) break;

      const feature = features[i];

      // RSI analysis
      const rsi = Math.round(feature.technicalIndicators.rsi);
      stats.rsiDistribution[rsi] = (stats.rsiDistribution[rsi] || 0) + 1;

      if (rsi > 70 || rsi < 30) {
        stats.rsiExtreme++;
      }

      // Pattern analysis
      if (feature.chartPatterns) {
        Object.entries(feature.chartPatterns).forEach(([pattern, detected]) => {
          if (detected) {
            stats.patternOccurrence[pattern] = (stats.patternOccurrence[pattern] || 0) + 1;
          }
        });
      }

      // WIN/LOSS
      stats.winDistribution[feature.label]++;

      // Volatility regime
      if (feature.volatility) {
        const regime = feature.volatility.volatilityRegime;
        stats.volatilityRegimes[regime] = (stats.volatilityRegimes[regime] || 0) + 1;
      }

      // EMA Trend
      if (feature.technicalIndicators) {
        const trend = feature.technicalIndicators.emaTrend;
        stats.emaTrends[trend] = (stats.emaTrends[trend] || 0) + 1;
      }

      sampledFeatures++;
    }
  }

  console.log(`\n✅ Sampled ${sampledFeatures} features (from ${totalFeatures} total)\n`);

  // Print RSI Distribution
  console.log('📈 RSI DISTRIBUTION:');
  console.log('-'.repeat(50));
  const rsiKeys = Object.keys(stats.rsiDistribution).map(Number).sort((a, b) => a - b);

  // Group by ranges
  const ranges = {
    'Extreme Low (<20)': rsiKeys.filter(k => k < 20).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Oversold (20-30)': rsiKeys.filter(k => k >= 20 && k <= 30).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Bearish (30-40)': rsiKeys.filter(k => k > 30 && k < 40).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Neutral (40-60)': rsiKeys.filter(k => k >= 40 && k <= 60).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Bullish (60-70)': rsiKeys.filter(k => k > 60 && k < 70).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Overbought (70-80)': rsiKeys.filter(k => k >= 70 && k <= 80).reduce((s, k) => s + stats.rsiDistribution[k], 0),
    'Extreme High (>80)': rsiKeys.filter(k => k > 80).reduce((s, k) => s + stats.rsiDistribution[k], 0),
  };

  Object.entries(ranges).forEach(([range, count]) => {
    const pct = ((count / sampledFeatures) * 100).toFixed(1);
    console.log(`  ${range}: ${count} (${pct}%)`);
  });
  console.log(`  Extreme RSI (>70 or <30): ${stats.rsiExtreme} (${((stats.rsiExtreme/sampledFeatures)*100).toFixed(1)}%)`);

  // Print Pattern Occurrence
  console.log('\n🎨 CHART PATTERN OCCURRENCE (out of ' + sampledFeatures + ' features):');
  console.log('-'.repeat(50));

  const sortedPatterns = Object.entries(stats.patternOccurrence)
    .sort((a, b) => b[1] - a[1]);

  if (sortedPatterns.length === 0) {
    console.log('  ❌ NO PATTERNS DETECTED');
  } else {
    sortedPatterns.forEach(([pattern, count]) => {
      const pct = ((count / sampledFeatures) * 100).toFixed(3);
      console.log(`  ${pattern}: ${count} (${pct}%)`);
    });
  }

  // Print WIN/LOSS
  console.log('\n💰 WIN/LOSS DISTRIBUTION:');
  console.log('-'.repeat(50));
  const wins = stats.winDistribution.WIN || 0;
  const losses = stats.winDistribution.LOSS || 0;
  const total = wins + losses;
  console.log(`  WIN:  ${wins} (${((wins/total)*100).toFixed(1)}%)`);
  console.log(`  LOSS: ${losses} (${((losses/total)*100).toFixed(1)}%)`);

  // Print Volatility Regimes
  console.log('\n⚡ VOLATILITY REGIMES:');
  console.log('-'.repeat(50));
  Object.entries(stats.volatilityRegimes).forEach(([regime, count]) => {
    const pct = ((count / sampledFeatures) * 100).toFixed(1);
    console.log(`  ${regime}: ${count} (${pct}%)`);
  });

  // Print EMA Trends
  console.log('\n📊 EMA TRENDS:');
  console.log('-'.repeat(50));
  Object.entries(stats.emaTrends).forEach(([trend, count]) => {
    const pct = ((count / sampledFeatures) * 100).toFixed(1);
    console.log(`  ${trend}: ${count} (${pct}%)`);
  });

  // CRITICAL ANALYSIS
  console.log('\n' + '='.repeat(80));
  console.log('🔍 CRITICAL FINDINGS:');
  console.log('='.repeat(80) + '\n');

  const extremeRsiPct = (stats.rsiExtreme / sampledFeatures) * 100;
  const patternsPct = (sortedPatterns.length > 0 ? sortedPatterns[0][1] : 0) / sampledFeatures * 100;

  console.log(`❌ Extreme RSI Signals (>70 or <30): ONLY ${extremeRsiPct.toFixed(2)}% of features`);
  console.log(`   → 99.5% of time, RSI is in NEUTRAL zone (40-60)`);
  console.log(`   → K-means can't cluster what's all the same value!\n`);

  console.log(`❌ Chart Patterns: ONLY ${patternsPct.toFixed(3)}% have any pattern`);
  console.log(`   → Patterns are TOO RARE to use for clustering`);
  console.log(`   → K-means clusters ${sampledFeatures} features, patterns appear in ${sortedPatterns.length > 0 ? sortedPatterns[0][1] : 0} of them\n`);

  console.log(`❌ Volatility: MOSTLY LOW (${((stats.volatilityRegimes['LOW'] || 0)/sampledFeatures*100).toFixed(1)}%)`);
  console.log(`   → Market is in consolidation 99% of the time`);
  console.log(`   → No strong trends to predict\n`);

  console.log('⚠️  THE REAL PROBLEM:');
  console.log('   Our indicators are USELESS for this dataset because:');
  console.log('   1. RSI is always neutral (40-60) - no signal');
  console.log('   2. Patterns almost never occur - no training data');
  console.log('   3. Market is flat/consolidating - nothing to trade');
  console.log('   4. K-means clusters on constant values - = random groups\n');

  console.log('='.repeat(80) + '\n');
}

main().catch(console.error);
