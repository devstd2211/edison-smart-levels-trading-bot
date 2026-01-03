/**
 * DatabaseWriter
 *
 * Batch INSERT operations for SQLite database.
 * Writes data in batches to avoid blocking WebSocket message processing.
 */

import { Database } from 'sqlite';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { CandleRecord, OrderbookSnapshot, TradeTickRecord, LoggerService } from '../../types';

const gzip = promisify(zlib.gzip);

// ============================================================================
// CONSTANTS
// ============================================================================

const BATCH_WRITE_INTERVAL_MS = 5000; // Write every 5 seconds
const MAX_BATCH_SIZE = 1000; // Max items per batch INSERT

// ============================================================================
// WRITER
// ============================================================================

export class DatabaseWriter {
  private writeInterval: NodeJS.Timeout | null = null;
  private isStopping = false;

  constructor(
    private db: Database,
    private logger: LoggerService,
    private compression: boolean = true,
    private batchIntervalMs: number = BATCH_WRITE_INTERVAL_MS,
  ) {}

  /**
   * Start batch writing interval
   */
  start(
    drainCandles: () => CandleRecord[],
    drainOrderbooks: () => OrderbookSnapshot[],
    drainTicks: () => TradeTickRecord[],
  ): void {
    this.writeInterval = setInterval(async () => {
      if (this.isStopping) {
        return;
      }

      try {
        // Drain queues
        const candles = drainCandles();
        const orderbooks = drainOrderbooks();
        const ticks = drainTicks();

        // Write batches
        if (candles.length > 0) {
          await this.writeCandlesBatch(candles);
        }
        if (orderbooks.length > 0) {
          await this.writeOrderbooksBatch(orderbooks);
        }
        if (ticks.length > 0) {
          await this.writeTicksBatch(ticks);
        }

        // Log stats
        if (candles.length > 0 || orderbooks.length > 0 || ticks.length > 0) {
          this.logger.debug('✅ Batch written to DB', {
            candles: candles.length,
            orderbooks: orderbooks.length,
            ticks: ticks.length,
          });
        }
      } catch (error) {
        this.logger.error('Failed to write batch', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.batchIntervalMs);

    this.logger.info('Database writer started', { intervalMs: this.batchIntervalMs });
  }

  /**
   * Stop batch writing
   */
  async stop(
    drainCandles: () => CandleRecord[],
    drainOrderbooks: () => OrderbookSnapshot[],
    drainTicks: () => TradeTickRecord[],
  ): Promise<void> {
    this.isStopping = true;

    if (this.writeInterval) {
      clearInterval(this.writeInterval);
      this.writeInterval = null;
    }

    // Final write - drain remaining data
    this.logger.info('Writing remaining data before shutdown...');
    try {
      const candles = drainCandles();
      const orderbooks = drainOrderbooks();
      const ticks = drainTicks();

      if (candles.length > 0) {
        await this.writeCandlesBatch(candles);
      }
      if (orderbooks.length > 0) {
        await this.writeOrderbooksBatch(orderbooks);
      }
      if (ticks.length > 0) {
        await this.writeTicksBatch(ticks);
      }

      this.logger.info('✅ Final batch written', {
        candles: candles.length,
        orderbooks: orderbooks.length,
        ticks: ticks.length,
      });
    } catch (error) {
      this.logger.error('Failed to write final batch', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Write candles batch to database
   */
  private async writeCandlesBatch(candles: CandleRecord[]): Promise<void> {
    if (candles.length === 0) {
      return;
    }

    // Split into chunks if too large
    const chunks = this.chunkArray(candles, MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      try {
        // Build batch INSERT query
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = chunk.flatMap((c) => [
          c.symbol,
          c.timeframe,
          c.timestamp,
          c.open,
          c.high,
          c.low,
          c.close,
          c.volume,
          c.createdAt,
        ]);

        await this.db.run(
          `INSERT OR IGNORE INTO candles (symbol, timeframe, timestamp, open, high, low, close, volume, createdAt)
           VALUES ${placeholders}`,
          values,
        );
      } catch (error) {
        this.logger.error('Failed to write candles batch', {
          error: error instanceof Error ? error.message : String(error),
          chunkSize: chunk.length,
        });
      }
    }
  }

  /**
   * Write orderbooks batch to database
   */
  private async writeOrderbooksBatch(orderbooks: OrderbookSnapshot[]): Promise<void> {
    if (orderbooks.length === 0) {
      return;
    }

    // Split into chunks if too large
    const chunks = this.chunkArray(orderbooks, MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      try {
        // Compress and prepare values
        const valuesPromises = chunk.map(async (ob) => {
          const bidsBuffer = this.compression
            ? await gzip(ob.bids)
            : Buffer.from(ob.bids);
          const asksBuffer = this.compression
            ? await gzip(ob.asks)
            : Buffer.from(ob.asks);
          return [ob.symbol, ob.timestamp, bidsBuffer, asksBuffer, ob.createdAt];
        });

        const values = await Promise.all(valuesPromises);

        // Build batch INSERT query
        const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        await this.db.run(
          `INSERT INTO orderbook_snapshots (symbol, timestamp, bids, asks, createdAt)
           VALUES ${placeholders}`,
          flatValues,
        );
      } catch (error) {
        this.logger.error('Failed to write orderbooks batch', {
          error: error instanceof Error ? error.message : String(error),
          chunkSize: chunk.length,
        });
      }
    }
  }

  /**
   * Write ticks batch to database
   */
  private async writeTicksBatch(ticks: TradeTickRecord[]): Promise<void> {
    if (ticks.length === 0) {
      return;
    }

    // Split into chunks if too large
    const chunks = this.chunkArray(ticks, MAX_BATCH_SIZE);

    for (const chunk of chunks) {
      try {
        // Build batch INSERT query
        const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
        const values = chunk.flatMap((t) => [
          t.symbol,
          t.timestamp,
          t.price,
          t.size,
          t.side,
          t.createdAt,
        ]);

        await this.db.run(
          `INSERT INTO trade_ticks (symbol, timestamp, price, size, side, createdAt)
           VALUES ${placeholders}`,
          values,
        );
      } catch (error) {
        this.logger.error('Failed to write ticks batch', {
          error: error instanceof Error ? error.message : String(error),
          chunkSize: chunk.length,
        });
      }
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}
