/**
 * Bot Bridge Service
 *
 * Connects web server to trading bot via EventEmitter pattern.
 * Forwards bot events to WebSocket clients and provides control methods.
 */
import { EventEmitter } from 'events';
import type { BotStatus, Position } from '../types/api.types.js';
export interface IBotInstance extends EventEmitter {
    isRunning: boolean;
    getCurrentPosition(): Position | null;
    getBalance(): Promise<number>;
    getMarketData(): any;
    getCandles(timeframe: string, limit: number): Promise<any[]>;
    getPositionHistory(limit: number): Promise<any[]>;
    start(): Promise<void>;
    stop(): void;
    bybitService?: any;
}
export declare class BotBridgeService extends EventEmitter {
    private bot;
    private botEventForwarding;
    constructor(bot: IBotInstance);
    /**
     * Setup bot event forwarding to web clients
     */
    private setupEventForwarding;
    /**
     * Get current bot status
     */
    getStatus(): Promise<BotStatus>;
    /**
     * Start the trading bot
     */
    startBot(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Stop the trading bot
     */
    stopBot(): {
        success: boolean;
        error?: string;
    };
    /**
     * Get current position
     */
    getPosition(): Position | null;
    /**
     * Get current balance
     */
    getBalance(): Promise<number>;
    /**
     * Get market data (RSI, EMA, ATR, etc.)
     */
    getMarketData(): any;
    /**
     * Get candlestick data for web chart
     */
    getCandles(timeframe: string, limit?: number): Promise<any[]>;
    /**
     * Get position history
     */
    getPositionHistory(limit?: number): Promise<any[]>;
    /**
     * Check if bot is running
     */
    isRunning(): boolean;
}
