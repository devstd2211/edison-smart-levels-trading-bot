import type { Candle } from './types/core';
import type { Position } from './types/position';
import type { Config } from './types/legacy';
import type {
  PositionClosedEventPayload,
  PositionOpenedEventPayload,
} from './types/bot-events';
import type {
  WebApiFundingRateView,
  WebApiMarketData,
  WebApiOrderBookView,
  WebApiPositionHistoryEntry,
  WebApiVolumeProfileView,
  WebApiWallsView,
} from '@edison/contracts';
import type { IWebApiAdapter } from 'trading-bot-web-server';


import type {
  ITradingBotServices,
  ITradingBotRuntimeDependencies,
  IWebApiReadServices,
} from './interfaces';
import { BotInitializer } from './services/bot-initializer';
import { WebSocketEventHandlerManager } from './services/websocket-event-handler-manager';
import { createWebApiAdapter } from './api/create-web-api-adapter';
import { createMonitoringReadServices } from './services/containers/monitoring-services';

/**
 * Main Trading Bot orchestrator
 * Coordinates all services and manages the trading lifecycle
 *
 * NOTE: This class is ONLY responsible for trading logic.
 * Event API is provided separately via BotEventEmitter adapter.
 */
export class TradingBot {
  private readonly config: Config;
  private readonly services: ITradingBotServices;
  private readonly webApiServices: IWebApiReadServices;
  private readonly initializer: BotInitializer;
  private readonly eventHandlerManager: WebSocketEventHandlerManager;
  private webApiAdapter?: IWebApiAdapter;

  // Direct service references (no getters - simpler and more transparent)
  private readonly logger: ITradingBotServices['coreServices']['logger'];
  private readonly telegram: ITradingBotServices['coreServices']['telegram'];
  private readonly tradingOrchestrator: ITradingBotServices['executionServices']['tradingOrchestrator'];
  private readonly positionManager: ITradingBotServices['executionServices']['positionManager'];
  private readonly positionMonitor: ITradingBotServices['executionServices']['positionMonitor'];
  private readonly monitoringServices: ITradingBotServices['monitoringServices'];

  // Public accessors for external consumers
  /**
   * Get EventBus for creating BotEventEmitter adapter
   */
  get eventBus() {
    return this.services.coreServices.eventBus;
  }

  // State
  public isRunning = false;

  // 🔒 CRITICAL: OrderID → TP Level mapping for reliable TP detection
  // Avoids guesswork when multiple TP orders are placed
  private tpOrderToLevel: Map<string, number> = new Map();

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
    if (!this.isRecord(this.config)) {
      return false;
    }
    const dashboard = this.isRecord(this.config.dashboard) ? this.config.dashboard : undefined;
    return dashboard?.enabled === true;
  }

  /**
   * Constructor - receives all dependencies via DI (BotFactory)
   *
   * @param services - Grouped service bundle with all initialized services
   * @param config - Bot configuration
   */
  constructor(dependencies: ITradingBotRuntimeDependencies, config: Config) {
    const services = dependencies.tradingBotServices;

    this.services = services;
    this.webApiServices = dependencies.webApiServices;
    this.config = config;
    this.initializer = new BotInitializer(dependencies.initializerServices, config);
    this.eventHandlerManager = new WebSocketEventHandlerManager(
      dependencies.eventHandlerServices,
      config,
    );

    // Initialize direct service references
    this.logger = services.coreServices.logger;
    this.telegram = services.coreServices.telegram;
    this.tradingOrchestrator = services.executionServices.tradingOrchestrator;
    this.positionManager = services.executionServices.positionManager;
    this.positionMonitor = services.executionServices.positionMonitor;
    this.monitoringServices = createMonitoringReadServices(services.monitoringServices);

    this.logger.info('🤖 TradingBot initialized with injected dependencies via BotFactory');
    this.logger.info('🔍 DEBUG: Config structure check', {
      hasStrategicWeights: !!config.strategicWeights,
      strategicWeightsKeys: config.strategicWeights ? Object.keys(config.strategicWeights) : [],
    });
  }

  /**
   * Preload historical candles for all timeframes
   * Called once at startup to populate cache before trading begins
   */
  private async preloadCandles(): Promise<void> {
    this.logger.info('[Bot] Preloading historical candles for all timeframes...');

    // PHASE 4: Candles are now loaded asynchronously via WebSocket subscription
    // No need for explicit preload - the system will collect them as candles close
    // This prevents cache initialization errors during startup
    this.logger.info('[Bot] ✅ Candle collection via WebSocket initialized (async preload disabled)');
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
        beforeMonitoring: async () => {
          // Register handlers after WS connections are established.
          this.eventHandlerManager.registerAllHandlers(this);
          this.setupCriticalErrorHandling();

          if (this.monitoringServices.dashboard && this.isDashboardEnabled()) {
            this.setupDashboardEventListeners();
          }
        },
      });

      this.isRunning = true;
      this.logger.info('✅ Started successfully! Waiting for candle close events...');

      // Send Telegram notification
      const enabledTimeframes = Object.keys(this.config.timeframes)
        .filter((key) => this.config.timeframes[key].enabled)
        .map((key) => `${key}(${this.config.timeframes[key].interval}m)`);
      await this.telegram.notifyBotStarted(this.config.exchange.symbol, enabledTimeframes);

      // Note: Force open mode is not supported in new TradingOrchestrator architecture
      // Trading will start automatically when ENTRY candles close
      if (this.config.trading.forceOpenPosition?.enabled) {
        this.logger.warn('⚠️ Force open mode is not supported in new architecture - ignoring');
      }
    } catch (error) {
      this.logger.error('Failed to start', { error });
      await this.stop();
      throw error;
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
    // Handler for critical errors
    const handleCriticalError = (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('🚨🚨🚨 CRITICAL ERROR RECEIVED - Initiating IMMEDIATE shutdown 🚨🚨🚨', {
        error: errorMessage,
      });

      // Set a hard timeout - if shutdown takes too long, force exit
      const shutdownTimeout = setTimeout(() => {
        this.logger.error('⏱️ TIMEOUT: Shutdown took too long. Force exiting...');
        process.exit(1);
      }, 5000); // 5 second timeout

      // Trigger graceful shutdown on critical error
      void this.stop().then(() => {
        clearTimeout(shutdownTimeout);
        this.logger.error('✅ Bot stopped due to critical error. Exiting process.');
        process.exit(1);
      }).catch((stopError) => {
        clearTimeout(shutdownTimeout);
        this.logger.error('Failed to stop bot gracefully', { error: stopError });
        process.exit(1);
      });
    };

    // Listen for critical API errors from position monitor
    this.positionMonitor.on('critical-error', handleCriticalError);

    // Listen for critical API errors from EventBus (e.g., periodic tasks)
    this.services.coreServices.eventBus.on('critical-error', handleCriticalError);

    this.logger.debug('Critical error handlers registered (positionMonitor + EventBus)');
  }

  /**
   * Stop the trading bot gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.info('Not running');
      return;
    }

    this.logger.info('Stopping...');

    try {
      // Clean up event handlers (memory leak prevention)
      this.eventHandlerManager.cleanupAllListeners();

      // Delegate to initializer for graceful shutdown
      await this.initializer.shutdown();

      this.isRunning = false;
      this.logger.info('✅ Stopped successfully');
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
    // Listen for position-opened events
    this.eventBus.on('position-opened', (data: PositionOpenedEventPayload) => {
      const position = this.getPositionFromEvent(data);
      if (!position) {
        return;
      }
      const msg = `${position.side} @ ${position.entryPrice.toFixed(4)} | Qty: ${position.quantity}`;
      dashboard.recordEvent('position-open', msg);
    });

    // Listen for position-closed events
    this.eventBus.on('position-closed', (data: PositionClosedEventPayload) => {
      const position = this.getPositionFromEvent(data);
      if (!position) {
        return;
      }
      const pnl = this.isRecord(data) && typeof data.pnl === 'number'
        ? data.pnl
        : position.unrealizedPnL || 0;
      const msg = `${position.side} closed | P&L: ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT`;
      dashboard.recordEvent('position-close', msg);
    });

    this.logger.debug('📊 Dashboard event listeners configured');
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
      const balance = await this.services.bybitService.getBalance();
      return balance.walletBalance;
    } catch (error) {
      this.logger.error('Error getting balance', { error });
      const positionSize = this.config?.riskManagement?.positionSizeUsdt || 100;
      const placeholderBalance = positionSize * 100;
      return placeholderBalance;
    }
  }

  /**
   * Get bot status
   */
  getStatus(): {
    isRunning: boolean;
    hasPosition: boolean;
    position: Position | null;
  } {
    return {
      isRunning: this.isRunning,
      hasPosition: this.positionManager.getCurrentPosition() !== null,
      position: this.positionManager.getCurrentPosition(),
    };
  }

  /**
   * Lazy-load web API adapter
   * Provides access to data for web interface
   */
  private getWebAPI(): IWebApiAdapter {
    if (!this.webApiAdapter) {
      this.webApiAdapter = createWebApiAdapter(this.webApiServices);
    }
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

