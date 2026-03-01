"use strict";
/**
 * Bot Control Routes
 *
 * API endpoints for bot management:
 * - GET /api/bot/status - Get bot status
 * - POST /api/bot/start - Start bot
 * - POST /api/bot/stop - Stop bot
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBotRoutes = createBotRoutes;
const express_1 = require("express");
function createBotRoutes(bridge) {
    const router = (0, express_1.Router)();
    /**
     * GET /api/bot/status
     * Get current bot status
     */
    router.get('/status', async (_req, res) => {
        try {
            const status = await bridge.getStatus();
            res.json({
                success: true,
                data: status,
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
     * POST /api/bot/start
     * Start the trading bot
     */
    router.post('/start', async (_req, res) => {
        try {
            const result = await bridge.startBot();
            if (result.success) {
                res.json({
                    success: true,
                    data: { message: 'Bot started successfully' },
                    timestamp: Date.now(),
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to start bot',
                    timestamp: Date.now(),
                });
            }
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
     * POST /api/bot/stop
     * Stop the trading bot
     */
    router.post('/stop', (_req, res) => {
        try {
            const result = bridge.stopBot();
            if (result.success) {
                res.json({
                    success: true,
                    data: { message: 'Bot stopped successfully' },
                    timestamp: Date.now(),
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to stop bot',
                    timestamp: Date.now(),
                });
            }
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
//# sourceMappingURL=bot.routes.js.map