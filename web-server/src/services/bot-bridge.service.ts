/**
 * Bot Bridge Service
 *
 * Connects web server to trading bot via EventEmitter pattern.
 * Forwards bot events to WebSocket clients and provides control methods.
 */

import { EventEmitter } from 'events';
import type { BotStatus, Position, Signal } from '../types/api.types.js';

export interface IBotInstance extends EventEmitter {
  isRunning: boolean;
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  getMarketData(): any;
  getCandles(timeframe: string, limit: number): Promise<any[]>;
  getPositionHistory(limit: number): Promise<any[]>;
  getOrderBook(symbol: string): Promise<any>;
  getWalls(symbol: string): Promise<any>;
  getFundingRate(symbol: string): Promise<any>;
  getVolumeProfile(symbol: string, levels: number): Promise<any>;
  start(): Promise<void>;
  stop(): void;
  bybitService?: any;
}

export class BotBridgeService extends EventEmitter {
  private botEventForwarding = new Map<string, string>([
    ['position-opened', 'POSITION_OPENED'],
    ['position-closed', 'POSITION_CLOSED'],
    ['position-updated', 'POSITION_UPDATED'],
    ['signal', 'SIGNAL_GENERATED'],
    ['takeProfitHit', 'TP_HIT'],
    ['stopLossHit', 'SL_HIT'],
    ['balance-updated', 'BALANCE_UPDATED'],
    ['bot-started', 'BOT_STARTED'],
    ['bot-stopped', 'BOT_STOPPED'],
    ['error', 'BOT_ERROR'],
  ]);
  private botListeners = new Map<string, (data: any) => void>();
  private recentSignals: Signal[] = [];

  constructor(private bot: IBotInstance) {
    super();
    this.setupEventForwarding();
  }

  /**
   * Setup bot event forwarding to web clients
   */
  private setupEventForwarding() {
    for (const [botEvent, wsEvent] of this.botEventForwarding.entries()) {
      const listener = (data: any) => {
        // Cache signals for API retrieval
        if (botEvent === 'signal:generated') {
          this.cacheSignal(data);
        }

        this.emit('bot-event', {
          type: wsEvent,
          payload: data,
          timestamp: Date.now(),
        });
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
      this.emit('bot-event', {
        type: 'BOT_ERROR',
        payload: { message },
        timestamp: Date.now(),
      });
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
      this.emit('bot-event', {
        type: 'BOT_ERROR',
        payload: { message },
        timestamp: Date.now(),
      });
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
  getMarketData(): any {
    try {
      return this.bot.getMarketData?.();
    } catch (error) {
      console.error('Error getting market data:', error);
      return null;
    }
  }

  /**
   * Get candlestick data for web chart
   */
  async getCandles(timeframe: string, limit: number = 100): Promise<any[]> {
    try {
      return (await this.bot.getCandles?.(timeframe, limit)) || [];
    } catch (error) {
      console.error('Error getting candles:', error);
      return [];
    }
  }

  /**
   * Get position history
   */
  async getPositionHistory(limit: number = 50): Promise<any[]> {
    try {
      return (await this.bot.getPositionHistory?.(limit)) || [];
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
  async getOrderBook(symbol: string): Promise<any> {
    try {
      return (await this.bot.getOrderBook?.(symbol)) || { bids: [], asks: [] };
    } catch (error) {
      console.error('Error getting orderbook:', error);
      return { bids: [], asks: [] };
    }
  }

  /**
   * Get detected walls
   */
  async getWalls(symbol: string): Promise<any> {
    try {
      return (await this.bot.getWalls?.(symbol)) || [];
    } catch (error) {
      console.error('Error getting walls:', error);
      return [];
    }
  }

  /**
   * Get funding rate
   */
  async getFundingRate(symbol: string): Promise<any> {
    try {
      return (await this.bot.getFundingRate?.(symbol)) || { current: 0, predicted: 0 };
    } catch (error) {
      console.error('Error getting funding rate:', error);
      return { current: 0, predicted: 0 };
    }
  }

  /**
   * Get volume profile
   */
  async getVolumeProfile(symbol: string, levels: number = 20): Promise<any> {
    try {
      return (await this.bot.getVolumeProfile?.(symbol, levels)) || { prices: [], volumes: [] };
    } catch (error) {
      console.error('Error getting volume profile:', error);
      return { prices: [], volumes: [] };
    }
  }

  /**
   * Get recent signals (cached from signal:generated events)
   */
  getRecentSignals(limit: number = 50): Signal[] {
    return this.recentSignals.slice(0, limit);
  }
}
