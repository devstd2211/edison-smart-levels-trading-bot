/**
 * Config Routes
 *
 * Endpoints for configuration management
 * Uses ConfigManagementService for business logic (SRP compliance)
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type {
  ApiResponse,
  ConfigBackupsResponsePayload,
  ConfigCleanupRequestPayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigMutationPreviewPayload,
  ConfigMutationPreviewRequestPayload,
  ConfigReadResponsePayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaPayload,
  ConfigUpdateRequestPayload,
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
import {
  createConfigBackupCollection,
  createConfigMutationPreviewResponse,
  createConfigUpdateResponse,
  createConfigValidationResponse,
  type ConfigRestoreRequestParams,
  hasValidationConfigPayload,
  isConfigPayload,
  parseCleanupKeepCount,
  parseRestoreBackupId,
  resolveServerRuntimePorts,
  type StrategyToggleRequestParams,
} from './config-route-contracts.js';
import { handleRouteError, requireNonEmptyParam, sendError, sendSuccess } from './route-response.js';

type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

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
  router.get('/', async (req: Request, res: Response<ApiResponse<ConfigReadResponsePayload>>) => {
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
  router.put(
    '/',
    async (
      req: Request<Record<string, never>, ApiResponse<ConfigUpdateResponsePayload>, ConfigUpdateRequestPayload>,
      res: Response<ApiResponse<ConfigUpdateResponsePayload>>,
    ) => {
    try {
      if (!isConfigPayload(req.body)) {
        sendError(res, 400, 'Invalid configuration payload');
        return;
      }
      sendSuccess(res, createConfigUpdateResponse(await configService.write(req.body)));
    } catch (error) {
      handleRouteError(res, error, 'Failed to update configuration', 400);
    }
    },
  );

  /**
   * GET /api/config/strategies
   * Get all available strategies with their enabled status
   */
  router.get('/strategies', async (req: Request, res: Response<ApiResponse<StrategiesResponsePayload>>) => {
    try {
      sendSuccess(res, await configService.getStrategySummaries());
    } catch (error) {
      handleRouteError(res, error, 'Failed to fetch strategies');
    }
  });

  /**
   * PATCH /api/config/strategies/:id
   * Toggle individual strategy on/off
   */
  router.patch(
    '/strategies/:id',
    async (
      req: Request<StrategyToggleRequestParams, ApiResponse<StrategyToggleResponsePayload>, StrategyToggleRequestPayload>,
      res: Response<ApiResponse<StrategyToggleResponsePayload>>,
    ) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;

      if (!requireNonEmptyParam(res, id, 'Strategy id')) {
        return;
      }
      if (typeof enabled !== 'boolean') {
        sendError(res, 400, 'Missing enabled flag');
        return;
      }

      sendSuccess(res, await configService.updateStrategyToggle(id, enabled));
    } catch (error) {
      handleRouteError(res, error, 'Failed to update strategy configuration', 404);
    }
    },
  );

  /**
   * PATCH /api/config/risk
   * Update risk management settings
   */
  router.patch(
    '/risk',
    async (
      req: Request<Record<string, never>, ApiResponse<RiskUpdateResponsePayload>, RiskSettingsPayload>,
      res: Response<ApiResponse<RiskUpdateResponsePayload>>,
    ) => {
    try {
      sendSuccess(res, await configService.updateRiskSettings(req.body));
    } catch (error) {
      handleRouteError(res, error, 'Failed to update risk settings');
    }
    },
  );

  /**
   * POST /api/config/preview
   * Preview configuration mutation diff and validation summary
   */
  router.post(
    '/preview',
    async (
      req: Request<Record<string, never>, ApiResponse<ConfigMutationPreviewPayload>, ConfigMutationPreviewRequestPayload>,
      res: Response<ApiResponse<ConfigMutationPreviewPayload>>,
    ) => {
      try {
        if (!hasValidationConfigPayload(req.body)) {
          sendError(res, 400, 'No config provided for preview');
          return;
        }

        sendSuccess(res, createConfigMutationPreviewResponse(await configService.preview(req.body.config)));
      } catch (error) {
        handleRouteError(res, error, 'Failed to preview configuration');
      }
    },
  );

  /**
   * POST /api/config/validate
   * Validate configuration JSON
   */
  router.post(
    '/validate',
    (
      req: Request<Record<string, never>, ApiResponse<ConfigValidationResponsePayload>, ConfigValidationRequestPayload>,
      res: Response<ApiResponse<ConfigValidationResponsePayload>>,
    ) => {
    try {
      if (!hasValidationConfigPayload(req.body)) {
        sendError(res, 400, 'No config provided for validation');
        return;
      }

      sendSuccess(res, createConfigValidationResponse(configService.validate(req.body.config)));
    } catch (error) {
      handleRouteError(res, error, 'Failed to validate configuration');
    }
    },
  );

  /**
   * GET /api/config/backups
   * List all configuration backups
   */
  router.get('/backups', async (req: Request, res: Response<ApiResponse<ConfigBackupsResponsePayload>>) => {
    try {
      sendSuccess(res, createConfigBackupCollection(await configService.getBackups()));
    } catch (error) {
      handleRouteError(res, error, 'Failed to retrieve backups');
    }
  });

  /**
   * POST /api/config/restore/:backupId
   * Restore configuration from a specific backup
   */
  router.post(
    '/restore/:backupId',
    async (
      req: Request<ConfigRestoreRequestParams, ApiResponse<ConfigRestoreResponsePayload>>,
      res: Response<ApiResponse<ConfigRestoreResponsePayload>>,
    ) => {
    try {
      const backupId = parseRestoreBackupId(req.params);
      if (!requireNonEmptyParam(res, backupId, 'Backup id')) {
        return;
      }
      sendSuccess(res, await configService.restore(backupId));
    } catch (error) {
      handleRouteError(res, error, 'Failed to restore configuration', 400);
    }
    },
  );

  /**
   * POST /api/config/cleanup
   * Delete old backups (keep only N most recent)
   */
  router.post(
    '/cleanup',
    async (
      req: Request<Record<string, never>, ApiResponse<ConfigCleanupResponsePayload>, ConfigCleanupRequestPayload>,
      res: Response<ApiResponse<ConfigCleanupResponsePayload>>,
    ) => {
    try {
      const keepCount = parseCleanupKeepCount(req.body);
      sendSuccess(res, await configService.cleanupOldBackups(keepCount));
    } catch (error) {
      handleRouteError(res, error, 'Failed to cleanup backups');
    }
    },
  );

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
      sendSuccess(res, createConfigBackupCollection(await configService.getBackups()));
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
    const { apiPort, wsPort } = resolveServerRuntimePorts(getRuntimePorts?.());

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
