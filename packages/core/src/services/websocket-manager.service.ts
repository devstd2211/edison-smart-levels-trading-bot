/**
 * WebSocket Manager Service
 * Manages Bybit WebSocket connections and subscriptions
 *
 * Responsibilities:
 * 1. Connect to Bybit WebSocket V5
 * 2. Subscribe to Position updates
 * 3. Subscribe to Order execution updates
 * 4. Emit events when position opened/closed
 * 5. Handle reconnection and errors
 *
 * Single Responsibility: Real-time event streaming from exchange
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { ILifecycle } from '../interfaces/ILifecycle';
import {
  ExchangeConfig,
  Position,
  PositionData,
  OrderExecutionData,
  OrderUpdateData,
} from '../types/legacy';
import { OrderExecutionDetectorService } from './order-execution-detector.service';
import { WebSocketAuthenticationService } from './websocket-authentication.service';
import { EventDeduplicationService } from './event-deduplication.service';
import { WebSocketKeepAliveService } from './websocket-keep-alive.service';
import { mapPositionFromWebSocketData } from './websocket-manager/websocket-position-mapping.utils';
import {
  buildPrivateWebSocketSubscriptionMessage,
  calculateWebSocketBackoffDelay,
  decodePrivateWebSocketMessage,
  getMaxReconnectAttempts,
  getReconnectDelayMs,
  PRIVATE_WS_AUTH_RETRY,
  PRIVATE_WS_CONNECTION_RETRY,
  PRIVATE_WS_CONNECTION_TIMEOUT_MS,
  resolvePrivateWebSocketTarget,
} from './websocket-manager/websocket-manager-connection.utils';
import {
  buildExecutionEventKey,
  hasMessageTopicData,
  isAuthSuccessMessage,
  isClosedPositionSize,
  isPongMessage,
  isSubscriptionAckMessage,
  mapExecutionResultToEvent,
  mapOrderUpdateToEvent,
  matchesTrackedSymbol,
  normalizeOrderExecutions,
  normalizeOrderUpdates,
  normalizePositionUpdates,
  parsePrivateWebSocketMessage,
  type PrivateWebSocketMessage,
} from './websocket-manager/websocket-manager-message.utils';
import {
  ErrorHandler,
  RecoveryStrategy,
  WebSocketConnectionError,
  WebSocketAuthenticationError,
  WebSocketSubscriptionError,
  ErrorLogger,
} from '../errors';
import { getErrorMessage, normalizeError } from '../utils/error.utils';

// ============================================================================
// WEBSOCKET EVENTS
// ============================================================================

export interface PositionUpdateEvent {
  symbol: string;
  side: string;
  size: string;
  avgPrice: string;
  leverage: string;
  unrealisedPnl: string;
}

export interface OrderExecutionEvent {
  orderId: string;
  symbol: string;
  side: string;
  orderStatus: string;
  execQty: string;
  execPrice: string;
}

export interface OrderUpdateEvent {
  orderId: string;
  symbol: string;
  orderType: string;
  orderStatus: string;
  avgPrice: string;
  qty: string;
  cumExecQty: string;
}

export interface WebSocketManagerSocket {
  readyState: number;
  send(data: string): void;
  close(): void;
  terminate(): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'message', listener: (data: WebSocket.Data) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'close', listener: () => void): void;
}

// ============================================================================
// WEBSOCKET MANAGER SERVICE
// ============================================================================

export class WebSocketManagerService extends EventEmitter implements ILifecycle {
  private ws: WebSocketManagerSocket | null = null;
  private reconnectAttempts: number = 0;
  private isConnecting: boolean = false;
  private shouldReconnect: boolean = true;
  private readonly logger: ErrorLogger;

  constructor(
    private readonly config: ExchangeConfig,
    private readonly symbol: string,
    private readonly errorHandler: ErrorHandler,
    private readonly orderExecutionDetector: OrderExecutionDetectorService,
    private readonly authService: WebSocketAuthenticationService,
    private readonly deduplicationService: EventDeduplicationService,
    private readonly keepAliveService: WebSocketKeepAliveService,
  ) {
    super();
    this.logger = this.errorHandler.getLogger();
  }

  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws !== null && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    const { url: wsUrl, mode } = resolvePrivateWebSocketTarget(this.config);

    this.logger.info('Connecting to WebSocket', { url: wsUrl, mode });

    let lastError: Error | null = null;
    const { maxAttempts } = PRIVATE_WS_CONNECTION_RETRY;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.connectOnce(wsUrl);
        return;
      } catch (error) {
        lastError = normalizeError(error);

        if (attempt < maxAttempts) {
          const delayMs = calculateWebSocketBackoffDelay(
            attempt,
            PRIVATE_WS_CONNECTION_RETRY,
          );

          const tradingError = lastError instanceof WebSocketConnectionError
            ? lastError
            : new WebSocketConnectionError(lastError.message);

          const retryResult = await this.errorHandler.handle(tradingError, {
            strategy: RecoveryStrategy.RETRY,
            context: 'WebSocketManager.connect',
            onRetry: (attemptNum) => {
              this.logger.warn(`[WS] Retry attempt ${attemptNum} after ${delayMs}ms`, {
                url: wsUrl,
                error: lastError?.message,
              });
            },
          });

          if (!retryResult.recovered) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }
    }

    this.isConnecting = false;
    const finalError = new WebSocketConnectionError(
      `Failed to connect after ${maxAttempts} attempts: ${lastError?.message}`,
      { url: wsUrl, attemptNumber: maxAttempts },
    );

    const result = await this.errorHandler.handle(finalError, {
      strategy: RecoveryStrategy.THROW,
      context: 'WebSocketManager.connect',
    });

    if (!result.success) {
      this.emit('error', result.error || finalError);
      throw result.error || finalError;
    }
  }

  private async connectOnce(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const socket: WebSocketManagerSocket = new WebSocket(wsUrl);
        this.ws = socket;

        const connectionTimeout = setTimeout(() => {
          if (this.ws === socket) {
            socket.terminate();
          }
          reject(new WebSocketConnectionError('WebSocket connection timeout after 10s', { url: wsUrl }));
        }, PRIVATE_WS_CONNECTION_TIMEOUT_MS);

        socket.on('open', () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          void this.authenticate();
          this.startPing();
          this.emit('connected');
          resolve();
        });

        socket.on('message', (data: WebSocket.Data) => {
          const message = decodePrivateWebSocketMessage(data);
          if (message !== null) {
            this.handleMessage(message);
          }
        });

        socket.on('error', (error: Error) => {
          clearTimeout(connectionTimeout);
          this.emit('error', error);
          reject(new WebSocketConnectionError(`WebSocket error: ${error.message}`, { url: wsUrl }));
        });

        socket.on('close', () => {
          clearTimeout(connectionTimeout);
          this.isConnecting = false;
          if (this.ws === socket) {
            this.ws = null;
          }
          this.stopPing();
          this.emit('disconnected');

          if (this.shouldReconnect && this.reconnectAttempts < getMaxReconnectAttempts()) {
            this.reconnectAttempts++;
            setTimeout(() => {
              void this.connect();
            }, getReconnectDelayMs());
          }
        });
      } catch (error) {
        reject(new WebSocketConnectionError(`Failed to create WebSocket: ${getErrorMessage(error)}`, { url: wsUrl }));
      }
    });
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.stopPing();
    this.deduplicationService.clear();
    const socket = this.ws;
    this.ws = null;

    try {
      if (socket !== null) {
        socket.close();
      }
    } catch (error) {
      const disconnectError = normalizeError(error);
      const tradingError = new WebSocketConnectionError(
        `Disconnect error: ${disconnectError.message}`,
      );

      await this.errorHandler.handle(tradingError, {
        strategy: RecoveryStrategy.SKIP,
        context: 'WebSocketManager.disconnect',
      });
    }
  }

  start(): Promise<void> {
    return this.connect();
  }

  stop(): Promise<void> {
    return this.disconnect();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getLastCloseReason(): 'SL' | 'TP' | 'TRAILING' | null {
    return this.orderExecutionDetector.getLastCloseReason();
  }

  resetLastCloseReason(): void {
    this.orderExecutionDetector.resetLastCloseReason();
  }

  private isDuplicateEvent(eventType: string, eventId: string, timestamp: number): boolean {
    return this.deduplicationService.isDuplicate(eventType, eventId, timestamp);
  }

  private hasOpenSocket(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private sendSocketPayload(payload: unknown): void {
    if (!this.hasOpenSocket() || this.ws === null) {
      throw new WebSocketConnectionError('WebSocket is not open');
    }

    this.ws.send(JSON.stringify(payload));
  }

  private async authenticate(): Promise<void> {
    if (!this.hasOpenSocket()) {
      return;
    }

    let lastError: Error | null = null;
    const { maxAttempts } = PRIVATE_WS_AUTH_RETRY;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const authPayload = this.authService.generateAuthPayload(
          this.config.apiKey,
          this.config.apiSecret,
        );

        this.sendSocketPayload(authPayload);

        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });

        return;
      } catch (error) {
        lastError = normalizeError(error);

        if (attempt < maxAttempts) {
          const delayMs = calculateWebSocketBackoffDelay(attempt, PRIVATE_WS_AUTH_RETRY);
          const tradingError = new WebSocketAuthenticationError(lastError.message);

          await this.errorHandler.handle(tradingError, {
            strategy: RecoveryStrategy.RETRY,
            context: 'WebSocketManager.authenticate',
            onRetry: (attemptNum) => {
              this.logger.warn(`[WS] Auth retry attempt ${attemptNum} after ${delayMs}ms`, {
                error: lastError?.message,
              });
            },
          });

          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    const finalError = new WebSocketAuthenticationError(
      `Failed to authenticate after ${maxAttempts} attempts: ${lastError?.message}`,
    );

    await this.errorHandler.handle(finalError, {
      strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
      context: 'WebSocketManager.authenticate',
    });
  }

  private async subscribe(): Promise<void> {
    if (!this.hasOpenSocket()) {
      return;
    }

    try {
      const subscribeMessage = buildPrivateWebSocketSubscriptionMessage();

      this.sendSocketPayload(subscribeMessage);

      this.logger.info('Private WebSocket subscribed to topics', {
        topics: subscribeMessage.args,
      });
    } catch (error) {
      const subscriptionError = normalizeError(error);
      const tradingError = new WebSocketSubscriptionError(
        `Subscription failed: ${subscriptionError.message}`,
      );

      await this.errorHandler.handle(tradingError, {
        strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
        context: 'WebSocketManager.subscribe',
      });
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = parsePrivateWebSocketMessage(data);
      this.routeMessage(message);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${getErrorMessage(error)}`));
    }
  }

  private routeMessage(message: PrivateWebSocketMessage): void {
    if (isAuthSuccessMessage(message)) {
      this.logger.info('Private WebSocket authenticated successfully');
      void this.subscribe();
      return;
    }

    if (isSubscriptionAckMessage(message)) {
      if (message.success === true) {
        this.logger.info('Bybit confirmed subscription', { success: true });
      } else {
        this.logger.error('Bybit rejected subscription', {
          success: message.success,
          message,
        });
      }
      return;
    }

    if (isPongMessage(message) || !hasMessageTopicData(message)) {
      return;
    }

    if (message.topic === 'position') {
      this.handlePositionUpdate(message.data as PositionData | PositionData[]);
      return;
    }

    if (message.topic === 'execution') {
      this.logger.debug('Received execution topic event', {
        executionCount: Array.isArray(message.data) ? message.data.length : 0,
      });
      this.handleOrderExecution(message.data as OrderExecutionData | OrderExecutionData[]);
      return;
    }

    if (message.topic === 'order') {
      this.logger.debug('Received order topic event', {
        orderCount: Array.isArray(message.data) ? message.data.length : 0,
      });
      this.handleOrderUpdate(message.data as OrderUpdateData | OrderUpdateData[]);
    }
  }

  private handlePositionUpdate(data: PositionData | PositionData[]): void {
    for (const positionData of normalizePositionUpdates(data)) {
      this.processPositionData(positionData);
    }
  }

  private processPositionData(positionData: PositionData): void {
    if (!matchesTrackedSymbol(positionData.symbol, this.symbol)) {
      return;
    }

    if (isClosedPositionSize(positionData.size)) {
      this.orderExecutionDetector.resetTpCounter();
      this.emit('positionClosed', { symbol: this.symbol });
      return;
    }

    const position: Position = mapPositionFromWebSocketData(this.symbol, positionData);
    this.emit('positionUpdate', position);
  }

  private handleOrderExecution(data: OrderExecutionData | OrderExecutionData[]): void {
    for (const executionData of normalizeOrderExecutions(data)) {
      if (!matchesTrackedSymbol(executionData.symbol, this.symbol)) {
        continue;
      }

      const result = this.orderExecutionDetector.detectExecution(executionData);
      const mappedEvent = mapExecutionResultToEvent(result, this.symbol);

      switch (result.type) {
        case 'TAKE_PROFIT': {
          const eventKey = buildExecutionEventKey('TP', result);
          if (this.isDuplicateEvent('TP', eventKey, Date.now())) {
            break;
          }

          this.logger.info(`TP${result.tpLevel} execution detected from WebSocket`, {
            tpLevel: result.tpLevel,
            orderId: result.orderId,
            execPrice: result.execPrice,
            execQty: result.execQty,
            closedSize: result.closedSize,
          });

          if (mappedEvent !== null) {
            this.emit(mappedEvent.eventName, mappedEvent.payload);
          }
          break;
        }

        case 'STOP_LOSS': {
          const eventKey = buildExecutionEventKey('SL', result);
          if (this.isDuplicateEvent('SL', eventKey, Date.now())) {
            break;
          }

          this.logger.info('Stop Loss execution detected from WebSocket', {
            orderId: result.orderId,
            execPrice: result.execPrice,
            execQty: result.execQty,
          });

          if (mappedEvent !== null) {
            this.emit(mappedEvent.eventName, mappedEvent.payload);
          }
          break;
        }

        case 'TRAILING_STOP': {
          const eventKey = buildExecutionEventKey('TRAILING', result);
          if (this.isDuplicateEvent('TRAILING', eventKey, Date.now())) {
            break;
          }

          this.logger.info('Trailing Stop execution detected from WebSocket', {
            orderId: result.orderId,
            execPrice: result.execPrice,
            execQty: result.execQty,
          });

          if (mappedEvent !== null) {
            this.emit(mappedEvent.eventName, mappedEvent.payload);
          }
          break;
        }

        case 'ENTRY':
          if (mappedEvent !== null) {
            this.emit(mappedEvent.eventName, mappedEvent.payload);
          }
          break;

        default:
          break;
      }
    }
  }

  private handleOrderUpdate(data: OrderUpdateData | OrderUpdateData[]): void {
    for (const orderData of normalizeOrderUpdates(data)) {
      this.logger.debug('Processing order update', {
        orderId: orderData.orderId,
        symbol: orderData.symbol,
        status: orderData.orderStatus,
        stopOrderType: orderData.stopOrderType,
        avgPrice: orderData.avgPrice,
      });

      if (!matchesTrackedSymbol(orderData.symbol, this.symbol)) {
        continue;
      }

      const mappedEvent = mapOrderUpdateToEvent(orderData, this.symbol);
      if (mappedEvent?.eventName === 'takeProfitFilled') {
        this.logger.info('Take Profit detected from WebSocket', {
          orderId: orderData.orderId,
          avgPrice: orderData.avgPrice,
          qty: orderData.cumExecQty,
        });
        this.emit(mappedEvent.eventName, mappedEvent.payload);
      } else if (mappedEvent?.eventName === 'stopLossFilled') {
        this.logger.info('Stop Loss detected from WebSocket', {
          orderId: orderData.orderId,
          avgPrice: orderData.avgPrice,
          qty: orderData.cumExecQty,
        });
        this.emit(mappedEvent.eventName, mappedEvent.payload);
      }
    }
  }

  private startPing(): void {
    if (this.ws !== null) {
      this.keepAliveService.start(this.ws);
    }
  }

  private stopPing(): void {
    this.keepAliveService.stop();
  }
}
