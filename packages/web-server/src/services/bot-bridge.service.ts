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
} from '../types/api.types.js';
import type {
  WebApiCandle,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';
import type { IWebApiAdapter } from './web-api-adapter.types.js';

export interface IBotInstance extends EventEmitter {
  isRunning: boolean;
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  start(): Promise<void>;
  stop(): void;
}

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
    this.webApi = webApi ?? this.coerceWebApiAdapter(bot);
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

            const signalMessage: WebSocketMessage<'SIGNAL_NEW'> = {
              type: 'SIGNAL_NEW',
              payload: mappedSignal,
              timestamp: Date.now(),
            };
            this.emit('bot-event', signalMessage);

            const generatedMessage: WebSocketMessage<'SIGNAL_GENERATED'> = {
              type: 'SIGNAL_GENERATED',
              payload: {
                strategy: mappedSignal.type,
                direction: mappedSignal.direction,
                confidence: mappedSignal.confidence,
              },
              timestamp: Date.now(),
            };
            this.emit('bot-event', generatedMessage);
            return;
          }
          case 'position-opened': {
            const position = this.toWebPosition(
              this.extractPositionPayload(data as BotPositionEventPayload),
            );
            const message: WebSocketMessage<'POSITION_OPENED'> = {
              type: 'POSITION_OPENED',
              payload: position ? { position } : {},
              timestamp: Date.now(),
            };
            this.emit('bot-event', message);
            return;
          }
          case 'position-closed': {
            const { pnl, exitType } = this.extractClosePayload(data as BotPositionEventPayload);
            const message: WebSocketMessage<'POSITION_CLOSED'> = {
              type: 'POSITION_CLOSED',
              payload: { pnl, exitType },
              timestamp: Date.now(),
            };
            this.emit('bot-event', message);
            return;
          }
          case 'error': {
            const message: WebSocketMessage<'ERROR'> = {
              type: 'ERROR',
              payload: this.toErrorPayload(data),
              timestamp: Date.now(),
            };
            this.emit('bot-event', message);
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

  private coerceWebApiAdapter(bot: IBotInstance): IWebApiAdapter | undefined {
    const candidate = bot as Partial<IWebApiAdapter>;
    if (
      typeof candidate.getMarketData === 'function'
      && typeof candidate.getCandles === 'function'
      && typeof candidate.getPositionHistory === 'function'
      && typeof candidate.getOrderBook === 'function'
      && typeof candidate.getWalls === 'function'
      && typeof candidate.getFundingRate === 'function'
      && typeof candidate.getVolumeProfile === 'function'
    ) {
      return candidate as IWebApiAdapter;
    }
    return undefined;
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

  private extractPositionPayload(data: BotPositionEventPayload): Position | BotPositionEventPayload {
    if (!this.isRecord(data)) {
      return data;
    }
    if (this.isRecord(data.position)) {
      return data.position as Position;
    }
    if (this.isRecord(data.closedPosition)) {
      return data.closedPosition as Position;
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

  private extractClosePayload(data: BotPositionEventPayload): { pnl?: number; exitType?: string } {
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
    if (data instanceof Error) {
      return { error: data.message, details: data.stack };
    }
    if (this.isRecord(data)) {
      const error = this.coerceString(data.error ?? data.message, 'Unknown error');
      const details = this.coerceString(data.details, '');
      return details ? { error, details } : { error };
    }
    return { error: 'Unknown error' };
  }

  private async emitBotStatusChange(): Promise<void> {
    const status = await this.getStatus();
    const message: WebSocketMessage<'BOT_STATUS_CHANGE'> = {
      type: 'BOT_STATUS_CHANGE',
      payload: status,
      timestamp: Date.now(),
    };
    this.emit('bot-event', message);
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
    try {
      const position = this.bot.getCurrentPosition();
      const balance = await this.bot.getBalance();
      const unrealizedPnL = position ? position.unrealizedPnL : 0;

      return {
        isRunning: this.bot.isRunning,
        currentPosition: position,
        balance,
        unrealizedPnL,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        isRunning: this.bot.isRunning,
        currentPosition: null,
        balance: 0,
        unrealizedPnL: 0,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: WebSocketMessage<'ERROR'> = {
        type: 'ERROR',
        payload: { error: message },
        timestamp: Date.now(),
      };
      this.emit('bot-event', errorMessage);
      return { success: false, error: message };
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorMessage: WebSocketMessage<'ERROR'> = {
        type: 'ERROR',
        payload: { error: message },
        timestamp: Date.now(),
      };
      this.emit('bot-event', errorMessage);
      return { success: false, error: message };
    }
  }

  /**
   * Get current position
   */
  getPosition(): Position | null {
    return this.bot.getCurrentPosition();
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    try {
      return await this.bot.getBalance();
    } catch (error) {
      console.error('Error getting balance:', error);
      return 0;
    }
  }

  /**
   * Get market data (RSI, EMA, ATR, etc.)
   */
  async getMarketData(): Promise<WebApiMarketData> {
    try {
      if (!this.webApi) {
        return { currentPrice: 0, priceChangePercent: 0 };
      }
      const marketData = await this.webApi.getMarketData();
      return marketData ?? { currentPrice: 0, priceChangePercent: 0 };
    } catch (error) {
      console.error('Error getting market data:', error);
      return { currentPrice: 0, priceChangePercent: 0 };
    }
  }

  /**
   * Get candlestick data for web chart
   */
  async getCandles(timeframe: string, limit: number = 100): Promise<WebApiCandle[]> {
    try {
      if (!this.webApi) {
        return [];
      }
      return await this.webApi.getCandles(timeframe, limit);
    } catch (error) {
      console.error('Error getting candles:', error);
      return [];
    }
  }

  /**
   * Get position history
   */
  async getPositionHistory(limit: number = 50): Promise<WebApiPositionHistoryEntry[]> {
    try {
      if (!this.webApi) {
        return [];
      }
      return await this.webApi.getPositionHistory(limit);
    } catch (error) {
      console.error('Error getting position history:', error);
      return [];
    }
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
    try {
      if (!this.webApi) {
        return { symbol, bids: [], asks: [], timestamp: Date.now() };
      }
      return await this.webApi.getOrderBook(symbol);
    } catch (error) {
      console.error('Error getting orderbook:', error);
      return { symbol, bids: [], asks: [], timestamp: Date.now() };
    }
  }

  /**
   * Get detected walls
   */
  async getWalls(symbol: string): Promise<WebApiWallsView> {
    try {
      if (!this.webApi) {
        return { symbol, walls: [] };
      }
      const walls = await this.webApi.getWalls(symbol);
      if (Array.isArray(walls)) {
        return { symbol, walls };
      }
      return walls || { symbol, walls: [] };
    } catch (error) {
      console.error('Error getting walls:', error);
      return { symbol, walls: [] };
    }
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<WebApiFundingRateView> {
    try {
      if (!this.webApi) {
        return {
          symbol,
          current: 0,
          predicted: 0,
          nextFundingTime: 0,
          lastFundingTime: 0,
        };
      }
      return await this.webApi.getFundingRate(symbol);
    } catch (error) {
      console.error('Error getting funding rate:', error);
      return { symbol, current: 0, predicted: 0, nextFundingTime: 0, lastFundingTime: 0 };
    }
  }

  /**
   * Get volume profile
   */
  async getVolumeProfile(symbol: string, levels: number = 20): Promise<WebApiVolumeProfileView> {
    try {
      if (!this.webApi) {
        return {
          symbol,
          levels: [],
          volumes: [],
          maxVolume: 0,
        };
      }
      return await this.webApi.getVolumeProfile(symbol, levels);
    } catch (error) {
      console.error('Error getting volume profile:', error);
      return { symbol, levels: [], volumes: [], maxVolume: 0 };
    }
  }

  /**
   * Get recent signals (cached from signal:generated events)
   */
  getRecentSignals(limit: number = 50): Signal[] {
    return this.recentSignals.slice(0, limit);
  }
}
