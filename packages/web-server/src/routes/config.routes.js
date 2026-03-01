"use strict";
/**
 * Config Routes
 *
 * Endpoints for configuration management
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConfigRoutes = createConfigRoutes;
const express_1 = require("express");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
function createConfigRoutes(configPath = './config.json') {
    const router = (0, express_1.Router)();
    /**
     * GET /api/config
     * Get full configuration
     */
    router.get('/', async (req, res) => {
        try {
            const data = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(data);
            res.json({
                success: true,
                data: config,
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to read configuration',
            });
        }
    });
    /**
     * PUT /api/config
     * Update entire configuration (requires bot restart)
     */
    router.put('/', async (req, res) => {
        try {
            const newConfig = req.body;
            // Validate config is an object
            if (typeof newConfig !== 'object' || newConfig === null) {
                return res.status(400).json({
                    success: false,
                    error: 'Config must be a valid object',
                });
            }
            // Create backup
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${configPath}.backup.${timestamp}.json`;
            const currentConfig = await fs.readFile(configPath, 'utf-8');
            await fs.writeFile(backupPath, currentConfig);
            // Write new config
            await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2));
            res.json({
                success: true,
                data: {
                    message: 'Configuration updated successfully',
                    backupPath,
                    requiresRestart: true,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to update configuration',
            });
        }
    });
    /**
     * PATCH /api/config/strategies
     * Toggle individual strategies on/off
     */
    router.patch('/strategies', async (req, res) => {
        try {
            const { strategy, enabled } = req.body;
            if (!strategy || typeof enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing strategy name or enabled flag',
                });
            }
            const configData = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configData);
            // Update strategy config (assuming strategies are in config root)
            if (config[strategy]) {
                config[strategy].enabled = enabled;
            }
            else {
                return res.status(404).json({
                    success: false,
                    error: `Strategy '${strategy}' not found in configuration`,
                });
            }
            // Write updated config
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            res.json({
                success: true,
                data: {
                    strategy,
                    enabled,
                    message: `Strategy ${strategy} ${enabled ? 'enabled' : 'disabled'}`,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to update strategy configuration',
            });
        }
    });
    /**
     * PATCH /api/config/risk
     * Update risk management settings
     */
    router.patch('/risk', async (req, res) => {
        try {
            const { maxLeverage, maxPositionSize, dailyLossLimit, stopLossPercent } = req.body;
            const configData = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(configData);
            // Ensure risk object exists
            if (!config.risk) {
                config.risk = {};
            }
            // Update provided risk settings
            if (maxLeverage !== undefined)
                config.risk.maxLeverage = maxLeverage;
            if (maxPositionSize !== undefined)
                config.risk.maxPositionSize = maxPositionSize;
            if (dailyLossLimit !== undefined)
                config.risk.dailyLossLimit = dailyLossLimit;
            if (stopLossPercent !== undefined)
                config.risk.stopLossPercent = stopLossPercent;
            // Write updated config
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            res.json({
                success: true,
                data: {
                    message: 'Risk settings updated successfully',
                    risk: config.risk,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to update risk settings',
            });
        }
    });
    /**
     * POST /api/config/validate
     * Validate configuration JSON
     */
    router.post('/validate', async (req, res) => {
        try {
            const { config } = req.body;
            if (!config) {
                return res.status(400).json({
                    success: false,
                    error: 'No config provided for validation',
                });
            }
            // Basic validation
            const errors = [];
            // Validate required fields
            if (!config.trading && !config.strategies) {
                errors.push('Config must have trading or strategies section');
            }
            // Validate risk parameters if present
            if (config.risk) {
                if (config.risk.maxLeverage && typeof config.risk.maxLeverage !== 'number') {
                    errors.push('maxLeverage must be a number');
                }
                if (config.risk.maxPositionSize && typeof config.risk.maxPositionSize !== 'number') {
                    errors.push('maxPositionSize must be a number');
                }
                if (config.risk.dailyLossLimit && typeof config.risk.dailyLossLimit !== 'number') {
                    errors.push('dailyLossLimit must be a number');
                }
            }
            // Validate strategies if present
            if (config.strategies && typeof config.strategies !== 'object') {
                errors.push('Strategies must be an object');
            }
            res.json({
                success: errors.length === 0,
                data: {
                    valid: errors.length === 0,
                    errors,
                    warnings: [],
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to validate configuration',
            });
        }
    });
    /**
     * GET /api/config/schema
     * Get configuration schema for UI hints
     */
    router.get('/schema', async (req, res) => {
        const schema = {
            sections: {
                trading: {
                    name: 'Trading Parameters',
                    fields: [
                        { name: 'symbol', type: 'string', label: 'Trading Pair' },
                        { name: 'timeframe', type: 'string', label: 'Candle Timeframe' },
                        { name: 'enabled', type: 'boolean', label: 'Enable Trading' },
                    ],
                },
                risk: {
                    name: 'Risk Management',
                    fields: [
                        { name: 'maxLeverage', type: 'number', label: 'Max Leverage' },
                        { name: 'maxPositionSize', type: 'number', label: 'Max Position Size' },
                        { name: 'dailyLossLimit', type: 'number', label: 'Daily Loss Limit' },
                        { name: 'stopLossPercent', type: 'number', label: 'Stop Loss %' },
                    ],
                },
                strategies: {
                    name: 'Strategies',
                    fields: [
                        { name: 'enabled', type: 'boolean', label: 'Enabled' },
                        { name: 'confidence', type: 'number', label: 'Min Confidence' },
                        { name: 'maxTrades', type: 'number', label: 'Max Concurrent Trades' },
                    ],
                },
            },
        };
        res.json({
            success: true,
            data: schema,
        });
    });
    /**
     * GET /api/config/history
     * Get configuration change history (backups)
     */
    router.get('/history', async (req, res) => {
        try {
            const configDir = path.dirname(configPath);
            const files = await fs.readdir(configDir);
            // Find all backup files
            const backups = files
                .filter((f) => f.startsWith(path.basename(configPath)) && f.includes('backup'))
                .map((f) => ({
                filename: f,
                path: path.join(configDir, f),
            }))
                .sort()
                .reverse();
            res.json({
                success: true,
                data: {
                    backups,
                    count: backups.length,
                },
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve configuration history',
            });
        }
    });
    return router;
}
//# sourceMappingURL=config.routes.js.map