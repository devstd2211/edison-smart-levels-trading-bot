/**
 * Swagger/OpenAPI Configuration
 *
 * Documents API endpoints against the current shared response contracts.
 */

import type {
  ApiMessageResponse,
  BalanceResponsePayload,
  BotConfigPayload,
  BotStatus,
  ConfigBackupPayload,
  ConfigBackupsResponsePayload,
  ConfigCleanupRequestPayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigReadResponsePayload,
  ConfigRestoreResponsePayload,
  ConfigSchemaFieldPayload,
  ConfigSchemaPayload,
  ConfigSchemaSectionPayload,
  ConfigTimeframePayload,
  ConfigUpdateRequestPayload,
  ConfigUpdateResponsePayload,
  ConfigValidationRequestPayload,
  ConfigValidationResponsePayload,
  EquityCurvePoint,
  JournalPagePayload,
  JournalStatsPayload,
  PnlHistoryPoint,
  Position,
  RecentSignalsResponsePayload,
  RiskSettingsPayload,
  RiskUpdateResponsePayload,
  ServerRuntimeConfigPayload,
  SessionComparisonPayload,
  Signal,
  StrategiesConfigPayload,
  StrategiesResponsePayload,
  StrategyConfigEntryPayload,
  StrategyConfigSummary,
  StrategyPerformancePayload,
  StrategyToggleRequestPayload,
  StrategyToggleResponsePayload,
  StructuredApiErrorResponse,
} from '@edison/contracts/runtime-api';
import {
  DEFAULT_CONFIG_BACKUP_KEEP_COUNT,
} from '@edison/contracts/runtime-api';
import type {
  WebApiCandlesResponse,
  WebApiFundingRateView,
  WebApiJournalEntry,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiPositionsResponse,
  WebApiSessionStats,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';

type SwaggerContractSchemas = {
  ApiMessageResponse: ApiMessageResponse;
  BalanceResponsePayload: BalanceResponsePayload;
  BotConfigPayload: BotConfigPayload;
  BotStatus: BotStatus;
  ConfigBackupPayload: ConfigBackupPayload;
  ConfigBackupsResponsePayload: ConfigBackupsResponsePayload;
  ConfigCleanupRequestPayload: ConfigCleanupRequestPayload;
  ConfigCleanupResponsePayload: ConfigCleanupResponsePayload;
  ConfigHistoryResponsePayload: ConfigHistoryResponsePayload;
  ConfigReadResponsePayload: ConfigReadResponsePayload;
  ConfigRestoreResponsePayload: ConfigRestoreResponsePayload;
  ConfigSchemaFieldPayload: ConfigSchemaFieldPayload;
  ConfigSchemaPayload: ConfigSchemaPayload;
  ConfigSchemaSectionPayload: ConfigSchemaSectionPayload;
  ConfigTimeframePayload: ConfigTimeframePayload;
  ConfigUpdateRequestPayload: ConfigUpdateRequestPayload;
  ConfigUpdateResponsePayload: ConfigUpdateResponsePayload;
  ConfigValidationRequestPayload: ConfigValidationRequestPayload;
  ConfigValidationResponsePayload: ConfigValidationResponsePayload;
  GenericObject: Record<string, unknown>;
  HealthStatus: {
    status: string;
    botRunning: boolean;
    timestamp: number;
  };
  EquityCurveCollectionPayload: EquityCurvePoint[];
  JournalEntriesPayload: WebApiJournalEntry[];
  JournalPagePayload: JournalPagePayload;
  JournalStatsPayload: JournalStatsPayload;
  PnlHistoryCollectionPayload: PnlHistoryPoint[];
  Position: Position;
  RecentSignalsResponsePayload: RecentSignalsResponsePayload;
  RiskSettingsPayload: RiskSettingsPayload;
  RiskUpdateResponsePayload: RiskUpdateResponsePayload;
  ServerRuntimeConfigPayload: ServerRuntimeConfigPayload;
  Signal: Signal;
  SessionComparisonPayload: SessionComparisonPayload;
  StrategiesConfigPayload: StrategiesConfigPayload;
  SessionStatsCollectionPayload: WebApiSessionStats[];
  StrategiesResponsePayload: StrategiesResponsePayload;
  StrategyConfigEntryPayload: StrategyConfigEntryPayload;
  StrategyConfigSummary: StrategyConfigSummary;
  StrategyPerformanceCollectionPayload: StrategyPerformancePayload[];
  StrategyToggleRequestPayload: StrategyToggleRequestPayload;
  StrategyToggleResponsePayload: StrategyToggleResponsePayload;
  StructuredApiErrorResponse: StructuredApiErrorResponse;
  WebApiCandlesResponse: WebApiCandlesResponse;
  WebApiFundingRateView: WebApiFundingRateView;
  WebApiMarketData: WebApiMarketData;
  WebApiOrderBookView: WebApiOrderBookView;
  WebApiPositionsResponse: WebApiPositionsResponse;
  WebApiVolumeProfileView: WebApiVolumeProfileView;
  WebApiWallsView: WebApiWallsView;
  WebApiPositionHistoryEntry: WebApiPositionHistoryEntry;
};

const SCHEMAS = {
  ApiMessageResponse: 'ApiMessageResponse',
  BalanceResponsePayload: 'BalanceResponsePayload',
  BotConfigPayload: 'BotConfigPayload',
  BotStatus: 'BotStatus',
  ConfigSchemaFieldPayload: 'ConfigSchemaFieldPayload',
  ConfigSchemaSectionPayload: 'ConfigSchemaSectionPayload',
  ConfigBackupPayload: 'ConfigBackupPayload',
  ConfigBackupsResponsePayload: 'ConfigBackupsResponsePayload',
  ConfigCleanupRequestPayload: 'ConfigCleanupRequestPayload',
  ConfigCleanupResponsePayload: 'ConfigCleanupResponsePayload',
  ConfigHistoryResponsePayload: 'ConfigHistoryResponsePayload',
  ConfigReadResponsePayload: 'ConfigReadResponsePayload',
  ConfigRestoreResponsePayload: 'ConfigRestoreResponsePayload',
  ConfigSchemaPayload: 'ConfigSchemaPayload',
  ConfigTimeframePayload: 'ConfigTimeframePayload',
  ConfigUpdateRequestPayload: 'ConfigUpdateRequestPayload',
  ConfigUpdateResponsePayload: 'ConfigUpdateResponsePayload',
  ConfigValidationRequestPayload: 'ConfigValidationRequestPayload',
  ConfigValidationResponsePayload: 'ConfigValidationResponsePayload',
  GenericObject: 'GenericObject',
  HealthStatus: 'HealthStatus',
  EquityCurveCollectionPayload: 'EquityCurveCollectionPayload',
  JournalEntriesPayload: 'JournalEntriesPayload',
  JournalPagePayload: 'JournalPagePayload',
  JournalStatsPayload: 'JournalStatsPayload',
  PnlHistoryCollectionPayload: 'PnlHistoryCollectionPayload',
  Position: 'Position',
  RecentSignalsResponsePayload: 'RecentSignalsResponsePayload',
  RiskSettingsPayload: 'RiskSettingsPayload',
  RiskUpdateResponsePayload: 'RiskUpdateResponsePayload',
  ServerRuntimeConfigPayload: 'ServerRuntimeConfigPayload',
  Signal: 'Signal',
  SessionComparisonPayload: 'SessionComparisonPayload',
  StrategiesConfigPayload: 'StrategiesConfigPayload',
  SessionStatsCollectionPayload: 'SessionStatsCollectionPayload',
  StrategiesResponsePayload: 'StrategiesResponsePayload',
  StrategyConfigEntryPayload: 'StrategyConfigEntryPayload',
  StrategyConfigSummary: 'StrategyConfigSummary',
  StrategyPerformanceCollectionPayload: 'StrategyPerformanceCollectionPayload',
  StrategyToggleRequestPayload: 'StrategyToggleRequestPayload',
  StrategyToggleResponsePayload: 'StrategyToggleResponsePayload',
  StructuredApiErrorResponse: 'StructuredApiErrorResponse',
  WebApiCandlesResponse: 'WebApiCandlesResponse',
  WebApiFundingRateView: 'WebApiFundingRateView',
  WebApiMarketData: 'WebApiMarketData',
  WebApiOrderBookView: 'WebApiOrderBookView',
  WebApiPositionHistoryEntry: 'WebApiPositionHistoryEntry',
  WebApiPositionsResponse: 'WebApiPositionsResponse',
  WebApiVolumeProfileView: 'WebApiVolumeProfileView',
  WebApiWallsView: 'WebApiWallsView',
} satisfies Record<keyof SwaggerContractSchemas, string>;

const schemaRef = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

const createSuccessEnvelopeSchema = (dataSchema: Record<string, unknown>) => ({
  type: 'object',
  required: ['success', 'data', 'timestamp'],
  properties: {
    success: { type: 'boolean', enum: [true] },
    data: dataSchema,
    timestamp: { type: 'number' },
  },
});

const createSuccessResponse = (description: string, schemaName: string) => ({
  description,
  content: {
    'application/json': {
      schema: createSuccessEnvelopeSchema(schemaRef(schemaName)),
    },
  },
});

const createErrorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: schemaRef(SCHEMAS.StructuredApiErrorResponse),
    },
  },
});

const createJsonRequestBody = (schemaName: string, required: boolean = true) => ({
  required,
  content: {
    'application/json': {
      schema: schemaRef(schemaName),
    },
  },
});

const createConfigRouteSuccessResponse = (description: string, schemaName: string) =>
  createSuccessResponse(description, schemaName);

const createConfigRouteRequestBody = (schemaName: string, required: boolean = true) =>
  createJsonRequestBody(schemaName, required);

const createConfigBackupCollectionSchema = () => ({
  type: 'object',
  required: ['backups', 'count'],
  properties: {
    backups: {
      type: 'array',
      items: schemaRef(SCHEMAS.ConfigBackupPayload),
    },
    count: { type: 'number' },
  },
});

const createConfigActionMessageSchema = (
  properties: Record<string, unknown>,
  required: string[],
) => ({
  type: 'object',
  required: ['message', ...required],
  properties: {
    message: { type: 'string' },
    ...properties,
  },
});

export const swaggerConfig = {
  openapi: '3.0.0',
  info: {
    title: 'Trading Bot Web Server API',
    version: '1.0.0',
    description: 'Real-time API for trading bot management and data retrieval',
    contact: {
      name: 'Bot Support',
    },
  },
  servers: [
    {
      url: 'http://localhost:4000',
      description: 'Development server',
    },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Health check endpoint',
        responses: {
          '200': createSuccessResponse('Server is healthy', 'HealthStatus'),
        },
      },
    },
    '/api/bot/start': {
      post: {
        tags: ['Bot Control'],
        summary: 'Start trading bot',
        responses: {
          '200': createSuccessResponse('Bot started successfully', SCHEMAS.ApiMessageResponse),
          '400': createErrorResponse('Bot could not be started'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/bot/stop': {
      post: {
        tags: ['Bot Control'],
        summary: 'Stop trading bot',
        responses: {
          '200': createSuccessResponse('Bot stopped successfully', SCHEMAS.ApiMessageResponse),
          '400': createErrorResponse('Bot could not be stopped'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/bot/status': {
      get: {
        tags: ['Bot Control'],
        summary: 'Get bot status',
        responses: {
          '200': createSuccessResponse('Current bot status', SCHEMAS.BotStatus),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/position': {
      get: {
        tags: ['Market Data'],
        summary: 'Get current position',
        responses: {
          '200': createSuccessResponse('Current open position or null', 'NullablePosition'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/balance': {
      get: {
        tags: ['Market Data'],
        summary: 'Get account balance',
        responses: {
          '200': createSuccessResponse('Current account balance', SCHEMAS.BalanceResponsePayload),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/market': {
      get: {
        tags: ['Market Data'],
        summary: 'Get market data (indicators)',
        responses: {
          '200': createSuccessResponse('Market data including RSI, EMA, ATR, etc.', SCHEMAS.WebApiMarketData),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/signals/recent': {
      get: {
        tags: ['Market Data'],
        summary: 'Get recent signals',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          '200': createSuccessResponse('Recent trading signals', SCHEMAS.RecentSignalsResponsePayload),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/candles': {
      get: {
        tags: ['Market Data'],
        summary: 'Get candlestick data for charts',
        parameters: [
          {
            name: 'timeframe',
            in: 'query',
            schema: { type: 'string', default: '5m' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 100, minimum: 1, maximum: 500 },
          },
        ],
        responses: {
          '200': createSuccessResponse('Candlestick history', SCHEMAS.WebApiCandlesResponse),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/positions/history': {
      get: {
        tags: ['Market Data'],
        summary: 'Get recent position history',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, minimum: 1, maximum: 500 },
          },
        ],
        responses: {
          '200': createSuccessResponse('Recent position history', SCHEMAS.WebApiPositionsResponse),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/orderbook/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get orderbook snapshot for a trading pair',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': createSuccessResponse('Orderbook snapshot', SCHEMAS.WebApiOrderBookView),
          '400': createErrorResponse('Missing or invalid symbol'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/walls/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get detected buy and sell walls for a trading pair',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': createSuccessResponse('Detected market walls', SCHEMAS.WebApiWallsView),
          '400': createErrorResponse('Missing or invalid symbol'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/funding-rate/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get current and predicted funding rate for a trading pair',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': createSuccessResponse('Funding rate data', SCHEMAS.WebApiFundingRateView),
          '400': createErrorResponse('Missing or invalid symbol'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/volume-profile/{symbol}': {
      get: {
        tags: ['Market Data'],
        summary: 'Get volume profile levels for a trading pair',
        parameters: [
          {
            name: 'symbol',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          },
        ],
        responses: {
          '200': createSuccessResponse('Volume profile data', SCHEMAS.WebApiVolumeProfileView),
          '400': createErrorResponse('Missing or invalid symbol'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/config': {
      get: {
        tags: ['Configuration'],
        summary: 'Get full configuration',
        responses: {
          '200': createConfigRouteSuccessResponse('Current bot configuration', SCHEMAS.ConfigReadResponsePayload),
          '500': createErrorResponse('Failed to read configuration'),
        },
      },
      put: {
        tags: ['Configuration'],
        summary: 'Update configuration (requires bot restart)',
        requestBody: createConfigRouteRequestBody(SCHEMAS.ConfigUpdateRequestPayload),
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration updated successfully', SCHEMAS.ConfigUpdateResponsePayload),
          '400': createErrorResponse('Configuration validation failed'),
        },
      },
    },
    '/api/config/strategies': {
      get: {
        tags: ['Configuration'],
        summary: 'Get strategy toggle summary',
        responses: {
          '200': createConfigRouteSuccessResponse('Available strategies and current enabled state', SCHEMAS.StrategiesResponsePayload),
          '500': createErrorResponse('Failed to fetch strategies'),
        },
      },
    },
    '/api/config/strategies/{id}': {
      patch: {
        tags: ['Configuration'],
        summary: 'Toggle an individual strategy on or off',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: createConfigRouteRequestBody(SCHEMAS.StrategyToggleRequestPayload),
        responses: {
          '200': createConfigRouteSuccessResponse('Strategy configuration updated', SCHEMAS.StrategyToggleResponsePayload),
          '400': createErrorResponse('Missing or invalid strategy toggle payload'),
          '404': createErrorResponse('Strategy not found'),
          '500': createErrorResponse('Failed to update strategy configuration'),
        },
      },
    },
    '/api/config/risk': {
      patch: {
        tags: ['Configuration'],
        summary: 'Update risk management settings',
        requestBody: createConfigRouteRequestBody(SCHEMAS.RiskSettingsPayload),
        responses: {
          '200': createConfigRouteSuccessResponse('Risk settings updated successfully', SCHEMAS.RiskUpdateResponsePayload),
          '400': createErrorResponse('Missing or invalid risk settings payload'),
          '500': createErrorResponse('Failed to update risk settings'),
        },
      },
    },
    '/api/config/validate': {
      post: {
        tags: ['Configuration'],
        summary: 'Validate configuration',
        requestBody: createConfigRouteRequestBody(SCHEMAS.ConfigValidationRequestPayload),
        responses: {
          '200': createConfigRouteSuccessResponse('Validation result', SCHEMAS.ConfigValidationResponsePayload),
          '400': createErrorResponse('Missing or invalid validation payload'),
          '500': createErrorResponse('Validation request failed'),
        },
      },
    },
    '/api/config/backups': {
      get: {
        tags: ['Configuration'],
        summary: 'List configuration backups',
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration backups', SCHEMAS.ConfigBackupsResponsePayload),
          '500': createErrorResponse('Failed to retrieve backups'),
        },
      },
    },
    '/api/config/cleanup': {
      post: {
        tags: ['Configuration'],
        summary: 'Delete old configuration backups while keeping the most recent N files',
        requestBody: createConfigRouteRequestBody(SCHEMAS.ConfigCleanupRequestPayload, false),
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration backups cleaned up', SCHEMAS.ConfigCleanupResponsePayload),
          '500': createErrorResponse('Failed to cleanup backups'),
        },
      },
    },
    '/api/config/restore/{backupId}': {
      post: {
        tags: ['Configuration'],
        summary: 'Restore configuration from backup',
        parameters: [
          {
            name: 'backupId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration restored', SCHEMAS.ConfigRestoreResponsePayload),
          '400': createErrorResponse('Backup not found or invalid'),
        },
      },
    },
    '/api/config/schema': {
      get: {
        tags: ['Configuration'],
        summary: 'Get configuration schema metadata for the UI',
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration schema metadata', SCHEMAS.ConfigSchemaPayload),
        },
      },
    },
    '/api/config/history': {
      get: {
        tags: ['Configuration'],
        summary: 'Get legacy configuration history aliases',
        responses: {
          '200': createConfigRouteSuccessResponse('Configuration history', SCHEMAS.ConfigHistoryResponsePayload),
          '500': createErrorResponse('Failed to retrieve configuration history'),
        },
      },
    },
    '/api/config/server': {
      get: {
        tags: ['Configuration'],
        summary: 'Get runtime API and WebSocket endpoints',
        responses: {
          '200': createSuccessResponse('Runtime API and WebSocket endpoints', SCHEMAS.ServerRuntimeConfigPayload),
        },
      },
    },
    '/api/analytics/journal': {
      get: {
        tags: ['Analytics'],
        summary: 'Get paginated trade journal entries',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, minimum: 1, maximum: 500 },
          },
        ],
        responses: {
          '200': createSuccessResponse('Paginated journal entries', SCHEMAS.JournalPagePayload),
          '500': createErrorResponse('Failed to fetch journal'),
        },
      },
    },
    '/api/analytics/journal/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'Get journal statistics',
        responses: {
          '200': createSuccessResponse('Journal statistics', SCHEMAS.JournalStatsPayload),
          '500': createErrorResponse('Failed to fetch journal statistics'),
        },
      },
    },
    '/api/analytics/journal/last24h': {
      get: {
        tags: ['Analytics'],
        summary: 'Get journal entries from the last 24 hours',
        responses: {
          '200': createSuccessResponse('Recent journal entries', SCHEMAS.JournalEntriesPayload),
          '500': createErrorResponse('Failed to fetch recent journal'),
        },
      },
    },
    '/api/analytics/sessions': {
      get: {
        tags: ['Analytics'],
        summary: 'Get recorded trading sessions',
        responses: {
          '200': createSuccessResponse('Recorded sessions', SCHEMAS.SessionStatsCollectionPayload),
          '500': createErrorResponse('Failed to fetch sessions'),
        },
      },
    },
    '/api/analytics/sessions/compare': {
      get: {
        tags: ['Analytics'],
        summary: 'Compare two recorded sessions',
        parameters: [
          {
            name: 'id1',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'id2',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': createSuccessResponse('Session comparison', SCHEMAS.SessionComparisonPayload),
          '400': createErrorResponse('Missing or invalid comparison parameters'),
          '500': createErrorResponse('Failed to compare sessions'),
        },
      },
    },
    '/api/analytics/strategy-performance': {
      get: {
        tags: ['Analytics'],
        summary: 'Get performance breakdown by strategy',
        responses: {
          '200': createSuccessResponse('Strategy performance summary', SCHEMAS.StrategyPerformanceCollectionPayload),
          '500': createErrorResponse('Failed to fetch strategy performance'),
        },
      },
    },
    '/api/analytics/pnl-history': {
      get: {
        tags: ['Analytics'],
        summary: 'Get cumulative PnL history for charting',
        responses: {
          '200': createSuccessResponse('PnL history', SCHEMAS.PnlHistoryCollectionPayload),
          '500': createErrorResponse('Failed to fetch PnL history'),
        },
      },
    },
    '/api/analytics/equity-curve': {
      get: {
        tags: ['Analytics'],
        summary: 'Get equity curve data',
        responses: {
          '200': createSuccessResponse('Equity curve data', SCHEMAS.EquityCurveCollectionPayload),
          '500': createErrorResponse('Failed to fetch equity curve'),
        },
      },
    },
  },
  components: {
    schemas: {
      GenericObject: {
        type: 'object',
        additionalProperties: true,
      },
      HealthStatus: {
        type: 'object',
        required: ['status', 'timestamp', 'botRunning'],
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'number' },
          botRunning: { type: 'boolean' },
        },
      },
      ApiErrorDetail: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'string' },
          suggestion: { type: 'string' },
        },
      },
      StructuredApiErrorResponse: {
        type: 'object',
        required: ['success', 'error', 'timestamp'],
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: schemaRef('ApiErrorDetail'),
          timestamp: { type: 'number' },
          requestId: { type: 'string' },
        },
      },
      Position: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['LONG', 'SHORT'] },
          quantity: { type: 'number' },
          entryPrice: { type: 'number' },
          currentPrice: { type: 'number' },
          leverage: { type: 'number' },
          marginUsed: { type: 'number' },
          unrealizedPnL: { type: 'number' },
          unrealizedPnLPercent: { type: 'number' },
          stopLoss: {
            type: 'object',
            properties: {
              price: { type: 'number' },
              breakeven: { type: 'number' },
              trailing: { type: 'boolean' },
            },
          },
          takeProfits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                price: { type: 'number' },
                quantity: { type: 'number' },
                hit: { type: 'boolean' },
              },
            },
          },
          openedAt: { type: 'number' },
          status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
        },
      },
      NullablePosition: {
        anyOf: [schemaRef('Position'), { type: 'null' }],
      },
      BotStatus: {
        type: 'object',
        required: ['isRunning', 'currentPosition', 'balance', 'unrealizedPnL', 'timestamp'],
        properties: {
          isRunning: { type: 'boolean' },
          currentPosition: schemaRef('NullablePosition'),
          balance: { type: 'number' },
          unrealizedPnL: { type: 'number' },
          timestamp: { type: 'number' },
          error: { type: 'string' },
        },
      },
      Signal: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          direction: { type: 'string', enum: ['LONG', 'SHORT', 'HOLD'] },
          type: { type: 'string' },
          confidence: { type: 'number' },
          price: { type: 'number' },
          stopLoss: { type: 'number' },
          takeProfits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                price: { type: 'number' },
                quantity: { type: 'number' },
                hit: { type: 'boolean' },
              },
            },
          },
          reason: { type: 'string' },
          timestamp: { type: 'number' },
        },
      },
      ApiMessageResponse: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
        },
      },
      BalanceResponsePayload: {
        type: 'object',
        required: ['balance'],
        properties: {
          balance: { type: 'number' },
        },
      },
      RecentSignalsResponsePayload: {
        type: 'object',
        required: ['signals', 'count'],
        properties: {
          signals: {
            type: 'array',
            items: schemaRef('Signal'),
          },
          count: { type: 'number' },
        },
      },
      ConfigValidationResponsePayload: {
        type: 'object',
        required: ['valid', 'errors', 'warnings'],
        properties: {
          valid: { type: 'boolean' },
          errors: {
            type: 'array',
            items: { type: 'string' },
          },
          warnings: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      StrategyConfigSummary: {
        type: 'object',
        required: ['id', 'name', 'enabled'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          enabled: { type: 'boolean' },
          config: schemaRef(SCHEMAS.StrategyConfigEntryPayload),
        },
      },
      ConfigTimeframePayload: {
        type: 'object',
        properties: {
          interval: { type: 'string' },
          candleLimit: { type: 'number' },
          enabled: { type: 'boolean' },
        },
        additionalProperties: true,
      },
      StrategyConfigEntryPayload: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          minConfidence: { type: 'number' },
        },
        additionalProperties: true,
      },
      StrategiesConfigPayload: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean' },
          default: { type: 'string' },
        },
        additionalProperties: {
          anyOf: [
            schemaRef(SCHEMAS.StrategyConfigEntryPayload),
            { type: 'boolean' },
            { type: 'string' },
          ],
        },
      },
      BotConfigPayload: {
        type: 'object',
        properties: {
          exchange: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              name: { type: 'string' },
              demo: { type: 'boolean' },
              testnet: { type: 'boolean' },
            },
            additionalProperties: true,
          },
          trading: {
            type: 'object',
            properties: {
              leverage: { type: 'number' },
              positionSizeUsdt: { type: 'number' },
              maxPositions: { type: 'number' },
              orderType: { type: 'string' },
              tradingCycleIntervalMs: { type: 'number' },
              favourableMovementThresholdPercent: { type: 'number' },
            },
            additionalProperties: true,
          },
          risk: schemaRef(SCHEMAS.RiskSettingsPayload),
          riskManagement: {
            allOf: [
              schemaRef(SCHEMAS.RiskSettingsPayload),
              {
                type: 'object',
                properties: {
                  minStopLossPercent: { type: 'number' },
                  breakevenOffsetPercent: { type: 'number' },
                  trailingStopEnabled: { type: 'boolean' },
                  trailingStopPercent: { type: 'number' },
                  trailingStopActivationLevel: { type: 'number' },
                  positionSizeUsdt: { type: 'number' },
                  timeBasedExitEnabled: { type: 'boolean' },
                  timeBasedExitMinutes: { type: 'number' },
                  timeBasedExitMinPnl: { type: 'number' },
                  takeProfits: {
                    type: 'array',
                    items: schemaRef(SCHEMAS.GenericObject),
                  },
                },
                additionalProperties: true,
              },
            ],
          },
          timeframes: {
            type: 'object',
            properties: {
              entry: schemaRef(SCHEMAS.ConfigTimeframePayload),
              primary: schemaRef(SCHEMAS.ConfigTimeframePayload),
              trend1: schemaRef(SCHEMAS.ConfigTimeframePayload),
              trend2: schemaRef(SCHEMAS.ConfigTimeframePayload),
              context: schemaRef(SCHEMAS.ConfigTimeframePayload),
            },
            additionalProperties: true,
          },
          strategies: schemaRef(SCHEMAS.StrategiesConfigPayload),
          webApi: schemaRef(SCHEMAS.GenericObject),
        },
        additionalProperties: true,
      },
      ConfigReadResponsePayload: {
        allOf: [schemaRef(SCHEMAS.BotConfigPayload)],
      },
      ConfigUpdateRequestPayload: {
        allOf: [schemaRef(SCHEMAS.BotConfigPayload)],
      },
      StrategiesResponsePayload: {
        type: 'object',
        required: ['strategies', 'total', 'active'],
        properties: {
          strategies: {
            type: 'array',
            items: schemaRef(SCHEMAS.StrategyConfigSummary),
          },
          total: { type: 'number' },
          active: { type: 'number' },
        },
      },
      ConfigUpdateResponsePayload: {
        type: 'object',
        required: ['message', 'backupPath', 'requiresRestart'],
        properties: {
          message: { type: 'string' },
          backupPath: { type: 'string' },
          requiresRestart: { type: 'boolean' },
        },
      },
      ConfigBackupPayload: {
        type: 'object',
        required: ['id', 'timestamp', 'filePath', 'path', 'filename', 'size'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'number' },
          filePath: { type: 'string' },
          path: { type: 'string' },
          filename: { type: 'string' },
          size: { type: 'number' },
        },
      },
      ConfigBackupsResponsePayload: createConfigBackupCollectionSchema(),
      ConfigHistoryResponsePayload: createConfigBackupCollectionSchema(),
      ConfigCleanupRequestPayload: {
        type: 'object',
        properties: {
          keepCount: { type: 'number', default: DEFAULT_CONFIG_BACKUP_KEEP_COUNT },
        },
      },
      ConfigValidationRequestPayload: {
        type: 'object',
        required: ['config'],
        properties: {
          config: schemaRef(SCHEMAS.ConfigUpdateRequestPayload),
        },
      },
      ConfigCleanupResponsePayload: {
        ...createConfigActionMessageSchema({
          deleted: { type: 'number' },
          remainingBackups: { type: 'number' },
          totalBackups: { type: 'number' },
        }, ['deleted', 'remainingBackups', 'totalBackups']),
      },
      ConfigRestoreResponsePayload: {
        ...createConfigActionMessageSchema({
          success: { type: 'boolean', enum: [true] },
          restoredBackup: schemaRef(SCHEMAS.ConfigBackupPayload),
          preRestoreBackupPath: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
          },
          requiresRestart: { type: 'boolean', enum: [true] },
        }, ['success', 'restoredBackup', 'preRestoreBackupPath', 'requiresRestart']),
      },
      ServerRuntimeConfigPayload: {
        type: 'object',
        required: ['api', 'websocket'],
        properties: {
          api: {
            type: 'object',
            required: ['port', 'url'],
            properties: {
              port: { type: 'number' },
              url: { type: 'string' },
            },
          },
          websocket: {
            type: 'object',
            required: ['port', 'url'],
            properties: {
              port: { type: 'number' },
              url: { type: 'string' },
            },
          },
        },
      },
      StrategyToggleRequestPayload: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
        },
      },
      RiskSettingsPayload: {
        type: 'object',
        properties: {
          maxLeverage: { type: 'number' },
          maxPositionSize: { type: 'number' },
          dailyLossLimit: { type: 'number' },
          stopLossPercent: { type: 'number' },
          takeProfitPercent: { type: 'number' },
        },
        additionalProperties: true,
      },
      StrategyToggleResponsePayload: {
        type: 'object',
        required: ['strategy', 'enabled', 'message'],
        properties: {
          strategy: { type: 'string' },
          enabled: { type: 'boolean' },
          message: { type: 'string' },
        },
      },
      RiskUpdateResponsePayload: {
        type: 'object',
        required: ['message', 'risk'],
        properties: {
          message: { type: 'string' },
          risk: schemaRef(SCHEMAS.RiskSettingsPayload),
        },
      },
      ConfigSchemaFieldPayload: {
        type: 'object',
        required: ['name', 'type', 'label'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'] },
          label: { type: 'string' },
        },
      },
      ConfigSchemaSectionPayload: {
        type: 'object',
        required: ['name', 'fields'],
        properties: {
          name: { type: 'string' },
          fields: {
            type: 'array',
            items: schemaRef(SCHEMAS.ConfigSchemaFieldPayload),
          },
        },
      },
      ConfigSchemaPayload: {
        type: 'object',
        required: ['sections'],
        properties: {
          sections: {
            type: 'object',
            additionalProperties: schemaRef(SCHEMAS.ConfigSchemaSectionPayload),
          },
        },
      },
      WebApiMarketData: {
        type: 'object',
        required: ['currentPrice', 'priceChangePercent'],
        properties: {
          currentPrice: { type: 'number' },
          priceChangePercent: { type: 'number' },
          rsi: { type: 'number' },
          ema20: { type: 'number' },
          ema50: { type: 'number' },
          atr: { type: 'number' },
          trend: { type: 'string' },
          btcCorrelation: { type: 'number' },
          nearestLevel: { type: 'number' },
          distanceToLevel: { type: 'number' },
        },
      },
      WebApiCandle: {
        type: 'object',
        required: ['open', 'high', 'low', 'close', 'timestamp'],
        properties: {
          open: { type: 'number' },
          high: { type: 'number' },
          low: { type: 'number' },
          close: { type: 'number' },
          volume: { type: 'number' },
          timestamp: { type: 'number' },
        },
      },
      WebApiCandlesResponse: {
        type: 'object',
        required: ['candles'],
        properties: {
          candles: {
            type: 'array',
            items: schemaRef('WebApiCandle'),
          },
        },
      },
      WebApiPositionHistoryEntry: {
        type: 'object',
        properties: {
          id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
          symbol: { type: 'string' },
          side: { type: 'string' },
          entryPrice: { type: 'number' },
          entryTime: { type: 'number' },
          exitPrice: { type: 'number' },
          exitTime: { type: 'number' },
          pnl: { type: 'number' },
          quantity: { type: 'number' },
          leverage: { type: 'number' },
          status: { type: 'string' },
          entryCondition: { type: 'string' },
          exitCondition: { type: 'string' },
        },
      },
      WebApiPositionsResponse: {
        type: 'object',
        required: ['positions'],
        properties: {
          positions: {
            type: 'array',
            items: schemaRef('WebApiPositionHistoryEntry'),
          },
        },
      },
      WebApiOrderBookLevelView: {
        type: 'object',
        required: ['price', 'quantity', 'cumulative'],
        properties: {
          price: { type: 'number' },
          quantity: { type: 'number' },
          cumulative: { type: 'number' },
        },
      },
      WebApiOrderBookView: {
        type: 'object',
        required: ['symbol', 'bids', 'asks', 'timestamp'],
        properties: {
          symbol: { type: 'string' },
          bids: {
            type: 'array',
            items: schemaRef('WebApiOrderBookLevelView'),
          },
          asks: {
            type: 'array',
            items: schemaRef('WebApiOrderBookLevelView'),
          },
          timestamp: { type: 'number' },
        },
      },
      WebApiWallView: {
        type: 'object',
        required: ['side', 'price', 'quantity', 'strength', 'detected'],
        properties: {
          side: { type: 'string' },
          price: { type: 'number' },
          quantity: { type: 'number' },
          strength: { type: 'number' },
          detected: { type: 'boolean' },
        },
      },
      WebApiWallsView: {
        type: 'object',
        required: ['symbol', 'walls'],
        properties: {
          symbol: { type: 'string' },
          walls: {
            type: 'array',
            items: schemaRef('WebApiWallView'),
          },
        },
      },
      WebApiFundingRateView: {
        type: 'object',
        required: ['symbol', 'current', 'predicted', 'nextFundingTime', 'lastFundingTime'],
        properties: {
          symbol: { type: 'string' },
          current: { type: 'number' },
          predicted: { type: 'number' },
          nextFundingTime: { type: 'number' },
          lastFundingTime: { type: 'number' },
        },
      },
      WebApiVolumeProfileView: {
        type: 'object',
        required: ['symbol', 'levels', 'volumes', 'maxVolume'],
        properties: {
          symbol: { type: 'string' },
          levels: {
            type: 'array',
            items: { type: 'string' },
          },
          volumes: {
            type: 'array',
            items: { type: 'number' },
          },
          maxVolume: { type: 'number' },
        },
      },
      JournalEntry: {
        type: 'object',
        required: ['id', 'timestamp', 'direction', 'entryPrice', 'exitPrice', 'quantity', 'pnl', 'pnlPercent', 'strategy', 'exitReason'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'number' },
          direction: { type: 'string', enum: ['LONG', 'SHORT'] },
          entryPrice: { type: 'number' },
          exitPrice: { type: 'number' },
          quantity: { type: 'number' },
          pnl: { type: 'number' },
          pnlPercent: { type: 'number' },
          strategy: { type: 'string' },
          exitReason: { type: 'string' },
        },
      },
      JournalPagePayload: {
        type: 'object',
        required: ['entries', 'total', 'page', 'pages'],
        properties: {
          entries: {
            type: 'array',
            items: schemaRef('JournalEntry'),
          },
          total: { type: 'number' },
          page: { type: 'number' },
          pages: { type: 'number' },
        },
      },
      JournalEntriesPayload: {
        type: 'array',
        items: schemaRef('JournalEntry'),
      },
      JournalStatsPayload: {
        type: 'object',
        required: ['totalTrades', 'totalPnL', 'winRate', 'avgWin', 'avgLoss', 'winLossRatio', 'longWinRate', 'shortWinRate'],
        properties: {
          totalTrades: { type: 'number' },
          totalPnL: { type: 'number' },
          winRate: { type: 'number' },
          avgWin: { type: 'number' },
          avgLoss: { type: 'number' },
          winLossRatio: { type: 'number' },
          longWinRate: { type: 'number' },
          shortWinRate: { type: 'number' },
        },
      },
      SessionStats: {
        type: 'object',
        required: ['sessionId', 'startTime', 'trades', 'totalPnL', 'winRate', 'winCount', 'lossCount', 'totalTrades'],
        properties: {
          sessionId: { type: 'string' },
          startTime: { type: 'number' },
          endTime: { type: 'number' },
          trades: {
            type: 'array',
            items: schemaRef('JournalEntry'),
          },
          totalPnL: { type: 'number' },
          winRate: { type: 'number' },
          winCount: { type: 'number' },
          lossCount: { type: 'number' },
          totalTrades: { type: 'number' },
        },
      },
      SessionStatsCollectionPayload: {
        type: 'array',
        items: schemaRef('SessionStats'),
      },
      SessionComparisonSummaryPayload: {
        type: 'object',
        required: ['tradesDiff', 'pnlDiff', 'winRateDiff'],
        properties: {
          tradesDiff: { type: 'number' },
          pnlDiff: { type: 'number' },
          winRateDiff: { type: 'number' },
        },
      },
      SessionComparisonPayload: {
        type: 'object',
        required: ['session1', 'session2', 'comparison'],
        properties: {
          session1: {
            anyOf: [schemaRef('SessionStats'), { type: 'null' }],
          },
          session2: {
            anyOf: [schemaRef('SessionStats'), { type: 'null' }],
          },
          comparison: schemaRef('SessionComparisonSummaryPayload'),
        },
      },
      StrategyPerformancePayload: {
        type: 'object',
        required: ['strategy', 'trades', 'winRate', 'totalPnL', 'avgPnL', 'wins', 'losses'],
        properties: {
          strategy: { type: 'string' },
          trades: { type: 'number' },
          winRate: { type: 'number' },
          totalPnL: { type: 'number' },
          avgPnL: { type: 'number' },
          wins: { type: 'number' },
          losses: { type: 'number' },
        },
      },
      StrategyPerformanceCollectionPayload: {
        type: 'array',
        items: schemaRef('StrategyPerformancePayload'),
      },
      PnlHistoryPoint: {
        type: 'object',
        required: ['time', 'timestamp', 'pnl', 'cumulativePnL', 'tradeNumber'],
        properties: {
          time: { type: 'string' },
          timestamp: { type: 'number' },
          pnl: { type: 'number' },
          cumulativePnL: { type: 'number' },
          tradeNumber: { type: 'number' },
        },
      },
      PnlHistoryCollectionPayload: {
        type: 'array',
        items: schemaRef('PnlHistoryPoint'),
      },
      EquityCurvePoint: {
        type: 'object',
        required: ['time', 'timestamp', 'equity', 'pnl', 'tradeNumber', 'drawdown'],
        properties: {
          time: { type: 'string' },
          timestamp: { type: 'number' },
          equity: { type: 'number' },
          pnl: { type: 'number' },
          tradeNumber: { type: 'number' },
          drawdown: { type: 'number' },
        },
      },
      EquityCurveCollectionPayload: {
        type: 'array',
        items: schemaRef('EquityCurvePoint'),
      },
    },
  },
  tags: [
    { name: 'System', description: 'System health and status' },
    { name: 'Bot Control', description: 'Bot start/stop/status' },
    { name: 'Market Data', description: 'Real-time market data and signals' },
    { name: 'Configuration', description: 'Bot configuration management' },
    { name: 'Analytics', description: 'Trading analytics and statistics' },
  ],
};
