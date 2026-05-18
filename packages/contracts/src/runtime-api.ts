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
  STRATEGIES_RELOADED: StrategyReloadedPayload;
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

export type ControlConfigPayload = BotConfigPayload & {
  trading?: BotConfigPayload['trading'] & {
    symbol?: string;
    timeframe?: string;
    enabled?: boolean;
  };
  risk?: RiskSettingsPayload;
  strategies?: StrategiesConfigPayload;
};

export type ConfigReadResponsePayload = BotConfigPayload;

export interface ConfigMutationRequestPayload {
  config: BotConfigPayload;
}

export type ConfigUpdateRequestPayload = ConfigMutationRequestPayload;

export interface ConfigValidationIssuePayload {
  path: string;
  message: string;
}

export interface ConfigValidationSummaryPayload {
  errorCount: number;
  warningCount: number;
  issueCount: number;
}

export interface ConfigValidationResponsePayload {
  valid: boolean;
  errors: ConfigValidationIssuePayload[];
  warnings: ConfigValidationIssuePayload[];
  summary: ConfigValidationSummaryPayload;
}

export interface ConfigMutationPreviewEntryPayload {
  path: string;
  kind: 'added' | 'updated' | 'removed';
  previousValue: string | null;
  nextValue: string | null;
}

export interface ConfigMutationPreviewSummaryPayload {
  addedCount: number;
  updatedCount: number;
  removedCount: number;
  totalChanges: number;
}

export interface ConfigMutationPreviewPayload {
  changes: ConfigMutationPreviewEntryPayload[];
  summary: ConfigMutationPreviewSummaryPayload;
  validation: ConfigValidationResponsePayload;
}

export type ConfigMutationPreviewRequestPayload = ConfigMutationRequestPayload;

export interface ConfigUpdateResponsePayload {
  message: string;
  backupPath: string;
  requiresRestart: true;
  preview: ConfigMutationPreviewPayload;
  validation: ConfigValidationResponsePayload;
}

export interface StrategyToggleRequestPayload {
  enabled: boolean;
}

export interface StrategyToggleResponsePayload {
  strategy: string;
  enabled: boolean;
  message: string;
}

export type StrategyReloadedPayload = {
  strategies: StrategyConfigSummary[];
};

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

export const CONFIG_SCHEMA_SECTION_KEYS = ['trading', 'risk', 'strategies'] as const;

export type ConfigSchemaSectionKey = (typeof CONFIG_SCHEMA_SECTION_KEYS)[number];

export type ConfigSchemaSectionsPayload =
  Record<ConfigSchemaSectionKey, ConfigSchemaSectionPayload>
  & Record<string, ConfigSchemaSectionPayload>;

export interface ConfigSchemaPayload {
  sections: ConfigSchemaSectionsPayload;
}

export const CONFIG_SCHEMA_METADATA: ConfigSchemaPayload = {
  sections: {
    trading: {
      name: 'Trading Parameters',
      fields: [
        { name: 'symbol', type: 'string', label: 'Trading Pair' },
        { name: 'timeframe', type: 'string', label: 'Candle Timeframe' },
        { name: 'enabled', type: 'boolean', label: 'Enable Trading' },
      ],
    },
    risk: {
      name: 'Risk Management',
      fields: [
        { name: 'maxLeverage', type: 'number', label: 'Max Leverage' },
        { name: 'maxPositionSize', type: 'number', label: 'Max Position Size' },
        { name: 'dailyLossLimit', type: 'number', label: 'Daily Loss Limit' },
        { name: 'stopLossPercent', type: 'number', label: 'Stop Loss %' },
        { name: 'takeProfitPercent', type: 'number', label: 'Take Profit %' },
      ],
    },
    strategies: {
      name: 'Strategies',
      fields: [
        { name: 'enabled', type: 'boolean', label: 'Enabled' },
        { name: 'confidence', type: 'number', label: 'Min Confidence' },
        { name: 'maxTrades', type: 'number', label: 'Max Concurrent Trades' },
      ],
    },
  },
};

export const DEFAULT_CONFIG_BACKUP_KEEP_COUNT = 10;

export const DEFAULT_SERVER_RUNTIME_PORTS = {
  api: 4000,
  websocket: 4001,
} as const;

export interface ConfigBackupPayload {
  id: string;
  timestamp: number;
  filePath: string;
  path: string;
  filename: string;
  size: number;
}

export interface ConfigBackupCollectionPayload {
  backups: ConfigBackupPayload[];
  count: number;
}

export type ConfigBackupsResponsePayload = ConfigBackupCollectionPayload;

export interface ConfigCleanupRequestPayload {
  keepCount?: number;
}

export interface ConfigHistoryEntryPayload {
  filename: string;
  path: string;
}

export type ConfigHistoryResponsePayload = ConfigBackupCollectionPayload;

export interface ConfigRestoreResponsePayload {
  success: true;
  message: string;
  restoredBackup: ConfigBackupPayload;
  preRestoreBackupPath: string | null;
  requiresRestart: true;
}

export interface ConfigCleanupResponsePayload {
  deleted: number;
  remainingBackups: number;
  totalBackups: number;
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

export interface ConfigValidationRequestPayload {
  config: BotConfigPayload;
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
