"use strict";
/**
 * Data Routes
 *
 * API endpoints for data retrieval:
 * - GET /api/data/position - Current position
 * - GET /api/data/balance - Current balance
 * - GET /api/data/market - Market data (indicators)
 * - GET /api/data/signals/recent - Recent signals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDataRoutes = createDataRoutes;
const express_1 = require("express");
function createDataRoutes(bridge) {
    const router = (0, express_1.Router)();
    /**
     * GET /api/data/position
     * Get current position
     */
    router.get('/position', (_req, res) => {
        try {
            const position = bridge.getPosition();
            res.json({
                success: true,
                data: position,
                timestamp: Date.now(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
                success: false,
                error: message,
                timestamp: Date.now(),
            });
        }
    });
    /**
     * GET /api/data/balance
     * Get current balance
     */
    router.get('/balance', async (_req, res) => {
        try {
            const balance = await bridge.getBalance();
            res.json({
                success: true,
                data: { balance },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
                success: false,
                error: message,
                timestamp: Date.now(),
            });
        }
    });
    /**
     * GET /api/data/market
     * Get market data (price, RSI, EMA, ATR, etc.)
     */
    router.get('/market', (_req, res) => {
        try {
            const marketData = bridge.getMarketData();
            res.json({
                success: true,
                data: marketData || {},
                timestamp: Date.now(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
                success: false,
                error: message,
                timestamp: Date.now(),
            });
        }
    });
    /**
     * GET /api/data/signals/recent
     * Get recent signals
     */
    router.get('/signals/recent', (_req, res) => {
        // TODO: Implement signal history retrieval from bot
        // For Phase 2: Return empty array as placeholder
        res.json({
            success: true,
            data: { signals: [] },
            timestamp: Date.now(),
        });
    });
    /**
     * GET /api/data/candles?timeframe=5m&limit=100
     * Get candlestick data for web chart
     */
    router.get('/candles', async (req, res) => {
        try {
            const timeframe = req.query.timeframe || '5m';
            const limit = parseInt(req.query.limit || '100', 10);
            const candles = await bridge.getCandles(timeframe, Math.min(limit, 500)); // Cap at 500
            res.json({
                success: true,
                data: { candles },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
                success: false,
                error: message,
                timestamp: Date.now(),
            });
        }
    });
    /**
     * GET /api/data/positions/history?limit=50
     * Get recent closed positions with entry/exit points
     */
    router.get('/positions/history', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit || '50', 10);
            const positions = await bridge.getPositionHistory(Math.min(limit, 500)); // Cap at 500
            res.json({
                success: true,
                data: { positions },
                timestamp: Date.now(),
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({
                success: false,
                error: message,
                timestamp: Date.now(),
            });
        }
    });
    return router;
}
//# sourceMappingURL=data.routes.js.map