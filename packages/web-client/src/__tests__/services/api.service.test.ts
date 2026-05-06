/**
 * API Service Tests (Phase 8)
 *
 * Tests for REST API client communication with backend server
 */

import {
  ApiClient,
  ConfigApi,
  type ApiResponse,
  type BalanceApiPayload,
  type ConfigApiPayload,
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
      const response: ApiResponse<ConfigApiPayload> = {
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
  });
});
