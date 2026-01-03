/**
 * ML Pattern Discovery CLI
 *
 * Discovers new trading patterns using K-means clustering
 * Usage:
 *   npm run discover-patterns-ml
 *   npm run discover-patterns-ml --clusters=8
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, MLFeatureSet, MLDiscoveryConfig } from '../src/types';
import { MLPatternDiscoveryService } from '../src/services/pattern-ml-discovery.service';

// ============================================================================
// CONSTANTS
// ============================================================================

const OUTPUT_DIR = path.join(__dirname, '../data/pattern-validation');
const FEATURES_FILE = path.join(OUTPUT_DIR, 'pattern-features-latest.json');
const DISCOVERY_RESULTS_DIR = path.join(OUTPUT_DIR, 'ml-discovery');

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const logger = new LoggerService(LogLevel.INFO, path.join(__dirname, '../logs'), false);

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🤖 ML PATTERN DISCOVERY - K-MEANS CLUSTERING');
    console.log('='.repeat(80) + '\n');

    // Parse arguments
    const args = process.argv.slice(2);
    let numClusters = 6; // Default

    for (const arg of args) {
      if (arg.startsWith('--clusters=')) {
        numClusters = parseInt(arg.replace('--clusters=', ''));
      }
    }

    logger.info(`[MLDiscovery] Starting ML pattern discovery (K=${numClusters})...`);

    // Step 1: Load features
    console.log('\n📂 Loading features...');

    // Try to find index file for chunked features
    const indexFiles = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.startsWith('pattern-features-') && f.endsWith('-index.json'))
      .sort()
      .reverse(); // Latest first

    let features: MLFeatureSet[] = [];

    if (indexFiles.length > 0) {
      // Load chunked features
      const indexFile = path.join(OUTPUT_DIR, indexFiles[0]);
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));

      console.log(`\n📂 Loading features from ${index.symbol}...`);
      console.log(`   Total features: ${index.totalFeatures.toLocaleString()}`);
      console.log(`   Chunks: ${index.chunks}`);
      console.log(`   Timestamp: ${index.timestamp}`);

      // Load all chunks
      for (let i = 0; i < index.files.length; i++) {
        const chunkPath = path.join(OUTPUT_DIR, index.files[i]);
        const chunkData = JSON.parse(fs.readFileSync(chunkPath, 'utf-8'));
        features.push(...chunkData);

        // Progress indicator every 3 chunks
        if ((i + 1) % 3 === 0 || i === index.files.length - 1) {
          console.log(`   Loaded chunk ${i + 1}/${index.chunks} (${features.length.toLocaleString()} features so far)`);
        }
      }

      console.log(`✅ Loaded ${features.length.toLocaleString()} total feature sets`);
    } else if (fs.existsSync(FEATURES_FILE)) {
      // Fallback to single file if exists
      console.log('Loading from single file (legacy format)...');
      features = JSON.parse(fs.readFileSync(FEATURES_FILE, 'utf-8'));
      console.log(`✅ Loaded ${features.length} feature sets`);
    } else {
      logger.error('[MLDiscovery] No feature files found', { dir: OUTPUT_DIR });
      console.error(`❌ Error: No feature files found in ${OUTPUT_DIR}`);
      console.log('\nMake sure to run: npm run extract-features-from-candles first');
      process.exit(1);
    }

    // Step 2: Create config
    const config: MLDiscoveryConfig = {
      enabled: true,
      numClusters,
      maxIterations: 500,
      convergenceThreshold: 0.0001,
      trainTestSplit: {
        trainPercent: 70,
        testPercent: 30,
      },
      normalizeFeatures: true,
      minClusterSize: Math.max(5, Math.floor(features.length / numClusters / 2)),
      minClusterWinRate: 40,
      dataSource: 'BACKTEST',
      backtestPeriodDays: 90,
      autoDiscoveryInterval: 'MANUAL',
      lastDiscoveryTimestamp: Date.now(),
    };

    // Step 3: Create output directory
    if (!fs.existsSync(DISCOVERY_RESULTS_DIR)) {
      fs.mkdirSync(DISCOVERY_RESULTS_DIR, { recursive: true });
    }

    // Step 4: Run discovery
    console.log(`\n🧠 Running K-means clustering (K=${numClusters})...`);
    let result;
    try {
      const service = new MLPatternDiscoveryService(logger, config);
      result = await service.discoverPatterns(features);

      console.log(`✅ Discovery complete!`);
      console.log(`   Clusters: ${result.numClusters}`);
      console.log(`   Train samples: ${result.trainSamples}`);
      console.log(`   Test samples: ${result.testSamples}`);
    } catch (error) {
      // If discovery fails, save minimal data
      logger.error('[MLDiscovery] Discovery failed - attempting to save partial results', {
        error: error instanceof Error ? error.message : String(error),
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const errorFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-error-${timestamp}.json`);
      fs.writeFileSync(
        errorFile,
        JSON.stringify(
          {
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
            totalFeatures: features.length,
            numClusters,
            config,
          },
          null,
          2,
        ),
      );

      console.log(`\n⚠️ Partial error report saved: ${errorFile}`);
      throw error;
    }

    // Step 5: Save results as JSON (without raw samples to avoid stack overflow)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const resultsFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-${timestamp}.json`);

    // Create serializable result (remove large raw samples)
    const serializableResult = {
      ...result,
      clusters: result.clusters.map(c => ({
        clusterId: c.clusterId,
        centroid: c.centroid,
        sampleCount: c.sampleCount,
        winRate: c.winRate,
        avgWinPnl: c.avgWinPnl,
        avgLossPnl: c.avgLossPnl,
        expectancy: c.expectancy,
        avgRsi: c.avgRsi,
        avgAtrPercent: c.avgAtrPercent,
        commonPatterns: c.commonPatterns,
        commonVolatilityRegimes: c.commonVolatilityRegimes,
        // Note: samples array removed to prevent stack overflow
      })),
    };

    fs.writeFileSync(resultsFile, JSON.stringify(serializableResult, null, 2));
    console.log(`\n📊 Results saved: ${resultsFile}`);

    // Step 6: Generate markdown report
    const reportFile = path.join(DISCOVERY_RESULTS_DIR, `ml-discovery-report-${timestamp}.md`);
    const report = generateReport(result);
    fs.writeFileSync(reportFile, report);
    console.log(`📄 Report saved: ${reportFile}`);

    // Step 7: Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📈 DISCOVERY SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`Total Samples: ${result.totalSamples}`);
    console.log(`Train/Test Split: ${result.trainSamples}/${result.testSamples}`);
    console.log(`Clusters Found: ${result.numClusters}`);
    console.log(`Quality Score: ${(result.qualityScore * 100).toFixed(1)}%\n`);

    console.log('🏆 Top Clusters by Win Rate:');
    for (const top of result.topClustersByWinRate) {
      const status = top.tradeable ? '✅' : '⚠️';
      console.log(
        `   ${status} Cluster ${top.clusterId}: ${top.winRate.toFixed(1)}% WR (n=${top.sampleCount})`,
      );
    }

    console.log('\n💡 Recommendations:');
    for (const rec of result.recommendations) {
      console.log(`   ${rec}`);
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

/**
 * Generate markdown report
 */
function generateReport(result: any): string {
  let md = `# ML Pattern Discovery Report\n\n`;

  md += `**Generated**: ${new Date(result.discoveryTimestamp).toISOString()}\n`;
  md += `**Period**: ${result.backtestPeriod.startDate} to ${result.backtestPeriod.endDate}\n`;
  md += `**Quality Score**: ${(result.qualityScore * 100).toFixed(1)}%\n\n`;

  md += `## Overview\n\n`;
  md += `- Total Samples: ${result.totalSamples}\n`;
  md += `- Train Set: ${result.trainSamples}\n`;
  md += `- Test Set: ${result.testSamples}\n`;
  md += `- Clusters: ${result.numClusters}\n\n`;

  md += `## Top Clusters\n\n`;
  md += `| Cluster | Win Rate | Samples | Tradeable |\n`;
  md += `|---------|----------|---------|----------|\n`;

  for (const top of result.topClustersByWinRate) {
    const tradeable = top.tradeable ? '✅' : '❌';
    md += `| ${top.clusterId} | ${top.winRate.toFixed(1)}% | ${top.sampleCount} | ${tradeable} |\n`;
  }

  md += `\n## Cluster Details\n\n`;

  for (const cluster of result.clusters) {
    md += `### Cluster ${cluster.clusterId}\n\n`;
    md += `- Sample Count: ${cluster.sampleCount}\n`;
    md += `- Win Rate: ${cluster.winRate.toFixed(1)}%\n`;
    md += `- Expectancy: ${cluster.expectancy.toFixed(4)}\n`;
    md += `- Avg RSI: ${cluster.avgRsi.toFixed(2)}\n`;
    md += `- Avg ATR%: ${cluster.avgAtrPercent.toFixed(4)}\n\n`;

    if (cluster.commonPatterns && Object.keys(cluster.commonPatterns).length > 0) {
      md += `**Common Patterns**:\n`;
      for (const [pattern, count] of Object.entries(cluster.commonPatterns)) {
        const pct = ((count as number) / cluster.sampleCount * 100).toFixed(1);
        md += `- ${pattern}: ${count} (${pct}%)\n`;
      }
      md += `\n`;
    }
  }

  md += `## Recommendations\n\n`;
  for (const rec of result.recommendations) {
    md += `- ${rec}\n`;
  }

  md += `\n---\n\nGenerated by ML Pattern Discovery Service\n`;

  return md;
}

// ============================================================================
// RUN
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
