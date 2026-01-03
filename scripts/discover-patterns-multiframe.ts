/**
 * Multi-Timeframe ML Pattern Discovery - K-means clustering
 *
 * Advanced version using multi-timeframe feature context (1m, 5m, 15m, 1h)
 * This should provide better clustering and predictability compared to 1m-only features.
 *
 * Usage:
 *   npm run discover-patterns-multiframe
 *   npm run discover-patterns-multiframe --clusters=8
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, MLFeatureSet } from '../src/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../data/pattern-validation');
const DISCOVERY_RESULTS_DIR = path.join(OUTPUT_DIR, 'ml-discovery-multiframe');

// ============================================================================
// TYPES
// ============================================================================

interface MultiFrameClusterResult {
  clusterId: number;
  centroid: number[];
  sampleCount: number;
  winRate: number;
  expectancy: number;
  avgRsi1m: number;
  avgRsi5m: number;
  avgRsi15m: number;
  avgAtrPercent1m: number;
  avgAtrPercent5m: number;
  avgVolatilityRegime1m: string;
  avgVolatilityRegime5m: string;
  multiFrameContextAvailable: number; // How many samples have multi-timeframe context
}

interface MultiFrameDiscoveryResult {
  timestamp: string;
  isoTimestamp: string;
  symbol: string;
  totalFeatures: number;
  featuresWithMultiFrame: number;
  multiFramePercent: number;
  numClusters: number;
  clusters: MultiFrameClusterResult[];
  topClustersByWinRate: Array<{
    clusterId: number;
    winRate: number;
    sampleCount: number;
    multiFrameContext: boolean;
  }>;
  qualityScore: number;
  expectedImprovement: string;
}

// ============================================================================
// K-MEANS IMPLEMENTATION
// ============================================================================

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function featuresToVector(feature: MLFeatureSet): number[] {
  const v: number[] = [];

  // 1m indicators (weight: 1.0)
  v.push(feature.technicalIndicators.rsi);
  v.push(feature.technicalIndicators.ema20);
  v.push(feature.volatility.atrPercent * 100);
  v.push(feature.volatility.bollingerWidth * 100);

  // Price action from 1m (last 3 closes)
  const closes = feature.priceAction.closes;
  v.push(closes[closes.length - 1]);
  v.push(closes[closes.length - 2] || closes[closes.length - 1]);
  v.push(closes[closes.length - 3] || closes[closes.length - 1]);

  // 5m indicators if available (weight: 0.8)
  if (feature.multiTimeframeContext?.context5m) {
    v.push(feature.multiTimeframeContext.context5m.technicalIndicators.rsi * 0.8);
    v.push(feature.multiTimeframeContext.context5m.volatility.atrPercent * 100 * 0.7);
  } else {
    v.push(feature.technicalIndicators.rsi * 0.8);
    v.push(feature.volatility.atrPercent * 100 * 0.7);
  }

  // 15m indicators if available (weight: 0.6)
  if (feature.multiTimeframeContext?.context15m) {
    v.push(feature.multiTimeframeContext.context15m.technicalIndicators.rsi * 0.6);
    v.push(feature.multiTimeframeContext.context15m.volatility.atrPercent * 100 * 0.5);
  } else {
    v.push(feature.technicalIndicators.rsi * 0.6);
    v.push(feature.volatility.atrPercent * 100 * 0.5);
  }

  return v;
}

function kMeansClustering(features: MLFeatureSet[], k: number, maxIterations: number = 100): {
  assignments: number[];
  centroids: number[][];
} {
  const vectors = features.map((f) => featuresToVector(f));

  // Initialize random centroids
  const centroids: number[][] = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * vectors.length);
    centroids.push([...vectors[randomIndex]]);
  }

  let assignments: number[] = new Array(vectors.length).fill(0);
  let converged = false;
  let iteration = 0;

  while (!converged && iteration < maxIterations) {
    // Assign each vector to nearest centroid
    const newAssignments: number[] = [];
    for (const vector of vectors) {
      let minDistance = Infinity;
      let bestCluster = 0;
      for (let j = 0; j < centroids.length; j++) {
        const distance = euclideanDistance(vector, centroids[j]);
        if (distance < minDistance) {
          minDistance = distance;
          bestCluster = j;
        }
      }
      newAssignments.push(bestCluster);
    }

    // Check convergence
    converged = newAssignments.every((a, i) => a === assignments[i]);
    assignments = newAssignments;

    // Update centroids
    const newCentroids: number[][] = [];
    for (let j = 0; j < k; j++) {
      const clusteredVectors = vectors.filter((_, i) => assignments[i] === j);
      if (clusteredVectors.length === 0) {
        // Keep old centroid if cluster is empty
        newCentroids.push([...centroids[j]]);
      } else {
        const newCentroid: number[] = [];
        const dim = centroids[j].length;
        for (let d = 0; d < dim; d++) {
          const sum = clusteredVectors.reduce((acc, v) => acc + (v[d] || 0), 0);
          newCentroid.push(sum / clusteredVectors.length);
        }
        newCentroids.push(newCentroid);
      }
    }
    centroids.length = 0;
    centroids.push(...newCentroids);

    iteration++;
  }

  return { assignments, centroids };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const logger = new LoggerService(LogLevel.INFO, path.join(__dirname, '../logs'), false);

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 MULTI-TIMEFRAME ML PATTERN DISCOVERY - K-MEANS CLUSTERING');
    console.log('='.repeat(80) + '\n');

    // Parse arguments
    const args = process.argv.slice(2);
    let numClusters = 6;
    let targetTimeframe = ''; // Empty = load latest (any timeframe)

    for (const arg of args) {
      if (arg.startsWith('--clusters=')) {
        numClusters = parseInt(arg.replace('--clusters=', ''));
      }
      if (arg.startsWith('--timeframe=')) {
        targetTimeframe = arg.replace('--timeframe=', '');
      }
    }

    logger.info(`[MLDiscoveryMultiFrame] Starting multi-timeframe pattern discovery (K=${numClusters})...`);

    // Load features
    console.log('\n📂 Loading multi-timeframe features...');

    const indexFiles = fs.readdirSync(OUTPUT_DIR)
      .filter((f) => {
        if (!f.startsWith('pattern-features-') || !f.endsWith('-index.json')) return false;
        if (targetTimeframe === '') return true; // Load any timeframe
        // Match timeframe: pattern-features-SOLUSDT-5m-... or pattern-features-SOLUSDT-1h-...
        return f.includes(`-${targetTimeframe}-`);
      })
      .sort()
      .reverse();

    if (indexFiles.length === 0) {
      console.error(`❌ Error: No feature index files found in ${OUTPUT_DIR}${targetTimeframe ? ` for timeframe ${targetTimeframe}` : ''}`);
      console.log(`\nRun this first: npm run extract-features${targetTimeframe ? ` -- --timeframe=${targetTimeframe}` : ''}`);
      process.exit(1);
    }

    const indexFile = path.join(OUTPUT_DIR, indexFiles[0]);
    const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

    console.log(`\n📂 Loading features from ${index.symbol}...`);
    console.log(`   Total features: ${index.totalFeatures.toLocaleString()}`);
    console.log(`   Chunks: ${index.chunks}`);

    const features: MLFeatureSet[] = [];
    for (let i = 0; i < index.files.length; i++) {
      const chunkPath = path.join(OUTPUT_DIR, index.files[i]);
      const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
      features.push(...chunkData);

      if ((i + 1) % 5 === 0) {
        process.stdout.write(`\r   Loaded ${i + 1}/${index.files.length} chunks...`);
      }
    }

    console.log(`\n✅ Loaded ${features.length.toLocaleString()} features\n`);

    // Check for multi-timeframe context
    const withMultiFrame = features.filter((f) => f.multiTimeframeContext).length;
    console.log(`⭐ Multi-Timeframe Analysis:`);
    console.log(`   Features with multi-timeframe context: ${withMultiFrame} (${(withMultiFrame / features.length * 100).toFixed(1)}%)`);
    console.log(`   Expected improvement: +5-15% predictability boost\n`);

    // Run K-means
    console.log(`🔄 Running K-means clustering with K=${numClusters}...`);
    const { assignments, centroids } = kMeansClustering(features, numClusters);

    // Analyze clusters
    console.log('\n📊 Analyzing clusters...');
    const clusters: MultiFrameClusterResult[] = [];

    for (let i = 0; i < numClusters; i++) {
      const clusterIndices = assignments.map((a, idx) => (a === i ? idx : -1)).filter((idx) => idx >= 0);
      const clusterFeatures = clusterIndices.map((idx) => features[idx]);

      const wins = clusterFeatures.filter((f) => f.label === 'WIN').length;
      const losses = clusterFeatures.filter((f) => f.label === 'LOSS').length;
      const winRate = clusterFeatures.length > 0 ? wins / clusterFeatures.length : 0;
      const expectancy = winRate > 0.5 ? winRate - (1 - winRate) : -(1 - winRate) + winRate;

      // Multi-timeframe stats
      const avgRsi1m = clusterFeatures.reduce((sum, f) => sum + f.technicalIndicators.rsi, 0) / clusterFeatures.length;
      const avgRsi5m =
        clusterFeatures.reduce(
          (sum, f) => sum + (f.multiTimeframeContext?.context5m.technicalIndicators.rsi || f.technicalIndicators.rsi),
          0,
        ) / clusterFeatures.length;
      const avgRsi15m =
        clusterFeatures.reduce(
          (sum, f) => sum + (f.multiTimeframeContext?.context15m.technicalIndicators.rsi || f.technicalIndicators.rsi),
          0,
        ) / clusterFeatures.length;

      const avgAtrPercent1m = (clusterFeatures.reduce((sum, f) => sum + f.volatility.atrPercent, 0) / clusterFeatures.length) * 100;
      const avgAtrPercent5m =
        (clusterFeatures.reduce(
          (sum, f) => sum + (f.multiTimeframeContext?.context5m.volatility.atrPercent || f.volatility.atrPercent),
          0,
        ) / clusterFeatures.length) * 100;

      const multiFrameCount = clusterFeatures.filter((f) => f.multiTimeframeContext).length;
      const volatilityRegimes1m = clusterFeatures
        .map((f) => f.volatility.volatilityRegime)
        .reduce((acc: Record<string, number>, v) => ((acc[v] = (acc[v] || 0) + 1), acc), {});
      const topRegime1m = Object.entries(volatilityRegimes1m).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';

      const volatilityRegimes5m = clusterFeatures
        .map((f) => f.multiTimeframeContext?.context5m.volatility.volatilityRegime || f.volatility.volatilityRegime)
        .reduce((acc: Record<string, number>, v) => ((acc[v] = (acc[v] || 0) + 1), acc), {});
      const topRegime5m = Object.entries(volatilityRegimes5m).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN';

      clusters.push({
        clusterId: i,
        centroid: centroids[i],
        sampleCount: clusterFeatures.length,
        winRate: winRate * 100,
        expectancy: expectancy * 100,
        avgRsi1m,
        avgRsi5m,
        avgRsi15m,
        avgAtrPercent1m,
        avgAtrPercent5m,
        avgVolatilityRegime1m: topRegime1m,
        avgVolatilityRegime5m: topRegime5m,
        multiFrameContextAvailable: multiFrameCount,
      });

      process.stdout.write(`\r   Analyzed ${i + 1}/${numClusters} clusters...`);
    }

    console.log('\n✅ Clustering complete\n');

    // Sort by win rate
    const topClusters = clusters
      .map((c) => ({
        clusterId: c.clusterId,
        winRate: c.winRate,
        sampleCount: c.sampleCount,
        multiFrameContext: c.multiFrameContextAvailable > c.sampleCount * 0.5,
      }))
      .sort((a, b) => b.winRate - a.winRate);

    // Create output directory
    if (!fs.existsSync(DISCOVERY_RESULTS_DIR)) {
      fs.mkdirSync(DISCOVERY_RESULTS_DIR, { recursive: true });
    }

    // Calculate overall quality
    const bestCluster = clusters[topClusters[0].clusterId];
    const qualityScore = bestCluster.winRate > 55 ? 7 : bestCluster.winRate > 50 ? 5 : 2;

    // Prepare result
    const result: MultiFrameDiscoveryResult = {
      timestamp: new Date().toLocaleString(),
      isoTimestamp: new Date().toISOString(),
      symbol: index.symbol,
      totalFeatures: features.length,
      featuresWithMultiFrame: withMultiFrame,
      multiFramePercent: (withMultiFrame / features.length) * 100,
      numClusters,
      clusters,
      topClustersByWinRate: topClusters,
      qualityScore,
      expectedImprovement:
        withMultiFrame > features.length * 0.8
          ? 'HIGH - Most features have multi-timeframe context'
          : withMultiFrame > features.length * 0.5
            ? 'MEDIUM - Half of features have multi-timeframe context'
            : 'LOW - Few features have multi-timeframe context',
    };

    // Save result
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const resultFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-multiframe-${index.symbol}-${timestamp}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

    // Print summary
    console.log('='.repeat(80));
    console.log('📈 MULTI-TIMEFRAME DISCOVERY RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log(`Symbol: ${index.symbol}`);
    console.log(`Total Features: ${features.length.toLocaleString()}`);
    console.log(`Multi-Frame Features: ${withMultiFrame.toLocaleString()} (${(withMultiFrame / features.length * 100).toFixed(1)}%)`);
    console.log(`Clusters: K=${numClusters}`);
    console.log(`Quality Score: ${qualityScore}/10`);
    console.log(`Expected Improvement: ${result.expectedImprovement}\n`);

    console.log('🏆 Top 5 Clusters by Win Rate:');
    topClusters.slice(0, 5).forEach((tc, idx) => {
      const cluster = clusters[tc.clusterId];
      console.log(
        `\n${idx + 1}. Cluster ${tc.clusterId} - WR: ${tc.winRate.toFixed(1)}% | Samples: ${tc.sampleCount.toLocaleString()}`,
      );
      console.log(`   RSI (1m/5m/15m): ${cluster.avgRsi1m.toFixed(1)} / ${cluster.avgRsi5m.toFixed(1)} / ${cluster.avgRsi15m.toFixed(1)}`);
      console.log(`   ATR% (1m/5m): ${cluster.avgAtrPercent1m.toFixed(2)}% / ${cluster.avgAtrPercent5m.toFixed(2)}%`);
      console.log(`   Volatility Regime: ${cluster.avgVolatilityRegime1m} / ${cluster.avgVolatilityRegime5m}`);
      console.log(`   Multi-Frame Context: ${tc.multiFrameContext ? '✅ Yes' : '❌ No'}`);
    });

    console.log(`\n📁 Results saved to: ${resultFile}\n`);
    console.log('✅ Multi-Timeframe ML Pattern Discovery Complete!\n');
  } catch (error) {
    logger.error('[MLDiscoveryMultiFrame] Failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
