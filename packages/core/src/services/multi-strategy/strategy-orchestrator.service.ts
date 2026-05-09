/**
 * STRATEGY ORCHESTRATOR SERVICE
 *
 * Main orchestration service for multi-strategy support.
 * Coordinates between multiple strategies, manages switching, routes events.
 *
 * Responsibilities:
 * 1. Load/unload strategies
 * 2. Switch active strategy
 * 3. Route candle data to active strategy
 * 4. Broadcast events across strategies
 * 5. Aggregate system-wide metrics
 *
 * Design Pattern: Facade + Orchestrator
 * Usage: Injected into TradingOrchestrator
 */

import type {
  StrategyMetadata,
  IsolatedStrategyContext,
  MultiStrategySystemStats,
  MultiStrategyStats,
} from '../../types/legacy';
import { TimeframeRole, Candle, LoggerService } from '../../types/legacy';
import { BotEventBus } from './../../services/event-bus';
import { StrategyRegistryService } from './strategy-registry.service';
import { StrategyFactoryService } from './strategy-factory.service';
import { StrategyStateManagerService } from './strategy-state-manager.service';

// Dependencies used to create per-strategy TradingOrchestrator instances.
import { TradingOrchestrator } from '../trading-orchestrator.service';
import { PositionExitingService } from '../position-exiting.service';
import { RiskManager } from '../risk-manager.service';
import { TelegramService } from '../telegram.service';
import { StrategyOrchestratorCacheService } from './strategy-orchestrator-cache.service';
import { CandleProvider } from '../../providers/candle.provider';
import { TimeframeProvider } from '../../providers/timeframe.provider';
import { PositionLifecycleService } from '../position-lifecycle.service';
import { getErrorMessage } from '../../utils/error.utils';
import {
  buildStrategyMetadata,
  buildStrategyStats,
  buildSystemStatsBase,
  getConfigVersion,
} from './strategy-orchestrator-state.utils';
import { ICONS } from '../../cli/cli-runtime';

export class StrategyOrchestratorService {
  private activeContext: IsolatedStrategyContext | null = null;
  private contextMap = new Map<string, IsolatedStrategyContext>();

  // Keeps one orchestrator instance per loaded strategy.
  private orchestratorCache: StrategyOrchestratorCacheService<TradingOrchestrator>;

  // Shared infrastructure reused by every strategy-specific orchestrator.
  private sharedServices: {
    candleProvider: CandleProvider;
    timeframeProvider: TimeframeProvider;
    positionManager: PositionLifecycleService;
    riskManager: RiskManager;
    telegram: TelegramService | null;
    positionExitingService: PositionExitingService;
  } | null = null;



  constructor(
    private registry: StrategyRegistryService,
    private factory: StrategyFactoryService,
    private stateManager: StrategyStateManagerService,
    private logger: LoggerService,
    private eventBus: BotEventBus,
  ) {
    this.orchestratorCache = new StrategyOrchestratorCacheService<TradingOrchestrator>(this.logger);
  }

  private log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger[level](message, meta);
    } else {
      const prefix = '[StrategyOrchestratorService]';
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      if (level === 'warn') console.warn(`${prefix} ${message}${metaStr}`);
      else if (level === 'error') console.error(`${prefix} ${message}${metaStr}`);
      else console.log(`${prefix} ${message}${metaStr}`);
    }
  }


  /**
   * Load initial strategy at startup
   *
   * @param strategyName Name of strategy to load
   * @returns Strategy context
   */
  async loadStrategy(strategyName: string): Promise<IsolatedStrategyContext> {
    this.log('info', `[StrategyOrchestrator] Loading strategy: ${strategyName}`);

    const context = await this.factory.createContext(strategyName, 'default');

    this.contextMap.set(context.strategyId, context);
    this.activeContext = context;
    context.isActive = true;

    // Register in registry
    const metadata: StrategyMetadata = buildStrategyMetadata(context, true);
    this.registry.registerStrategy(context.strategyId, metadata);

    this.log('info', `[StrategyOrchestrator] ${ICONS.success} Loaded strategy: ${strategyName} (${context.strategyId})`);

    return context;
  }

  /**
   * Add additional strategy (hot load)
   *
   * Can run multiple strategies without restart.
   */
  async addStrategy(
    strategyName: string,
    symbol?: string,
  ): Promise<string> {
    this.log('info', `[StrategyOrchestrator] Adding strategy: ${strategyName}`);

    const context = await this.factory.createContext(
      strategyName,
      symbol || 'default',
      { restorePreviousState: true, validate: false },
    );

    this.contextMap.set(context.strategyId, context);

    // Register in registry
    const metadata: StrategyMetadata = buildStrategyMetadata(context, false);
    this.registry.registerStrategy(context.strategyId, metadata);

    this.log('info', `[StrategyOrchestrator] ${ICONS.success} Added strategy: ${strategyName} (${context.strategyId})`);

    return context.strategyId;
  }

  /**
   * Remove strategy (unload)
   *
   * Closes positions and saves state.
   */
  async removeStrategy(strategyId: string): Promise<void> {
    this.log('info', `[StrategyOrchestrator] Removing strategy: ${strategyId}`);

    const context = this.contextMap.get(strategyId);
    if (!context) {
      throw new Error(
        `[StrategyOrchestrator] Strategy not found: ${strategyId}`,
      );
    }

    // Unload if active
    if (this.activeContext?.strategyId === strategyId) {
      this.activeContext = null;
    }

    // Cleanup
    await this.factory.destroyContext(strategyId, {
      saveFinalState: true,
      closePositions: true,
      persistMetrics: true,
      shutdownTimeout: 5000,
    });

    // Unregister from registry
    this.registry.unregisterStrategy(strategyId);

    // Remove from context map
    this.contextMap.delete(strategyId);

    // Remove any cached orchestrator for the unloaded strategy.
    this.orchestratorCache.removeOrchestrator(strategyId);

    this.log('info', `[StrategyOrchestrator] ${ICONS.success} Removed strategy: ${strategyId}`);
  }

  /**
   * Switch active trading strategy
   *
   * @param strategyId ID of strategy to activate
   */
  async switchTradingStrategy(strategyId: string): Promise<void> {
    this.log('info', `[StrategyOrchestrator] Switching to strategy: ${strategyId}`);

    const targetContext = this.contextMap.get(strategyId);
    if (!targetContext) {
      throw new Error(
        `[StrategyOrchestrator] Strategy not found: ${strategyId}`,
      );
    }

    const result = await this.stateManager.switchStrategy(
      this.activeContext,
      targetContext,
    );

    if (!result.success) {
      throw new Error(
        `[StrategyOrchestrator] Switch failed: ${result.error}`,
      );
    }

    this.activeContext = targetContext;

    // Update registry
    this.registry.setActive(strategyId, true);

    this.log('info', `[StrategyOrchestrator] ${ICONS.success} Switched to strategy: ${strategyId}`);
  }

  /**
   * Get active strategy context
   */
  getActiveContext(): IsolatedStrategyContext | null {
    return this.activeContext;
  }

  /**
   * Get strategy context by ID
   */
  getContext(strategyId: string): IsolatedStrategyContext | null {
    return this.contextMap.get(strategyId) || null;
  }

  /**
   * List all loaded strategies
   */
  listStrategies(): IsolatedStrategyContext[] {
    return Array.from(this.contextMap.values());
  }

  /**
   * Get strategy stats
   */
  getStrategyStats(strategyId: string): MultiStrategyStats | null {
    const context = this.contextMap.get(strategyId);
    if (!context) return null;

    const metadata = this.registry.getStrategy(strategyId);

    return buildStrategyStats(strategyId, context, metadata);
  }

  /**
   * Get overall system stats
   */
  getOverallStats(): MultiStrategySystemStats {
    const strategies = this.listStrategies();
    const stats: MultiStrategySystemStats = buildSystemStatsBase(
      strategies,
      this.activeContext,
    );

    for (const context of strategies) {
      const stratStats = this.getStrategyStats(context.strategyId);
      if (stratStats) {
        stats.strategiesByPnL.push(stratStats);
        stats.totalTrades += stratStats.totalTrades;
        stats.combinedPnL += stratStats.totalPnL;
      }
    }

    return stats;
  }

  /**
   * Handle candle for active strategy
   *
   * Routes market data only to the active strategy orchestrator.
   *
   * @param role Timeframe role (PRIMARY, ENTRY, TREND, CONTEXT)
   * @param candle OHLCV candle data
   */
  async onCandleClosed(role: TimeframeRole, candle: Candle): Promise<void> {
    if (!this.activeContext) {
      this.logger.debug('No active strategy context; skipping candle routing');
      return;
    }

    try {
      this.activeContext.lastCandleTime = new Date(candle.timestamp);

      // Get or create TradingOrchestrator instance for this strategy
      const orchestrator = await this.getOrCreateStrategyOrchestrator(this.activeContext);
      if (!orchestrator) {
        this.logger.warn('Failed to get strategy orchestrator for active context', {
          strategyId: this.activeContext.strategyId,
        });
        return;
      }

      // Route candle to active strategy's orchestrator only
      // Other strategies remain dormant and do not receive candle events
      await orchestrator.onCandleClosed(role, candle);

      // Emit event for monitoring
      this.eventBus.publishSync({
        type: 'candleRoutedToStrategy',
        timestamp: Date.now(),
        data: {
          strategyId: this.activeContext.strategyId,
          role,
          timestamp: candle.timestamp,
        },
        strategyId: this.activeContext.strategyId,
      });
    } catch (error) {
      this.logger.error('Error routing candle to active strategy context', {
        strategyId: this.activeContext?.strategyId,
        error: getErrorMessage(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Get or create TradingOrchestrator instance for a strategy
   *
   * Creates an isolated orchestrator per strategy using shared services.
   * With strategy-specific configuration (composition-based design)
   *
   * @param context Strategy context with isolated configuration
   * @returns Promise<TradingOrchestrator | null> Orchestrator instance or null if creation fails
   */
  private async getOrCreateStrategyOrchestrator(context: IsolatedStrategyContext): Promise<TradingOrchestrator | null> {
    // STEP 1: Check cache first (strategy-scoped instance)
    const cached = this.orchestratorCache.getOrchestrator(context.strategyId);
    if (cached) {
      this.logger.debug('Reusing cached strategy orchestrator', {
        strategyId: context.strategyId,
      });
      return cached;
    }

    try {
      // STEP 2: Validate shared services are available
      if (!this.sharedServices) {
        this.logger.error('Shared services are not initialized for strategy orchestrator creation', {
          strategyId: context.strategyId,
        });
        return null;
      }

      // STEP 3: Create TradingOrchestrator with strategy-specific config.
      // Reuses shared infrastructure (positionManager, riskManager, etc.)
      // but with strategy-specific config for indicators, analyzers, and orchestration params.
      const orchestrator = new TradingOrchestrator(
        context.config as unknown as ConstructorParameters<typeof TradingOrchestrator>[0],
        this.sharedServices.candleProvider,
        this.sharedServices.timeframeProvider,
        context.exchange,
        this.sharedServices.positionManager,
        this.sharedServices.telegram,
        this.logger,
        this.sharedServices.riskManager,
        this.sharedServices.positionExitingService,
      );

      // STEP 4: Cache the orchestrator.
      this.orchestratorCache.cacheOrchestrator(context.strategyId, orchestrator);

      // STEP 5: Wire event handlers with strategy-aware logging.
      this.wireEventHandlers(orchestrator, context.strategyId);

      this.logger.info(`${ICONS.success} Created strategy trading orchestrator`, {
        strategyId: context.strategyId,
        symbol: context.symbol,
        configVersion: getConfigVersion(context.config),
      });

      return orchestrator;
    } catch (error) {
      this.logger.error('Failed to create strategy trading orchestrator', {
        strategyId: context.strategyId,
        error: getErrorMessage(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Wire strategy-aware event handlers around the underlying orchestrator.
   */
  private wireEventHandlers(orchestrator: TradingOrchestrator, strategyId: string): void {
    // Hook point for future event tagging once TradingOrchestrator exposes listeners.
    // This would wrap orchestrator event emissions to add strategyId to BotEventBus events
    void orchestrator;
    this.logger.debug('Wired strategy orchestrator event handlers', { strategyId });
  }

  /**
   * Broadcast event to all strategies
   *
   * For system-wide events that should notify all strategies.
   */
  async broadcastEvent(event: unknown): Promise<void> {
    this.log('info', `[StrategyOrchestrator] Broadcasting event to ${this.contextMap.size} strategies`);

    const promises = Array.from(this.contextMap.values()).map(
      async (context) => {
        try {
          // Each strategy would handle the event
          // Actual implementation would use EventBus
        } catch (error) {
          this.log('warn', `[StrategyOrchestrator] Event handling failed for ${context.strategyId}: ${error}`);
        }
      }
    );

    await Promise.all(promises);
  }

  /**
   * Snapshot all strategies (for backup/recovery)
   */
  async snapshotAllStrategies(): Promise<void> {
    const contexts = this.listStrategies();
    await this.stateManager.snapshotAllStrategies(contexts);
  }

  /**
   * Get registry (for direct access if needed)
   */
  getRegistry(): StrategyRegistryService {
    return this.registry;
  }

  /**
   * Get factory (for direct access if needed)
   */
  getFactory(): StrategyFactoryService {
    return this.factory;
  }

  /**
   * Get state manager (for direct access if needed)
   */
  getStateManager(): StrategyStateManagerService {
    return this.stateManager;
  }

  /**
   * Set shared services for TradingOrchestrator creation
   * Called by services during initialization
   *
   * Inject shared infrastructure reused by all strategy orchestrators.
   */
  setSharedServices(sharedServices: {
    candleProvider: CandleProvider;
    timeframeProvider: TimeframeProvider;
    positionManager: PositionLifecycleService;
    riskManager: RiskManager;
    telegram: TelegramService | null;
    positionExitingService: PositionExitingService;
  }): void {
    this.sharedServices = sharedServices;
    this.logger.debug('Shared services initialized for strategy orchestrator creation');
  }

  /**
   * Get orchestrator cache statistics
   *
   * Expose cache stats for monitoring and tests.
   */
  getCacheStats(): ReturnType<StrategyOrchestratorCacheService['getStats']> {
    return this.orchestratorCache.getStats();
  }
}

