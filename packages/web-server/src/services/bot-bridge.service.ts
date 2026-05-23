/**
 * Bot Bridge Service
 *
 * Connects web server to trading bot via EventEmitter pattern.
 * Forwards bot events to WebSocket clients and provides control methods.
 */

import { EventEmitter } from 'events';
import type {
  BotStatus,
  Position,
  Signal,
  WebSocketMessage,
  WebSocketPayloadMap,
} from '@edison/contracts/runtime-api';
import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import type { IWebApiAdapter } from './web-api-adapter.types.js';
import { createErrorDetail, createWebSocketErrorPayload } from '../errors/api-error-response.js';

export interface IBotInstance extends EventEmitter {
  isRunning: boolean;
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
}

type BotBridgeReadApi = Pick<IWebApiAdapter, keyof IWebApiAdapter>;

type BotPositionEventPayload =
  | Position
  | {
    position?: Position;
    closedPosition?: Position;
    strategyId?: string;
    positionId?: string;
    pnl?: number;
    exitType?: string;
  };

type BotEventPayloadMap = {
  signal: unknown;
  'position-opened': BotPositionEventPayload;
  'position-closed': BotPositionEventPayload;
  error: unknown;
  'bot-started': boolean;
  'bot-stopped': boolean;
};

type BotEventName = keyof BotEventPayloadMap;
type BotEventListener<K extends BotEventName> = (data: BotEventPayloadMap[K]) => void;

export class BotBridgeService extends EventEmitter {
  private botEventForwarding: BotEventName[] = [
    'signal',
    'position-opened',
    'position-closed',
    'error',
    'bot-started',
    'bot-stopped',
  ];
  private botListeners = new Map<BotEventName, BotEventListener<BotEventName>>();
  private recentSignals: Signal[] = [];

  private readonly webApi?: IWebApiAdapter;

  constructor(private bot: IBotInstance, webApi?: IWebApiAdapter) {
    super();
    this.webApi = webApi;
    this.setupEventForwarding();
  }

  /**
   * Setup bot event forwarding to web clients
   */
  private setupEventForwarding() {
    for (const botEvent of this.botEventForwarding) {
      const listener: BotEventListener<typeof botEvent> = (data) => {
        switch (botEvent) {
          case 'signal': {
            const mappedSignal = this.toWebSignal(data);
            if (!mappedSignal) {
              return;
            }
            this.cacheSignal(mappedSignal);
            this.emitSignalEvents(mappedSignal);
            return;
          }
          case 'position-opened': {
            this.emit('bot-event', this.createPositionOpenedMessage(data as BotPositionEventPayload));
            return;
          }
          case 'position-closed': {
            this.emit('bot-event', this.createPositionClosedMessage(data as BotPositionEventPayload));
            return;
          }
          case 'error': {
            this.emitErrorEvent(data);
            return;
          }
          case 'bot-started':
          case 'bot-stopped': {
            void this.emitBotStatusChange();
            return;
          }
        }
      };
      this.botListeners.set(botEvent, listener);
      this.bot.on(botEvent, listener);
    }
  }

  /**
   * Cache signal for API retrieval (keep last 50)
   */
  private cacheSignal(signal: Signal) {
    this.recentSignals.unshift({
      ...signal,
      timestamp: Date.now(),
    });
    // Keep only last 50 signals
    if (this.recentSignals.length > 50) {
      this.recentSignals = this.recentSignals.slice(0, 50);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private coerceNumber(value: unknown, fallback: number = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private coerceString(value: unknown, fallback: string): string {
    return typeof value === 'string' ? value : fallback;
  }

  private getNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private getString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private getCurrentWebPosition(): Position | null {
    return this.toWebPosition(this.bot.getCurrentPosition());
  }

  private createEmptyMarketData(): WebApiMarketData {
    return { currentPrice: 0, priceChangePercent: 0 };
  }

  private createEmptyOrderBook(symbol: string): WebApiOrderBookView {
    return { symbol, bids: [], asks: [], timestamp: Date.now() };
  }

  private createEmptyWalls(symbol: string): WebApiWallsView {
    return { symbol, walls: [] };
  }

  private createEmptyFundingRate(symbol: string): WebApiFundingRateView {
    return {
      symbol,
      current: 0,
      predicted: 0,
      nextFundingTime: 0,
      lastFundingTime: 0,
    };
  }

  private createEmptyVolumeProfile(symbol: string): WebApiVolumeProfileView {
    return {
      symbol,
      levels: [],
      volumes: [],
      maxVolume: 0,
    };
  }

  private async readWebApi<T>(
    operation: keyof BotBridgeReadApi,
    read: (webApi: BotBridgeReadApi) => Promise<T>,
    fallback: T,
  ): Promise<T> {
    if (!this.webApi) {
      return fallback;
    }

    try {
      const result = await read(this.webApi);
      return result ?? fallback;
    } catch (error) {
      this.logReadFallback(operation, error);
      return fallback;
    }
  }

  private logReadFallback(operation: keyof BotBridgeReadApi | 'getBalance', error: unknown): void {
    const reason = createErrorDetail(error).message;
    console.error(`[BotBridgeService] ${operation} fallback`, { error: reason });
  }

  private createBotEventMessage<TType extends keyof WebSocketPayloadMap>(
    type: TType,
    payload: WebSocketPayloadMap[TType],
    requestId?: string,
  ): WebSocketMessage<TType> {
    return {
      type,
      payload,
      ...(requestId ? { requestId } : {}),
      timestamp: Date.now(),
    };
  }

  private createErrorMessage(data: unknown): WebSocketMessage<'ERROR'> {
    return this.createBotEventMessage('ERROR', this.toErrorPayload(data));
  }

  private createSignalNewMessage(signal: Signal): WebSocketMessage<'SIGNAL_NEW'> {
    return this.createBotEventMessage('SIGNAL_NEW', signal);
  }

  private createSignalGeneratedMessage(signal: Signal): WebSocketMessage<'SIGNAL_GENERATED'> {
    return this.createBotEventMessage('SIGNAL_GENERATED', {
      strategy: signal.type,
      direction: signal.direction,
      confidence: signal.confidence,
    });
  }

  private emitBotEvent(message: WebSocketMessage): void {
    this.emit('bot-event', message);
  }

  private emitErrorEvent(data: unknown): void {
    this.emitBotEvent(this.createErrorMessage(data));
  }

  private emitBotEvents(messages: WebSocketMessage[]): void {
    messages.forEach((message) => this.emitBotEvent(message));
  }

  private emitSignalEvents(signal: Signal): void {
    this.emitBotEvents([
      this.createSignalNewMessage(signal),
      this.createSignalGeneratedMessage(signal),
    ]);
  }

  private async readBalanceWithFallback(): Promise<{ balance: number; error?: string }> {
    try {
      return { balance: await this.bot.getBalance() };
    } catch (error) {
      this.logReadFallback('getBalance', error);
      return {
        balance: 0,
        error: createErrorDetail(error).message,
      };
    }
  }

  private async readStatusSnapshot(): Promise<{
    currentPosition: Position | null;
    balance: number;
    unrealizedPnL: number;
    error?: string;
  }> {
    const currentPosition = this.getCurrentWebPosition();
    const { balance, error } = await this.readBalanceWithFallback();
    const unrealizedPnL = currentPosition?.unrealizedPnL ?? 0;

    return error
      ? { currentPosition, balance, unrealizedPnL, error }
      : { currentPosition, balance, unrealizedPnL };
  }

  private toWebSignal(data: unknown): Signal | null {
    if (!this.isRecord(data)) {
      return null;
    }

    const directionRaw = data.direction;
    if (directionRaw !== 'LONG' && directionRaw !== 'SHORT' && directionRaw !== 'HOLD') {
      return null;
    }
    const direction: Signal['direction'] = directionRaw;

    const timestamp = this.getNumber(data.timestamp);
    const type = this.getString(data.type);
    const confidence = this.getNumber(data.confidence);
    const price = this.getNumber(data.price);
    const stopLoss = this.getNumber(data.stopLoss);
    const reason = this.getString(data.reason);

    if (
      timestamp === null
      || !type
      || confidence === null
      || price === null
      || stopLoss === null
      || reason === null
    ) {
      return null;
    }

    if (!Array.isArray(data.takeProfits)) {
      return null;
    }

    const takeProfits = data.takeProfits.reduce<Signal['takeProfits']>((acc, tp) => {
      if (!this.isRecord(tp)) {
        return acc;
      }
      const tpPrice = this.getNumber(tp.price);
      const tpQuantity = this.getNumber(tp.quantity ?? tp.sizePercent ?? tp.percent);
      if (tpPrice === null || tpQuantity === null) {
        return acc;
      }
      const mapped: { price: number; quantity: number; hit?: boolean } = {
        price: tpPrice,
        quantity: tpQuantity,
      };
      if (typeof tp.hit === 'boolean') {
        mapped.hit = tp.hit;
      }
      acc.push(mapped);
      return acc;
    }, []);

    const marketDataRaw = this.isRecord(data.marketData) ? this.toWebSignalMarketData(data.marketData) : undefined;
    const marketData =
      marketDataRaw && Object.keys(marketDataRaw).length > 0 ? marketDataRaw : undefined;

    return {
      id: this.coerceString(data.id, `${type}-${timestamp}`),
      direction,
      type,
      confidence,
      price,
      stopLoss,
      takeProfits,
      reason,
      timestamp,
      ...(marketData ? { marketData } : {}),
    };
  }

  private toWebSignalMarketData(data: Record<string, unknown>): Signal['marketData'] {
    const marketData: Signal['marketData'] = {};
    if (typeof data.rsi === 'number') {
      marketData.rsi = data.rsi;
    }
    if (typeof data.rsiEntry === 'number') {
      marketData.rsiEntry = data.rsiEntry;
    }
    if (typeof data.rsiTrend1 === 'number') {
      marketData.rsiTrend1 = data.rsiTrend1;
    }
    if (typeof data.ema20 === 'number') {
      marketData.ema20 = data.ema20;
    }
    if (typeof data.ema50 === 'number') {
      marketData.ema50 = data.ema50;
    }
    if (typeof data.atr === 'number') {
      marketData.atr = data.atr;
    }
    if (typeof data.trend === 'string') {
      marketData.trend = data.trend as 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }
    if (typeof data.nearestLevel === 'number') {
      marketData.nearestLevel = data.nearestLevel;
    }
    if (typeof data.distanceToLevel === 'number') {
      marketData.distanceToLevel = data.distanceToLevel;
    }
    return marketData;
  }

  private extractPositionPayload(data: unknown): unknown {
    if (!this.isRecord(data)) {
      return data;
    }
    if (this.isRecord(data.position)) {
      return data.position;
    }
    if (this.isRecord(data.closedPosition)) {
      return data.closedPosition;
    }
    return data;
  }

  private toWebPosition(data: unknown): Position | null {
    if (!this.isRecord(data)) {
      return null;
    }

    const id = this.getString(data.id);
    const symbol = this.getString(data.symbol);
    const sideRaw = this.getString(data.side);
    if (sideRaw !== 'SHORT' && sideRaw !== 'LONG') {
      return null;
    }
    const side: Position['side'] = sideRaw;
    const quantity = this.getNumber(data.quantity);
    const entryPrice = this.getNumber(data.entryPrice);
    const leverage = this.getNumber(data.leverage);
    const marginUsed = this.getNumber(data.marginUsed);
    const unrealizedPnL = this.getNumber(data.unrealizedPnL);
    const openedAt = this.getNumber(data.openedAt);
    const statusRaw = this.getString(data.status);
    const status: Position['status'] = statusRaw === 'CLOSED' ? 'CLOSED' : 'OPEN';

    if (
      !id
      || !symbol
      || quantity === null
      || entryPrice === null
      || leverage === null
      || marginUsed === null
      || unrealizedPnL === null
      || openedAt === null
    ) {
      return null;
    }

    const stopLossValue = data.stopLoss;
    const stopLossRecord = this.isRecord(stopLossValue) ? stopLossValue : null;
    const stopLossPrice = stopLossRecord
      ? this.getNumber(stopLossRecord.price)
      : this.getNumber(stopLossValue);
    if (stopLossPrice === null) {
      return null;
    }
    const breakeven = stopLossRecord
      ? typeof stopLossRecord.breakeven === 'number'
        ? stopLossRecord.breakeven
        : stopLossRecord.isBreakeven === true
          ? stopLossPrice
          : undefined
      : undefined;
    const trailing = stopLossRecord
      ? typeof stopLossRecord.trailing === 'boolean'
        ? stopLossRecord.trailing
        : stopLossRecord.isTrailing === true
      : undefined;

    if (!Array.isArray(data.takeProfits)) {
      return null;
    }
    const takeProfits = data.takeProfits.reduce<Position['takeProfits']>((acc, tp) => {
      if (!this.isRecord(tp)) {
        return acc;
      }
      const tpPrice = this.getNumber(tp.price);
      const tpQuantity = this.getNumber(tp.quantity ?? tp.sizePercent ?? tp.percent);
      if (tpPrice === null || tpQuantity === null) {
        return acc;
      }
      const mapped: { price: number; quantity: number; hit?: boolean } = {
        price: tpPrice,
        quantity: tpQuantity,
      };
      if (typeof tp.hit === 'boolean') {
        mapped.hit = tp.hit;
      }
      acc.push(mapped);
      return acc;
    }, []);

    const currentPrice = this.getNumber(data.currentPrice) ?? entryPrice;
    const unrealizedPnLPercent =
      this.getNumber(data.unrealizedPnLPercent)
      ?? (marginUsed > 0 ? (unrealizedPnL / marginUsed) * 100 : 0);

    return {
      id,
      symbol,
      side,
      quantity,
      entryPrice,
      currentPrice,
      leverage,
      marginUsed,
      unrealizedPnL,
      unrealizedPnLPercent,
      stopLoss: {
        price: stopLossPrice,
        ...(breakeven !== undefined ? { breakeven } : {}),
        ...(trailing !== undefined ? { trailing } : {}),
      },
      takeProfits,
      openedAt,
      status,
    };
  }

  private extractClosePayload(data: unknown): { pnl?: number; exitType?: string } {
    if (!this.isRecord(data)) {
      return {};
    }
    const pnlValue = typeof data.pnl === 'number' ? data.pnl : undefined;
    const exitTypeValue = typeof data.exitType === 'string' ? data.exitType : undefined;
    if (pnlValue !== undefined || exitTypeValue !== undefined) {
      return { pnl: pnlValue, exitType: exitTypeValue };
    }
    const position = this.toWebPosition(this.extractPositionPayload(data));
    if (!position) {
      return {};
    }
    const pnl = typeof position.unrealizedPnL === 'number' ? position.unrealizedPnL : undefined;
    return { pnl, exitType: exitTypeValue };
  }

  private toErrorPayload(data: unknown): WebSocketPayloadMap['ERROR'] {
    return createWebSocketErrorPayload(data);
  }

  private async emitBotStatusChange(): Promise<void> {
    this.emit('bot-event', await this.createStatusChangeMessage());
  }

  private createActionFailurePayload(error: unknown): WebSocketPayloadMap['ERROR'] {
    const detail = createErrorDetail(error);
    return createWebSocketErrorPayload({
      error: detail.message,
      ...(detail.code ? { code: detail.code } : {}),
      ...(!(error instanceof Error) && detail.details ? { details: detail.details } : {}),
    });
  }

  private createBotActionFailure(error: unknown): { success: false; error: string } {
    const payload = this.createActionFailurePayload(error);
    this.emitBotEvent(this.createBotEventMessage('ERROR', payload));
    return { success: false, error: payload.error };
  }

  /**
   * Cleanup all event listeners
   */
  destroy() {
    for (const [botEvent, listener] of this.botListeners.entries()) {
      this.bot.off(botEvent, listener);
    }
    this.botListeners.clear();
    this.removeAllListeners();
  }

  /**
   * Get current bot status
   */
  async getStatus(): Promise<BotStatus> {
    const snapshot = await this.readStatusSnapshot();
    const status: BotStatus = {
      isRunning: this.bot.isRunning,
      currentPosition: snapshot.currentPosition,
      balance: snapshot.balance,
      unrealizedPnL: snapshot.unrealizedPnL,
      timestamp: Date.now(),
    };

    return snapshot.error ? { ...status, error: snapshot.error } : status;
  }

  async createStatusChangeMessage(requestId?: string): Promise<WebSocketMessage<'BOT_STATUS_CHANGE'>> {
    const status = await this.getStatus();
    return this.createBotEventMessage('BOT_STATUS_CHANGE', status, requestId);
  }

  createPositionUpdateMessage(requestId?: string): WebSocketMessage<'POSITION_UPDATE'> {
    return this.createBotEventMessage('POSITION_UPDATE', { position: this.getCurrentWebPosition() }, requestId);
  }

  createPositionOpenedMessage(requestIdOrPayload?: string | BotPositionEventPayload): WebSocketMessage<'POSITION_OPENED'> {
    const requestId = typeof requestIdOrPayload === 'string' ? requestIdOrPayload : undefined;
    const payloadSource = typeof requestIdOrPayload === 'string' ? undefined : requestIdOrPayload;
    const position = this.toWebPosition(this.extractPositionPayload(payloadSource ?? this.bot.getCurrentPosition()));
    return this.createBotEventMessage('POSITION_OPENED', position ? { position } : {}, requestId);
  }

  createPositionClosedMessage(requestIdOrPayload?: string | BotPositionEventPayload): WebSocketMessage<'POSITION_CLOSED'> {
    const requestId = typeof requestIdOrPayload === 'string' ? requestIdOrPayload : undefined;
    const payloadSource = typeof requestIdOrPayload === 'string' ? undefined : requestIdOrPayload;
    const { pnl, exitType } = this.extractClosePayload(payloadSource ?? this.bot.getCurrentPosition());
    return this.createBotEventMessage('POSITION_CLOSED', { pnl, exitType }, requestId);
  }

  /**
   * Start the trading bot
   */
  async startBot(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.bot.isRunning) {
        return { success: false, error: 'Bot is already running' };
      }
      await this.bot.start();
      return { success: true };
    } catch (error) {
      return this.createBotActionFailure(error);
    }
  }

  /**
   * Stop the trading bot
   */
  stopBot(): { success: boolean; error?: string } {
    try {
      if (!this.bot.isRunning) {
        return { success: false, error: 'Bot is not running' };
      }
      this.bot.stop();
      return { success: true };
    } catch (error) {
      return this.createBotActionFailure(error);
    }
  }

  /**
   * Get current position
   */
  getPosition(): Position | null {
    return this.createPositionUpdateMessage().payload.position;
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    return (await this.readBalanceWithFallback()).balance;
  }

  /**
   * Get market data (RSI, EMA, ATR, etc.)
   */
  async getMarketData(): Promise<WebApiMarketData> {
    return this.readWebApi(
      'getMarketData',
      (webApi) => webApi.getMarketData(),
      this.createEmptyMarketData(),
    );
  }

  /**
   * Get candlestick data for web chart
   */
  async getCandles(timeframe: string, limit: number = 100): Promise<WebApiCandle[]> {
    return this.readWebApi(
      'getCandles',
      (webApi) => webApi.getCandles(timeframe, limit),
      [],
    );
  }

  /**
   * Get position history
   */
  async getPositionHistory(limit: number = 50): Promise<WebApiPositionHistoryEntry[]> {
    return this.readWebApi(
      'getPositionHistory',
      (webApi) => webApi.getPositionHistory(limit),
      [],
    );
  }

  /**
   * Check if bot is running
   */
  isRunning(): boolean {
    return this.bot.isRunning;
  }
  /**
   * Get orderbook snapshot
   */
  async getOrderBook(symbol: string): Promise<WebApiOrderBookView> {
    return this.readWebApi(
      'getOrderBook',
      (webApi) => webApi.getOrderBook(symbol),
      this.createEmptyOrderBook(symbol),
    );
  }

  /**
   * Get detected walls
   */
  async getWalls(symbol: string): Promise<WebApiWallsView> {
    return this.readWebApi(
      'getWalls',
      (webApi) => webApi.getWalls(symbol),
      this.createEmptyWalls(symbol),
    );
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<WebApiFundingRateView> {
    return this.readWebApi(
      'getFundingRate',
      (webApi) => webApi.getFundingRate(symbol),
      this.createEmptyFundingRate(symbol),
    );
  }

  /**
   * Get volume profile
   */
  async getVolumeProfile(symbol: string, levels: number = 20): Promise<WebApiVolumeProfileView> {
    return this.readWebApi(
      'getVolumeProfile',
      (webApi) => webApi.getVolumeProfile(symbol, levels),
      this.createEmptyVolumeProfile(symbol),
    );
  }

  /**
   * Get recent signals (cached from signal:generated events)
   */
  getRecentSignals(limit: number = 50): Signal[] {
    return this.recentSignals.slice(0, limit);
  }
}
