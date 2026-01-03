/**
 * Simple ML Pattern Discovery - K-means clustering
 *
 * Simpler version that avoids deep object traversal causing stack overflow
 * Usage:
 *   npm run discover-patterns-simple
 *   npm run discover-patterns-simple --clusters=8
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, MLFeatureSet } from '../src/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../data/pattern-validation');
const DISCOVERY_RESULTS_DIR = path.join(OUTPUT_DIR, 'ml-discovery');

// ============================================================================
// TYPES
// ============================================================================

interface SimpleClusterResult {
  clusterId: number;
  centroid: number[];
  sampleCount: number;
  winRate: number;
  expectancy: number;
  avgRsi: number;
  avgAtrPercent: number;
}

interface SimpleDiscoveryResult {
  timestamp: string;
  isoTimestamp: string;
  symbol: string;
  totalFeatures: number;
  totalTrain: number;
  totalTest: number;
  numClusters: number;
  clusters: SimpleClusterResult[];
  topClustersByWinRate: Array<{
    clusterId: number;
    winRate: number;
    sampleCount: number;
  }>;
  qualityScore: number;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const logger = new LoggerService(LogLevel.INFO, path.join(__dirname, '../logs'), false);

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 SIMPLE ML PATTERN DISCOVERY - K-MEANS CLUSTERING');
    console.log('='.repeat(80) + '\n');

    // Parse arguments
    const args = process.argv.slice(2);
    let numClusters = 6;

    for (const arg of args) {
      if (arg.startsWith('--clusters=')) {
        numClusters = parseInt(arg.replace('--clusters=', ''));
      }
    }

    logger.info(`[MLDiscovery] Starting simple ML pattern discovery (K=${numClusters})...`);

    // Load features
    console.log('\n📂 Loading features...');

    const indexFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith('pattern-features-') && f.endsWith('-index.json'))
      .sort()
      .reverse();

    if (indexFiles.length === 0) {
      console.error(`❌ Error: No feature index files found in ${OUTPUT_DIR}`);
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

      if ((i + 1) % 3 === 0 || i === index.files.length - 1) {
        console.log(`   Loaded chunk ${i + 1}/${index.chunks} (${features.length.toLocaleString()} features so far)`);
      }
    }

    console.log(`✅ Loaded ${features.length.toLocaleString()} total feature sets`);

    // Split train/test
    const splitPoint = Math.floor(features.length * 0.7);
    const trainFeatures = features.slice(0, splitPoint);
    const testFeatures = features.slice(splitPoint);

    console.log(`\n📊 Data split:`);
    console.log(`   Train: ${trainFeatures.length.toLocaleString()}`);
    console.log(`   Test: ${testFeatures.length.toLocaleString()}`);

    // K-means clustering
    console.log(`\n🧠 Running K-means clustering (K=${numClusters})...`);

    // Convert to vectors (only numeric features)
    const vectors = trainFeatures.map(f => {
      const lastClose = f.priceAction?.closes ? f.priceAction.closes[f.priceAction.closes.length - 1] : 0;
      return [
        lastClose,
        f.technicalIndicators.rsi || 0,
        f.volatility.atrPercent || 0,
        f.volatility.bollingerWidth || 0,
        f.orderFlow.bidAskImbalance || 0,
      ];
    });

    // K-means++ initialization
    const centroids = initializeCentroidsPP(vectors, numClusters);

    // Run K-means
    const assignments = kMeans(vectors, centroids, 300);

    console.log(`✅ K-means complete!`);
    console.log(`   Clusters: ${numClusters}`);

    // Evaluate clusters
    const clusters: SimpleClusterResult[] = [];

    for (let k = 0; k < numClusters; k++) {
      const sampleIndices = assignments
        .map((a, i) => (a === k ? i : -1))
        .filter(i => i >= 0);

      if (sampleIndices.length > 0) {
        const clusterSamples = sampleIndices.map(i => trainFeatures[i]);

        // Calculate statistics
        const winCount = clusterSamples.filter(s => s.label === 'WIN').length;
        const winRate = (winCount / clusterSamples.length) * 100;
        const avgRsi = clusterSamples.reduce((sum, s) => sum + (s.technicalIndicators.rsi || 0), 0) / clusterSamples.length;
        const avgAtrPercent = clusterSamples.reduce((sum, s) => sum + (s.volatility.atrPercent || 0), 0) / clusterSamples.length;

        // Estimate expectancy (simplified)
        const avgWin = 0.5; // Placeholder
        const avgLoss = 0.5; // Placeholder
        const expectancy = avgWin * (winRate / 100) - avgLoss * (1 - winRate / 100);

        clusters.push({
          clusterId: k,
          centroid: centroids[k],
          sampleCount: clusterSamples.length,
          winRate,
          expectancy,
          avgRsi,
          avgAtrPercent,
        });
      }
    }

    // Sort by win rate
    clusters.sort((a, b) => b.winRate - a.winRate);

    // Create result
    const isoTimestamp = new Date().toISOString();
    const timestamp = isoTimestamp.replace(/[:.]/g, '-').slice(0, -5);
    const result: SimpleDiscoveryResult = {
      timestamp,
      isoTimestamp,
      symbol: index.symbol,
      totalFeatures: features.length,
      totalTrain: trainFeatures.length,
      totalTest: testFeatures.length,
      numClusters,
      clusters,
      topClustersByWinRate: clusters.slice(0, 3).map(c => ({
        clusterId: c.clusterId,
        winRate: c.winRate,
        sampleCount: c.sampleCount,
      })),
      qualityScore: clusters.filter(c => c.winRate >= 60).length / numClusters,
    };

    // Create output directory
    if (!fs.existsSync(DISCOVERY_RESULTS_DIR)) {
      fs.mkdirSync(DISCOVERY_RESULTS_DIR, { recursive: true });
    }

    // Save results
    const resultsFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-simple-${timestamp}.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(result, null, 2));
    console.log(`\n📊 Results saved: ${resultsFile}`);

    // Generate report
    const reportFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-simple-report-${timestamp}.md`);
    const report = generateReport(result);
    fs.writeFileSync(reportFile, report);
    console.log(`📄 Report saved: ${reportFile}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 DISCOVERY SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`Symbol: ${result.symbol}`);
    console.log(`Total Samples: ${result.totalFeatures}`);
    console.log(`Train/Test: ${result.totalTrain}/${result.totalTest}`);
    console.log(`Clusters Found: ${result.numClusters}`);
    console.log(`Quality Score: ${(result.qualityScore * 100).toFixed(1)}%\n`);

    console.log('🏆 Top Clusters by Win Rate:');
    for (const cluster of clusters.slice(0, 5)) {
      const status = cluster.winRate >= 60 ? '✅' : '⚠️';
      console.log(
        `   ${status} Cluster ${cluster.clusterId}: ${cluster.winRate.toFixed(1)}% WR (n=${cluster.sampleCount})`,
      );
    }

    console.log('\n✅ ML Discovery Complete!\n');
  } catch (error) {
    logger.error('[MLDiscovery] Failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function featureToVector(f: MLFeatureSet): number[] {
  const lastClose = f.priceAction?.closes ? f.priceAction.closes[f.priceAction.closes.length - 1] : 0;
  return [
    lastClose,
    f.technicalIndicators?.rsi || 0,
    f.volatility?.atrPercent || 0,
    f.volatility?.bollingerWidth || 0,
    f.orderFlow?.bidAskImbalance || 0,
  ];
}

function initializeCentroidsPP(vectors: number[][], k: number): number[][] {
  const centroids: number[][] = [];
  const distances: number[] = new Array(vectors.length).fill(Infinity);

  // Choose first centroid randomly
  centroids.push([...vectors[Math.floor(Math.random() * vectors.length)]]);

  // Choose remaining k-1 centroids
  for (let i = 1; i < k; i++) {
    // Update distances to nearest centroid
    for (let j = 0; j < vectors.length; j++) {
      const dist = euclideanDistance(vectors[j], centroids[centroids.length - 1]);
      distances[j] = Math.min(distances[j], dist * dist);
    }

    // Choose next centroid with probability proportional to distance squared
    const sumDist = distances.reduce((a, b) => a + b, 0);
    let rand = Math.random() * sumDist;

    for (let j = 0; j < vectors.length; j++) {
      rand -= distances[j];
      if (rand <= 0) {
        centroids.push([...vectors[j]]);
        break;
      }
    }
  }

  return centroids;
}

function kMeans(vectors: number[][], centroids: number[][], maxIter: number): number[] {
  let assignments = new Array(vectors.length).fill(0);
  let converged = false;
  let iter = 0;

  while (!converged && iter < maxIter) {
    // Assign points to nearest centroid
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let k = 0; k < centroids.length; k++) {
        const dist = euclideanDistance(vectors[i], centroids[k]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = k;
        }
      }

      assignments[i] = bestCluster;
    }

    // Update centroids
    const newCentroids = centroids.map((_, k) => {
      const indices = assignments.map((a, i) => (a === k ? i : -1)).filter(i => i >= 0);

      if (indices.length === 0) return [...centroids[k]];

      const dim = centroids[0].length;
      const newCentroid = new Array(dim).fill(0);

      for (let d = 0; d < dim; d++) {
        for (const i of indices) {
          newCentroid[d] += vectors[i][d];
        }
        newCentroid[d] /= indices.length;
      }

      return newCentroid;
    });

    // Check convergence
    let movement = 0;
    for (let k = 0; k < centroids.length; k++) {
      movement = Math.max(movement, euclideanDistance(centroids[k], newCentroids[k]));
    }

    converged = movement < 0.0001;

    for (let k = 0; k < centroids.length; k++) {
      centroids[k] = newCentroids[k];
    }

    iter++;
  }

  return assignments;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function generateReport(result: SimpleDiscoveryResult): string {
  let md = `# ML Pattern Discovery Report (Simple)\n\n`;

  md += `**Generated**: ${result.isoTimestamp}\n`;
  md += `**Symbol**: ${result.symbol}\n`;
  md += `**Quality Score**: ${(result.qualityScore * 100).toFixed(1)}%\n\n`;

  md += `## Overview\n\n`;
  md += `- Total Samples: ${result.totalFeatures.toLocaleString()}\n`;
  md += `- Train Set: ${result.totalTrain.toLocaleString()}\n`;
  md += `- Test Set: ${result.totalTest.toLocaleString()}\n`;
  md += `- Clusters: ${result.numClusters}\n\n`;

  md += `## Top Clusters\n\n`;
  md += `| Cluster | Win Rate | Samples | Expectancy |\n`;
  md += `|---------|----------|---------|------------|\n`;

  for (const cluster of result.clusters.slice(0, 5)) {
    md += `| ${cluster.clusterId} | ${cluster.winRate.toFixed(1)}% | ${cluster.sampleCount} | ${cluster.expectancy.toFixed(4)} |\n`;
  }

  md += `\n## All Clusters\n\n`;

  for (const cluster of result.clusters) {
    md += `### Cluster ${cluster.clusterId}\n\n`;
    md += `- Sample Count: ${cluster.sampleCount}\n`;
    md += `- Win Rate: ${cluster.winRate.toFixed(1)}%\n`;
    md += `- Expectancy: ${cluster.expectancy.toFixed(4)}\n`;
    md += `- Avg RSI: ${cluster.avgRsi.toFixed(2)}\n`;
    md += `- Avg ATR%: ${cluster.avgAtrPercent.toFixed(4)}\n\n`;
  }

  md += `---\n\nGenerated by Simple ML Pattern Discovery Service\n`;

  return md;
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
