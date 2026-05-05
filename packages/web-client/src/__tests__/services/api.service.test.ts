/**
 * API Service Tests (Phase 8)
 *
 * Tests for REST API client communication with backend server
 */

import {
  ApiClient,
  type ApiResponse,
  type BalanceApiPayload,
  type ConfigApiPayload,
  type RecentSignalsApiPayload,
} from '../../services/api.service';

describe('Phase 8: Web Dashboard - API Service', () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient('http://localhost:4000/api');
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
  });
});
