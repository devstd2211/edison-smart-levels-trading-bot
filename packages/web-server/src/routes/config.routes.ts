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
import type {
  ApiResponse,
  BotConfigPayload,
  ConfigBackupsResponsePayload,
  ConfigCleanupRequestPayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaPayload,
  ConfigUpdateResponsePayload,
  ConfigValidationRequestPayload,
  ConfigValidationResponsePayload,
  RiskSettingsPayload,
  RiskUpdateResponsePayload,
  ServerRuntimeConfigPayload,
  StrategyToggleRequestPayload,
  StrategyToggleResponsePayload,
  StrategiesResponsePayload,
} from '@edison/contracts/runtime-api';
import { ConfigManagementService } from '../services/config-management.service.js';
import { handleRouteError, requireNonEmptyParam, sendError, sendSuccess } from './route-response.js';

type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function createConfigRoutes(
  configPath: string = './config.json',
  getRuntimePorts?: () => ServerRuntimePorts,
): Router {
  const router = Router();
  const configService = new ConfigManagementService(configPath);

  /**
   * GET /api/config
   * Get full configuration
   */
  router.get('/', async (req: Request, res: Response<ApiResponse<BotConfigPayload>>) => {
    try {
      sendSuccess(res, await configService.read());
    } catch (error) {
      handleRouteError(res, error, 'Failed to read configuration');
    }
  });

  /**
   * PUT /api/config
   * Update entire configuration (requires bot restart)
   */
  router.put('/', async (req: Request, res: Response<ApiResponse<ConfigUpdateResponsePayload>>) => {
    try {
      if (!isRecord(req.body)) {
        sendError(res, 400, 'Invalid configuration payload');
        return;
      }
      const result = await configService.write(req.body as BotConfigPayload);
      sendSuccess(res, {
        message: result.message,
        backupPath: result.backupPath,
        requiresRestart: true,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update configuration', 400);
    }
  });

  /**
   * GET /api/config/strategies
   * Get all available strategies with their enabled status
   */
  router.get('/strategies', async (req: Request, res: Response<ApiResponse<StrategiesResponsePayload>>) => {
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as unknown;

      if (!isRecord(config) || !isRecord(config.strategies)) {
        sendSuccess(res, {
          strategies: [],
          total: 0,
          active: 0,
        });
        return;
      }

      // Map config strategies to UI format
      const strategies = Object.entries(config.strategies).map(([key, value]) => {
        const enabled = isRecord(value) ? value.enabled === true : false;
        return {
          id: key,
          name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
          enabled,
          config: isRecord(value) ? value : undefined,
        };
      });

      sendSuccess(res, {
        strategies,
        total: strategies.length,
        active: strategies.filter((s) => s.enabled).length,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch strategies');
    }
  });

  /**
   * PATCH /api/config/strategies/:id
   * Toggle individual strategy on/off
   */
  router.patch('/strategies/:id', async (req: Request, res: Response<ApiResponse<StrategyToggleResponsePayload>>) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body as StrategyToggleRequestPayload;

      if (!requireNonEmptyParam(res, id, 'Strategy id')) {
        return;
      }
      if (typeof enabled !== 'boolean') {
        sendError(res, 400, 'Missing enabled flag');
        return;
      }

      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as unknown;

      // Update nested strategy config
      if (!isRecord(config) || !isRecord(config.strategies) || !isRecord(config.strategies[id])) {
        sendError(res, 404, `Strategy '${id}' not found in configuration`);
        return;
      }

      config.strategies[id].enabled = enabled;

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      sendSuccess(res, {
        strategy: id,
        enabled,
        message: `Strategy ${id} ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update strategy configuration');
    }
  });

  /**
   * PATCH /api/config/risk
   * Update risk management settings
   */
  router.patch('/risk', async (req: Request, res: Response<ApiResponse<RiskUpdateResponsePayload>>) => {
    try {
      const {
        maxLeverage,
        maxPositionSize,
        dailyLossLimit,
        stopLossPercent,
        takeProfitPercent,
      } = req.body as RiskSettingsPayload;

      const configData = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configData) as unknown;

      // Keep legacy `risk` and current `riskManagement` shapes aligned.
      if (!isRecord(config)) {
        sendError(res, 500, 'Invalid configuration format');
        return;
      }
      const risk = isRecord(config.risk) ? config.risk : {};
      const riskManagement = isRecord(config.riskManagement) ? config.riskManagement : {};

      // Update provided risk settings
      if (maxLeverage !== undefined) risk.maxLeverage = maxLeverage;
      if (maxPositionSize !== undefined) risk.maxPositionSize = maxPositionSize;
      if (dailyLossLimit !== undefined) risk.dailyLossLimit = dailyLossLimit;
      if (stopLossPercent !== undefined) risk.stopLossPercent = stopLossPercent;
      if (takeProfitPercent !== undefined) risk.takeProfitPercent = takeProfitPercent;

      if (stopLossPercent !== undefined) riskManagement.stopLossPercent = stopLossPercent;

      config.risk = risk;
      if (Object.keys(riskManagement).length > 0) {
        config.riskManagement = riskManagement;
      }
      const responseRisk = isRecord(config.riskManagement)
        ? config.riskManagement
        : isRecord(config.risk)
          ? config.risk
          : {};

      // Write updated config
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));

      sendSuccess(res, {
        message: 'Risk settings updated successfully',
        risk: responseRisk as RiskSettingsPayload & Record<string, unknown>,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to update risk settings');
    }
  });

  /**
   * POST /api/config/validate
   * Validate configuration JSON
   */
  router.post('/validate', (req: Request, res: Response<ApiResponse<ConfigValidationResponsePayload>>) => {
    try {
      const { config } = req.body as ConfigValidationRequestPayload;

      if (!config) {
        sendError(res, 400, 'No config provided for validation');
        return;
      }

      const validation = configService.validate(config);

      sendSuccess(res, {
        valid: validation.valid,
        errors: validation.errors,
        warnings: [],
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to validate configuration');
    }
  });

  /**
   * GET /api/config/backups
   * List all configuration backups
   */
  router.get('/backups', async (req: Request, res: Response<ApiResponse<ConfigBackupsResponsePayload>>) => {
    try {
      const backups = await configService.getBackups();
      sendSuccess(res, {
        backups,
        count: backups.length,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to retrieve backups');
    }
  });

  /**
   * POST /api/config/restore/:backupId
   * Restore configuration from a specific backup
   */
  router.post('/restore/:backupId', async (req: Request, res: Response<ApiResponse<ConfigRestoreResponsePayload>>) => {
    try {
      const { backupId } = req.params;
      if (!requireNonEmptyParam(res, backupId, 'Backup id')) {
        return;
      }
      sendSuccess(res, await configService.restore(backupId));
    } catch (error) {
      handleRouteError(res, error, 'Failed to restore configuration', 400);
    }
  });

  /**
   * POST /api/config/cleanup
   * Delete old backups (keep only N most recent)
   */
  router.post('/cleanup', async (req: Request, res: Response<ApiResponse<ConfigCleanupResponsePayload>>) => {
    try {
      const { keepCount = 10 } = req.body as ConfigCleanupRequestPayload;
      sendSuccess(res, await configService.cleanupOldBackups(keepCount));
    } catch (error) {
      handleRouteError(res, error, 'Failed to cleanup backups');
    }
  });

  /**
   * GET /api/config/schema
   * Get configuration schema for UI hints
   */
  router.get('/schema', (req: Request, res: Response<ApiResponse<ConfigSchemaPayload>>) => {
    sendSuccess(res, configService.getSchema());
  });

  /**
   * GET /api/config/history
   * Get configuration change history (deprecated - use /backups instead)
   */
  router.get('/history', async (req: Request, res: Response<ApiResponse<ConfigHistoryResponsePayload>>) => {
    try {
      const backups = await configService.getBackups();

      // Map to legacy format for backward compatibility
      const legacyBackups = backups.map((b) => ({
        filename: path.basename(b.filePath),
        path: b.filePath,
      }));

      sendSuccess(res, {
        backups: legacyBackups,
        count: legacyBackups.length,
      });
    } catch (error) {
      handleRouteError(res, error, 'Failed to retrieve configuration history');
    }
  });

  /**
   * GET /api/config/server
   * Get server configuration (ports, endpoints, etc.) from .env
   * Uses actual runtime ports if provided (handles port conflicts)
   */
  router.get('/server', (req: Request, res: Response<ApiResponse<ServerRuntimeConfigPayload>>) => {
    const runtimePorts = getRuntimePorts?.();
    const apiPort = runtimePorts?.apiPort ?? parseInt(process.env.API_PORT || '4000', 10);
    const wsPort = runtimePorts?.wsPort ?? parseInt(process.env.WS_PORT || '4001', 10);

    sendSuccess(res, {
      api: {
        port: apiPort,
        url: `http://localhost:${apiPort}`,
      },
      websocket: {
        port: wsPort,
        url: `ws://localhost:${wsPort}`,
      },
    });
  });

  return router;
}
