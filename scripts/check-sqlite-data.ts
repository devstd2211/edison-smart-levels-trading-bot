/**
 * Check SQLite Database Data
 *
 * Quick script to check what data is available in market-data.db
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'path';
import { ICONS } from '../packages/core/src/cli/cli-runtime';

async function main() {
  const dbPath = path.join(__dirname, '../data/market-data.db');

  console.log(`${ICONS.chart} Checking SQLite database: ${dbPath}
`);

  // Open database
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Get unique symbols
  const symbols = await db.all<Array<{ symbol: string }>>(
    'SELECT DISTINCT symbol FROM candles'
  );

  console.log(`${ICONS.package} Symbols in database: ${symbols.map((s) => s.symbol).join(', ')}
`);

  // For each symbol, get timeframes and count
  for (const { symbol } of symbols) {
    console.log(`${ICONS.small_blue_diamond} ${symbol}:`);

    const timeframes = await db.all<Array<{ timeframe: string; count: number; minTs: number; maxTs: number }>>(
      `SELECT
         timeframe,
         COUNT(*) as count,
         MIN(timestamp) as minTs,
         MAX(timestamp) as maxTs
       FROM candles
       WHERE symbol = ?
       GROUP BY timeframe
       ORDER BY timeframe`,
      symbol
    );

    for (const tf of timeframes) {
      const minDate = new Date(tf.minTs).toISOString();
      const maxDate = new Date(tf.maxTs).toISOString();
      console.log(`  - ${tf.timeframe}: ${tf.count} candles (${minDate} → ${maxDate})`);
    }

    console.log('');
  }

  await db.close();
}

main().catch((error) => {
  console.error(`${ICONS.error} Error:`, error);
  process.exit(1);
});

