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
import type { ILifecycle } from '../interfaces/ILifecycle';
import {
  Candle,
  ExchangeConfig,
  KlineData,
  LoggerService,
  OrderbookData,
  TimeframeRole,
  TradeData,
} from '../types/legacy';
import { TimeframeProvider } from '../providers/timeframe.provider';
import { TIMING_CONSTANTS } from '../constants/technical.constants';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import {
  buildPublicWebSocketSubscriptionMessage,
  buildPublicWebSocketTopics,
  decodePublicWebSocketMessage,
  type PublicWebSocketBtcConfirmationConfig,
  WS_PUBLIC_URL,
} from './public-websocket/public-websocket-connection.utils';
import {
  appendBtcCandle,
  detectOrderbookSnapshot,
  extractSymbolFromKlineTopic,
  findTimeframeRoleByInterval,
  isBtcKlineTopic,
  isOrderbookDataComplete,
  isTradeDataComplete,
  mapClosedCandleFromKline,
  mapOrderbookUpdateEvent,
  mapTradeEvent,
} from './public-websocket/public-websocket-message.utils';

const PING_INTERVAL_MS = TIMING_CONSTANTS.PING_INTERVAL_MS;
const RECONNECT_DELAY_MS = TIMING_CONSTANTS.RECONNECT_DELAY_MS;
const MAX_RECONNECT_ATTEMPTS = TIMING_CONSTANTS.MAX_RECONNECT_ATTEMPTS;

export class PublicWebSocketService extends EventEmitter implements ILifecycle {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;
  private subscribedTopics: Set<string> = new Set();
  private lastIncompleteWarning = 0;
  private btcConfirmation?: PublicWebSocketBtcConfirmationConfig;
  private btcCandlesStore?: { btcCandles1m: Candle[] };

  constructor(
    private readonly config: ExchangeConfig,
    private readonly symbol: string,
    private readonly timeframeProvider: TimeframeProvider,
    private readonly logger: LoggerService,
    private readonly errorHandler?: ErrorHandler,
    btcConfirmation?: PublicWebSocketBtcConfirmationConfig,
  ) {
    super();
    this.btcConfirmation = btcConfirmation;
  }

  setBtcCandlesStore(store: { btcCandles1m: Candle[] }): void {
    this.btcCandlesStore = store;
    if (this.btcConfirmation) {
      this.logger.debug('BTC candles store configured for WebSocket updates');
    }
  }

  connect(): void {
    if (this.isConnecting || (this.ws !== null && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;

    this.logger.info('Connecting to Public WebSocket', { wsUrl: WS_PUBLIC_URL });
    this.ws = new WebSocket(WS_PUBLIC_URL);

    this.ws.on('open', () => {
      this.handleOpen();
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      const message = decodePublicWebSocketMessage(data);
      if (message === null) {
        return;
      }

      this.handleMessage(message);
    });

    this.ws.on('error', (error: Error) => {
      this.handleConnectionError(error);
    });

    this.ws.on('close', () => {
      this.handleClose();
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();
    const socket = this.ws;
    this.ws = null;

    try {
      if (socket !== null) {
        socket.close();
      }

      this.logger.info('Public WebSocket disconnected');
    } catch (error) {
      const closeError = error instanceof Error ? error : new Error(String(error));
      this.logger.warn('Error during disconnect', {
        error: closeError.message,
      });

      if (this.errorHandler) {
        this.errorHandler.handle(closeError, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PublicWebSocketService.disconnect',
          logger: this.logger,
        });
      }
    }
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    this.disconnect();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private subscribe(): void {
    if (!this.hasOpenSocket()) {
      return;
    }

    const topics = buildPublicWebSocketTopics({
      symbol: this.symbol,
      timeframes: this.timeframeProvider.getAllTimeframes(),
      btcConfirmation: this.btcConfirmation,
    });

    if (this.btcConfirmation?.enabled) {
      const btcSymbol = this.btcConfirmation.symbol || 'BTCUSDT';
      const btcTopic = topics.find(
        (topic) => topic.startsWith('kline.') && topic.endsWith(`.${btcSymbol}`),
      );
      this.logger.info('BTC subscription added', {
        btcTopic,
        btcSymbol,
        interval: this.btcConfirmation.timeframe || '1',
        });
    }

    const sent = this.sendSocketPayload(
      buildPublicWebSocketSubscriptionMessage(topics),
      'PublicWebSocketService.subscribe',
      RecoveryStrategy.GRACEFUL_DEGRADE,
    );

    if (!sent) {
      this.subscribedTopics.clear();
      return;
    }

    this.subscribedTopics = new Set(topics);
    this.logger.info(
      'Subscribed to timeframes, orderbook, public trades' +
        (this.btcConfirmation?.enabled ? ', and BTC' : ''),
      { topics },
    );
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as {
        success?: boolean;
        op?: string;
        topic?: string;
        type?: string;
        data?: unknown;
      };

      if (message.op === 'subscribe' && message.success === true) {
        this.logger.debug('Subscription confirmed');
        return;
      }

      if (message.op === 'pong') {
        return;
      }

      this.routeTopicMessage(message.topic, message.data);
    } catch (error) {
      const parseError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to parse Public WebSocket message', {
        error: parseError.message,
        data: data.substring(0, 200),
      });

      if (this.errorHandler) {
        this.errorHandler.handle(parseError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PublicWebSocketService.handleMessage',
          logger: this.logger,
        });
        this.logger.warn('Skipping malformed message due to parse error');
      } else {
        this.emit('error', new Error(`Failed to parse message: ${parseError.message}`));
      }
    }
  }

  private handleKlineUpdate(data: KlineData | KlineData[], topic?: string): void {
    const klines = Array.isArray(data) ? data : [data];
    const topicSymbol = extractSymbolFromKlineTopic(topic);

    for (const klineData of klines) {
      const candle = mapClosedCandleFromKline(klineData);
      if (!candle) {
        continue;
      }

      const isBtcCandle = isBtcKlineTopic(topicSymbol, this.btcConfirmation);

      if (topicSymbol !== this.symbol) {
        this.logger.debug('Received non-main kline', {
          symbol: topicSymbol,
          close: candle.close,
          isBtcCandle,
          expectedBtcSymbol: this.btcConfirmation?.symbol || 'BTCUSDT',
          topic,
        });
      }

      if (isBtcCandle) {
        this.updateBtcCandleStore(candle);
        continue;
      }

      const interval = klineData.interval ?? '';
      const role = this.getTimeframeRole(interval);

      if (role == null) {
        this.logger.warn('Unknown interval received', { interval, symbol: topicSymbol });
        continue;
      }

      this.logger.info('New candle closed', {
        symbol: this.symbol,
        role,
        interval,
        timestamp: new Date(candle.timestamp).toISOString(),
        close: candle.close,
      });

      this.emit('candleClosed', { role, candle });
    }
  }

  private handleOrderbookUpdate(data: OrderbookData): void {
    try {
      if (!isOrderbookDataComplete(data)) {
        if (this.errorHandler) {
          this.errorHandler.handle(new Error('Orderbook missing bids or asks'), {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'PublicWebSocketService.handleOrderbookUpdate',
            logger: this.logger,
          });
        }

        this.logger.warn('Orderbook data missing b or a', {
          hasB: !!data.b,
          hasA: !!data.a,
          rawData: JSON.stringify(data).substring(0, 200),
        });
        return;
      }

      const bids = data.b;
      const asks = data.a;
      const isSnapshot = detectOrderbookSnapshot(data, this.lastIncompleteWarning);

      if (isSnapshot) {
        this.logger.info('Orderbook snapshot detected', {
          bids: bids.length,
          asks: asks.length,
          updateId: data.u,
          type: data.type,
        });
      }

      this.emit(
        'orderbookUpdate',
        mapOrderbookUpdateEvent(data, this.symbol, isSnapshot),
      );

      if (isSnapshot) {
        this.lastIncompleteWarning = Date.now();
      }
    } catch (error) {
      const orderbookError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to handle orderbook update', {
        error: orderbookError.message,
      });

      if (this.errorHandler) {
        this.errorHandler.handle(orderbookError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PublicWebSocketService.handleOrderbookUpdate',
          logger: this.logger,
        });
      }
    }
  }

  private handleTradeUpdate(data: TradeData | TradeData[]): void {
    try {
      const trades = Array.isArray(data) ? data : [data];

      for (const tradeData of trades) {
        if (!isTradeDataComplete(tradeData)) {
          if (this.errorHandler) {
            this.errorHandler.handle(new Error('Incomplete trade data'), {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
              context: 'PublicWebSocketService.handleTradeUpdate',
              logger: this.logger,
            });
          }

          this.logger.warn('Incomplete trade data', {
            hasTimestamp: !!tradeData.T,
            hasSide: !!tradeData.S,
            hasVolume: !!tradeData.v,
            hasPrice: !!tradeData.p,
          });
          continue;
        }

        this.emit('trade', mapTradeEvent(tradeData));
      }
    } catch (error) {
      const tradeError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Failed to handle trade update', {
        error: tradeError.message,
      });

      if (this.errorHandler) {
        this.errorHandler.handle(tradeError, {
          strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
          context: 'PublicWebSocketService.handleTradeUpdate',
          logger: this.logger,
        });
      }
    }
  }

  private getTimeframeRole(interval: string): TimeframeRole | null {
    return findTimeframeRoleByInterval(interval, this.timeframeProvider.getAllTimeframes());
  }

  private startPing(): void {
    this.stopPing();

    this.pingInterval = setInterval(() => {
      this.sendSocketPayload(
        { op: 'ping' },
        'PublicWebSocketService.startPing',
        RecoveryStrategy.GRACEFUL_DEGRADE,
      );
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleOpen(): void {
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.logger.info('Public WebSocket connected');
    this.subscribe();
    this.startPing();
    this.emit('connected');
  }

  private handleConnectionError(error: Error): void {
    this.logger.error('Public WebSocket error', { error: error.message });
    this.emit('error', error);
  }

  private handleClose(): void {
    this.isConnecting = false;
    this.stopPing();
    this.logger.warn('Public WebSocket disconnected');
    this.emit('disconnected');

    if (!this.shouldReconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      return;
    }

    this.reconnectAttempts++;
    this.logger.info('Reconnecting to Public WebSocket', {
      attempt: this.reconnectAttempts,
      maxAttempts: MAX_RECONNECT_ATTEMPTS,
    });
    setTimeout(() => {
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private routeTopicMessage(topic: string | undefined, data: unknown): void {
    if (data === undefined || data === null) {
      return;
    }

    if (topic?.startsWith('kline.')) {
      this.handleKlineUpdate(data as KlineData | KlineData[], topic);
    }

    if (topic?.startsWith('orderbook.')) {
      this.handleOrderbookUpdate(data as OrderbookData);
    }

    if (topic?.startsWith('publicTrade.')) {
      this.handleTradeUpdate(data as TradeData | TradeData[]);
    }
  }

  private updateBtcCandleStore(candle: Candle): void {
    if (!this.btcCandlesStore) {
      return;
    }

    const totalCandles = appendBtcCandle(
      this.btcCandlesStore.btcCandles1m,
      candle,
      this.btcConfirmation?.lookbackCandles || 100,
    );

    this.logger.info('BTC candle updated', {
      symbol: this.btcConfirmation?.symbol || 'BTCUSDT',
      timestamp: new Date(candle.timestamp).toISOString(),
      close: candle.close,
      totalCandles,
    });
  }

  private hasOpenSocket(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private sendSocketPayload(
    payload: unknown,
    context: string,
    strategy: RecoveryStrategy,
  ): boolean {
    const socket = this.ws;

    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      const sendError = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Public WebSocket transport send failed', {
        context,
        error: sendError.message,
      });

      if (this.errorHandler) {
        this.errorHandler.handle(sendError, {
          strategy,
          context,
          logger: this.logger,
        });
      } else {
        this.emit('error', sendError);
      }

      return false;
    }
  }
}
