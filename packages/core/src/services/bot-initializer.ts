import { INTEGER_MULTIPLIERS } from '../constants';
import { TIME_MULTIPLIERS } from '../constants/technical.constants';
import { ICONS } from '../cli/cli-runtime';
import { LoggerService } from './logger.service';
import { Config } from '../types/legacy';
import type { IBotInitializerServices } from '../interfaces';
import { LifecycleManager } from './lifecycle-manager.service';
import { cleanupListenerTargets } from './lifecycle-manager.service';
import {
  BOT_INITIALIZER_LIFECYCLE_IDS,
  createBotInitializerLifecycleCollaborators,
  getBotInitializerMonitoringServer,
  getBotInitializerListenerCleanupTargets,
  hasBotInitializerLifecycleStageServices,
  registerBotInitializerLifecycleServices,
  type BotInitializerLifecycleCollaborators,
} from './bot-initializer/bot-initializer-lifecycle.utils';
import { ErrorHandler, RetryConfig } from '../errors/ErrorHandler';
import {
  BOT_INITIALIZER_PERIODIC_INTERVAL_MS,
  createBotInitializerPeriodicCollaborators,
  runBotInitializerPeriodicCycle,
  type BotInitializerPeriodicCollaborators,
} from './bot-initializer/bot-initializer-periodic.utils';
import { getErrorMessage, getErrorStack } from '../utils/error.utils';
import { classifyBotInitializerError } from './bot-initializer/bot-initializer-error.utils';
import { runBotInitializerRetryOperation } from './bot-initializer/bot-initializer-retry.utils';
import {
  runBotInitializerShutdownStep,
  runBotInitializerShutdownSteps,
  type BotInitializerShutdownStep,
} from './bot-initializer/bot-initializer-shutdown.utils';

const TREND_ANALYSIS_WARMUP_DELAY_MS = 500;

export type BotInitializerCollaborators = {
  core: Pick<IBotInitializerServices['coreServices'], 'logger' | 'telegram' | 'timeService'>;
  marketData: IBotInitializerServices['marketDataServices'];
  exchangeRuntime: IBotInitializerServices['exchangeRuntime'];
  execution: IBotInitializerServices['executionServices'];
  journal: IBotInitializerServices['journal'];
  sessionStats: IBotInitializerServices['sessionStats'];
  btcMarketState: IBotInitializerServices['btcMarketState'];
  monitoringServices: IBotInitializerServices['monitoringServices'];
  resilienceServices: IBotInitializerServices['resilienceServices'];
  exchangeFactory: IBotInitializerServices['exchangeFactory'];
};

export const createBotInitializerCollaborators = (
  services: IBotInitializerServices,
): BotInitializerCollaborators => ({
  core: {
    logger: services.coreServices.logger,
    telegram: services.coreServices.telegram,
    timeService: services.coreServices.timeService,
  },
  marketData: services.marketDataServices,
  exchangeRuntime: services.exchangeRuntime,
  execution: services.executionServices,
  journal: services.journal,
  sessionStats: services.sessionStats,
  btcMarketState: services.btcMarketState,
  get monitoringServices() {
    return services.monitoringServices;
  },
  get resilienceServices() {
    return services.resilienceServices;
  },
  get exchangeFactory() {
    return services.exchangeFactory;
  },
});

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
  private readonly lifecycleCollaborators: BotInitializerLifecycleCollaborators;
  private readonly collaborators: BotInitializerCollaborators;
  private readonly periodicCollaborators: BotInitializerPeriodicCollaborators;

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

  constructor(
    private services: IBotInitializerServices,
    private config: Config,
    private errorHandler?: ErrorHandler,
  ) {
    this.collaborators = createBotInitializerCollaborators(services);
    this.lifecycleCollaborators = createBotInitializerLifecycleCollaborators(services);
    this.logger = this.collaborators.core.logger;
    this.lifecycleManager = new LifecycleManager(this.logger);
    this.periodicCollaborators = createBotInitializerPeriodicCollaborators(services);
    registerBotInitializerLifecycleServices(this.lifecycleManager, this.lifecycleCollaborators);
  }

  /**
   * Bootstrap runtime lifecycle in startup order.
   * Allows caller to inject steps that must run after sockets connect
   * and before monitoring tasks begin.
   */
  async bootstrap(hooks: {
    beforeMonitoring?: () => void | Promise<void>;
    afterStart?: () => void | Promise<void>;
  } = {}): Promise<void> {
    await this.initialize();
    this.logDataSubscriptionStatus();
    await this.connectWebSockets();
    if (hooks.beforeMonitoring) {
      await hooks.beforeMonitoring();
    }
    await this.startMonitoring();
    if (hooks.afterStart) {
      await hooks.afterStart();
    }
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
          this.lifecycleManager.startService(
            BOT_INITIALIZER_LIFECYCLE_IDS.privateWebSocket,
            { throwOnError: true },
          ),
      );

      // Connect Public WebSocket with retry
      this.logger.info('Connecting Public WebSocket...');
      await this.connectWithRetry(
        'Public WebSocket',
        () =>
          this.lifecycleManager.startService(
            BOT_INITIALIZER_LIFECYCLE_IDS.publicWebSocket,
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
      await runBotInitializerRetryOperation(connectFn, {
        classifyError: classifyBotInitializerError,
        config: this.WEBSOCKET_RETRY_CONFIG,
        context: { wsName },
        logger: this.logger,
        operation: `connectWebSocket(${wsName})`,
        retryLabel: `${wsName} connection`,
      });
      return;
    }

    await connectFn();
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
      await new Promise(resolve => setTimeout(resolve, TREND_ANALYSIS_WARMUP_DELAY_MS));
      this.logger.debug('Starting TradingOrchestrator trend analysis after WebSocket warm-up');

      if (this.collaborators.execution.tradingOrchestrator) {
        this.logger.info(`${ICONS.success} TradingOrchestrator found, calling initializeTrendAnalysis()...`);
        await this.collaborators.execution.tradingOrchestrator.initializeTrendAnalysis();
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
      await this.lifecycleManager.startService(
        BOT_INITIALIZER_LIFECYCLE_IDS.positionMonitor,
        { throwOnError: true },
      );
      this.logger.debug('Position monitor started');
    };

    if (this.errorHandler) {
      await runBotInitializerRetryOperation(performStart, {
        classifyError: classifyBotInitializerError,
        config: this.MONITOR_START_RETRY_CONFIG,
        logger: this.logger,
        operation: 'startPositionMonitor',
        retryLabel: 'position monitor start',
      });
      return;
    }

    await performStart();
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
      const openPositions = await this.collaborators.exchangeRuntime.current.getOpenPositions();
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
      this.collaborators.execution.positionManager.syncWithWebSocket(exchangePosition);

      const restoredPosition = this.collaborators.execution.positionManager.getCurrentPosition();
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
  async shutdown(hooks: {
    beforeShutdown?: () => void | Promise<void>;
    afterShutdown?: () => void | Promise<void>;
  } = {}): Promise<void> {
    try {
      this.logger.info(`${ICONS.warning} Starting graceful shutdown...`);

      if (hooks.beforeShutdown) {
        await hooks.beforeShutdown();
      }

      const cleanupTargets = getBotInitializerListenerCleanupTargets(this.lifecycleCollaborators);

      if (this.errorHandler) {
        const shutdownSteps: BotInitializerShutdownStep[] = [
          {
            name: 'stop periodic tasks',
            run: () => {
              this.stopPeriodicTasks();
            },
          },
          {
            name: 'stop lifecycle services',
            run: () => this.lifecycleManager.stopAll(),
          },
          ...cleanupTargets.map((cleanupTarget) => ({
            name: `remove ${cleanupTarget.label.toLowerCase()} listeners`,
            run: () => {
              cleanupTarget.target.removeAllListeners();
              this.logger.debug(`${cleanupTarget.label} listeners removed`);
            },
          })),
          {
            name: 'end session statistics',
            run: () => {
              this.collaborators.sessionStats.endSession();
              this.logger.info(`${ICONS.chart} Session ended`);
            },
          },
          {
            name: 'send Telegram notification',
            run: async () => {
              await this.collaborators.core.telegram.notifyBotStopped();
            },
          },
        ];

        await runBotInitializerShutdownSteps(this.logger, shutdownSteps);
      } else {
        // Without ErrorHandler: original behavior (throws on errors)
        // Stop periodic tasks
        this.stopPeriodicTasks();

        // Stop lifecycle-managed services
        await this.lifecycleManager.stopAll({ throwOnError: true });

        await cleanupListenerTargets(cleanupTargets, (cleanupTarget) => {
          this.logger.debug(`${cleanupTarget.label} listeners removed`);
        });

        // End session statistics tracking
        this.collaborators.sessionStats.endSession();
        this.logger.info(`${ICONS.chart} Session ended`);

        // Send Telegram notification
        await this.collaborators.core.telegram.notifyBotStopped();
      }

      if (hooks.afterShutdown) {
        await hooks.afterShutdown();
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
      const exchange = this.collaborators.exchangeRuntime.current;

      // If using factory-created exchange (non-Bybit), create it asynchronously
      const exchangeFactory = this.collaborators.exchangeFactory;
      if (exchangeFactory && exchangeName !== 'bybit') {
        this.logger.info(`Creating ${exchangeName} exchange via factory...`);
        const runtimeExchange = await exchangeFactory.createExchange();
        this.collaborators.exchangeRuntime.setCurrent(runtimeExchange);
        this.logger.info(`${ICONS.success} ${exchangeName} exchange created and initialized`);
      } else if (exchange.initialize) {
        // Traditional Bybit initialization
        await exchange.initialize();
        this.logger.debug(`${ICONS.success} Bybit service initialized`);
      } else {
        this.logger.debug(`${ICONS.success} Exchange service initialized`);
      }
    };

    if (this.errorHandler) {
      await runBotInitializerRetryOperation(performInit, {
        classifyError: classifyBotInitializerError,
        config: this.BYBIT_INIT_RETRY_CONFIG,
        context: { exchangeName },
        logger: this.logger,
        operation: 'initializeBybit',
        retryLabel: 'Bybit init',
      });
      return;
    }

    await performInit();
  }

  /**
   * Private: Start session statistics with graceful degradation
   */
  private async startSessionStats(): Promise<void> {
    this.logger.info('Starting session statistics...');

    const performStats = async () => {
      this.collaborators.journal.start();
      this.collaborators.sessionStats.start();
      const sessionId = this.collaborators.sessionStats.startSession(
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
      await this.collaborators.core.timeService.syncWithExchange();

      const syncInfo = this.collaborators.core.timeService.getSyncInfo();
      this.logger.info('Time synchronized', {
        offset: syncInfo.offset,
        nextSyncIn: `${Math.round(syncInfo.nextSyncIn / TIME_MULTIPLIERS.MILLISECONDS_PER_SECOND)}s`,
      });
    };

    if (this.errorHandler) {
      await runBotInitializerRetryOperation(performSync, {
        classifyError: classifyBotInitializerError,
        config: this.TIME_SYNC_RETRY_CONFIG,
        logger: this.logger,
        operation: 'syncTimeWithExchange',
        retryLabel: 'time sync',
      });
      return;
    }

    await performSync();
  }

  /**
   * Private: Initialize candle provider cache with retry
   */
  private async initializeCandleProvider(): Promise<void> {
    this.logger.info('Initializing candle cache for all enabled timeframes...');

    const performInit = async () => {
      await this.collaborators.marketData.candleProvider.initialize();
      this.logger.debug(`${ICONS.success} Candle cache initialized (async preload disabled)`);
    };

    if (this.errorHandler) {
      await runBotInitializerRetryOperation(performInit, {
        classifyError: classifyBotInitializerError,
        config: this.CANDLE_PROVIDER_RETRY_CONFIG,
        logger: this.logger,
        operation: 'initializeCandleProvider',
        retryLabel: 'candle provider init',
      });
      return;
    }

    await performInit();
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
    const result = await runBotInitializerPeriodicCycle(this.periodicCollaborators);
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

      const btcCandles = await this.collaborators.exchangeRuntime.current.getCandles({
        symbol: btcConfig.symbol,
        timeframe: btcConfig.timeframe,
        limit: btcConfig.lookbackCandles || 100,
      });

      this.collaborators.btcMarketState.btcCandles1m = btcCandles;

      this.logger.info(`${ICONS.success} BTC candles loaded successfully`, {
        count: btcCandles.length,
        latestTimestamp: btcCandles.length > 0 ? new Date(btcCandles[btcCandles.length - 1].timestamp).toISOString() : 'N/A',
      });
    } catch (error) {
      this.logger.error('Failed to load BTC candles', { error: getErrorMessage(error) });
      // Don't throw - allow bot to continue without BTC confirmation
      this.collaborators.btcMarketState.btcCandles1m = [];
    }
  }

  private async startMonitoringServices(): Promise<void> {
    if (!hasBotInitializerLifecycleStageServices(this.lifecycleCollaborators, 'monitoring')) {
      return;
    }
    await this.lifecycleManager.startStage('monitoring');
  }

  private async startResilienceServices(): Promise<void> {
    if (!hasBotInitializerLifecycleStageServices(this.lifecycleCollaborators, 'resilience')) {
      return;
    }
    await this.lifecycleManager.startStage('resilience');
  }

  private async startExecutionServices(): Promise<void> {
    await this.lifecycleManager.startStage('execution', { throwOnError: true });
  }

  /**
   * Start MonitoringServer if configured (non-blocking)
   */
  private startMonitoringServer(): void {
    const monitoringServer = getBotInitializerMonitoringServer(this.lifecycleCollaborators);
    if (!monitoringServer) {
      return;
    }

    void this.lifecycleManager.startService(BOT_INITIALIZER_LIFECYCLE_IDS.monitoringServer);
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
