/**
 * Swagger/OpenAPI Configuration
 *
 * Documents all API endpoints with request/response schemas
 */

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
          '200': {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'number' },
                    botRunning: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/bot/start': {
      post: {
        tags: ['Bot Control'],
        summary: 'Start trading bot',
        responses: {
          '200': {
            description: 'Bot started successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/bot/stop': {
      post: {
        tags: ['Bot Control'],
        summary: 'Stop trading bot',
        responses: {
          '200': {
            description: 'Bot stopped successfully',
          },
        },
      },
    },

    '/api/bot/status': {
      get: {
        tags: ['Bot Control'],
        summary: 'Get bot status',
        responses: {
          '200': {
            description: 'Current bot status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        isRunning: { type: 'boolean' },
                        currentPosition: { type: 'object' },
                        balance: { type: 'number' },
                        unrealizedPnL: { type: 'number' },
                      },
                    },
                    timestamp: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/data/position': {
      get: {
        tags: ['Market Data'],
        summary: 'Get current position',
        responses: {
          '200': {
            description: 'Current open position or null',
          },
        },
      },
    },

    '/api/data/balance': {
      get: {
        tags: ['Market Data'],
        summary: 'Get account balance',
        responses: {
          '200': {
            description: 'Current account balance',
          },
        },
      },
    },

    '/api/data/market': {
      get: {
        tags: ['Market Data'],
        summary: 'Get market data (indicators)',
        responses: {
          '200': {
            description: 'Market data including RSI, EMA, ATR, etc.',
          },
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
            schema: { type: 'integer', default: 50, maximum: 100 },
          },
        ],
        responses: {
          '200': {
            description: 'Recent trading signals (max 50)',
          },
        },
      },
    },

    '/api/config': {
      get: {
        tags: ['Configuration'],
        summary: 'Get full configuration',
        responses: {
          '200': {
            description: 'Current bot configuration',
          },
        },
      },
      put: {
        tags: ['Configuration'],
        summary: 'Update configuration (requires bot restart)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Configuration updated successfully',
          },
          '400': {
            description: 'Configuration validation failed',
          },
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
                properties: {
                  config: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Validation result',
          },
        },
      },
    },

    '/api/config/backups': {
      get: {
        tags: ['Configuration'],
        summary: 'List all config backups',
        responses: {
          '200': {
            description: 'List of backup files',
          },
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
          '200': {
            description: 'Configuration restored',
          },
          '400': {
            description: 'Backup not found or invalid',
          },
        },
      },
    },

    '/api/analytics/journal': {
      get: {
        tags: ['Analytics'],
        summary: 'Get trade journal entries',
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50 },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated journal entries',
          },
        },
      },
    },

    '/api/analytics/stats': {
      get: {
        tags: ['Analytics'],
        summary: 'Get trading statistics',
        responses: {
          '200': {
            description: 'Trading performance statistics',
          },
        },
      },
    },
  },

  components: {
    schemas: {
      Position: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          symbol: { type: 'string' },
          side: { type: 'string', enum: ['LONG', 'SHORT'] },
          quantity: { type: 'number' },
          entryPrice: { type: 'number' },
          currentPrice: { type: 'number' },
          unrealizedPnL: { type: 'number' },
          status: { type: 'string', enum: ['OPEN', 'CLOSED'] },
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
          timestamp: { type: 'number' },
        },
      },

      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
          timestamp: { type: 'number' },
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
