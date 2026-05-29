import type { Candle } from './types/core';
import type { Position } from './types/position';
import type { Config } from './types/legacy';
import type {
  BotRuntimeEventListener,
  PositionClosedEventPayload,
  PositionOpenedEventPayload,
} from './types/bot-events';
import type {
  TradingBotConfig,
  TradingBotStatus,
  TradingBotWebApi,
} from './types/trading-bot';
import type {
  IWebApiAdapter,
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts/web-api';

import type {
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
} from './interfaces';
import { ICONS } from './cli/cli-runtime';
import { BotInitializer } from './services/bot-initializer';
import { WebSocketEventHandlerManager } from './services/websocket-event-handler-manager';

const CRITICAL_SHUTDOWN_TIMEOUT_MS = 5000;
const BALANCE_PLACEHOLDER_MULTIPLIER = 100;

type TradingBotRuntimeParts = {
  readonly services: ITradingBotRuntimeDependencies['tradingBotServices'];
  readonly balanceReader: ITradingBotRuntimeDependencies['balanceReader'];
  readonly webApiAdapter: ITradingBotRuntimeDependencies['webApiAdapter'];
};

type TradingBotLifecycleCollaborators = {
  readonly initializer: BotInitializer;
  readonly eventHandlerManager: WebSocketEventHandlerManager;
};

const selectTradingBotRuntimeParts = (
  dependencies: ITradingBotRuntimeDependencies,
): TradingBotRuntimeParts => ({
  services: dependencies.tradingBotServices,
  balanceReader: dependencies.balanceReader,
  webApiAdapter: dependencies.webApiAdapter,
});

const createTradingBotLifecycleCollaborators = (
  dependencies: ITradingBotRuntimeDependencies,
  config: Config,
): TradingBotLifecycleCollaborators => ({
  initializer: new BotInitializer(dependencies.initializerServices, config),
  eventHandlerManager: new WebSocketEventHandlerManager(
    dependencies.eventHandlerServices,
    config,
  ),
});

/**
 * Main Trading Bot orchestrator
 * Coordinates all services and manages the trading lifecycle
 *
 * NOTE: This class is ONLY responsible for trading logic.
 * Event API is provided separately via BotEventEmitter adapter.
 */
export class TradingBot implements TradingBotWebApi {
  private readonly config: TradingBotConfig;
  private readonly services: ITradingBotServices;
  private readonly balanceReader: ITradingBotRuntimeDependencies['balanceReader'];
  private readonly webApiAdapter: IWebApiAdapter;
  private readonly initializer: BotInitializer;
  private readonly eventHandlerManager: WebSocketEventHandlerManager;

  private criticalErrorHandler?: BotRuntimeEventListener<'critical-error'>;
  private positionOpenedListener?: BotRuntimeEventListener<'position-opened'>;
  private positionClosedListener?: BotRuntimeEventListener<'position-closed'>;
  private runtimeHooksPrepared = false;

  // Public accessors for external consumers
  /**
   * Get EventBus for creating BotEventEmitter adapter
   */
  get eventBus(): ITradingBotServices['coreServices']['eventBus'] {
    return this.services.coreServices.eventBus;
  }

  // State
  public isRunning = false;

  private get coreServices(): ITradingBotServices['coreServices'] {
    return this.services.coreServices;
  }

  private get executionServices(): ITradingBotServices['executionServices'] {
    return this.services.executionServices;
  }

  private get monitoringServices(): ITradingBotServices['monitoringServices'] {
    return this.services.monitoringServices;
  }

  private get logger(): ITradingBotServices['coreServices']['logger'] {
    return this.coreServices.logger;
  }

  private get telegram(): ITradingBotServices['coreServices']['telegram'] {
    return this.coreServices.telegram;
  }

  private get positionMonitor(): ITradingBotServices['executionServices']['positionMonitor'] {
    return this.executionServices.positionMonitor;
  }

  private get positionManager(): ITradingBotServices['executionServices']['positionManager'] {
    return this.executionServices.positionManager;
  }

  private get tradingOrchestrator(): ITradingBotServices['executionServices']['tradingOrchestrator'] {
    return this.executionServices.tradingOrchestrator;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private isPositionShape(value: unknown): value is Position {
    return this.isRecord(value)
      && typeof value.side === 'string'
      && typeof value.entryPrice === 'number'
      && typeof value.quantity === 'number';
  }

  private getPositionFromEvent(
    data: PositionOpenedEventPayload | PositionClosedEventPayload,
  ): Position | null {
    if (this.isPositionShape(data)) {
      return data;
    }
    if (!this.isRecord(data)) {
      return null;
    }
    if (this.isPositionShape(data.position)) {
      return data.position;
    }
    if ('closedPosition' in data && this.isPositionShape(data.closedPosition)) {
      return data.closedPosition;
    }
    return null;
  }

  private isDashboardEnabled(): boolean {
    return this.config.dashboard?.enabled === true;
  }

  private getEnabledTimeframes(): string[] {
    return Object.entries(this.config.timeframes)
      .filter(([, timeframe]) => timeframe.enabled)
      .map(([name, timeframe]) => `${name}(${timeframe.interval}m)`);
  }

  private getBalanceFallback(): number {
    const positionSize = this.config?.riskManagement?.positionSizeUsdt ?? 100;
    return positionSize * BALANCE_PLACEHOLDER_MULTIPLIER;
  }

  private formatDashboardPositionOpened(position: Position): string {
    return `${position.side} @ ${position.entryPrice.toFixed(4)} | Qty: ${position.quantity}`;
  }

  private getClosedPositionPnl(
    data: PositionClosedEventPayload,
    position: Position,
  ): number {
    return this.isRecord(data) && typeof data.pnl === 'number'
      ? data.pnl
      : position.unrealizedPnL || 0;
  }

  private formatDashboardPositionClosed(
    data: PositionClosedEventPayload,
    position: Position,
  ): string {
    const pnl = this.getClosedPositionPnl(data, position);
    return `${position.side} closed | P&L: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT`;
  }

  /**
   * Constructor - receives all dependencies via DI (BotFactory)
   *
   * @param services - Grouped service bundle with all initialized services
   * @param config - Bot configuration
   */
  constructor(dependencies: ITradingBotRuntimeDependencies, config: Config) {
    const runtimeParts = selectTradingBotRuntimeParts(dependencies);
    const lifecycleCollaborators = createTradingBotLifecycleCollaborators(dependencies, config);

    this.services = runtimeParts.services;
    this.balanceReader = runtimeParts.balanceReader;
    this.webApiAdapter = runtimeParts.webApiAdapter;
    this.config = config;
    this.initializer = lifecycleCollaborators.initializer;
    this.eventHandlerManager = lifecycleCollaborators.eventHandlerManager;

    this.logger.info(`${ICONS.robot} TradingBot initialized with injected dependencies via BotFactory`);
    this.logger.info('DEBUG: Config structure check', {
      hasStrategicWeights: !!config.strategicWeights,
      strategicWeightsKeys: config.strategicWeights ? Object.keys(config.strategicWeights) : [],
    });
  }

  /**
   * Start the trading bot
   *
   * Lifecycle:
   * 1. Initialize all components (services, candles, time sync)
   * 2. Setup event handlers
   * 3. Connect WebSocket connections
   * 4. Start position monitoring and periodic tasks
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Already running');
      return;
    }

    this.logger.info('Starting...');

    try {
      await this.initializer.bootstrap({
        beforeMonitoring: () => this.prepareRuntimeStartup(),
        afterStart: () => this.completeStartup(),
      });
    } catch (error) {
      this.logger.error('Failed to start', { error });
      await this.shutdownRuntimeState();
      throw error;
    }
  }

  private prepareRuntimeStartup(): void {
    this.cleanupBotLifecycleListeners();
    this.registerRuntimeEventHandlers();
    this.setupCriticalErrorHandling();

    if (this.monitoringServices.dashboard && this.isDashboardEnabled()) {
      this.setupDashboardEventListeners();
    }
    this.runtimeHooksPrepared = true;
  }

  private registerRuntimeEventHandlers(): void {
    this.eventHandlerManager.registerAllHandlers();
  }

  private async completeStartup(): Promise<void> {
    this.isRunning = true;
    this.logger.info(`${ICONS.success} Started successfully! Waiting for candle close events...`);

    await this.telegram.notifyBotStarted(this.config.exchange.symbol, this.getEnabledTimeframes());

    if (this.config.trading.forceOpenPosition?.enabled) {
      this.logger.warn(`${ICONS.warning} Force open mode is not supported in new architecture - ignoring`);
    }
  }

  /**
   * Main trading cycle - runs every N seconds
   * Generates signals and opens positions
   */
  // REMOVED: Old tradingCycle() logic - now handled by TradingOrchestrator
  // All trading logic moved to:
  // - ContextAnalyzer (PRIMARY timeframe analysis)
  // - EntryScanner (ENTRY timeframe scanning)
  // - TradingOrchestrator (coordination & execution)

  /**
   * Setup critical error handling
   * Listen for critical errors from position monitor and EventBus
   */
  private setupCriticalErrorHandling(): void {
    this.criticalErrorHandler = this.createCriticalErrorHandler();

    this.positionMonitor.on('critical-error', this.criticalErrorHandler);
    this.eventBus.on('critical-error', this.criticalErrorHandler);

    this.logger.debug('Critical error handlers registered (positionMonitor + EventBus)');
  }

  private createCriticalErrorHandler(): BotRuntimeEventListener<'critical-error'> {
    return (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`${ICONS.warning} CRITICAL ERROR RECEIVED - Initiating IMMEDIATE shutdown`, {
        error: errorMessage,
      });

      const shutdownTimeout = setTimeout(() => {
        this.logger.error(`${ICONS.warning} TIMEOUT: Shutdown took too long. Force exiting...`);
        process.exit(1);
      }, CRITICAL_SHUTDOWN_TIMEOUT_MS);

      void this.stop().then(() => {
        clearTimeout(shutdownTimeout);
        this.logger.error(`${ICONS.success} Bot stopped due to critical error. Exiting process.`);
        process.exit(1);
      }).catch((stopError) => {
        clearTimeout(shutdownTimeout);
        this.logger.error('Failed to stop bot gracefully', { error: stopError });
        process.exit(1);
      });
    };
  }

  /**
   * Stop the trading bot gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning && !this.runtimeHooksPrepared) {
      this.logger.info('Not running');
      return;
    }

    this.logger.info('Stopping...');

    try {
      await this.shutdownRuntimeState();
      this.logger.info(`${ICONS.success} Stopped successfully`);
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }

  /**
   * Setup dashboard event listeners for real-time updates
   * Connects position and exit events to dashboard display
   */
  private setupDashboardEventListeners(): void {
    const dashboard = this.monitoringServices.dashboard;
    if (!dashboard) {
      return;
    }

    this.positionOpenedListener = (data: PositionOpenedEventPayload) => {
      const position = this.getPositionFromEvent(data);
      if (!position) {
        return;
      }
      dashboard.recordEvent('position-open', this.formatDashboardPositionOpened(position));
    };

    this.positionClosedListener = (data: PositionClosedEventPayload) => {
      const position = this.getPositionFromEvent(data);
      if (!position) {
        return;
      }
      dashboard.recordEvent('position-close', this.formatDashboardPositionClosed(data, position));
    };

    this.eventBus.on('position-opened', this.positionOpenedListener);
    this.eventBus.on('position-closed', this.positionClosedListener);

    this.logger.debug('Dashboard event listeners configured');
  }

  private async shutdownRuntimeState(): Promise<void> {
    let cleanupCompleted = false;

    try {
      await this.initializer.shutdown({
        beforeShutdown: () => {
          this.eventHandlerManager.cleanupAllListeners();
          this.cleanupBotLifecycleListeners();
          cleanupCompleted = true;
        },
      });
    } finally {
      if (!cleanupCompleted) {
        this.eventHandlerManager.cleanupAllListeners();
        this.cleanupBotLifecycleListeners();
      }
      this.isRunning = false;
      this.runtimeHooksPrepared = false;
    }
  }

  private cleanupBotLifecycleListeners(): void {
    if (this.criticalErrorHandler) {
      this.positionMonitor.off('critical-error', this.criticalErrorHandler);
      this.eventBus.off('critical-error', this.criticalErrorHandler);
      this.criticalErrorHandler = undefined;
    }

    if (this.positionOpenedListener) {
      this.eventBus.off('position-opened', this.positionOpenedListener);
      this.positionOpenedListener = undefined;
    }

    if (this.positionClosedListener) {
      this.eventBus.off('position-closed', this.positionClosedListener);
      this.positionClosedListener = undefined;
    }
  }

  /**
   * Enable test mode - allows position opening without real signals
   * Used for debugging the position opening workflow
   */
  enableTestMode(): void {
    this.tradingOrchestrator.enableTestMode();
  }

  /**
   * Disable test mode
   */
  disableTestMode(): void {
    this.tradingOrchestrator.disableTestMode();
  }

  /**
   * Get current position
   */
  getCurrentPosition(): Position | null {
    return this.positionManager.getCurrentPosition();
  }

  /**
   * Get current balance
   */
  async getBalance(): Promise<number> {
    try {
      const balance = await this.balanceReader.getBalance();
      return balance.walletBalance;
    } catch (error) {
      this.logger.error('Error getting balance', { error });
      return this.getBalanceFallback();
    }
  }

  /**
   * Get bot status
   */
  getStatus(): TradingBotStatus {
    const position = this.positionManager.getCurrentPosition();
    return {
      isRunning: this.isRunning,
      hasPosition: position !== null,
      position,
    };
  }

  /**
   * Lazy-load web API adapter
   * Provides access to data for web interface
   */
  private getWebAPI(): IWebApiAdapter {
    return this.webApiAdapter;
  }

  /**
   * Expose web API adapter for external consumers (web-server bridge).
   */
  getWebApiAdapter(): IWebApiAdapter {
    return this.getWebAPI();
  }

  /**
   * Get current market data (price, indicators, trend)
   * Delegates to BotWebAPI
   */
  async getMarketData(): Promise<WebApiMarketData> {
    return this.getWebAPI().getMarketData();
  }

  /**
   * Get candlestick data for web chart
   * Delegates to BotWebAPI
   */
  async getCandles(timeframe: string, limit: number): Promise<Candle[]> {
    const candles = await this.getWebAPI().getCandles(timeframe, limit);
    return candles.map((candle) => ({
      ...candle,
      volume: candle.volume ?? 0,
    }));
  }

  /**
   * Get position history for web interface
   * Delegates to BotWebAPI
   */
  async getPositionHistory(limit: number): Promise<WebApiPositionHistoryEntry[]> {
    return this.getWebAPI().getPositionHistory(limit);
  }

  /**
   * Get orderbook data for web interface
   * Delegates to BotWebAPI
   */
  async getOrderBook(symbol: string): Promise<WebApiOrderBookView> {
    return this.getWebAPI().getOrderBook(symbol);
  }

  /**
   * Get wall orders for web interface
   * Delegates to BotWebAPI
   */
  async getWalls(symbol: string): Promise<WebApiWallsView> {
    return this.getWebAPI().getWalls(symbol);
  }

  /**
   * Get funding rate for web interface
   * Delegates to BotWebAPI
   */
  async getFundingRate(symbol: string): Promise<WebApiFundingRateView> {
    return this.getWebAPI().getFundingRate(symbol);
  }

  /**
   * Get volume profile for web interface
   * Delegates to BotWebAPI
   */
  async getVolumeProfile(symbol: string, levels: number): Promise<WebApiVolumeProfileView> {
    return this.getWebAPI().getVolumeProfile(symbol, levels);
  }
}
