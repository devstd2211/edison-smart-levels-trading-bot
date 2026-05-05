/**
 * API Service
 *
 * REST API client for communicating with backend server
 */

import type {
  ApiErrorResponse,
  ApiResponse,
  BotStatus,
  Signal,
  Strategy,
} from '../types';
import type {
  WebApiCandlesResponse,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiBotPosition,
  WebApiPositionsResponse,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';

export type { ApiErrorResponse, ApiResponse } from '../types';

export type BalanceApiPayload = {
  balance: number;
};

export type RecentSignalsApiPayload = {
  signals: Signal[];
  count: number;
};

export type ConfigApiPayload = Record<string, unknown>;

/**
 * Get fallback API URL if server config is unreachable
 */
function getFallbackApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:4002/api';
  }

  const hostname = window.location.hostname;
  // Default to 4002 for dev and prod
  return `http://${hostname}:4002/api`;
}

let API_BASE_URL = getFallbackApiUrl();

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Make GET request
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make POST request
   */
  async post<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Make DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      return this.handleResponse(response);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Handle response
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const json = await response.json();
    if (response.ok) {
      return json;
    }
    return {
      success: false,
      error: json.error || `HTTP ${response.status}`,
      timestamp: typeof json.timestamp === 'number' ? json.timestamp : Date.now(),
    };
  }

  /**
   * Handle error
   */
  private handleError(error: unknown): ApiErrorResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

// Bot API methods
export class BotApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient();
  }

  async getStatus(): Promise<ApiResponse<BotStatus>> {
    return this.client.get('/bot/status');
  }

  async start() {
    return this.client.post('/bot/start');
  }

  async stop() {
    return this.client.post('/bot/stop');
  }
}

// Data API methods
export class DataApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient();
  }

  async getCandles(timeframe: string = '5m', limit: number = 100): Promise<ApiResponse<WebApiCandlesResponse>> {
    return this.client.get(`/data/candles?timeframe=${timeframe}&limit=${limit}`);
  }

  async getPositionHistory(limit: number = 50): Promise<ApiResponse<WebApiPositionsResponse>> {
    return this.client.get(`/data/positions/history?limit=${limit}`);
  }

  async getMarketData(): Promise<ApiResponse<WebApiMarketData>> {
    return this.client.get('/data/market');
  }

  async getPosition(): Promise<ApiResponse<WebApiBotPosition | null>> {
    return this.client.get('/data/position');
  }

  async getBalance(): Promise<ApiResponse<BalanceApiPayload>> {
    return this.client.get('/data/balance');
  }

  async getRecentSignals(): Promise<ApiResponse<RecentSignalsApiPayload>> {
    return this.client.get('/data/signals/recent');
  }

  async getOrderBook(symbol: string): Promise<ApiResponse<WebApiOrderBookView>> {
    return this.client.get(`/data/orderbook/${symbol}`);
  }

  async getWalls(symbol: string): Promise<ApiResponse<WebApiWallsView>> {
    return this.client.get(`/data/walls/${symbol}`);
  }

  async getFundingRate(symbol: string): Promise<ApiResponse<WebApiFundingRateView>> {
    return this.client.get(`/data/funding-rate/${symbol}`);
  }

  async getVolumeProfile(symbol: string, limit: number = 20): Promise<ApiResponse<WebApiVolumeProfileView>> {
    return this.client.get(`/data/volume-profile/${symbol}?limit=${limit}`);
  }
}

// Config API methods
export class ConfigApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient();
  }

  async getConfig(): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.get('/config');
  }

  async saveConfig(config: Record<string, unknown>): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.put('/config', config);
  }

  async getStrategies(): Promise<ApiResponse<{ strategies: Strategy[] }>> {
    return this.client.get('/config/strategies');
  }

  async toggleStrategy(strategyId: string, enabled: boolean) {
    return this.client.patch(`/config/strategies/${strategyId}`, { enabled });
  }

  async updateRiskSettings(risk: Record<string, unknown>): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.patch('/config/risk', risk);
  }

  async validateConfig(config: Record<string, unknown>): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.post('/config/validate', { config });
  }

  async getConfigSchema(): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.get('/config/schema');
  }

  async getConfigHistory(): Promise<ApiResponse<ConfigApiPayload>> {
    return this.client.get('/config/history');
  }
}

// Singleton instances
export const api = new BotApi();
export const dataApi = new DataApi();
export const configApi = new ConfigApi();
