/**
 * Extract ML Features from Historical Candles
 *
 * Generates MLFeatureSets from SOLUSDT historical candles for pattern discovery.
 * Uses MULTI-TIMEFRAME feature extraction (1m, 5m, 15m, 1h context) for improved predictability.
 * Since we don't have pattern validation data, we'll use simple heuristics to
 * identify potential patterns and extract features.
 *
 * Usage:
 *   npm run extract-features SOLUSDT 2025-12-01 2025-12-02
 *   Default: extracts from last 30 days (with multi-timeframe context)
 */

import * as fs from 'fs';
import * as path from 'path';
import { LoggerService, LogLevel, MLFeatureSet, Candle } from '../src/types';
import { MLFeatureExtractorService } from '../src/services/ml-feature-extractor.service';
import { CandleAggregatorService } from '../src/services/candle-aggregator.service';

// ============================================================================
// CONSTANTS
// ============================================================================

const DATA_DIR = path.join(__dirname, '../data/historical');
const OUTPUT_DIR = path.join(__dirname, '../data/pattern-validation');
const DEFAULT_SYMBOL = 'SOLUSDT';
const DEFAULT_TIMEFRAME = '1m'; // '1m', '5m', '15m', '1h'
const FEATURE_WINDOW = 50; // Candles to analyze for feature extraction
const MIN_FEATURES = 500; // Minimum features to generate

// Parse timeframe string to minutes
function parseTimeframe(timeframeStr: string): number {
  if (timeframeStr === '1m') return 1;
  if (timeframeStr === '5m') return 5;
  if (timeframeStr === '15m') return 15;
  if (timeframeStr === '1h' || timeframeStr === '60m') return 60;
  return 1; // Default to 1m
}

// ============================================================================
// PATTERN HEURISTICS
// ============================================================================

function identifySimplePatterns(candles: Candle[]): string[] {
  if (candles.length < 5) return ['UNKNOWN'];

  const patterns: string[] = [];
  const last5 = candles.slice(-5);
  const last10 = candles.slice(-10);

  // Bullish engulfing (current close > prev open, current open < prev close)
  if (last5[4].close > last5[3].open && last5[4].open < last5[3].close) {
    patterns.push('BULLISH_ENGULFING');
  }

  // Bearish engulfing
  if (last5[4].close < last5[3].open && last5[4].open > last5[3].close) {
    patterns.push('BEARISH_ENGULFING');
  }

  // Uptrend: 3+ candles with higher highs and higher lows
  const uptrend = last5.every((c, i) => {
    if (i === 0) return true;
    return c.high >= last5[i - 1].high && c.low >= last5[i - 1].low;
  });
  if (uptrend) patterns.push('UPTREND');

  // Downtrend: 3+ candles with lower highs and lower lows
  const downtrend = last5.every((c, i) => {
    if (i === 0) return true;
    return c.high <= last5[i - 1].high && c.low <= last5[i - 1].low;
  });
  if (downtrend) patterns.push('DOWNTREND');

  // High volume spike
  const avgVolume = last10.reduce((sum, c) => sum + c.volume, 0) / 10;
  if (last5[4].volume > avgVolume * 2) {
    patterns.push('VOLUME_SPIKE');
  }

  // Range/consolidation (low range %)
  const highestHigh = Math.max(...last5.map((c) => c.high));
  const lowestLow = Math.min(...last5.map((c) => c.low));
  const rangePercent = ((highestHigh - lowestLow) / lowestLow) * 100;
  if (rangePercent < 1.0) {
    patterns.push('CONSOLIDATION');
  }

  return patterns.length > 0 ? patterns : ['NEUTRAL'];
}

function determineOutcome(currentCandle: Candle, nextCandle: Candle | undefined): 'WIN' | 'LOSS' {
  if (!nextCandle) return 'LOSS'; // Default to LOSS if no next candle
  // WIN if next candle closes higher than current
  return nextCandle.close > currentCandle.close ? 'WIN' : 'LOSS';
}

// ============================================================================
// MAIN EXTRACTION
// ============================================================================

async function main() {
  const logger = new LoggerService(LogLevel.INFO, path.join(__dirname, '../logs'), false);

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 ML FEATURE EXTRACTION FROM HISTORICAL CANDLES');
    console.log('='.repeat(80) + '\n');

    // Parse arguments
    const args = process.argv.slice(2);
    let timeframe = DEFAULT_TIMEFRAME;
    let symbol = DEFAULT_SYMBOL;
    let startDate: string | undefined;
    let endDate: string | undefined;

    // Look for --timeframe parameter first
    const timeframeArgIdx = args.findIndex((arg) => arg.startsWith('--timeframe='));
    if (timeframeArgIdx >= 0) {
      timeframe = args[timeframeArgIdx].split('=')[1] || DEFAULT_TIMEFRAME;
      // Remove this arg from processing
      args.splice(timeframeArgIdx, 1);
    }

    // Now parse remaining positional arguments
    const nonFlagArgs = args.filter((arg) => !arg.startsWith('--'));
    if (nonFlagArgs.length > 0) symbol = nonFlagArgs[0];
    if (nonFlagArgs.length > 1) startDate = nonFlagArgs[1];
    if (nonFlagArgs.length > 2) endDate = nonFlagArgs[2];

    const timeframeMinutes = parseTimeframe(timeframe);

    logger.info(`[FeatureExtraction] Starting extraction for ${symbol} on ${timeframe} timeframe...`);

    // Load candles (always load 1m as base)
    const candleFile = path.join(DATA_DIR, `${symbol}_1m_2024-12-02_2025-12-02.json`);
    if (!fs.existsSync(candleFile)) {
      console.error(`❌ Error: Candle file not found: ${candleFile}`);
      console.log('\nRun this first: npm run download-data SOLUSDT 2024-12-02 2025-12-02');
      process.exit(1);
    }

    console.log(`📂 Loading 1m candles from ${path.basename(candleFile)}...`);
    let candles1m: Candle[] = JSON.parse(fs.readFileSync(candleFile, 'utf-8'));

    // Filter by date range if provided
    if (startDate && endDate) {
      const start = new Date(startDate).getTime();
      const end = new Date(endDate).getTime();
      candles1m = candles1m.filter((c) => c.timestamp >= start && c.timestamp <= end);
      console.log(`📅 Filtered to ${startDate} - ${endDate}: ${candles1m.length} candles`);
    }

    console.log(`✅ Loaded ${candles1m.length} 1-minute candles\n`);

    // Aggregate to target timeframe if needed
    let candles = candles1m;
    if (timeframeMinutes > 1) {
      const aggregator = new CandleAggregatorService();
      candles = aggregator.aggregateCandles(candles1m, timeframeMinutes);
      console.log(`📊 Aggregated to ${timeframe}: ${candles.length} candles\n`);
    }

    // Extract features with multi-timeframe context
    console.log(`🧠 Extracting features from ${timeframe} candles with MULTI-TIMEFRAME context (1m, 5m, 15m, 1h)...`);
    const extractor = new MLFeatureExtractorService(logger);
    const features: MLFeatureSet[] = [];

    // Process candles in windows to detect patterns
    for (let i = FEATURE_WINDOW; i < candles.length - 1; i++) {
      const window = candles.slice(i - FEATURE_WINDOW, i + 1);
      const patterns = identifySimplePatterns(window);
      const outcome = determineOutcome(window[window.length - 1], candles[i + 1]);

      for (const pattern of patterns) {
        try {
          // Use multi-timeframe extraction for better predictability
          const feature = extractor.extractFeaturesMultiTimeframe(window, pattern, outcome, FEATURE_WINDOW);
          features.push(feature);
        } catch (error) {
          // Skip features with extraction errors
        }
      }

      if (features.length % 1000 === 0) {
        process.stdout.write(`\r   ${features.length} features extracted...`);
      }
    }

    console.log(`\n✅ Extracted ${features.length} features\n`);

    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Save features in chunks to avoid JSON size limits
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const timeframeLabel = timeframeMinutes === 1 ? '1m' : timeframeMinutes === 5 ? '5m' : timeframeMinutes === 15 ? '15m' : '1h';
    const chunkSize = 50000;
    const chunks = [];

    for (let i = 0; i < features.length; i += chunkSize) {
      chunks.push(features.slice(i, i + chunkSize));
    }

    const outputFiles: string[] = [];
    chunks.forEach((chunk, idx) => {
      const chunkFile = path.join(
        OUTPUT_DIR,
        `pattern-features-${symbol}-${timeframeLabel}-${timestamp}-chunk-${idx + 1}-of-${chunks.length}.json`
      );
      fs.writeFileSync(chunkFile, JSON.stringify(chunk, null, 2));
      outputFiles.push(chunkFile);
    });

    // Also create index file listing all chunks
    const indexFile = path.join(OUTPUT_DIR, `pattern-features-${symbol}-${timeframeLabel}-${timestamp}-index.json`);
    fs.writeFileSync(
      indexFile,
      JSON.stringify({
        totalFeatures: features.length,
        chunks: chunks.length,
        chunkSize,
        timestamp,
        symbol,
        timeframe: timeframeLabel,
        candleCount: candles.length,
        files: outputFiles.map((f) => path.basename(f)),
      }, null, 2)
    );

    console.log(`📊 Features saved in ${chunks.length} chunks:`)
    outputFiles.forEach((f, i) => console.log(`   ${i + 1}/${chunks.length}: ${path.basename(f)}`));
    console.log(`📋 Index: ${path.basename(indexFile)}\n`);

    // Summary
    console.log('='.repeat(80));
    console.log('📈 EXTRACTION SUMMARY');
    console.log('='.repeat(80) + '\n');
    console.log(`⭐ TIMEFRAME: ${timeframeLabel.toUpperCase()} (base for feature extraction)`);
    console.log(`⭐ MULTI-TIMEFRAME MODE ENABLED (1m, 5m, 15m, 1h context)`);
    console.log(`Total Candles (${timeframeLabel}): ${candles.length}`);
    console.log(`Total Features: ${features.length}`);
    console.log(`Average per candle: ${(features.length / candles.length).toFixed(2)}`);

    // Check for multi-timeframe context
    const withContext = features.filter((f) => f.multiTimeframeContext).length;
    console.log(`\nMulti-Timeframe Context:`);
    console.log(`  Features with multi-timeframe: ${withContext} (${(withContext / features.length * 100).toFixed(1)}%)`);

    // Count by outcome
    const wins = features.filter((f) => f.label === 'WIN').length;
    const losses = features.filter((f) => f.label === 'LOSS').length;
    console.log(`\nOutcome Distribution:`);
    console.log(`  WIN:  ${wins} (${(wins / features.length * 100).toFixed(1)}%)`);
    console.log(`  LOSS: ${losses} (${(losses / features.length * 100).toFixed(1)}%)`);

    // Count by pattern
    const patternCount: Record<string, number> = {};
    features.forEach((f) => {
      patternCount[f.patternType] = (patternCount[f.patternType] || 0) + 1;
    });

    console.log(`\nPattern Distribution:`);
    Object.entries(patternCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([pattern, count]) => {
        console.log(`  ${pattern}: ${count} (${(count / features.length * 100).toFixed(1)}%)`);
      });

    console.log('\n✅ Feature Extraction with Multi-Timeframe Context Complete!\n');
  } catch (error) {
    logger.error('[FeatureExtraction] Failed', {
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
