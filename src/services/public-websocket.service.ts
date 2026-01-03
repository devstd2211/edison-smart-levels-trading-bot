/**
 * Public WebSocket Service
 * Subscribes to public market data (kline/candles)
 *
 * Responsibilities:
 * 1. Connect to Bybit Public WebSocket V5
 * 2. Subscribe to kline (candle) updates
 * 3. Emit events when new candle closes
 * 4. Handle reconnection and errors
 *
 * Single Responsibility: Public market data streaming
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Candle, ExchangeConfig, TimeframeRole, LoggerService, KlineData, OrderbookData, TradeData } from '../types';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { TIMING_CONSTANTS } from '../constants/technical.constants';

// ============================================================================
// CONSTANTS
// ============================================================================

// NOTE: Public WebSocket uses the same URL for both demo and live accounts
// Only Private WebSocket has separate demo endpoint
const WS_PUBLIC_URL = 'wss://stream.bybit.com/v5/public/linear';
const PING_INTERVAL_MS = TIMING_CONSTANTS.PING_INTERVAL_MS;
const RECONNECT_DELAY_MS = TIMING_CONSTANTS.RECONNECT_DELAY_MS;
const MAX_RECONNECT_ATTEMPTS = TIMING_CONSTANTS.MAX_RECONNECT_ATTEMPTS;

// ============================================================================
// PUBLIC WEBSOCKET SERVICE
// ============================================================================

export class PublicWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private subscribedTopics: Set<string> = new Set();
  private lastIncompleteWarning: number = 0; // Timestamp of last incomplete orderbook warning
  private btcConfirmation?: any; // BTC confirmation config (optional)
  private btcCandlesStore?: { btcCandles1m: Candle[] }; // Reference to bot services for updating BTC candles

  constructor(
    private readonly config: ExchangeConfig,
    private readonly symbol: string,
    private readonly timeframeProvider: TimeframeProvider,
    private readonly logger: LoggerService,
    btcConfirmation?: any,
  ) {
    super();
    this.btcConfirmation = btcConfirmation;
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Set the BTC candles store (used to update candles from WebSocket)
   * Called by BotServices after initialization
   */
  setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void {
    this.btcCandlesStore = store;
    if (this.btcConfirmation) {
      this.logger.debug('🔗 BTC candles store configured for WebSocket updates');
    }
  }

  /**
   * Connect to Public WebSocket and subscribe to kline
   */
  connect(): void {
    if (this.isConnecting || (this.ws !== null && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    // Public WebSocket always uses the main URL (same for demo and live)
    const wsUrl = WS_PUBLIC_URL;

    this.logger.info('Connecting to Public WebSocket', { wsUrl });
    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.logger.info('Public WebSocket connected');
      this.subscribe();
      this.startPing();
      this.emit('connected');
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      let message: string;
      if (typeof data === 'string') {
        message = data;
      } else if (Buffer.isBuffer(data)) {
        message = data.toString('utf-8');
      } else if (Array.isArray(data)) {
        message = Buffer.concat(data).toString('utf-8');
      } else {
        return;
      }
      this.handleMessage(message);
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('Public WebSocket error', { error: error.message });
      this.emit('error', error);
    });

    this.ws.on('close', () => {
      this.isConnecting = false;
      this.stopPing();
      this.logger.warn('Public WebSocket disconnected');
      this.emit('disconnected');

      if (this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        this.logger.info('Reconnecting to Public WebSocket', {
          attempt: this.reconnectAttempts,
          maxAttempts: MAX_RECONNECT_ATTEMPTS,
        });
        setTimeout(() => {
          this.connect();
        }, RECONNECT_DELAY_MS);
      }
    });
  }

  /**
   * Disconnect from Public WebSocket
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();

    if (this.ws !== null) {
      this.ws.close();
      this.ws = null;
    }

    this.logger.info('Public WebSocket disconnected');
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Subscribe to kline topics for all enabled timeframes and orderbook
   */
  private subscribe(): void {
    if (this.ws === null || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const timeframes = this.timeframeProvider.getAllTimeframes();
    const topics: string[] = [];

    // Subscribe to kline (candles)
    for (const [role, config] of timeframes) {
      // Topic: kline.{interval}.{symbol}
      // Example: kline.5.BTCUSDT
      const topic = `kline.${config.interval}.${this.symbol}`;
      topics.push(topic);
      this.subscribedTopics.add(topic);
    }

    // Subscribe to orderbook (depth 50 for whale detection)
    const orderbookTopic = `orderbook.50.${this.symbol}`;
    topics.push(orderbookTopic);
    this.subscribedTopics.add(orderbookTopic);

    // Subscribe to public trades (for Delta Analysis)
    const tradeTopic = `publicTrade.${this.symbol}`;
    topics.push(tradeTopic);
    this.subscribedTopics.add(tradeTopic);

    // Subscribe to BTC kline (1m) for correlation analysis (if enabled)
    if (this.btcConfirmation?.enabled) {
      const btcInterval = this.btcConfirmation.timeframe || '1';
      const btcSymbol = this.btcConfirmation.symbol || 'BTCUSDT';
      const btcTopic = `kline.${btcInterval}.${btcSymbol}`;
      topics.push(btcTopic);
      this.subscribedTopics.add(btcTopic);
      this.logger.info('🔗 BTC subscription added', { btcTopic, btcSymbol, interval: btcInterval });
    }

    const subscribeMessage = {
      op: 'subscribe',
      args: topics,
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    this.logger.info('Subscribed to timeframes, orderbook, public trades' + (this.btcConfirmation?.enabled ? ', and BTC' : ''), { topics });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as {
        success?: boolean;
        op?: string;
        topic?: string;
        type?: string;
        data?: unknown;
      };

      // Handle subscription confirmation
      if (message.op === 'subscribe' && message.success === true) {
        this.logger.debug('Subscription confirmed');
        return;
      }

      // Handle pong
      if (message.op === 'pong') {
        return;
      }

      // Handle kline data
      if (message.topic?.startsWith('kline.') && message.data !== undefined && message.data !== null) {
        this.handleKlineUpdate(message.data as KlineData | KlineData[], message.topic);
      }

      // Handle orderbook data
      if (message.topic?.startsWith('orderbook.') && message.data !== undefined && message.data !== null) {
        this.handleOrderbookUpdate(message.data as OrderbookData);
      }

      // Handle public trade data (for Delta Analysis)
      if (message.topic?.startsWith('publicTrade.') && message.data !== undefined && message.data !== null) {
        this.handleTradeUpdate(message.data as TradeData | TradeData[]);
      }
    } catch (error) {
      this.logger.error('Failed to parse Public WebSocket message', {
        error: String(error),
        data: data.substring(0, 200),
      });
      this.emit('error', new Error(`Failed to parse message: ${String(error)}`));
    }
  }

  /**
   * Handle kline update from WebSocket
   * Handles both main symbol (XRPUSDT) and BTC candles
   */
  private handleKlineUpdate(data: KlineData | KlineData[], topic?: string): void {
    const klines = Array.isArray(data) ? data : [data];

    // Extract symbol from topic (e.g., "kline.1.BTCUSDT" -> "BTCUSDT")
    let topicSymbol = '';
    if (topic) {
      const parts = topic.split('.');
      if (parts.length >= 3) {
        topicSymbol = parts[2]; // parts[0]="kline", parts[1]="interval", parts[2]="SYMBOL"
      }
    }

    for (const kline of klines) {
      const klineData = kline;

      // Only process closed candles (confirm = true)
      if (klineData.confirm !== true) {
        continue;
      }

      const candle: Candle = {
        timestamp: parseInt(klineData.start ?? '0'),
        open: parseFloat(klineData.open ?? '0'),
        high: parseFloat(klineData.high ?? '0'),
        low: parseFloat(klineData.low ?? '0'),
        close: parseFloat(klineData.close ?? '0'),
        volume: parseFloat(klineData.volume ?? '0'),
      };

      // Check if this is a BTC candle - use symbol from topic (not from klineData.symbol which is empty)
      const isBtcCandle = this.btcConfirmation?.enabled && topicSymbol === (this.btcConfirmation.symbol || 'BTCUSDT');

      // DEBUG: Log all kline symbols to track what's coming
      if (topicSymbol !== this.symbol) {
        this.logger.debug('🔍 Received non-main kline', {
          symbol: topicSymbol,
          close: candle.close,
          isBtcCandle,
          expectedBtcSymbol: this.btcConfirmation?.symbol || 'BTCUSDT',
          topic,
        });
      }

      if (isBtcCandle) {
        // Handle BTC candle - update the BTC candles store
        if (this.btcCandlesStore) {
          // Keep only the last N candles (same as lookbackCandles)
          const maxCandles = this.btcConfirmation.lookbackCandles || 100;
          this.btcCandlesStore.btcCandles1m.push(candle);
          if (this.btcCandlesStore.btcCandles1m.length > maxCandles) {
            this.btcCandlesStore.btcCandles1m.shift();
          }

          this.logger.info('🔗 BTC candle updated', {
            symbol: 'BTCUSDT',
            timestamp: new Date(candle.timestamp).toISOString(),
            close: candle.close,
            totalCandles: this.btcCandlesStore.btcCandles1m.length,
          });
        }
        continue;
      }

      // Handle main symbol candles (XRPUSDT or other)
      // Determine timeframe role from interval
      const interval = klineData.interval ?? '';
      const role = this.getTimeframeRole(interval);

      if (role == null) {
        this.logger.warn('Unknown interval received', { interval, symbol: topicSymbol });
        continue;
      }

      this.logger.info('🕯️ New candle closed', {
        symbol: this.symbol,
        role,
        interval,
        timestamp: new Date(candle.timestamp).toISOString(),
        close: candle.close,
      });

      // Emit event with role - bot will update cache and potentially trigger trading cycle
      this.emit('candleClosed', { role, candle });
    }
  }

  /**
   * Handle orderbook update from WebSocket
   * Detects snapshot vs delta and emits raw update for OrderbookManager
   */
  private handleOrderbookUpdate(data: OrderbookData): void {
    try {
      const orderbookData = data;

      if (!orderbookData.b || !orderbookData.a) {
        this.logger.warn('⚠️ Orderbook data missing b or a', {
          hasB: !!orderbookData.b,
          hasA: !!orderbookData.a,
          rawData: JSON.stringify(data).substring(0, 200),
        });
        return;
      }

      // Detect message type:
      // - "snapshot" type field OR
      // - updateId = 1 indicates service restart (treat as snapshot) OR
      // - Large number of levels (>40) on first message = snapshot
      const isSnapshot =
        orderbookData.type === 'snapshot' ||
        orderbookData.u === 1 ||
        (!this.lastIncompleteWarning && // First message
          orderbookData.b.length > 40 &&
          orderbookData.a.length > 40);

      // Log snapshot detection
      if (isSnapshot) {
        this.logger.info('📸 Orderbook SNAPSHOT detected', {
          bids: orderbookData.b.length,
          asks: orderbookData.a.length,
          updateId: orderbookData.u,
          type: orderbookData.type,
        });
      }

      // Emit raw orderbook update for OrderbookManager
      this.emit('orderbookUpdate', {
        type: isSnapshot ? 'snapshot' : 'delta',
        symbol: orderbookData.s ?? this.symbol,
        bids: orderbookData.b,
        asks: orderbookData.a,
        updateId: orderbookData.u ?? 0,
        timestamp: Date.now(),
      });

      // Mark as initialized after first message
      if (isSnapshot) {
        this.lastIncompleteWarning = Date.now();
      }
    } catch (error) {
      this.logger.error('Failed to handle orderbook update', {
        error: String(error),
      });
    }
  }

  /**
   * Handle public trade update from WebSocket (for Delta Analysis)
   */
  private handleTradeUpdate(data: TradeData | TradeData[]): void {
    try {
      const trades = Array.isArray(data) ? data : [data];

      for (const trade of trades) {
        const tradeData = trade;

        if (!tradeData.T || !tradeData.S || !tradeData.v || !tradeData.p) {
          this.logger.warn('⚠️ Incomplete trade data', {
            hasTimestamp: !!tradeData.T,
            hasSide: !!tradeData.S,
            hasVolume: !!tradeData.v,
            hasPrice: !!tradeData.p,
          });
          continue;
        }

        // Emit trade event for DeltaAnalyzerService
        this.emit('trade', {
          timestamp: tradeData.T,
          price: parseFloat(tradeData.p),
          quantity: parseFloat(tradeData.v),
          side: tradeData.S === 'Buy' ? 'BUY' : 'SELL',
        });

        // Commented out: Too spammy (logs every trade tick)
        // this.logger.debug('📊 Trade tick received', {
        //   side: tradeData.S,
        //   price: tradeData.p,
        //   quantity: tradeData.v,
        // });
      }
    } catch (error) {
      this.logger.error('Failed to handle trade update', {
        error: String(error),
      });
    }
  }

  /**
   * Get timeframe role from interval string
   */
  private getTimeframeRole(interval: string): TimeframeRole | null {
    const timeframes = this.timeframeProvider.getAllTimeframes();

    for (const [role, config] of timeframes) {
      if (config.interval === interval) {
        return role;
      }
    }

    return null;
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.stopPing();

    this.pingInterval = setInterval(() => {
      if (this.ws !== null && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ op: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}
