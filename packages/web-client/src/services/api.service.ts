/**
 * API Service
 *
 * REST API client for communicating with backend server
 */

import type {
  ApiErrorResponse,
  ApiResponse,
  BotStatus,
} from '../types';
import type {
  ApiMessageResponse,
  BalanceResponsePayload,
  BotConfigPayload,
  ConfigBackupsResponsePayload,
  ConfigCleanupResponsePayload,
  ConfigHistoryResponsePayload,
  ConfigSchemaPayload,
  ConfigUpdateResponsePayload,
  ConfigValidationResponsePayload,
  EquityCurvePoint,
  JournalPagePayload,
  JournalStatsPayload,
  PnlHistoryPoint,
  RecentSignalsResponsePayload,
  RiskSettingsPayload,
  RiskUpdateResponsePayload,
  ServerRuntimeConfigPayload,
  SessionComparisonPayload,
  StrategyPerformancePayload,
  StrategyToggleResponsePayload,
  StrategiesResponsePayload,
  StructuredApiErrorResponse,
} from '@edison/contracts/runtime-api';
import type {
  WebApiCandlesResponse,
  WebApiFundingRateView,
  WebApiJournalEntry,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiBotPosition,
  WebApiPositionsResponse,
  WebApiVolumeProfileView,
  WebApiSessionStats,
  WebApiWallsView,
} from '@edison/contracts/web-api';
import { extractApiErrorMessage, loadServerConfigFromUrl } from './server-runtime-config';

export type { ApiErrorResponse, ApiResponse } from '../types';
export type BalanceApiPayload = BalanceResponsePayload;
export type RecentSignalsApiPayload = RecentSignalsResponsePayload;
export type BotConfigApiPayload = BotConfigPayload;
export type AnalyticsJournalPageApiPayload = JournalPagePayload;
export type AnalyticsJournalStatsApiPayload = JournalStatsPayload;
export type AnalyticsSessionComparisonApiPayload = SessionComparisonPayload;
export type AnalyticsStrategyPerformanceApiPayload = StrategyPerformancePayload[];
export type AnalyticsPnlHistoryApiPayload = PnlHistoryPoint[];
export type AnalyticsEquityCurveApiPayload = EquityCurvePoint[];

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

  getBaseUrl(): string {
    return this.baseUrl;
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
    const json = await response.json() as ApiResponse<T> | StructuredApiErrorResponse;
    if (response.ok) {
      return json as ApiResponse<T>;
    }
    return {
      success: false,
      error: extractApiErrorMessage(json, `HTTP ${response.status}`),
      timestamp: typeof json === 'object' && json && 'timestamp' in json && typeof json.timestamp === 'number'
        ? json.timestamp
        : Date.now(),
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
    return this.client.post<ApiMessageResponse>('/bot/start');
  }

  async stop() {
    return this.client.post<ApiMessageResponse>('/bot/stop');
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

  async getBalance(): Promise<ApiResponse<BalanceResponsePayload>> {
    return this.client.get('/data/balance');
  }

  async getRecentSignals(): Promise<ApiResponse<RecentSignalsResponsePayload>> {
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

  async getJournalPage(page: number = 1, limit: number = 50): Promise<ApiResponse<JournalPagePayload>> {
    return this.client.get(`/analytics/journal?page=${page}&limit=${limit}`);
  }

  async getJournalLast24Hours(): Promise<ApiResponse<WebApiJournalEntry[]>> {
    return this.client.get('/analytics/journal/last24h');
  }

  async getJournalStats(): Promise<ApiResponse<JournalStatsPayload>> {
    return this.client.get('/analytics/journal/stats');
  }

  async getSessions(): Promise<ApiResponse<WebApiSessionStats[]>> {
    return this.client.get('/analytics/sessions');
  }

  async compareSessions(id1: string, id2: string): Promise<ApiResponse<SessionComparisonPayload>> {
    return this.client.get(`/analytics/sessions/compare?id1=${encodeURIComponent(id1)}&id2=${encodeURIComponent(id2)}`);
  }

  async getStrategyPerformance(): Promise<ApiResponse<StrategyPerformancePayload[]>> {
    return this.client.get('/analytics/strategy-performance');
  }

  async getPnlHistory(): Promise<ApiResponse<PnlHistoryPoint[]>> {
    return this.client.get('/analytics/pnl-history');
  }

  async getEquityCurve(): Promise<ApiResponse<EquityCurvePoint[]>> {
    return this.client.get('/analytics/equity-curve');
  }
}

// Config API methods
export class ConfigApi {
  private client: ApiClient;

  constructor() {
    this.client = new ApiClient();
  }

  async getConfig(): Promise<ApiResponse<BotConfigPayload>> {
    return this.client.get('/config');
  }

  async saveConfig(config: BotConfigPayload): Promise<ApiResponse<ConfigUpdateResponsePayload>> {
    return this.client.put('/config', config);
  }

  async getStrategies(): Promise<ApiResponse<StrategiesResponsePayload>> {
    return this.client.get('/config/strategies');
  }

  async toggleStrategy(strategyId: string, enabled: boolean): Promise<ApiResponse<StrategyToggleResponsePayload>> {
    return this.client.patch(`/config/strategies/${strategyId}`, { enabled });
  }

  async updateRiskSettings(risk: RiskSettingsPayload): Promise<ApiResponse<RiskUpdateResponsePayload>> {
    return this.client.patch('/config/risk', risk);
  }

  async validateConfig(config: BotConfigPayload): Promise<ApiResponse<ConfigValidationResponsePayload>> {
    return this.client.post('/config/validate', { config });
  }

  async getConfigSchema(): Promise<ApiResponse<ConfigSchemaPayload>> {
    return this.client.get('/config/schema');
  }

  async getConfigHistory(): Promise<ApiResponse<ConfigHistoryResponsePayload>> {
    return this.client.get('/config/history');
  }

  async getConfigBackups(): Promise<ApiResponse<ConfigBackupsResponsePayload>> {
    return this.client.get('/config/backups');
  }

  async cleanupConfigBackups(keepCount: number = 10): Promise<ApiResponse<ConfigCleanupResponsePayload>> {
    return this.client.post('/config/cleanup', { keepCount });
  }

  async getServerConfig(): Promise<ApiResponse<ServerRuntimeConfigPayload>> {
    return loadServerConfigFromUrl(this.client.getBaseUrl());
  }
}

// Singleton instances
export const api = new BotApi();
export const dataApi = new DataApi();
export const configApi = new ConfigApi();
