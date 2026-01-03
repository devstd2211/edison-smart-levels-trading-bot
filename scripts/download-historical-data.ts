/**
 * Historical Data Downloader
 *
 * Downloads historical kline data from Bybit API
 * Supports multiple timeframes and date ranges
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// ============================================================================
// TYPES
// ============================================================================

interface Kline {
  timestamp: number;      // Open time (ms)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
}

interface DownloadConfig {
  symbol: string;         // e.g., "APEXUSDT"
  interval: string;       // "1", "5", "15", "30", "60", "240"
  startDate: string;      // "2024-08-01"
  endDate: string;        // "2024-11-01"
  outputDir: string;      // "./data/historical"
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BYBIT_API_URL = 'https://api.bybit.com';
const MAX_LIMIT = 1000;  // Bybit max limit per request
const DELAY_MS = 500;    // Delay between requests to avoid rate limit

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert date string to timestamp (ms)
 */
function dateToTimestamp(dateStr: string): number {
  return new Date(dateStr).getTime();
}

/**
 * Convert interval string to minutes
 */
function intervalToMinutes(interval: string): number {
  const map: Record<string, number> = {
    '1': 1,
    '3': 3,
    '5': 5,
    '15': 15,
    '30': 30,
    '60': 60,
    '120': 120,
    '240': 240,
    'D': 1440,
    'W': 10080,
  };
  return map[interval] || 1;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

/**
 * Fetch klines from Bybit API
 */
async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Kline[]> {
  try {
    const url = `${BYBIT_API_URL}/v5/market/kline`;
    const params = {
      category: 'linear',
      symbol: symbol,
      interval: interval,
      start: startTime,
      end: endTime,
      limit: MAX_LIMIT,
    };

    const response = await axios.get(url, { params });

    if (response.data.retCode !== 0) {
      throw new Error(`Bybit API error: ${response.data.retMsg}`);
    }

    const list = response.data.result.list;

    // Convert Bybit format to our format
    const klines: Kline[] = list.map((item: any) => ({
      timestamp: parseInt(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
      turnover: parseFloat(item[6]),
    }));

    // Sort by timestamp ascending (Bybit returns descending)
    klines.sort((a, b) => a.timestamp - b.timestamp);

    return klines;
  } catch (error: any) {
    console.error('❌ Failed to fetch klines:', error.message);
    throw error;
  }
}

/**
 * Download all klines for given period
 */
async function downloadKlines(config: DownloadConfig): Promise<Kline[]> {
  console.log('\n📥 Downloading historical data...');
  console.log(`Symbol: ${config.symbol}`);
  console.log(`Interval: ${config.interval}m`);
  console.log(`Period: ${config.startDate} to ${config.endDate}`);

  const startTime = dateToTimestamp(config.startDate);
  const endTime = dateToTimestamp(config.endDate);
  const intervalMinutes = intervalToMinutes(config.interval);
  const intervalMs = intervalMinutes * 60 * 1000;

  const allKlines: Kline[] = [];
  let currentStart = startTime;
  let requestCount = 0;

  while (currentStart < endTime) {
    const currentEnd = Math.min(currentStart + (MAX_LIMIT * intervalMs), endTime);

    console.log(`⏳ Request #${++requestCount}: ${new Date(currentStart).toISOString()} - ${new Date(currentEnd).toISOString()}`);

    const klines = await fetchKlines(config.symbol, config.interval, currentStart, currentEnd);

    if (klines.length === 0) {
      console.log('⚠️  No more data available');
      break;
    }

    allKlines.push(...klines);
    console.log(`✅ Fetched ${klines.length} candles (Total: ${formatNumber(allKlines.length)})`);

    // Move to next batch
    currentStart = klines[klines.length - 1].timestamp + intervalMs;

    // Rate limiting
    if (currentStart < endTime) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n🎉 Download complete! Total candles: ${formatNumber(allKlines.length)}`);

  return allKlines;
}

/**
 * Aggregate 1m candles to higher timeframes
 */
function aggregateCandles(candles: Kline[], targetIntervalMinutes: number): Kline[] {
  if (targetIntervalMinutes === 1) {
    return candles;
  }

  console.log(`\n🔄 Aggregating to ${targetIntervalMinutes}m timeframe...`);

  const aggregated: Kline[] = [];
  const intervalMs = targetIntervalMinutes * 60 * 1000;

  let i = 0;
  while (i < candles.length) {
    const bucketStart = candles[i].timestamp;
    const bucketEnd = bucketStart + intervalMs;

    // Collect all candles in this bucket
    const bucket: Kline[] = [];
    while (i < candles.length && candles[i].timestamp < bucketEnd) {
      bucket.push(candles[i]);
      i++;
    }

    if (bucket.length === 0) continue;

    // Aggregate
    const aggregatedCandle: Kline = {
      timestamp: bucketStart,
      open: bucket[0].open,
      high: Math.max(...bucket.map(c => c.high)),
      low: Math.min(...bucket.map(c => c.low)),
      close: bucket[bucket.length - 1].close,
      volume: bucket.reduce((sum, c) => sum + c.volume, 0),
      turnover: bucket.reduce((sum, c) => sum + c.turnover, 0),
    };

    aggregated.push(aggregatedCandle);
  }

  console.log(`✅ Aggregated ${candles.length} → ${aggregated.length} candles`);

  return aggregated;
}

/**
 * Save klines to JSON file
 */
function saveKlines(klines: Kline[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(klines, null, 2));

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`💾 Saved to: ${outputPath} (${sizeKb} KB)`);
}

/**
 * Save klines to CSV file
 */
function saveKlinesCsv(klines: Kline[], outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const header = 'timestamp,datetime,open,high,low,close,volume,turnover\n';
  const rows = klines.map(k => {
    const datetime = new Date(k.timestamp).toISOString();
    return `${k.timestamp},${datetime},${k.open},${k.high},${k.low},${k.close},${k.volume},${k.turnover}`;
  }).join('\n');

  fs.writeFileSync(outputPath, header + rows);

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`💾 Saved to: ${outputPath} (${sizeKb} KB)`);
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 BYBIT HISTORICAL DATA DOWNLOADER');
  console.log('═══════════════════════════════════════════════════════════════');

  // Parse command line arguments
  const args = process.argv.slice(2);

  const symbol = args[0] || 'BTCUSDT';
  const startDate = args[1] || '2025-11-01';
  const endDate = args[2] || '2025-12-01';
  const outputDir = args[3] || './data/historical';

  // Download 1m candles (base timeframe)
  const config: DownloadConfig = {
    symbol,
    interval: '1',
    startDate,
    endDate,
    outputDir,
  };

  try {
    const candles1m = await downloadKlines(config);

    if (candles1m.length === 0) {
      console.log('❌ No data downloaded. Exiting.');
      return;
    }

    // Save 1m candles
    const filename1m = `${symbol}_1m_${startDate}_${endDate}`;
    saveKlines(candles1m, path.join(outputDir, `${filename1m}.json`));
    saveKlinesCsv(candles1m, path.join(outputDir, `${filename1m}.csv`));

    // Generate higher timeframes
    console.log('\n🔄 Generating higher timeframes...');

    const timeframes = [
      { interval: 5, name: '5m' },
      { interval: 15, name: '15m' },
      { interval: 30, name: '30m' },
      { interval: 60, name: '1h' },
    ];

    for (const tf of timeframes) {
      const aggregated = aggregateCandles(candles1m, tf.interval);
      const filename = `${symbol}_${tf.name}_${startDate}_${endDate}`;
      saveKlines(aggregated, path.join(outputDir, `${filename}.json`));
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ ALL DONE!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`\nData saved to: ${outputDir}`);
    console.log('\nGenerated files:');
    console.log(`  - ${symbol}_1m_*.json/csv`);
    console.log(`  - ${symbol}_5m_*.json`);
    console.log(`  - ${symbol}_15m_*.json`);
    console.log(`  - ${symbol}_30m_*.json`);
    console.log(`  - ${symbol}_1h_*.json`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*
USAGE:

# Download default (APEXUSDT, last 3 months)
npm run download-data

# Download specific symbol and dates
npm run download-data BTCUSDT 2024-01-01 2024-11-07

# Download with custom output directory
npm run download-data APEXUSDT 2024-08-01 2024-11-07 ./data/backtest

MANUAL:
npx ts-node scripts/download-historical-data.ts [SYMBOL] [START_DATE] [END_DATE] [OUTPUT_DIR]
*/

// Run
if (require.main === module) {
  main();
}

export { downloadKlines, aggregateCandles, saveKlines };
