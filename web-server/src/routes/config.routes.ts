/**
 * Config Routes
 *
 * Endpoints for configuration management
 * Uses ConfigManagementService for business logic (SRP compliance)
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ConfigManagementService } from '../services/config-management.service.js';

export interface BotConfig {
  [key: string]: any;
}

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function createConfigRoutes(configPath: string = './config.json', getActualWsPort?: () => number): Router {
  const router = Router();
  const configService = new ConfigManagementService(configPath);

  /**
   * GET /api/config
   * Get full configuration
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const config = await configService.read();
      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to read configuration';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * PUT /api/config
   * Update entire configuration (requires bot restart)
   */
  router.put('/', async (req: Request, res: Response) => {
    try {
      const result = await configService.write(req.body);
      res.json({
        success: true,
        data: {
          message: result.message,
          backupPath: result.backupPath,
          requiresRestart: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update configuration';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/config/strategies
   * Get all available strategies with their enabled status
   */
  router.get('/strategies', async (req: Request, res: Response) => {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      if (!config.strategies) {
        return res.json({
          success: true,
          data: {
            strategies: [],
          },
        });
      }

      // Map config strategies to UI format
      const strategies = Object.entries(config.strategies).map(([key, value]: [string, any]) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
        enabled: value.enabled || false,
        config: value,
      }));

      res.json({
        success: true,
        data: {
          strategies,
          total: strategies.length,
          active: strategies.filter((s) => s.enabled).length,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to fetch strategies',
      });
    }
  });

  /**
   * PATCH /api/config/strategies/:id
   * Toggle individual strategy on/off
   */
  router.patch('/strategies/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'Missing enabled flag',
        });
      }

      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Update nested strategy config
      if (!config.strategies || !config.strategies[id]) {
        return res.status(404).json({
          success: false,
          error: `Strategy '${id}' not found in configuration`,
        });
      }

      config.strategies[id].enabled = enabled;

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        data: {
          strategy: id,
          enabled,
          message: `Strategy ${id} ${enabled ? 'enabled' : 'disabled'}`,
        },
      });
    } catch (error) {
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
  router.patch('/risk', async (req: Request, res: Response) => {
    try {
      const { maxLeverage, maxPositionSize, dailyLossLimit, stopLossPercent } = req.body;

      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Ensure risk object exists
      if (!config.risk) {
        config.risk = {};
      }

      // Update provided risk settings
      if (maxLeverage !== undefined) config.risk.maxLeverage = maxLeverage;
      if (maxPositionSize !== undefined) config.risk.maxPositionSize = maxPositionSize;
      if (dailyLossLimit !== undefined) config.risk.dailyLossLimit = dailyLossLimit;
      if (stopLossPercent !== undefined) config.risk.stopLossPercent = stopLossPercent;

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      res.json({
        success: true,
        data: {
          message: 'Risk settings updated successfully',
          risk: config.risk,
        },
      });
    } catch (error) {
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
  router.post('/validate', (req: Request, res: Response) => {
    try {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({
          success: false,
          error: 'No config provided for validation',
        });
      }

      const validation = configService.validate(config);

      res.json({
        success: validation.valid,
        data: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: [],
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to validate configuration',
      });
    }
  });

  /**
   * GET /api/config/backups
   * List all configuration backups
   */
  router.get('/backups', async (req: Request, res: Response) => {
    try {
      const backups = await configService.getBackups();
      res.json({
        success: true,
        data: {
          backups,
          count: backups.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve backups';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * POST /api/config/restore/:backupId
   * Restore configuration from a specific backup
   */
  router.post('/restore/:backupId', async (req: Request, res: Response) => {
    try {
      const { backupId } = req.params;
      const result = await configService.restore(backupId);
      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore configuration';
      res.status(400).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * POST /api/config/cleanup
   * Delete old backups (keep only N most recent)
   */
  router.post('/cleanup', async (req: Request, res: Response) => {
    try {
      const { keepCount = 10 } = req.body;
      const result = await configService.cleanupOldBackups(keepCount);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cleanup backups';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/config/schema
   * Get configuration schema for UI hints
   */
  router.get('/schema', (req: Request, res: Response) => {
    const schema = configService.getSchema();
    res.json({
      success: true,
      data: schema,
    });
  });

  /**
   * GET /api/config/history
   * Get configuration change history (deprecated - use /backups instead)
   */
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const backups = await configService.getBackups();

      // Map to legacy format for backward compatibility
      const legacyBackups = backups.map((b) => ({
        filename: path.basename(b.filePath),
        path: b.filePath,
      }));

      res.json({
        success: true,
        data: {
          backups: legacyBackups,
          count: legacyBackups.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retrieve configuration history';
      res.status(500).json({
        success: false,
        error: message,
      });
    }
  });

  /**
   * GET /api/config/server
   * Get server configuration (ports, endpoints, etc.) from .env
   * Uses actual port from getActualWsPort() if provided (handles port conflicts)
   */
  router.get('/server', (req: Request, res: Response) => {
    const apiPort = parseInt(process.env.API_PORT || '4002', 10);
    // Use actual WS port from callback if available (handles port conflicts)
    const wsPort = getActualWsPort ? getActualWsPort() : parseInt(process.env.WS_PORT || '4003', 10);

    res.json({
      success: true,
      data: {
        api: {
          port: apiPort,
          url: `http://localhost:${apiPort}`,
        },
        websocket: {
          port: wsPort,
          url: `ws://localhost:${wsPort}`,
        },
      },
    });
  });

  return router;
}
