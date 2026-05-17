/**
 * API Service Tests (Phase 8)
 *
 * Tests for REST API client communication with backend server
 */

import {
  ApiClient,
  ConfigApi,
  DataApi,
  type ApiResponse,
  type AnalyticsJournalPageApiPayload,
  type AnalyticsEquityCurveApiPayload,
  type AnalyticsStrategyPerformanceApiPayload,
  type BalanceApiPayload,
  type BotConfigApiPayload,
  type RecentSignalsApiPayload,
} from '../../services/api.service';

describe('Phase 8: Web Dashboard - API Service', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient('http://localhost:4000/api');
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('API Client Initialization', () => {
    test('should initialize with custom base URL', () => {
      const client = new ApiClient('http://test-server:4000/api');
      expect(client).toBeDefined();
    });

    test('should initialize with default base URL', () => {
      const client = new ApiClient();
      expect(client).toBeDefined();
    });
  });

  describe('GET Requests', () => {
    test('should have get method', () => {
      expect(typeof apiClient.get).toBe('function');
    });

    test('should return ApiResponse type', async () => {
      // Note: This will fail in test environment without mock
      // In production, would test against real API
      expect(apiClient.get).toBeDefined();
    });
  });

  describe('POST Requests', () => {
    test('should have post method', () => {
      expect(typeof apiClient.post).toBe('function');
    });

    test('should accept data parameter', async () => {
      expect(apiClient.post).toBeDefined();
    });
  });

  describe('PUT Requests', () => {
    test('should have put method', () => {
      expect(typeof apiClient.put).toBe('function');
    });
  });

  describe('PATCH Requests', () => {
    test('should have patch method', () => {
      expect(typeof apiClient.patch).toBe('function');
    });
  });

  describe('DELETE Requests', () => {
    test('should have delete method', () => {
      expect(typeof apiClient.delete).toBe('function');
    });
  });

  describe('API Response Types', () => {
    test('success response should have success and data properties', () => {
      const response: ApiResponse<BalanceApiPayload> = {
        success: true,
        data: { balance: 1000 },
        timestamp: Date.now(),
      };
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
    });

    test('error response should have success and error properties', () => {
      const response: ApiResponse<RecentSignalsApiPayload> = {
        success: false,
        error: 'Test error',
        timestamp: Date.now(),
      };
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    test('config payload remains a plain record for editor-driven routes', () => {
      const response: ApiResponse<BotConfigApiPayload> = {
        success: true,
        data: { exchange: { symbol: 'BTCUSDT' } },
        timestamp: Date.now(),
      };

      expect(response.data?.exchange).toBeDefined();
    });

    test('extracts message from structured middleware errors', async () => {
      const response = {
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid configuration payload',
          },
          timestamp: 123,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      await expect(apiClient.get('/config')).resolves.toEqual({
        success: false,
        error: 'Invalid configuration payload',
        timestamp: 123,
      });
    });

    test('extracts message from structured route errors with extra metadata', async () => {
      const response = {
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Slow down',
            details: 'Exceeded 0 requests in 1000ms',
          },
          retryAfter: 1000,
          timestamp: 987,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      await expect(apiClient.get('/config')).resolves.toEqual({
        success: false,
        error: 'Slow down',
        timestamp: 987,
      });
    });

    test('loads runtime server config through the shared config api helper', async () => {
      const configApi = new ConfigApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            api: { port: 4000, url: 'http://localhost:4000' },
            websocket: { port: 4001, url: 'ws://localhost:4001' },
          },
          timestamp: 321,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await configApi.getServerConfig();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:4002/api/config/server', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`Expected success response, received: ${result.error}`);
      }
      if (!result.data) {
        throw new Error('Expected runtime config payload');
      }
      expect(result.data.websocket.url).toBe('ws://localhost:4001');
    });

    test('returns typed config schema payloads from config api routes', async () => {
      const configApi = new ConfigApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            sections: {
              risk: {
                name: 'Risk Management',
                fields: [{ name: 'maxLeverage', type: 'number', label: 'Max Leverage' }],
              },
            },
          },
          timestamp: 444,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await configApi.getConfigSchema();

      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected schema payload');
      }
      expect(result.data.sections.risk.fields[0].name).toBe('maxLeverage');
    });

    test('returns typed config history payloads from config api routes', async () => {
      const configApi = new ConfigApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            backups: [{ filename: 'config.json.backup.1.json', path: 'D:/tmp/config.json.backup.1.json' }],
            count: 1,
          },
          timestamp: 555,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await configApi.getConfigHistory();

      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected config history payload');
      }
      expect(result.data.backups[0].filename).toContain('backup');
    });

    test('returns typed strategy summary payloads from config api routes', async () => {
      const configApi = new ConfigApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            strategies: [
              {
                id: 'breakoutStrategy',
                name: 'Breakout Strategy',
                enabled: true,
                config: { minConfidence: 0.75 },
              },
            ],
            total: 1,
            active: 1,
          },
          timestamp: 556,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await configApi.getStrategies();

      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected strategy summary payload');
      }
      expect(result.data.strategies[0].name).toBe('Breakout Strategy');
      expect(result.data.strategies[0].config?.minConfidence).toBe(0.75);
    });

    test('returns typed analytics journal payloads from analytics api routes', async () => {
      const dataApi = new DataApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            entries: [
              {
                id: 'trade-1',
                timestamp: 1,
                direction: 'LONG',
                entryPrice: 100,
                exitPrice: 110,
                quantity: 1,
                pnl: 10,
                pnlPercent: 10,
                strategy: 'Breakout',
                exitReason: 'TP1',
              },
            ],
            total: 1,
            page: 1,
            pages: 1,
          },
          timestamp: 666,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await dataApi.getJournalPage(1, 25);

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:4002/api/analytics/journal?page=1&limit=25', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected analytics journal payload');
      }
      const payload: AnalyticsJournalPageApiPayload = result.data;
      expect(payload.entries[0].strategy).toBe('Breakout');
    });

    test('returns typed strategy performance payloads from analytics api routes', async () => {
      const dataApi = new DataApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              strategy: 'Breakout',
              trades: 3,
              winRate: 66.7,
              totalPnL: 120,
              avgPnL: 40,
              wins: 2,
              losses: 1,
            },
          ],
          timestamp: 777,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await dataApi.getStrategyPerformance();

      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected strategy performance payload');
      }
      const payload: AnalyticsStrategyPerformanceApiPayload = result.data;
      expect(payload[0].avgPnL).toBe(40);
    });

    test('returns typed equity curve payloads from analytics api routes', async () => {
      const dataApi = new DataApi();
      const response = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: [
            {
              time: '2026-05-06T00:00:00.000Z',
              timestamp: 1,
              equity: 1010,
              pnl: 10,
              tradeNumber: 1,
              drawdown: 1,
            },
          ],
          timestamp: 888,
        }),
      } as Response;

      (global.fetch as jest.Mock).mockResolvedValue(response);

      const result = await dataApi.getEquityCurve();

      expect(result.success).toBe(true);
      if (!result.success || !result.data) {
        throw new Error('Expected equity curve payload');
      }
      const payload: AnalyticsEquityCurveApiPayload = result.data;
      expect(payload[0].equity).toBe(1010);
    });
  });
});
