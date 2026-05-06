/**
 * Swagger/OpenAPI Configuration
 *
 * Documents API endpoints against the current shared response contracts.
 */

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
      schema: schemaRef('StructuredApiErrorResponse'),
    },
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
          '200': createSuccessResponse('Bot started successfully', 'ApiMessageResponse'),
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
          '200': createSuccessResponse('Bot stopped successfully', 'ApiMessageResponse'),
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
          '200': createSuccessResponse('Current bot status', 'BotStatus'),
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
          '200': createSuccessResponse('Current account balance', 'BalanceResponsePayload'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/data/market': {
      get: {
        tags: ['Market Data'],
        summary: 'Get market data (indicators)',
        responses: {
          '200': createSuccessResponse('Market data including RSI, EMA, ATR, etc.', 'WebApiMarketData'),
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
          '200': createSuccessResponse('Recent trading signals', 'RecentSignalsResponsePayload'),
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
          '200': createSuccessResponse('Candlestick history', 'WebApiCandlesResponse'),
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
          '200': createSuccessResponse('Recent position history', 'WebApiPositionsResponse'),
          '500': createErrorResponse('Unexpected server error'),
        },
      },
    },
    '/api/config': {
      get: {
        tags: ['Configuration'],
        summary: 'Get full configuration',
        responses: {
          '200': createSuccessResponse('Current bot configuration', 'GenericObject'),
          '500': createErrorResponse('Failed to read configuration'),
        },
      },
      put: {
        tags: ['Configuration'],
        summary: 'Update configuration (requires bot restart)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: schemaRef('GenericObject'),
            },
          },
        },
        responses: {
          '200': createSuccessResponse('Configuration updated successfully', 'ConfigUpdateResponsePayload'),
          '400': createErrorResponse('Configuration validation failed'),
        },
      },
    },
    '/api/config/strategies': {
      get: {
        tags: ['Configuration'],
        summary: 'Get strategy toggle summary',
        responses: {
          '200': createSuccessResponse('Available strategies and current enabled state', 'StrategiesResponsePayload'),
          '500': createErrorResponse('Failed to fetch strategies'),
        },
      },
    },
    '/api/config/validate': {
      post: {
        tags: ['Configuration'],
        summary: 'Validate configuration',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['config'],
                properties: {
                  config: schemaRef('GenericObject'),
                },
              },
            },
          },
        },
        responses: {
          '200': createSuccessResponse('Validation result', 'ConfigValidationResponsePayload'),
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
          '200': createSuccessResponse('Configuration backups', 'ConfigBackupsResponsePayload'),
          '500': createErrorResponse('Failed to retrieve backups'),
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
          '200': createSuccessResponse('Configuration restored', 'RestoreConfigResponsePayload'),
          '400': createErrorResponse('Backup not found or invalid'),
        },
      },
    },
    '/api/config/server': {
      get: {
        tags: ['Configuration'],
        summary: 'Get runtime API and WebSocket endpoints',
        responses: {
          '200': createSuccessResponse('Runtime API and WebSocket endpoints', 'ServerRuntimeConfigPayload'),
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
          '200': createSuccessResponse('Paginated journal entries', 'JournalPagePayload'),
          '500': createErrorResponse('Failed to fetch journal'),
        },
      },
    },
    '/api/analytics/journal/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'Get journal statistics',
        responses: {
          '200': createSuccessResponse('Journal statistics', 'JournalStatsPayload'),
          '500': createErrorResponse('Failed to fetch journal statistics'),
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
          config: schemaRef('GenericObject'),
        },
      },
      StrategiesResponsePayload: {
        type: 'object',
        required: ['strategies', 'total', 'active'],
        properties: {
          strategies: {
            type: 'array',
            items: schemaRef('StrategyConfigSummary'),
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
      ConfigBackup: {
        type: 'object',
        required: ['id', 'timestamp', 'filePath', 'size'],
        properties: {
          id: { type: 'string' },
          timestamp: { type: 'number' },
          filePath: { type: 'string' },
          size: { type: 'number' },
        },
      },
      ConfigBackupsResponsePayload: {
        type: 'object',
        required: ['backups', 'count'],
        properties: {
          backups: {
            type: 'array',
            items: schemaRef('ConfigBackup'),
          },
          count: { type: 'number' },
        },
      },
      RestoreConfigResponsePayload: {
        type: 'object',
        required: ['success', 'message'],
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
        },
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
