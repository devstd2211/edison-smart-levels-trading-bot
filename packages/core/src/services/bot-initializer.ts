import { INTEGER_MULTIPLIERS } from '../constants';
import { TIME_MULTIPLIERS } from '../constants/technical.constants';
import { ICONS } from '../cli/cli-runtime';
import { LoggerService } from './logger.service';
import { Config } from '../types/legacy';
import type { IBotInitializerServices } from '../interfaces';
import { LifecycleManager } from './lifecycle-manager.service';
import {
  getBotInitializerListenerCleanupTargets,
  isLifecycleService,
  registerBotInitializerLifecycleServices,
} from './bot-initializer/bot-initializer-lifecycle.utils';
import { ErrorHandler, RecoveryStrategy, RetryConfig } from '../errors/ErrorHandler';
import {
  BOT_INITIALIZER_PERIODIC_INTERVAL_MS,
  runBotInitializerPeriodicCycle,
} from './bot-initializer/bot-initializer-periodic.utils';
import {
  ExchangeConnectionError,
  ExchangeAPIError,
  ExchangeRateLimitError,
  WebSocketConnectionError,
  PositionMonitoringError,
  ConfigurationError,
} from '../errors/DomainErrors';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';

/**
 * BotInitializer - Manages bot lifecycle (initialization and shutdown)
 *
 * Responsibilities:
 * - Initialize all bot components in correct order
 * - Start WebSocket connections
 * - Setup periodic maintenance tasks
 * - Graceful shutdown with cleanup
 *
 * This extracts lifecycle logic from TradingBot to keep it focused on orchestration.
 */
export class BotInitializer {
  private logger: LoggerService;
  private periodicTaskInterval: NodeJS.Timeout | null = null;
  private readonly lifecycleManager: LifecycleManager;

  // Retry configurations for different operations
  private readonly BYBIT_INIT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 500,
    backoffMultiplier: 2,
    maxDelayMs: 2000,
  };

  private readonly TIME_SYNC_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 300,
    backoffMultiplier: 2,
    maxDelayMs: 1500,
  };

  private readonly CANDLE_PROVIDER_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 5000,
  };

  private readonly WEBSOCKET_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 5000,
    backoffMultiplier: 1.5,
    maxDelayMs: 10000,
  };

  private readonly MONITOR_START_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 3,
    initialDelayMs: 500,
    backoffMultiplier: 2,
    maxDelayMs: 2000,
  };

  private get legacyBybitCompat():
    IBotInitializerServices & { bybitService?: IBotInitializerServices['marketDataServices']['bybitService'] } {
    return this.services;
  }

  constructor(
    private services: IBotInitializerServices,
    private config: Config,
    private errorHandler?: ErrorHandler,
  ) {
    this.logger = services.coreServices.logger;
    this.lifecycleManager = new LifecycleManager(this.logger);
    registerBotInitializerLifecycleServices(this.lifecycleManager, this.services);
  }

  /**
   * Classify initialization error into appropriate domain error type
   */
  private classifyInitError(
    error: unknown,
    operation: string,
    context: Record<string, unknown> = {},
  ): Error {
    const errorMessage = getErrorMessage(error);
    const originalError = error instanceof Error ? error : undefined;

    // Network/connection errors
    if (
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network')
    ) {
      return new ExchangeConnectionError(
        `Failed during ${operation}`,
        {
          exchangeName: 'bybit',
          ...context,
        },
        originalError,
      );
    }

    // Rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return new ExchangeRateLimitError(
        `Rate limit during ${operation}`,
        { exchangeName: 'bybit', retryAfterMs: 5000, ...context },
        originalError,
      );
    }

    // Position monitoring errors (check before WebSocket to be more specific)
    if (
      operation.toLowerCase().includes('monitor') ||
      operation.toLowerCase().includes('position')
    ) {
      return new PositionMonitoringError(
        `Monitor failed during ${operation}`,
        {
          operation,
          reason: errorMessage,
          ...context,
        },
        originalError,
      );
    }

    // WebSocket errors
    if (operation.includes('WebSocket') || errorMessage.includes('ws://')) {
      return new WebSocketConnectionError(
        `WS failed during ${operation}`,
        {
          url: typeof context.url === 'string' ? context.url : undefined,
          ...context,
        },
        originalError,
      );
    }

    // Configuration errors
    if (operation.includes('session') || operation.includes('stats')) {
      return new ConfigurationError(
        `Config error during ${operation}`,
        {
          configKey: operation,
          issue: errorMessage,
          ...context,
        },
        originalError,
      );
    }

    // Default: ExchangeAPIError
    return new ExchangeAPIError(
      `Failed during ${operation}`,
      {
        exchangeName: 'bybit',
        ...context,
      },
      originalError,
    );
  }

  /**
   * Bootstrap runtime lifecycle in startup order.
   * Allows caller to inject steps that must run after sockets connect
   * and before monitoring tasks begin.
   */
  async bootstrap(hooks: { beforeMonitoring?: () => void | Promise<void> } = {}): Promise<void> {
    await this.initialize();
    this.logDataSubscriptionStatus();
    await this.connectWebSockets();
    if (hooks.beforeMonitoring) {
      await hooks.beforeMonitoring();
    }
    await this.startMonitoring();
  }

  /**
   * Initialize all bot components
   * Called once at startup in correct dependency order
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info(`${ICONS.robot} Starting bot initialization sequence...`);

      // Phase 1: Initialize Bybit service - load symbol precision parameters
      await this.initializeBybit();

      // Phase 2: Start session statistics tracking
      await this.startSessionStats();

      // Phase 3: Synchronize time with exchange server
      await this.syncTimeWithExchange();

      // Phase 4: Initialize candle provider (if enabled)
      if (this.config.dataSubscriptions.candles.enabled) {
        await this.initializeCandleProvider();
      } else {
        this.logger.warn(`${ICONS.warning} Candles disabled - strategies may not work correctly!`);
      }

      // Phase 4.5: Load BTC candles (if BTC confirmation is enabled)
      if (this.config.btcConfirmation?.enabled) {
        await this.initializeBtcCandles();
      }

      // Phase 4.6: Start execution services (orchestrator, order state machine)
      await this.startExecutionServices();

      // Phase 4.7: Start monitoring services (dashboard/metrics)
      await this.startMonitoringServices();

      // Phase 4.75: Start resilience services (rate limiter, retry policy)
      await this.startResilienceServices();

      // Phase 4.8: Start monitoring server (optional, non-blocking)
      this.startMonitoringServer();

      this.logger.info(`${ICONS.success} Bot initialization complete - ready to connect WebSockets`);
    } catch (error) {
      this.logger.error('Failed to initialize bot', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Connect WebSocket connections with retry logic
   * Called after initialization, before trading starts
   */
  async connectWebSockets(): Promise<void> {
    try {
      this.logger.debug('connectWebSockets called');
      this.logger.info(`${ICONS.plug} Connecting WebSocket connections...`);

      // Connect Private WebSocket with retry
      this.logger.info('Connecting Private WebSocket...');
      await this.connectWithRetry(
        'Private WebSocket',
        () =>
          this.startLifecycleService(
            this.services.marketDataServices.webSocketManager,
            'private WebSocket',
            { throwOnError: true },
          ),
      );

      // Connect Public WebSocket with retry
      this.logger.info('Connecting Public WebSocket...');
      await this.connectWithRetry(
        'Public WebSocket',
        () =>
          this.startLifecycleService(
            this.services.marketDataServices.publicWebSocket,
            'public WebSocket',
            { throwOnError: true },
          ),
      );

      this.logger.info(`${ICONS.success} WebSocket connections established`);

      // CRITICAL Phase 5: Initialize trend analysis NOW that WebSocket has candles
      // This must happen AFTER WebSocket connects because candles are loaded asynchronously via WebSocket
      this.logger.debug('Initializing trend analysis after WebSocket startup');
      await this.initializeTrendAnalysisAfterWebSocket();
      this.logger.debug('Trend analysis initialization completed after WebSocket startup');
    } catch (error) {
      this.logger.error('Failed to connect WebSockets', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Helper to connect WebSocket with retry logic
   */
  private async connectWithRetry(
    wsName: string,
    connectFn: () => void | Promise<void>,
  ): Promise<void> {
    if (this.errorHandler) {
      for (let attempt = 1; attempt <= this.WEBSOCKET_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          await connectFn();
          return;
        } catch (error) {
          if (attempt === this.WEBSOCKET_RETRY_CONFIG.maxAttempts) {
            throw this.classifyInitError(error, `connectWebSocket(${wsName})`, {
              wsName,
            });
          }

          const delay = this.calculateRetryDelay(
            attempt,
            this.WEBSOCKET_RETRY_CONFIG,
          );
          this.logger.warn(`${ICONS.warning} Retrying ${wsName} connection (attempt ${attempt})...`, {
            delayMs: delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      await connectFn();
    }
  }

  /**
   * Initialize trend analysis after WebSocket connection
   * CRITICAL: Must be called AFTER WebSocket connects, not during initial initialization
   * Candles are loaded asynchronously via WebSocket, so we wait for connection first
   */
  private async initializeTrendAnalysisAfterWebSocket(): Promise<void> {
    try {
      this.logger.debug('Waiting briefly for initial candle flow before trend analysis');

      // Give WebSocket a brief moment to start receiving candles
      // Typically first candles arrive within 100-500ms
      await new Promise(resolve => setTimeout(resolve, 500));
      this.logger.debug('Starting TradingOrchestrator trend analysis after WebSocket warm-up');

      if (this.services.executionServices.tradingOrchestrator) {
        this.logger.info(`${ICONS.success} TradingOrchestrator found, calling initializeTrendAnalysis()...`);
        await this.services.executionServices.tradingOrchestrator.initializeTrendAnalysis();
        this.logger.info(`${ICONS.success} TradingOrchestrator.initializeTrendAnalysis() returned`);
      } else {
        this.logger.error(`${ICONS.warning} TradingOrchestrator not available in services bundle`);
      }
    } catch (error) {
      this.logger.error(`${ICONS.warning} Exception during trend initialization after WebSocket`, {
        error: getErrorMessage(error),
        stack: getErrorStack(error),
      });
      // Non-fatal - trend will initialize on first PRIMARY candle close
    }
  }

  /**
   * Start position monitor and periodic maintenance tasks
   * Called after WebSocket connections are established
   */
  async startMonitoring(): Promise<void> {
    try {
      this.logger.info(`${ICONS.chart} Starting position monitor and maintenance tasks...`);

      // CRITICAL: Restore open positions from exchange BEFORE periodic cleanup starts
      // This prevents race condition where cleanup cancels SL/TP before position is restored from WebSocket
      await this.restoreOpenPositions();

      // Start Position Monitor with retry
      await this.startPositionMonitor();

      // Setup periodic maintenance tasks (only after position restoration)
      this.setupPeriodicTasks();

      this.logger.info(`${ICONS.success} Position monitor and maintenance tasks started`);
    } catch (error) {
      this.logger.error('Failed to start monitoring', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Start position monitor with retry logic
   */
  private async startPositionMonitor(): Promise<void> {
    const performStart = async () => {
      await this.startLifecycleService(
        this.services.executionServices.positionMonitor,
        'position monitor',
        { throwOnError: true },
      );
      this.logger.debug('Position monitor started');
    };

    if (this.errorHandler) {
      for (let attempt = 1; attempt <= this.MONITOR_START_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          await performStart();
          return;
        } catch (error) {
          if (attempt === this.MONITOR_START_RETRY_CONFIG.maxAttempts) {
            throw this.classifyInitError(error, 'startPositionMonitor');
          }

          const delay = this.calculateRetryDelay(
            attempt,
            this.MONITOR_START_RETRY_CONFIG,
          );
          this.logger.warn(`${ICONS.warning} Retrying position monitor start (attempt ${attempt})...`, {
            delayMs: delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      await performStart();
    }
  }

  /**
   * Restore open positions from exchange after bot restart
   * CRITICAL: This is called BEFORE periodic cleanup to prevent cancelling SL/TP orders
   *
   * Race condition being prevented:
   * - Bot stops with open position
   * - Bot restarts
   * - Periodic cleanup runs every 30s and calls cancelAllConditionalOrders() if no position in memory
   * - WebSocket position restoration happens async and might not complete before first cleanup
   *
   * Solution: Proactively fetch position from exchange and restore to memory BEFORE cleanup starts
   */
  private async restoreOpenPositions(): Promise<void> {
    try {
      this.logger.info('Checking for open positions to restore...');

      // Fetch all open positions from exchange (BybitService is single-position, so max 1)
      const openPositions = await this.services.marketDataServices.bybitService.getOpenPositions();
      const exchangePosition = openPositions.length > 0 ? openPositions[0] : null;

      if (exchangePosition === null || exchangePosition.quantity === 0) {
        this.logger.debug(`${ICONS.success} No open positions found on exchange - clean state`);
        return;
      }

      // Position exists on exchange - restore it to memory
      this.logger.info(`${ICONS.success} Found open position on exchange - restoring to memory...`, {
        symbol: exchangePosition.symbol,
        side: exchangePosition.side,
        quantity: exchangePosition.quantity,
        entryPrice: exchangePosition.entryPrice,
      });

      // Sync position with WebSocket (this handles journal linking)
      this.services.executionServices.positionManager.syncWithWebSocket(exchangePosition);

      const restoredPosition = this.services.executionServices.positionManager.getCurrentPosition();
      if (restoredPosition) {
        this.logger.info(`${ICONS.success} Position restored successfully`, {
          positionId: restoredPosition.id,
          journalId: restoredPosition.journalId,
          protectionVerified: restoredPosition.protectionVerifiedOnce,
        });
      }
    } catch (error) {
      this.logger.error('Failed to restore open positions', {
        error: getErrorMessage(error),
      });
      // Non-fatal error - continue startup but log the issue
      // User should investigate why position restoration failed
    }
  }

  /**
   * Graceful shutdown - stop all components
   * With ErrorHandler: all operations use SKIP strategy (never block shutdown)
   * Without ErrorHandler: uses original behavior (throws on errors for backward compatibility)
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info(`${ICONS.warning} Starting graceful shutdown...`);

      if (this.errorHandler) {
        // With ErrorHandler: Skip all errors to ensure shutdown completes
        const skipOnError = async (name: string, fn: () => void | Promise<void>) => {
          try {
            await fn();
          } catch (error) {
            this.logger.warn(`${ICONS.warning} Error during ${name}, skipping:`, {
              error: getErrorMessage(error),
            });
          }
        };

        // Stop periodic tasks
        await skipOnError('stop periodic tasks', () => {
          this.stopPeriodicTasks();
        });

        // Stop lifecycle-managed services
        await skipOnError('stop lifecycle services', () => this.lifecycleManager.stopAll());

        for (const cleanupTarget of getBotInitializerListenerCleanupTargets(this.services)) {
          await skipOnError(`remove ${cleanupTarget.label.toLowerCase()} listeners`, () => {
            cleanupTarget.target.removeAllListeners();
            this.logger.debug(`${cleanupTarget.label} listeners removed`);
          });
        }

        // End session statistics tracking
        await skipOnError('end session statistics', () => {
          this.services.sessionStats.endSession();
          this.logger.info(`${ICONS.chart} Session ended`);
        });

        // Send Telegram notification
        await skipOnError('send Telegram notification', async () => {
          await this.services.coreServices.telegram.notifyBotStopped();
        });
      } else {
        // Without ErrorHandler: original behavior (throws on errors)
        // Stop periodic tasks
        this.stopPeriodicTasks();

        // Stop lifecycle-managed services
        await this.lifecycleManager.stopAll({ throwOnError: true });

        for (const cleanupTarget of getBotInitializerListenerCleanupTargets(this.services)) {
          cleanupTarget.target.removeAllListeners();
          this.logger.debug(`${cleanupTarget.label} listeners removed`);
        }

        // End session statistics tracking
        this.services.sessionStats.endSession();
        this.logger.info(`${ICONS.chart} Session ended`);

        // Send Telegram notification
        await this.services.coreServices.telegram.notifyBotStopped();
      }

      this.logger.info(`${ICONS.success} Shutdown complete`);
    } catch (error) {
      this.logger.error('Error during shutdown', {
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Private: Initialize Bybit service with error recovery
   */
  private async initializeBybit(): Promise<void> {
    const exchangeName = this.config.exchange.name || 'bybit';
    this.logger.info(`Initializing ${exchangeName} service...`);

    const performInit = async () => {
      // If using factory-created exchange (non-Bybit), create it asynchronously
      const exchangeFactory = this.services.exchangeFactory;
      if (exchangeFactory && exchangeName !== 'bybit') {
        this.logger.info(`Creating ${exchangeName} exchange via factory...`);
        const exchange = await exchangeFactory.createExchange();
        this.legacyBybitCompat.bybitService = exchange;
        this.logger.info(`${ICONS.success} ${exchangeName} exchange created and initialized`);
      } else if (this.services.marketDataServices.bybitService.initialize) {
        // Traditional Bybit initialization
        await this.services.marketDataServices.bybitService.initialize();
        this.logger.debug(`${ICONS.success} Bybit service initialized`);
      } else {
        this.logger.debug(`${ICONS.success} Exchange service initialized`);
      }
    };

    if (this.errorHandler) {
      for (let attempt = 1; attempt <= this.BYBIT_INIT_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          await performInit();
          return;
        } catch (error) {
          if (attempt === this.BYBIT_INIT_RETRY_CONFIG.maxAttempts) {
            throw this.classifyInitError(error, 'initializeBybit', { exchangeName });
          }

          const delay = this.calculateRetryDelay(
            attempt,
            this.BYBIT_INIT_RETRY_CONFIG,
          );
          this.logger.warn(`${ICONS.warning} Retrying Bybit init (attempt ${attempt})...`, {
            delayMs: delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      await performInit();
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const delay =
      config.initialDelayMs *
      Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelayMs || delay);
  }

  /**
   * Private: Start session statistics with graceful degradation
   */
  private async startSessionStats(): Promise<void> {
    this.logger.info('Starting session statistics...');

    const performStats = async () => {
      const sessionId = this.services.sessionStats.startSession(
        this.config,
        this.config.exchange.symbol,
      );
      this.logger.info(`${ICONS.chart} Session started: ${sessionId}`);
    };

    if (this.errorHandler) {
      try {
        await performStats();
      } catch (error) {
        this.logger.warn(`${ICONS.warning} Session statistics failed - continuing without stats`, {
          error: getErrorMessage(error),
        });
        // Non-critical - continue without stats
      }
    } else {
      try {
        await performStats();
      } catch (error) {
        this.logger.warn(`${ICONS.warning} Session statistics failed - continuing without stats`, {
          error: getErrorMessage(error),
        });
      }
    }
  }

  /**
   * Private: Synchronize time with exchange with retry
   */
  private async syncTimeWithExchange(): Promise<void> {
    this.logger.info('Synchronizing time with exchange...');

    const performSync = async () => {
      await this.services.coreServices.timeService.syncWithExchange();

      const syncInfo = this.services.coreServices.timeService.getSyncInfo();
      this.logger.info('Time synchronized', {
        offset: syncInfo.offset,
        nextSyncIn: `${Math.round(syncInfo.nextSyncIn / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND)}s`,
      });
    };

    if (this.errorHandler) {
      for (let attempt = 1; attempt <= this.TIME_SYNC_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          await performSync();
          return;
        } catch (error) {
          if (attempt === this.TIME_SYNC_RETRY_CONFIG.maxAttempts) {
            throw this.classifyInitError(error, 'syncTimeWithExchange');
          }

          const delay = this.calculateRetryDelay(
            attempt,
            this.TIME_SYNC_RETRY_CONFIG,
          );
          this.logger.warn(`${ICONS.warning} Retrying time sync (attempt ${attempt})...`, {
            delayMs: delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      await performSync();
    }
  }

  /**
   * Private: Initialize candle provider cache with retry
   */
  private async initializeCandleProvider(): Promise<void> {
    this.logger.info('Initializing candle cache for all enabled timeframes...');

    const performInit = async () => {
      await this.services.marketDataServices.candleProvider.initialize();
      this.logger.debug(`${ICONS.success} Candle cache initialized (async preload disabled)`);
    };

    if (this.errorHandler) {
      for (let attempt = 1; attempt <= this.CANDLE_PROVIDER_RETRY_CONFIG.maxAttempts; attempt++) {
        try {
          await performInit();
          return;
        } catch (error) {
          if (attempt === this.CANDLE_PROVIDER_RETRY_CONFIG.maxAttempts) {
            throw this.classifyInitError(error, 'initializeCandleProvider');
          }

          const delay = this.calculateRetryDelay(
            attempt,
            this.CANDLE_PROVIDER_RETRY_CONFIG,
          );
          this.logger.warn(`${ICONS.warning} Retrying candle provider init (attempt ${attempt})...`, {
            delayMs: delay,
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } else {
      await performInit();
    }
  }

  /**
   * Private: Setup periodic maintenance tasks
   *
   * Runs every 30 seconds:
   * - Re-synchronize time with exchange (prevent drift)
   * - Clean up hanging conditional orders (when no position is open)
   */
  private setupPeriodicTasks(): void {
    this.stopPeriodicTasks();
    this.periodicTaskInterval = setInterval(() => {
      void this.runPeriodicTaskCycle();
    }, BOT_INITIALIZER_PERIODIC_INTERVAL_MS);

    this.logger.info(
      `${ICONS.success} Periodic tasks enabled (every 30 seconds): time sync + conditional orders cleanup`,
    );
  }

  private stopPeriodicTasks(): void {
    if (this.periodicTaskInterval) {
      clearInterval(this.periodicTaskInterval);
      this.periodicTaskInterval = null;
      this.logger.debug('Periodic tasks stopped');
    }
  }

  private async runPeriodicTaskCycle(): Promise<void> {
    const result = await runBotInitializerPeriodicCycle(this.services);
    if (result.shouldStop) {
      this.stopPeriodicTasks();
    }
  }

  /**
   * Private: Initialize BTC candles for correlation analysis
   */
  private async initializeBtcCandles(): Promise<void> {
    try {
      const btcConfig = this.config.btcConfirmation;
      if (!btcConfig) {
        this.logger.warn(`${ICONS.warning} BTC confirmation config not found`);
        return;
      }

      this.logger.info(`${ICONS.chart} Loading BTC candles for correlation analysis...`, {
        symbol: btcConfig.symbol,
        interval: btcConfig.timeframe,
        lookbackCandles: btcConfig.lookbackCandles,
      });

      const btcCandles = await this.services.marketDataServices.bybitService.getCandles({
        symbol: btcConfig.symbol,
        timeframe: btcConfig.timeframe,
        limit: btcConfig.lookbackCandles || 100,
      });

      this.services.btcCandles1m = btcCandles;

      this.logger.info(`${ICONS.success} BTC candles loaded successfully`, {
        count: btcCandles.length,
        latestTimestamp: btcCandles.length > 0 ? new Date(btcCandles[btcCandles.length - 1].timestamp).toISOString() : 'N/A',
      });
    } catch (error) {
      this.logger.error('Failed to load BTC candles', { error: getErrorMessage(error) });
      // Don't throw - allow bot to continue without BTC confirmation
      this.services.btcCandles1m = [];
    }
  }

  private async startMonitoringServices(): Promise<void> {
    const monitoring = this.services.monitoringServices;
    if (!monitoring) {
      return;
    }
    await this.startLifecycleService(monitoring.metricsService, 'metrics service');
    await this.startLifecycleService(monitoring.dashboard, 'dashboard');
  }

  private async startResilienceServices(): Promise<void> {
    const resilience = this.services.resilienceServices;
    if (!resilience) {
      return;
    }
    await this.startLifecycleService(resilience.rateLimiter, 'rate limiter');
    await this.startLifecycleService(resilience.retryPolicy, 'retry policy');
    await this.startLifecycleService(resilience.bulkhead, 'bulkhead');
  }

  private async startExecutionServices(): Promise<void> {
    const { tradingOrchestrator, orderStateMachine } = this.services.executionServices;

    await this.startLifecycleService(
      tradingOrchestrator,
      'trading orchestrator',
      { throwOnError: true },
    );
    await this.startLifecycleService(orderStateMachine, 'order state machine');
  }

  /**
   * Start MonitoringServer if configured (non-blocking)
   */
  private startMonitoringServer(): void {
    const monitoringServer = this.services.monitoringServices?.monitoringServer;
    if (!monitoringServer) {
      return;
    }

    void this.startLifecycleService(monitoringServer, 'monitoring server');
  }

  private async startLifecycleService(
    service: unknown,
    name: string,
    options: { throwOnError?: boolean } = {},
  ): Promise<void> {
    if (!isLifecycleService(service)) {
      return;
    }

    try {
      await service.start();
    } catch (error) {
      this.logger.error(`Failed to start ${name}`, {
        error: getErrorMessage(error),
      });
      if (options.throwOnError) {
        throw error;
      }
    }
  }

  /**
   * Log data subscription status
   * Helper method for debugging
   */
  logDataSubscriptionStatus(): void {
    this.logger.info(`${ICONS.chart} Data Subscriptions:`, {
      candles: this.config.dataSubscriptions.candles.enabled ? ICONS.success : ICONS.error,
      indicators: this.config.dataSubscriptions.candles.calculateIndicators ? ICONS.success : ICONS.error,
      orderbook: this.config.dataSubscriptions.orderbook.enabled ? ICONS.success : ICONS.error,
      ticks: this.config.dataSubscriptions.ticks.enabled ? ICONS.success : ICONS.error,
      delta: this.config.dataSubscriptions.ticks.calculateDelta ? ICONS.success : ICONS.error,
    });
  }
}
