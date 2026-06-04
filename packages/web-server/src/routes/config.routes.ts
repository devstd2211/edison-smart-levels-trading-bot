/**
 * Config Routes
 *
 * Endpoints for configuration management
 * Uses ConfigManagementService for business logic (SRP compliance)
 */

import { Router, Request, Response } from 'express';
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
  createConfigRouteHandlers,
  createConfigRouteApi,
  type ConfigRouteApi,
  type ConfigRestoreRequestParams,
  type ServerRuntimePorts,
  type StrategyToggleRequestParams,
} from './config-route-contracts.js';
import {
  sendAsyncRouteMutation,
  sendAsyncRouteRead,
  sendRouteRead,
  sendRouteMutation,
} from './route-response.js';

export { createConfigRouteApi };
export type { ConfigRouteApi };

export function createConfigRoutes(
  configApi: ConfigRouteApi,
  getRuntimePorts?: () => ServerRuntimePorts,
): Router {
  const router = Router();
  const handlers = createConfigRouteHandlers(configApi, getRuntimePorts);

  /**
   * GET /api/config
   * Get full configuration
   */
  router.get('/', async (req: Request, res: Response<ApiResponse<ConfigReadResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => handlers.readConfig(), {
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
      sendAsyncRouteMutation(res, () => handlers.updateConfig(req.body), {
        fallbackMessage: 'Failed to update configuration',
        status: 400,
      }),
  );

  /**
   * GET /api/config/strategies
   * Get all available strategies with their enabled status
   */
  router.get('/strategies', async (req: Request, res: Response<ApiResponse<StrategiesResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => handlers.getStrategySummaries(), {
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
    ) =>
      sendAsyncRouteMutation(res, () => handlers.updateStrategyToggle(req.params, req.body), {
        fallbackMessage: 'Failed to update strategy configuration',
        status: 404,
      }),
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
    ) => sendAsyncRouteMutation(res, () => handlers.updateRiskSettings(req.body), {
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
      sendAsyncRouteMutation(res, () => handlers.previewConfig(req.body), {
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
      sendRouteMutation(res, () => handlers.validateConfig(req.body), {
        fallbackMessage: 'Failed to validate configuration',
      }),
  );

  /**
   * GET /api/config/backups
   * List all configuration backups
   */
  router.get('/backups', async (req: Request, res: Response<ApiResponse<ConfigBackupsResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => handlers.getBackupCollection(), {
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
      sendAsyncRouteMutation(res, () => handlers.restoreConfig(req.params), {
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
    ) =>
      sendAsyncRouteMutation(res, () => handlers.cleanupBackups(req.body), {
        fallbackMessage: 'Failed to cleanup backups',
      }),
  );

  /**
   * GET /api/config/schema
   * Get configuration schema for UI hints
   */
  router.get('/schema', (req: Request, res: Response<ApiResponse<ConfigSchemaPayload>>) => {
    sendRouteRead(res, () => handlers.getSchema());
  });

  /**
   * GET /api/config/history
   * Get configuration change history (deprecated - use /backups instead)
   */
  router.get('/history', async (req: Request, res: Response<ApiResponse<ConfigHistoryResponsePayload>>) => {
    await sendAsyncRouteRead(res, () => handlers.getHistory(), {
      fallbackMessage: 'Failed to retrieve configuration history',
    });
  });

  /**
   * GET /api/config/server
   * Get server configuration (ports, endpoints, etc.) from .env
   * Uses actual runtime ports if provided (handles port conflicts)
   */
  router.get('/server', (req: Request, res: Response<ApiResponse<ConfigServerRuntimeResponsePayload>>) => {
    sendRouteRead(res, () => handlers.readServerRuntimeConfig());
  });

  return router;
}
