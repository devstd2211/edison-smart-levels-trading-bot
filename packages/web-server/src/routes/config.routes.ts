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
  ConfigServerRuntimeResponsePayload,
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
  StrategyToggleRequestPayload,
  StrategyToggleResponsePayload,
  StrategiesResponsePayload,
} from '@edison/contracts/runtime-api';
import { ConfigManagementService } from '../services/config-management.service.js';
import {
  createConfigMutationPreviewResponse,
  createConfigUpdateResponse,
  createConfigValidationResponse,
  type ConfigRestoreRequestParams,
  parseConfigMutationRequest,
  parseValidationConfigRequest,
  parseCleanupKeepCount,
  parseRestoreBackupId,
  createServerRuntimeConfigPayload,
  type StrategyToggleRequestParams,
} from './config-route-contracts.js';
import {
  sendAsyncRouteMutation,
  handleRouteError,
  requireNonEmptyParam,
  sendAsyncRouteRead,
  sendError,
  sendRouteMutation,
  sendRouteRead,
} from './route-response.js';

type ServerRuntimePorts = {
  apiPort: number;
  wsPort: number;
};

type ConfigRouteReadApi = Pick<
  ConfigManagementService,
  'read' | 'getStrategySummaries' | 'getBackupCollection' | 'getSchema' | 'getHistory' | 'validate'
>;

type ConfigRouteMutationApi = Pick<
  ConfigManagementService,
  'write' | 'updateStrategyToggle' | 'updateRiskSettings' | 'preview' | 'restore' | 'cleanupOldBackups'
>;

export type ConfigRouteApi = ConfigRouteReadApi & ConfigRouteMutationApi;

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export function createConfigRouteApi(service: ConfigRouteApi): ConfigRouteApi {
  return {
    read: () => service.read(),
    write: (config) => service.write(config),
    getStrategySummaries: () => service.getStrategySummaries(),
    updateStrategyToggle: (id, enabled) => service.updateStrategyToggle(id, enabled),
    updateRiskSettings: (riskPatch) => service.updateRiskSettings(riskPatch),
    preview: (config) => service.preview(config),
    validate: (config) => service.validate(config),
    getBackupCollection: () => service.getBackupCollection(),
    restore: (backupId) => service.restore(backupId),
    cleanupOldBackups: (keepCount) => service.cleanupOldBackups(keepCount),
    getSchema: () => service.getSchema(),
    getHistory: () => service.getHistory(),
  };
}

export function createConfigRoutes(
  configApi: ConfigRouteApi,
  getRuntimePorts?: () => ServerRuntimePorts,
): Router {
  const router = Router();

  /**
   * GET /api/config
   * Get full configuration
   */
  router.get('/', async (req: Request, res: Response<ApiResponse<ConfigReadResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => configApi.read(), {
      fallbackMessage: 'Failed to read configuration',
    });
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
      const config = parseConfigMutationRequest(req.body);
      if (!config) {
        sendError(res, 400, 'Invalid configuration payload');
        return;
      }
      await sendAsyncRouteMutation(res, async () => createConfigUpdateResponse(await configApi.write(config)), {
        fallbackMessage: 'Failed to update configuration',
        status: 400,
      });
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
    await sendAsyncRouteRead(res, () => configApi.getStrategySummaries(), {
      fallbackMessage: 'Failed to fetch strategies',
    });
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

      await sendAsyncRouteMutation(res, () => configApi.updateStrategyToggle(id, enabled), {
        fallbackMessage: 'Failed to update strategy configuration',
        status: 404,
      });
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
    ) => sendAsyncRouteMutation(res, () => configApi.updateRiskSettings(req.body), {
      fallbackMessage: 'Failed to update risk settings',
    }),
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
        const config = parseConfigMutationRequest(req.body);
        if (!config) {
          sendError(res, 400, 'No config provided for preview');
          return;
        }

        await sendAsyncRouteMutation(res, async () => createConfigMutationPreviewResponse(await configApi.preview(config)), {
          fallbackMessage: 'Failed to preview configuration',
        });
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
      const config = parseValidationConfigRequest(req.body);
      if (!config) {
        sendError(res, 400, 'No config provided for validation');
        return;
      }

      sendRouteMutation(res, () => createConfigValidationResponse(configApi.validate(config)), {
        fallbackMessage: 'Failed to validate configuration',
      });
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
    await sendAsyncRouteRead(res, () => configApi.getBackupCollection(), {
      fallbackMessage: 'Failed to retrieve backups',
    });
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
      await sendAsyncRouteMutation(res, () => configApi.restore(backupId), {
        fallbackMessage: 'Failed to restore configuration',
        status: 400,
      });
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
      await sendAsyncRouteMutation(res, () => configApi.cleanupOldBackups(keepCount), {
        fallbackMessage: 'Failed to cleanup backups',
      });
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
    sendRouteRead(res, () => configApi.getSchema());
  });

  /**
   * GET /api/config/history
   * Get configuration change history (deprecated - use /backups instead)
   */
  router.get('/history', async (req: Request, res: Response<ApiResponse<ConfigHistoryResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => configApi.getHistory(), {
      fallbackMessage: 'Failed to retrieve configuration history',
    });
  });

  /**
   * GET /api/config/server
   * Get server configuration (ports, endpoints, etc.) from .env
   * Uses actual runtime ports if provided (handles port conflicts)
   */
  router.get('/server', (req: Request, res: Response<ApiResponse<ConfigServerRuntimeResponsePayload>>) => {
    sendRouteRead(res, () => createServerRuntimeConfigPayload(getRuntimePorts?.()));
  });

  return router;
}
