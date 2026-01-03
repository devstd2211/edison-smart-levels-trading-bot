/**
 * Data Collector Service (Refactored)
 *
 * Standalone service for collecting real-time market data for backtesting.
 * Collects: candles (multiple timeframes), orderbook snapshots, trade ticks.
 *
 * REFACTORED: Decomposed into separate components to prevent blocking.
 * - WebSocketReceiver: Parse messages (NO AWAIT)
 * - DataQueue: In-memory queues with memory limits
 * - DatabaseWriter: Batch INSERT operations
 * - PingPongHandler: Ping/pong handling
 *
 * NO TRADING LOGIC - data collection only!
 */

import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import WebSocket from 'ws';
import {
  DataCollectionConfig,
  OrderbookSnapshot,
  LoggerService,
} from '../types';

// Import decomposed components
import { PingPongHandler } from './data-collector/ping-pong.handler';
import { DataQueue } from './data-collector/data-queue';
import { DatabaseWriter } from './data-collector/database-writer';
import { WebSocketReceiver, ParsedMessage } from './data-collector/websocket-receiver';
import { TIME_MULTIPLIERS, TIMING_CONSTANTS, ORDERBOOK_SNAPSHOT_INTERVAL_MS } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

const BYBIT_WS_PUBLIC = 'wss://stream.bybit.com/v5/public/linear';
const RECONNECT_DELAY_MS = TIMING_CONSTANTS.RECONNECT_DELAY_MS;

// ============================================================================
// SERVICE
// ============================================================================

export class DataCollectorService {
  private db: Database | null = null;
  private ws: WebSocket | null = null;
  private orderbookInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private isStopping = false;

  // Latest orderbook snapshots (in memory)
  private latestOrderbooks: Map<string, { bids: Array<[string, string]>; asks: Array<[string, string]> }> =
    new Map();

  // Decomposed components
  private pingPongHandler: PingPongHandler;
  private dataQueue: DataQueue;
  private databaseWriter: DatabaseWriter | null = null;
  private receiver: WebSocketReceiver;

  constructor(
    private config: DataCollectionConfig,
    private logger: LoggerService,
  ) {
    // Initialize components
    this.pingPongHandler = new PingPongHandler(logger);
    this.dataQueue = new DataQueue(logger);
    this.receiver = new WebSocketReceiver(logger);
  }

  /**
   * Initialize database and create tables
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Data Collector (Multi-Symbol)', {
        symbols: this.config.symbols,
        symbolCount: this.config.symbols.length,
        timeframes: this.config.timeframes,
        orderbookInterval: this.config.orderbookInterval + 's',
        compression: this.config.database.compression,
      });

      // Open SQLite database
      this.db = await open({
        filename: this.config.database.path,
        driver: sqlite3.Database,
      });

      // Create tables
      await this.createTables();

      // Initialize DatabaseWriter
      this.databaseWriter = new DatabaseWriter(
        this.db,
        this.logger,
        this.config.database.compression,
      );

      this.logger.info('Database initialized', { path: this.config.database.path });
    } catch (error) {
      this.logger.error('Failed to initialize database', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create database tables with indexes
   */
  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Candles table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timeframe TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume REAL NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_candles_symbol_timeframe_timestamp
        ON candles(symbol, timeframe, timestamp);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_unique
        ON candles(symbol, timeframe, timestamp);
    `);

    // Orderbook snapshots table (with compression)
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS orderbook_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        bids BLOB NOT NULL,
        asks BLOB NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_orderbook_symbol_timestamp
        ON orderbook_snapshots(symbol, timestamp);
    `);

    // Trade ticks table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS trade_ticks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        price REAL NOT NULL,
        size REAL NOT NULL,
        side TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_trade_ticks_symbol_timestamp
        ON trade_ticks(symbol, timestamp);
    `);

    this.logger.info('Database tables created');
  }

  /**
   * Start collecting data (connect WebSocket + start intervals)
   */
  async start(): Promise<void> {
    this.logger.info('Starting Data Collector...');

    await this.connectWebSocket();

    // Start orderbook snapshot interval (if enabled)
    if (this.config.collectOrderbook) {
      this.startOrderbookSnapshotInterval();
    }

    // Start database writer
    if (this.databaseWriter) {
      this.databaseWriter.start(
        () => this.dataQueue.drainCandles(),
        () => this.dataQueue.drainOrderbooks(),
        () => this.dataQueue.drainTicks(),
      );
    }
  }

  /**
   * Stop collecting data
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Data Collector...');
    this.isStopping = true;

    // Stop ping/pong
    this.pingPongHandler.stop();

    // Stop orderbook interval
    if (this.orderbookInterval) {
      clearInterval(this.orderbookInterval);
      this.orderbookInterval = null;
    }

    // Stop database writer (will flush remaining data)
    if (this.databaseWriter) {
      await this.databaseWriter.stop(
        () => this.dataQueue.drainCandles(),
        () => this.dataQueue.drainOrderbooks(),
        () => this.dataQueue.drainTicks(),
      );
    }

    // Wait for any pending operations
    this.logger.info('Waiting for pending operations...');
    await new Promise((resolve) => setTimeout(resolve, TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND));

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Close database
    if (this.db) {
      await this.db.close();
      this.db = null;
    }

    // Clear queues
    this.dataQueue.clear();

    this.logger.info('Data Collector stopped');
  }

  /**
   * Connect to Bybit WebSocket and subscribe to streams
   */
  private async connectWebSocket(): Promise<void> {
    if (this.isConnecting) {
      return;
    }
    this.isConnecting = true;

    try {
      this.logger.info('Connecting to Bybit WebSocket...', { url: BYBIT_WS_PUBLIC });

      this.ws = new WebSocket(BYBIT_WS_PUBLIC, {
        handshakeTimeout: 10000,
      });

      this.ws.on('open', async () => {
        this.logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;

        // Subscribe to all streams
        await this.subscribeToStreams();

        // Start ping/pong handler
        if (this.ws) {
          this.pingPongHandler.start(this.ws);
        }
      });

      // CRITICAL FIX: Remove await from message handler (fire-and-forget)
      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleWebSocketMessage(data.toString()); // NO AWAIT!
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error', { error: error.message });
      });

      this.ws.on('close', async () => {
        this.logger.warn('WebSocket closed');
        this.isConnecting = false;

        // Stop ping/pong
        this.pingPongHandler.stop();

        // Reconnect
        await this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.error('Failed to connect WebSocket', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.isConnecting = false;
      await this.scheduleReconnect();
    }
  }

  /**
   * Subscribe to all configured streams (candles, orderbook, trades)
   */
  private async subscribeToStreams(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const subscriptions: string[] = [];

    // Subscribe to all symbols
    for (const symbol of this.config.symbols) {
      // Subscribe to candles (kline) for all timeframes
      for (const timeframe of this.config.timeframes) {
        const numericInterval = this.toNumericInterval(timeframe);
        subscriptions.push(`kline.${numericInterval}.${symbol}`);
      }

      // Subscribe to orderbook (50 levels)
      if (this.config.collectOrderbook) {
        subscriptions.push(`orderbook.50.${symbol}`);
      }

      // Subscribe to trade ticks
      if (this.config.collectTradeTicks) {
        subscriptions.push(`publicTrade.${symbol}`);
      }
    }

    // Send subscription message
    const subscribeMsg = {
      op: 'subscribe',
      args: subscriptions,
    };

    this.ws.send(JSON.stringify(subscribeMsg));

    this.logger.info('Subscribed to streams', {
      symbols: this.config.symbols,
      totalSubscriptions: subscriptions.length,
      subscriptionsPerSymbol: subscriptions.length / this.config.symbols.length,
    });
  }

  /**
   * Handle WebSocket message (NO AWAIT - fire-and-forget)
   */
  private handleWebSocketMessage(data: string): void {
    // Parse message (synchronous operation)
    const parsed = this.receiver.parseMessage(data);

    if (!parsed) {
      return;
    }

    // Handle different message types
    switch (parsed.type) {
    case 'subscription':
      if (parsed.success) {
        this.logger.info('✅ Subscription confirmed', {
          conn_id: parsed.conn_id,
        });
      } else {
        this.logger.error('❌ Subscription failed', {
          ret_msg: parsed.ret_msg,
          conn_id: parsed.conn_id,
        });
      }
      break;

    case 'server-ping':
      if (this.ws) {
        this.pingPongHandler.handleServerPing(this.ws, { op: 'ping', args: parsed.args });
      }
      break;

    case 'pong':
      this.pingPongHandler.handlePong({ op: parsed.op });
      break;

    case 'candle':
      // Add to queue (NO AWAIT!)
      this.dataQueue.addCandle(parsed.candle);

      // Log 1m candles for monitoring
      if (parsed.candle.timeframe === '1m') {
        this.logger.info('🕐 1m Candle received', {
          symbol: parsed.candle.symbol,
          timestamp: new Date(parsed.candle.timestamp).toISOString(),
          close: parsed.candle.close,
        });
      }
      break;

    case 'orderbook':
      // Store latest orderbook in memory (will be saved by interval)
      this.latestOrderbooks.set(parsed.symbol, {
        bids: parsed.bids,
        asks: parsed.asks,
      });
      break;

    case 'trade-ticks':
      // Add ticks to queue (NO AWAIT!)
      for (const tick of parsed.ticks) {
        this.dataQueue.addTick(tick);
      }
      break;

    case 'unhandled':
      this.logger.warn('⚠️ Unhandled message', {
        op: parsed.op,
        keys: parsed.keys,
      });
      break;
    }
  }

  /**
   * Start orderbook snapshot interval (save every N seconds)
   */
  private startOrderbookSnapshotInterval(): void {
    const intervalMs = ORDERBOOK_SNAPSHOT_INTERVAL_MS;

    this.orderbookInterval = setInterval(() => {
      // Add orderbook snapshots to queue (NO AWAIT!)
      for (const [symbol, orderbook] of this.latestOrderbooks) {
        const snapshot: OrderbookSnapshot = {
          symbol: symbol,
          timestamp: Date.now(),
          bids: JSON.stringify(orderbook.bids),
          asks: JSON.stringify(orderbook.asks),
          createdAt: Date.now(),
        };

        this.dataQueue.addOrderbook(snapshot);
      }

      // Log stats
      if (this.latestOrderbooks.size > 0) {
        this.logger.debug('Orderbook snapshots queued', {
          symbols: Array.from(this.latestOrderbooks.keys()),
          count: this.latestOrderbooks.size,
        });
      }
    }, intervalMs);

    this.logger.info('Orderbook snapshot interval started', {
      interval: intervalMs / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND + 's',
      symbols: this.config.symbols,
    });
  }

  /**
   * Schedule reconnect with exponential backoff
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.websocket.maxReconnectAttempts) {
      this.logger.error('Max reconnect attempts reached', {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.websocket.reconnectDelay * this.reconnectAttempts;

    this.logger.info('Scheduling reconnect', {
      attempt: this.reconnectAttempts,
      delay: delay + 'ms',
    });

    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  /**
   * Convert timeframe to numeric interval for Bybit v5 subscriptions
   */
  private toNumericInterval(timeframe: string): string {
    const map: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '30m': '30',
      '1h': '60',
      '4h': '240',
    };
    return map[timeframe] || timeframe;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    candles: number;
    orderbook_snapshots: number;
    trade_ticks: number;
  }> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const candlesCount = (await this.db.get('SELECT COUNT(*) as count FROM candles')) as
      | { count: number }
      | undefined;
    const orderbookCount = (await this.db.get('SELECT COUNT(*) as count FROM orderbook_snapshots')) as
      | { count: number }
      | undefined;
    const tradesCount = (await this.db.get('SELECT COUNT(*) as count FROM trade_ticks')) as
      | { count: number }
      | undefined;

    return {
      candles: candlesCount?.count || 0,
      orderbook_snapshots: orderbookCount?.count || 0,
      trade_ticks: tradesCount?.count || 0,
    };
  }

  /**
   * Get queue sizes (for monitoring)
   */
  getQueueSizes(): { candles: number; orderbooks: number; ticks: number } {
    return this.dataQueue.getSizes();
  }
}
