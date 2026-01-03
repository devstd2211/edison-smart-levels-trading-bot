"use strict";
/**
 * Bot Bridge Service
 *
 * Connects web server to trading bot via EventEmitter pattern.
 * Forwards bot events to WebSocket clients and provides control methods.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotBridgeService = void 0;
const events_1 = require("events");
class BotBridgeService extends events_1.EventEmitter {
    constructor(bot) {
        super();
        this.bot = bot;
        this.botEventForwarding = new Map([
            ['position:opened', 'POSITION_OPENED'],
            ['position:closed', 'POSITION_CLOSED'],
            ['position:updated', 'POSITION_UPDATED'],
            ['signal:generated', 'SIGNAL_GENERATED'],
            ['takeProfitHit', 'TP_HIT'],
            ['stopLossHit', 'SL_HIT'],
            ['balance:updated', 'BALANCE_UPDATED'],
            ['bot:started', 'BOT_STARTED'],
            ['bot:stopped', 'BOT_STOPPED'],
            ['bot:error', 'BOT_ERROR'],
        ]);
        this.setupEventForwarding();
    }
    /**
     * Setup bot event forwarding to web clients
     */
    setupEventForwarding() {
        for (const [botEvent, wsEvent] of this.botEventForwarding.entries()) {
            this.bot.on(botEvent, (data) => {
                this.emit('bot-event', {
                    type: wsEvent,
                    payload: data,
                    timestamp: Date.now(),
                });
            });
        }
    }
    /**
     * Get current bot status
     */
    async getStatus() {
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
        }
        catch (error) {
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
    async startBot() {
        try {
            if (this.bot.isRunning) {
                return { success: false, error: 'Bot is already running' };
            }
            await this.bot.start();
            return { success: true };
        }
        catch (error) {
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
    stopBot() {
        try {
            if (!this.bot.isRunning) {
                return { success: false, error: 'Bot is not running' };
            }
            this.bot.stop();
            return { success: true };
        }
        catch (error) {
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
    getPosition() {
        return this.bot.getCurrentPosition();
    }
    /**
     * Get current balance
     */
    async getBalance() {
        try {
            return await this.bot.getBalance();
        }
        catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }
    /**
     * Get market data (RSI, EMA, ATR, etc.)
     */
    getMarketData() {
        try {
            return this.bot.getMarketData?.();
        }
        catch (error) {
            console.error('Error getting market data:', error);
            return null;
        }
    }
    /**
     * Get candlestick data for web chart
     */
    async getCandles(timeframe, limit = 100) {
        try {
            return (await this.bot.getCandles?.(timeframe, limit)) || [];
        }
        catch (error) {
            console.error('Error getting candles:', error);
            return [];
        }
    }
    /**
     * Get position history
     */
    async getPositionHistory(limit = 50) {
        try {
            return (await this.bot.getPositionHistory?.(limit)) || [];
        }
        catch (error) {
            console.error('Error getting position history:', error);
            return [];
        }
    }
    /**
     * Check if bot is running
     */
    isRunning() {
        return this.bot.isRunning;
    }
}
exports.BotBridgeService = BotBridgeService;
//# sourceMappingURL=bot-bridge.service.js.map