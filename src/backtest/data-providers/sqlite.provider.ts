/**
 * SQLite Data Provider
 *
 * Reads historical candle data from SQLite database (market-data.db)
 * Schema: candles table with columns: symbol, timeframe, timestamp, open, high, low, close, volume
 */

import * as sqlite3Import from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';
import { promisify } from 'util';
import { gunzip } from 'zlib';
import { IDataProvider, TimeframeData } from './base.provider';

const sqlite3 = sqlite3Import.verbose();

const gunzipAsync = promisify(gunzip);

export class SqliteDataProvider implements IDataProvider {
  private dbPath: string;
  private db: Database | null = null;
  private orderbookCache = new Map<number, any>(); // ✅ Cache for orderbook snapshots

  constructor(dbPath: string = '') {
    // Auto-detect: prefer market-data-multi.db (from data-collector) if it exists
    if (!dbPath) {
      const multiDbPath = path.join(__dirname, '../../../data/market-data-multi.db');
      const singleDbPath = path.join(__dirname, '../../../data/market-data.db');

      // Check if multi-db exists and is not empty
      if (require('fs').existsSync(multiDbPath)) {
        const stats = require('fs').statSync(multiDbPath);
        if (stats.size > 1000000) { // > 1MB = has data
          this.dbPath = multiDbPath;
          console.log('📊 Using multi-symbol database: market-data-multi.db');
        } else {
          this.dbPath = singleDbPath;
          console.log('📊 Using single-symbol database: market-data.db');
        }
      } else {
        this.dbPath = singleDbPath;
        console.log('📊 Using single-symbol database: market-data.db');
      }
    } else {
      this.dbPath = dbPath;
    }
  }

  /**
   * Open database connection
   */
  private async openDatabase(): Promise<Database> {
    if (this.db) {
      return this.db;
    }

    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    return this.db;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Load candles from SQLite database
   */
  async loadCandles(symbol: string, startTime?: number, endTime?: number): Promise<TimeframeData> {
    console.log(`📥 Loading data from SQLite database (${this.dbPath})...`);

    const db = await this.openDatabase();

    // Build WHERE clause for time filtering
    let timeFilter = '';
    const params: Record<string, number | string> = { symbol };

    if (startTime && endTime) {
      timeFilter = 'AND timestamp >= :startTime AND timestamp <= :endTime';
      params.startTime = startTime;
      params.endTime = endTime;
    } else if (startTime) {
      timeFilter = 'AND timestamp >= :startTime';
      params.startTime = startTime;
    } else if (endTime) {
      timeFilter = 'AND timestamp <= :endTime';
      params.endTime = endTime;
    }

    // Load 1m candles
    console.log('  - Querying 1m candles...');
    const candles1m = await db.all(
      `SELECT timestamp, open, high, low, close, volume
       FROM candles
       WHERE symbol = ? AND timeframe = '1m' ${timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?')}
       ORDER BY timestamp ASC`,
      startTime && endTime
        ? [symbol, startTime, endTime]
        : startTime
          ? [symbol, startTime]
          : endTime
            ? [symbol, endTime]
            : [symbol],
    );

    // Load 5m candles
    console.log('  - Querying 5m candles...');
    const candles5m = await db.all(
      `SELECT timestamp, open, high, low, close, volume
       FROM candles
       WHERE symbol = ? AND timeframe = '5m' ${timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?')}
       ORDER BY timestamp ASC`,
      startTime && endTime
        ? [symbol, startTime, endTime]
        : startTime
          ? [symbol, startTime]
          : endTime
            ? [symbol, endTime]
            : [symbol],
    );

    // Load 15m candles
    console.log('  - Querying 15m candles...');
    const candles15m = await db.all(
      `SELECT timestamp, open, high, low, close, volume
       FROM candles
       WHERE symbol = ? AND timeframe = '15m' ${timeFilter.replace(':symbol', '?').replace(':startTime', '?').replace(':endTime', '?')}
       ORDER BY timestamp ASC`,
      startTime && endTime
        ? [symbol, startTime, endTime]
        : startTime
          ? [symbol, startTime]
          : endTime
            ? [symbol, endTime]
            : [symbol],
    );

    console.log(`✅ Loaded: ${candles1m.length} 1m, ${candles5m.length} 5m, ${candles15m.length} 15m candles`);

    // Check if we have data
    if (candles1m.length === 0 || candles5m.length === 0 || candles15m.length === 0) {
      console.error(`\n❌ Insufficient data in SQLite for ${symbol}`);
      console.error(`Found: 1m=${candles1m.length}, 5m=${candles5m.length}, 15m=${candles15m.length}`);
      console.error(`Database: ${this.dbPath}`);
      console.error(`Time filter: ${timeFilter || 'none'}`);
      throw new Error(
        `Insufficient data in SQLite for ${symbol}. Found: 1m=${candles1m.length}, 5m=${candles5m.length}, 15m=${candles15m.length}`,
      );
    }

    return {
      candles1m,
      candles5m,
      candles15m,
    };
  }

  getSourceName(): string {
    return 'SQLite Database';
  }

  /**
   * Load orderbook snapshot for a specific timestamp
   * Finds the closest orderbook snapshot to the given timestamp (within 60 seconds)
   */
  async loadOrderbookForCandle(
    symbol: string,
    timestamp: number,
  ): Promise<{
    symbol: string;
    timestamp: number;
    bids: [number, number][];
    asks: [number, number][];
    updateId: number;
  } | null> {
    // ✅ Check cache first (HUGE speedup!)
    const cacheKey = timestamp;
    if (this.orderbookCache.has(cacheKey)) {
      return this.orderbookCache.get(cacheKey)!;
    }

    const db = await this.openDatabase();

    // Find closest orderbook snapshot (within 60 seconds)
    const snapshot = await db.get(
      `SELECT timestamp, bids, asks
       FROM orderbook_snapshots
       WHERE symbol = ? AND ABS(timestamp - ?) <= 60000
       ORDER BY ABS(timestamp - ?) ASC
       LIMIT 1`,
      [symbol, timestamp, timestamp],
    );

    if (!snapshot) {
      return null;
    }

    try {
      // Decompress BLOB data
      const bidsBuffer = Buffer.from(snapshot.bids);
      const asksBuffer = Buffer.from(snapshot.asks);

      const bidsDecompressed = await gunzipAsync(bidsBuffer);
      const asksDecompressed = await gunzipAsync(asksBuffer);

      // Parse JSON
      const bids = JSON.parse(bidsDecompressed.toString());
      const asks = JSON.parse(asksDecompressed.toString());

      const result = {
        symbol,
        timestamp: snapshot.timestamp,
        bids,
        asks,
        updateId: 0, // Not tracked in database
      };

      // ✅ Cache the result (avoid repeated decompress+parse!)
      this.orderbookCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Failed to decompress orderbook snapshot:', error);
      return null;
    }
  }

  /**
   * Load trade ticks for a time range
   * Used by TickDelta backtesting
   */
  async loadTicks(symbol: string, startTime: number, endTime: number): Promise<any[]> {
    const db = await this.openDatabase();

    try {
      const ticks = await db.all(
        `SELECT timestamp, price, size, side
         FROM trade_ticks
         WHERE symbol = ? AND timestamp >= ? AND timestamp <= ?
         ORDER BY timestamp ASC`,
        [symbol, startTime, endTime],
      );

      return ticks || [];
    } catch (error) {
      console.error('Failed to load ticks:', error);
      return [];
    }
  }
}
