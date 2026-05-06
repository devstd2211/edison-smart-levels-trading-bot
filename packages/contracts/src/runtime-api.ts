import type {
  WebApiBotPosition,
  WebApiCandle,
  WebApiConfig,
  WebApiFundingRateView,
  WebApiJournalEntry,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiSessionStats,
  WebApiWallsView,
} from './web-api';

export type Position = WebApiBotPosition;

export interface BotStatus {
  isRunning: boolean;
  currentPosition: Position | null;
  balance: number;
  unrealizedPnL: number;
  timestamp: number;
  error?: string;
}

export interface Signal {
  id: string;
  direction: 'LONG' | 'SHORT' | 'HOLD';
  type: string;
  confidence: number;
  price: number;
  stopLoss: number;
  takeProfits: Array<{
    price: number;
    quantity: number;
    hit?: boolean;
  }>;
  reason?: string;
  timestamp: number;
  marketData?: {
    rsi?: number;
    rsiEntry?: number;
    rsiTrend1?: number;
    ema20?: number;
    ema50?: number;
    atr?: number;
    trend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    nearestLevel?: number;
    distanceToLevel?: number;
  };
}

export interface PositionOpenedPayload {
  position?: Position;
  signal?: {
    strategy?: string;
    reasoning?: string;
    entryConditions?: string;
  };
}

export interface PositionClosedPayload {
  pnl?: number;
  exitType?: string;
}

export interface SignalGeneratedPayload {
  strategy?: string;
  direction?: string;
  confidence?: number;
}

export interface ErrorPayload {
  error: string;
  code?: WebSocketErrorCode;
  details?: string;
  message?: string;
  requestType?: string;
}

export type WebSocketErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_MESSAGE'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'STATUS_READ_FAILED'
  | 'POSITION_READ_FAILED'
  | 'INTERNAL_SERVER_ERROR';

export interface WebSocketRequestPayloadMap {
  PING: Record<string, never>;
  GET_STATUS: Record<string, never>;
  GET_POSITION: Record<string, never>;
}

export type WebSocketRequestType = keyof WebSocketRequestPayloadMap;

export interface WebSocketRequestMessage<T extends WebSocketRequestType = WebSocketRequestType> {
  type: T;
  payload?: WebSocketRequestPayloadMap[T];
  timestamp?: number;
  requestId?: string;
}

export interface WebSocketPayloadMap {
  BOT_STATUS_CHANGE: BotStatus;
  POSITION_UPDATE: { position: Position | null };
  BALANCE_UPDATE: { balance: number; unrealizedPnL: number };
  SIGNAL_NEW: Signal;
  TREND_UPDATE: { trend?: string };
  MARKET_DATA_UPDATE: WebApiMarketData;
  ORDERBOOK_UPDATE: WebApiOrderBookView;
  WALLS_UPDATE: WebApiWallsView;
  FUNDING_RATE_UPDATE: WebApiFundingRateView;
  CANDLE_CLOSED: { timeframe: string; candle: WebApiCandle };
  POSITION_OPENED: PositionOpenedPayload;
  POSITION_CLOSED: PositionClosedPayload;
  SIGNAL_GENERATED: SignalGeneratedPayload;
  TP_HIT: { level?: number; price?: number; pnl?: number };
  SL_HIT: { price?: number; pnl?: number };
  STRATEGIES_RELOADED: {
    strategies: Array<{ id: string; name: string; enabled: boolean; config?: StrategyConfigEntryPayload }>;
  };
  JOURNAL_UPDATE: { journal: WebApiJournalEntry[] };
  SESSION_UPDATE: { sessions: WebApiSessionStats[] };
  ERROR: ErrorPayload;
  PONG: Record<string, never>;
}

export type WebSocketEventType = keyof WebSocketPayloadMap;

export interface WebSocketMessage<T extends WebSocketEventType = WebSocketEventType> {
  type: T;
  payload: WebSocketPayloadMap[T];
  timestamp: number;
  requestId?: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data?: T;
  timestamp: number;
}

export interface ApiErrorResponse {
  success: false;
  error?: string;
  timestamp: number;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: string;
  suggestion?: string;
}

export interface StructuredApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
  timestamp: number;
  requestId?: string;
}

export interface ApiMessageResponse {
  message: string;
}

export interface BalanceResponsePayload {
  balance: number;
}

export interface JournalPagePayload {
  entries: WebApiJournalEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface JournalStatsPayload {
  totalTrades: number;
  totalPnL: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  longWinRate: number;
  shortWinRate: number;
}

export interface SessionComparisonSummaryPayload {
  tradesDiff: number;
  pnlDiff: number;
  winRateDiff: number;
}

export interface SessionComparisonPayload {
  session1: WebApiSessionStats | null;
  session2: WebApiSessionStats | null;
  comparison: SessionComparisonSummaryPayload;
}

export interface StrategyPerformancePayload {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
  wins: number;
  losses: number;
}

export interface PnlHistoryPoint {
  time: string;
  timestamp: number;
  pnl: number;
  cumulativePnL: number;
  tradeNumber: number;
}

export interface EquityCurvePoint {
  time: string;
  timestamp: number;
  equity: number;
  pnl: number;
  tradeNumber: number;
  drawdown: number;
}

export interface RiskSettingsPayload extends Record<string, unknown> {
  maxLeverage?: number;
  maxPositionSize?: number;
  dailyLossLimit?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface StrategyConfigEntryPayload extends Record<string, unknown> {
  enabled?: boolean;
  minConfidence?: number;
}

export interface StrategiesConfigPayload {
  enabled?: boolean;
  default?: string;
  [key: string]: StrategyConfigEntryPayload | boolean | string | undefined;
}

export interface ConfigTimeframePayload extends Record<string, unknown> {
  interval?: string;
  candleLimit?: number;
  enabled?: boolean;
}

export interface BotConfigPayload extends Record<string, unknown> {
  exchange?: ({
    symbol?: string;
    name?: string;
    demo?: boolean;
    testnet?: boolean;
  } & Record<string, unknown>);
  trading?: ({
    leverage?: number;
    positionSizeUsdt?: number;
    maxPositions?: number;
    orderType?: string;
    tradingCycleIntervalMs?: number;
    favourableMovementThresholdPercent?: number;
  } & Record<string, unknown>);
  risk?: RiskSettingsPayload & Record<string, unknown>;
  riskManagement?: RiskSettingsPayload & ({
    minStopLossPercent?: number;
    breakevenOffsetPercent?: number;
    trailingStopEnabled?: boolean;
    trailingStopPercent?: number;
    trailingStopActivationLevel?: number;
    positionSizeUsdt?: number;
    timeBasedExitEnabled?: boolean;
    timeBasedExitMinutes?: number;
    timeBasedExitMinPnl?: number;
    takeProfits?: Array<Record<string, unknown>>;
  } & Record<string, unknown>);
  timeframes?: ({
    entry?: ConfigTimeframePayload;
    primary?: ConfigTimeframePayload;
    trend1?: ConfigTimeframePayload;
    trend2?: ConfigTimeframePayload;
    context?: ConfigTimeframePayload;
  } & Record<string, unknown>);
  strategies?: StrategiesConfigPayload;
  webApi?: WebApiConfig & Record<string, unknown>;
}

export interface ConfigUpdateResponsePayload {
  message: string;
  backupPath: string;
  requiresRestart: true;
}

export interface StrategyToggleResponsePayload {
  strategy: string;
  enabled: boolean;
  message: string;
}

export interface RiskUpdateResponsePayload {
  message: string;
  risk: RiskSettingsPayload & Record<string, unknown>;
}

export interface ConfigSchemaFieldPayload {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  label: string;
}

export interface ConfigSchemaSectionPayload {
  name: string;
  fields: ConfigSchemaFieldPayload[];
}

export interface ConfigSchemaPayload {
  sections: Record<string, ConfigSchemaSectionPayload>;
}

export interface ConfigBackupPayload {
  id: string;
  timestamp: number;
  filePath: string;
  size: number;
}

export interface ConfigBackupsResponsePayload {
  backups: ConfigBackupPayload[];
  count: number;
}

export interface ConfigHistoryEntryPayload {
  filename: string;
  path: string;
}

export interface ConfigHistoryResponsePayload {
  backups: ConfigHistoryEntryPayload[];
  count: number;
}

export interface ConfigRestoreResponsePayload {
  success: boolean;
  message: string;
}

export interface ConfigCleanupResponsePayload {
  deleted: number;
  message: string;
}

export interface RecentSignalsResponsePayload {
  signals: Signal[];
  count: number;
}

export interface StrategyConfigSummary {
  id: string;
  name: string;
  enabled: boolean;
  config?: StrategyConfigEntryPayload;
}

export interface StrategiesResponsePayload {
  strategies: StrategyConfigSummary[];
  total: number;
  active: number;
}

export interface ConfigValidationResponsePayload {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ServerRuntimeConfigPayload {
  api: {
    port: number;
    url: string;
  };
  websocket: {
    port: number;
    url: string;
  };
}
