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
import {
  createConfigRouteApi,
  createConfigMutationPreviewResponse,
  createConfigUpdateResponse,
  createConfigValidationResponse,
  type ConfigRouteApi,
  type ConfigRestoreRequestParams,
  type ServerRuntimePorts,
  parseCleanupKeepCount,
  createServerRuntimeConfigPayload,
  requireConfigMutationRequest,
  requireRestoreBackupId,
  requireValidationConfigRequest,
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

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export { createConfigRouteApi };
export type { ConfigRouteApi };

function requireStrategyToggleEnabled(
  res: Response<ApiResponse<StrategyToggleResponsePayload>>,
  enabled: unknown,
): enabled is boolean {
  if (typeof enabled === 'boolean') {
    return true;
  }

  sendError(res, 400, 'Missing enabled flag');
  return false;
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
    ) =>
      sendAsyncRouteMutation(res, async () => createConfigUpdateResponse(await configApi.write(
        requireConfigMutationRequest(req.body),
      )), {
        fallbackMessage: 'Failed to update configuration',
        status: 400,
      }),
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
      if (!requireStrategyToggleEnabled(res, enabled)) {
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
    ) =>
      sendAsyncRouteMutation(res, async () => createConfigMutationPreviewResponse(await configApi.preview(
        requireConfigMutationRequest(req.body, 'No config provided for preview'),
      )), {
          fallbackMessage: 'Failed to preview configuration',
        }),
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
    ) =>
      sendRouteMutation(res, () => createConfigValidationResponse(configApi.validate(
        requireValidationConfigRequest(req.body),
      )), {
        fallbackMessage: 'Failed to validate configuration',
      }),
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
    ) =>
      sendAsyncRouteMutation(res, () => configApi.restore(requireRestoreBackupId(req.params)), {
        fallbackMessage: 'Failed to restore configuration',
        status: 400,
      }),
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
