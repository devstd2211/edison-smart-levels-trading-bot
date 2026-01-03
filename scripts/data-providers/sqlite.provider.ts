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
import { IDataProvider, CandleData, TimeframeData } from './base.provider';

const sqlite3 = sqlite3Import.verbose();

const gunzipAsync = promisify(gunzip);

export class SqliteDataProvider implements IDataProvider {
  private dbPath: string;
  private db: Database | null = null;

  constructor(dbPath: string = path.join(__dirname, '../../data/market-data.db')) {
    this.dbPath = dbPath;
  }

  /**
   * Open database connection
   */
  private async openDatabase(): Promise<Database> {
    if (this.db) return this.db;

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
    const params: any = { symbol };

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
    console.log(`  - Querying 1m candles...`);
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
        : [symbol]
    ) as CandleData[];

    // Load 5m candles
    console.log(`  - Querying 5m candles...`);
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
        : [symbol]
    ) as CandleData[];

    // Load 15m candles
    console.log(`  - Querying 15m candles...`);
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
        : [symbol]
    ) as CandleData[];

    console.log(`✅ Loaded: ${candles1m.length} 1m, ${candles5m.length} 5m, ${candles15m.length} 15m candles`);

    // Check if we have data
    if (candles1m.length === 0 || candles5m.length === 0 || candles15m.length === 0) {
      throw new Error(
        `Insufficient data in SQLite for ${symbol}. Found: 1m=${candles1m.length}, 5m=${candles5m.length}, 15m=${candles15m.length}`
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
    timestamp: number
  ): Promise<{
    symbol: string;
    timestamp: number;
    bids: [number, number][];
    asks: [number, number][];
    updateId: number;
  } | null> {
    const db = await this.openDatabase();

    // Find closest orderbook snapshot (within 60 seconds)
    const snapshot = await db.get(
      `SELECT timestamp, bids, asks
       FROM orderbook_snapshots
       WHERE symbol = ? AND ABS(timestamp - ?) <= 60000
       ORDER BY ABS(timestamp - ?) ASC
       LIMIT 1`,
      [symbol, timestamp, timestamp]
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

      return {
        symbol,
        timestamp: snapshot.timestamp,
        bids,
        asks,
        updateId: 0, // Not tracked in database
      };
    } catch (error) {
      console.error(`Failed to decompress orderbook snapshot:`, error);
      return null;
    }
  }
}
