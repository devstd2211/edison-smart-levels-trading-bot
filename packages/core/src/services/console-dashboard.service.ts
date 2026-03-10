/**
 * Console Dashboard Service - Non-Blocking Edition
 * Real-time trading dashboard using blessed
 * Uses non-blocking render queue to prevent freezing
 *
 * KEY FIXES:
 * - No blocking screen.render() calls in main thread
 * - Queue-based updates to prevent log freezing
 * - Separate render thread via setImmediate
 * - Real-time indicator data + P&L tracking
 *
 * Error Handling Strategy (Phase 8.9.72):
 * - THROW: Config validation (enabled, updateInterval, theme)
 * - THROW: Input validation (metrics, price, TP, SL, events)
 * - GRACEFUL_DEGRADE: State update failures, blessed screen operations
 * - SKIP: Logging failures never block execution
 */

import blessed, { Widgets } from 'blessed';
import { EventEmitter } from 'events';
import { Position } from '../types/legacy';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import type { ILifecycle } from '../interfaces/ILifecycle';
import {
  formatDashboardDuration,
  formatDashboardPercent,
  formatDashboardPnL,
  getDashboardEventTypeColor,
  getDashboardRsiColor,
  getDashboardTrendColor,
  getDashboardWinRateColor,
  renderDashboardProgressBar,
} from './console-dashboard/console-dashboard-format.utils';
import {
  appendDashboardEventWithLimit,
  buildDashboardTakeProfitLevels,
  createInitialDashboardState,
  type DashboardEvent,
  type DashboardMetricSnapshot,
} from './console-dashboard/console-dashboard-state.utils';

interface DashboardConfig {
  enabled: boolean;
  updateInterval?: number; // ms between refreshes (1000 = 1 sec)
  theme?: 'dark' | 'light';
}

interface TimeframeMetrics extends DashboardMetricSnapshot {}

type DashboardLogMeta = string | Record<string, unknown>;

interface DashboardState {
  // Market data by timeframe
  metrics: Map<string, TimeframeMetrics>;

  // Current price & updates
  currentPrice: number;
  priceUpdatedAt: number;

  // Position info
  position?: Position;
  entryPrice?: number;
  currentPnL?: number;
  currentPnLPercent?: number;

  // Protection levels
  tpLevels: Array<{ price: number; percent: number; level: number; reached?: boolean }>;
  slLevel?: number;

  // Trading stats
  dailyWins: number;
  dailyLosses: number;
  dailyPnL: number;

  // Events log
  events: DashboardEvent[];

  // UI state
  lastUpdate: Date;
}

export class ConsoleDashboardService extends EventEmitter implements ILifecycle {
  private screen?: Widgets.Screen;
  private config: DashboardConfig;
  private state: DashboardState;
  private widgets: Map<string, Widgets.BoxElement> = new Map();
  private updateIntervalId?: NodeJS.Timeout;
  private started = false;

  // Non-blocking render control
  private renderScheduled = false;

  constructor(
    config: DashboardConfig = { enabled: true },
    private errorHandler?: ErrorHandler
  ) {
    super();
    // THROW: Config validation
    this.validateConfig(config);
    this.config = { ...config };
    this.state = createInitialDashboardState();

  }

  /**
   * Validate configuration values
   * @throws On invalid config
   */
  private validateConfig(config: DashboardConfig): void {
    if (!config || typeof config !== 'object') {
      this.throwValidationError('Config must be a valid object');
    }

    if (typeof config.enabled !== 'boolean') {
      this.throwValidationError('Config.enabled must be a boolean');
    }

    if (config.updateInterval !== undefined) {
      if (typeof config.updateInterval !== 'number' || !Number.isFinite(config.updateInterval)) {
        this.throwValidationError('Config.updateInterval must be a finite number');
      }

      if (config.updateInterval < 0) {
        this.throwValidationError('Config.updateInterval must be non-negative');
      }
    }

    if (config.theme !== undefined) {
      if (!['dark', 'light'].includes(config.theme)) {
        this.throwValidationError('Config.theme must be "dark" or "light"');
      }
    }
  }

  private throwValidationError(message: string): never {
    const error = new Error(message);
    if (this.errorHandler) {
      this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
    }
    throw error;
  }

  /**
   * Initialize dashboard with blessed screen
   */
  private initialize(): void {
    try {
      this.screen = blessed.screen({
        mouse: false,
        keyboard: true,
        smartCSR: true,
        title: 'Edison Trading Bot - Live Dashboard',
        dockBorders: true,
      });

      // Exit on Ctrl+C
      this.screen.key(['C-c'], () => {
        this.destroy();
        process.exit(0);
      });

      this.createLayout();

      // Start non-blocking update loop
      this.startNonBlockingUpdates();

      this.safeLog('[DASHBOARD] ✅ Initialized (non-blocking mode)');
    } catch (error) {
      this.safeWarn('[DASHBOARD] Initialization failed:', this.toLogMeta(error));
      this.config.enabled = false;
      // GRACEFUL_DEGRADE: Dashboard init failure
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Start dashboard (lifecycle)
   */
  start(): void {
    if (!this.config.enabled || this.started) {
      return;
    }

    this.started = true;
    try {
      this.initialize();
    } catch (error) {
      this.safeWarn('[DASHBOARD] Failed to initialize:', error instanceof Error ? error.message : String(error));
      this.config.enabled = false;
      this.started = false;
    }
  }

  /**
   * Create dashboard layout
   */
  private createLayout(): void {
    if (!this.screen) return;

    // Header (top)
    this.createHeader();

    // Market data (top-left 1/3)
    this.createMarketMetrics();

    // Position & P&L (top-right 2/3)
    this.createPositionStats();

    // Daily stats (middle)
    this.createDailyStats();

    // Indicators (bottom-left)
    this.createIndicators();

    // Recent updates (bottom-right)
    this.createRecentUpdates();

    this.screen.render();
  }

  private createHeader(): void {
    if (!this.screen) return;

    blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      content: '{bold}{cyan-fg}EDISON TRADING BOT DASHBOARD{/cyan-fg}{/bold}',
      style: {
        fg: 'white',
        bg: 'darkblue',
      },
      tags: true,
    });
  }

  private createMarketMetrics(): void {
    if (!this.screen) return;

    const widget = blessed.box({
      parent: this.screen,
      top: 1,
      left: 0,
      width: '33%',
      height: '25%',
      border: 'line',
      title: '📈 Market Metrics',
      style: {
        border: { fg: 'cyan' },
      },
      tags: true,
      scrollable: false,
    });

    this.widgets.set('metrics', widget);
  }

  private createPositionStats(): void {
    if (!this.screen) return;

    const widget = blessed.box({
      parent: this.screen,
      top: 1,
      left: '33%',
      right: 0,
      height: '25%',
      border: 'line',
      title: '💼 Position & P&L',
      style: {
        border: { fg: 'green' },
      },
      tags: true,
      scrollable: false,
    });

    this.widgets.set('position', widget);
  }

  private createDailyStats(): void {
    if (!this.screen) return;

    const widget = blessed.box({
      parent: this.screen,
      top: '26%',
      left: 0,
      right: 0,
      height: '12%',
      border: 'line',
      title: '📊 Daily Stats',
      style: {
        border: { fg: 'yellow' },
      },
      tags: true,
      scrollable: false,
    });

    this.widgets.set('stats', widget);
  }

  private createIndicators(): void {
    if (!this.screen) return;

    const widget = blessed.box({
      parent: this.screen,
      top: '38%',
      left: 0,
      width: '50%',
      bottom: 0,
      border: 'line',
      title: '🔍 Indicators (1m/5m/15m)',
      style: {
        border: { fg: 'magenta' },
      },
      tags: true,
      scrollable: true,
      mouse: true,
    });

    this.widgets.set('indicators', widget);
  }

  private createRecentUpdates(): void {
    if (!this.screen) return;

    const widget = blessed.box({
      parent: this.screen,
      top: '38%',
      left: '50%',
      right: 0,
      bottom: 0,
      border: 'line',
      title: '⏱️ Recent Updates',
      style: {
        border: { fg: 'white' },
      },
      tags: true,
      scrollable: true,
      mouse: true,
    });

    this.widgets.set('updates', widget);
  }

  /**
   * Non-blocking update loop using setImmediate
   * Prevents blocking main trading thread
   */
  private startNonBlockingUpdates(): void {
    const updateLoop = () => {
      // Queue render for next event loop
      if (!this.renderScheduled) {
        this.renderScheduled = true;
        setImmediate(() => {
          try {
            this.render();
          } catch (error) {
            // Silently fail - dashboard errors don't crash bot
          } finally {
            this.renderScheduled = false;
          }
        });
      }
    };

    // Start loop
    const interval = this.config.updateInterval || 1000;
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
    }
    this.updateIntervalId = setInterval(updateLoop, interval);
  }

  /**
   * Render dashboard
   */
  private render(): void {
    if (!this.screen) return;

    try {
      this.renderMetrics();
      this.renderPosition();
      this.renderDailyStats();
      this.renderIndicators();
      this.renderRecentUpdates();

      this.screen.render();
    } catch (error) {
      // Ignore render errors - they shouldn't crash the bot
    }
  }

  /**
   * Format P&L with color (green=profit, red=loss)
   */
  private formatPnL(value: number): string {
    return formatDashboardPnL(value);
  }

  /**
   * Format percentage with color
   */
  private formatPercent(value: number): string {
    return formatDashboardPercent(value);
  }

  /**
   * Render ASCII progress bar
   */
  private renderProgressBar(current: number, target: number, width: number = 20): string {
    return renderDashboardProgressBar(current, target, width);
  }

  /**
   * Format duration (seconds to human-readable)
   */
  private formatDuration(seconds: number): string {
    return formatDashboardDuration(seconds);
  }

  private renderMetrics(): void {
    const widget = this.widgets.get('metrics');
    if (!widget || !this.screen) return;

    let content = '';
    if (this.state.currentPrice > 0) {
      content += `{bold}Current Price:{/bold} $${this.state.currentPrice.toFixed(4)}\n`;
      const age = this.state.priceUpdatedAt > 0
        ? Math.floor((Date.now() - this.state.priceUpdatedAt) / 1000)
        : 0;
      content += `{gray-fg}Updated: ${age}s ago{/}\n\n`;
    }

    if (this.state.metrics.size > 0) {
      for (const [tf, metrics] of this.state.metrics) {
        const trendColor = getDashboardTrendColor(metrics.trend);
        content += `{bold}${tf}:{/bold} ${trendColor}${metrics.trend}{/}\n`;
        content += `  RSI: ${metrics.rsi.toFixed(1)}`;
        if (metrics.ema20) content += ` | EMA20: ${metrics.ema20.toFixed(2)}`;
        if (metrics.atr) content += ` | ATR: ${metrics.atr.toFixed(4)}`;
        content += '\n';
      }
    } else {
      content += '{gray-fg}Waiting for market data...{/}';
    }

    widget.setContent(content);
  }

  private renderPosition(): void {
    const widget = this.widgets.get('position');
    if (!widget || !this.screen) return;

    if (!this.state.position) {
      widget.setContent('{gray-fg}No active position{/}');
      return;
    }

    const { position, entryPrice, currentPnL, currentPnLPercent } = this.state;
    const sideColor = position.side === 'LONG' ? '{green-fg}' : '{red-fg}';

    let content = `{bold}Position:{/bold} ${sideColor}${position.side}{/}\n`;
    content += `{bold}Entry:{/bold} $${entryPrice?.toFixed(4) || 'N/A'}\n`;
    content += `{bold}Current:{/bold} $${this.state.currentPrice.toFixed(4)}\n`;

    // P&L with color
    if (currentPnL !== undefined && currentPnLPercent !== undefined) {
      content += `{bold}P&L:{/bold} ${this.formatPnL(currentPnL)} (${this.formatPercent(currentPnLPercent)})\n`;
    }

    // Time in position
    if (position.openedAt) {
      const duration = Math.floor((Date.now() - position.openedAt) / 1000);
      content += `{bold}Time:{/bold} ${this.formatDuration(duration)}\n`;
    }

    // TP Levels with progress bars
    if (this.state.tpLevels.length > 0) {
      content += '\n{bold}Take Profit Levels:{/bold}\n';
      for (const tp of this.state.tpLevels) {
        const reachedIcon = tp.reached ? '{green-fg}✓{/}' : ' ';
        const distance = entryPrice && tp.price > 0
          ? ((tp.price - this.state.currentPrice) / entryPrice * 100)
          : 0;
        const progress = entryPrice && tp.price > 0
          ? ((this.state.currentPrice - entryPrice) / (tp.price - entryPrice) * 100)
          : 0;

        content += `${reachedIcon} TP${tp.level}: $${tp.price.toFixed(4)} (${tp.percent.toFixed(1)}%)`;
        if (!tp.reached && distance !== 0) {
          content += ` ${this.formatPercent(distance)} away`;
        }
        content += '\n';

        // Progress bar
        if (!tp.reached && progress > 0) {
          content += `  ${this.renderProgressBar(progress, 100, 15)}\n`;
        }
      }
    }

    // Stop Loss
    if (this.state.slLevel) {
      const distance = entryPrice
        ? ((this.state.slLevel - this.state.currentPrice) / entryPrice * 100)
        : 0;
      content += `\n{bold}Stop Loss:{/bold} {red-fg}$${this.state.slLevel.toFixed(4)}{/}`;
      if (distance !== 0) {
        content += ` (${this.formatPercent(distance)} away)`;
      }
    }

    widget.setContent(content);
  }

  private renderDailyStats(): void {
    const widget = this.widgets.get('stats');
    if (!widget || !this.screen) return;

    const { dailyWins, dailyLosses, dailyPnL } = this.state;
    const totalTrades = dailyWins + dailyLosses;
    const winRate = totalTrades > 0 ? (dailyWins / totalTrades) * 100 : 0;
    const avgPnL = totalTrades > 0 ? dailyPnL / totalTrades : 0;

    // Win rate color
    const wrColor = getDashboardWinRateColor(winRate);

    let content = '{bold}Daily Stats:{/bold}\n';
    content += `Trades: {bold}${totalTrades}{/bold} `;
    content += `(${'{green-fg}'}W:${dailyWins}{/} / ${'{red-fg}'}L:${dailyLosses}{/}) `;
    content += `| Win Rate: ${wrColor}${winRate.toFixed(1)}%{/}\n`;
    content += `P&L: ${this.formatPnL(dailyPnL)} `;
    if (totalTrades > 0) {
      content += `| Avg: ${this.formatPnL(avgPnL)}`;
    }

    widget.setContent(content);
  }

  private renderIndicators(): void {
    const widget = this.widgets.get('indicators');
    if (!widget || !this.screen) return;

    if (this.state.metrics.size === 0) {
      widget.setContent('{gray-fg}Waiting for indicator data...{/}');
      return;
    }

    let content = '';
    for (const [tf, metrics] of this.state.metrics) {
      const trendColor = getDashboardTrendColor(metrics.trend);

      content += `{bold}{cyan-fg}${tf.toUpperCase()}{/}{/bold}\n`;
      content += `  Trend: ${trendColor}${metrics.trend}{/}\n`;

      // RSI with color (overbought/oversold)
      const rsiColor = getDashboardRsiColor(metrics.rsi);
      content += `  RSI: ${rsiColor}${metrics.rsi.toFixed(1)}{/}`;

      // RSI bar
      const rsiBar = this.renderProgressBar(metrics.rsi, 100, 10);
      content += ` ${rsiBar}\n`;

      if (metrics.ema20) {
        content += `  EMA20: ${metrics.ema20.toFixed(4)}`;
        if (metrics.ema50) {
          const crossColor = metrics.ema20 > metrics.ema50 ? '{green-fg}' : '{red-fg}';
          const crossSymbol = metrics.ema20 > metrics.ema50 ? '>' : '<';
          content += ` ${crossColor}${crossSymbol}{/} EMA50: ${metrics.ema50.toFixed(4)}`;
        }
        content += '\n';
      }

      if (metrics.atr) {
        content += `  ATR: ${metrics.atr.toFixed(4)}`;
      }
      if (metrics.volume) {
        content += ` | Vol: ${(metrics.volume / 1000).toFixed(1)}K`;
      }
      content += '\n\n';
    }

    widget.setContent(content);
  }

  private renderRecentUpdates(): void {
    const widget = this.widgets.get('updates');
    if (!widget || !this.screen) return;

    if (this.state.events.length === 0) {
      widget.setContent('{gray-fg}No recent events{/}');
      return;
    }

    let content = '';
    const recentEvents = this.state.events.slice(-10);
    for (const event of recentEvents) {
      const time = event.timestamp.toLocaleTimeString();

      // Color by event type
      const typeColor = getDashboardEventTypeColor(event.type);

      content += `{gray-fg}[${time}]{/} ${typeColor}${event.type}{/}: ${event.message}\n`;
    }

    widget.setContent(content);
  }

  /**
   * Update metrics for a timeframe
   * @throws On invalid timeframe or data
   */
  public updateMetrics(timeframe: string, data: Partial<TimeframeMetrics>): void {
    // THROW: Input validation (outside try-catch to propagate)
    this.validateMetricsInput(timeframe, data);

    try {
      const existing = this.state.metrics.get(timeframe) || {
        timeframe,
        trend: 'NEUTRAL',
        rsi: 50,
      };

      this.state.metrics.set(timeframe, { ...existing, ...data });
      this.state.lastUpdate = new Date();
    } catch (error) {
      // GRACEFUL_DEGRADE: Metrics update failure
      this.safeLog(`Metrics update failed for ${timeframe}: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Update current price
   * @throws On invalid price
   */
  public updatePrice(price: number): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      this.throwValidationError('Price must be a finite number');
    }

    if (price < 0) {
      this.throwValidationError('Price must be non-negative');
    }

    try {
      this.state.currentPrice = price;
      this.state.priceUpdatedAt = Date.now();
    } catch (error) {
      // GRACEFUL_DEGRADE: State update failure
      this.safeLog(`Price state update failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Update position
   */
  public updatePosition(position: Position | undefined): void {
    try {
      if (position !== undefined && position !== null) {
        if (typeof position !== 'object') {
          throw new Error('Position must be an object or undefined');
        }

        if (typeof position.entryPrice !== 'number' || !Number.isFinite(position.entryPrice)) {
          throw new Error('Position.entryPrice must be a finite number');
        }
      }

      this.state.position = position;
      if (position) {
        this.state.entryPrice = position.entryPrice;
      }
    } catch (error) {
      // GRACEFUL_DEGRADE: Position update failure
      this.safeLog(`Position update failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Update P&L
   * @throws On invalid P&L values
   */
  public updatePnL(pnl: number, pnlPercent: number): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof pnl !== 'number' || !Number.isFinite(pnl)) {
      this.throwValidationError('PnL must be a finite number');
    }

    if (typeof pnlPercent !== 'number' || !Number.isFinite(pnlPercent)) {
      this.throwValidationError('PnL percent must be a finite number');
    }

    try {
      this.state.currentPnL = pnl;
      this.state.currentPnLPercent = pnlPercent;
    } catch (error) {
      // GRACEFUL_DEGRADE: State update failure
      this.safeLog(`PnL state update failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Set take profit levels
   * @throws On invalid levels
   */
  public setTakeProfits(levels: Array<{ price?: number; percent: number; level?: number }>): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (!Array.isArray(levels)) {
      const error = new Error('Levels must be an array');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (levels.length === 0) {
      const error = new Error('Levels array cannot be empty');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    // Validate each level
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      if (typeof level !== 'object') {
        const error = new Error(`Level ${i} must be an object`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (typeof level.percent !== 'number' || !Number.isFinite(level.percent)) {
        const error = new Error(`Level ${i} percent must be a finite number`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (level.percent < 0 || level.percent > 100) {
        const error = new Error(`Level ${i} percent must be between 0 and 100`);
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (level.price !== undefined) {
        if (typeof level.price !== 'number' || !Number.isFinite(level.price)) {
          const error = new Error(`Level ${i} price must be a finite number`);
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }

        if (level.price < 0) {
          const error = new Error(`Level ${i} price must be non-negative`);
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }
    }

    try {
      this.state.tpLevels = buildDashboardTakeProfitLevels(levels);
    } catch (error) {
      // GRACEFUL_DEGRADE: TP levels update failure
      this.safeLog(`Take profit update failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Set stop loss level
   * @throws On invalid stop loss
   */
  public setStopLoss(price: number): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof price !== 'number' || !Number.isFinite(price)) {
      this.throwValidationError('Stop loss price must be a finite number');
    }

    if (price < 0) {
      this.throwValidationError('Stop loss price must be non-negative');
    }

    try {
      this.state.slLevel = price;
    } catch (error) {
      // GRACEFUL_DEGRADE: Stop loss update failure
      this.safeLog(`Stop loss update failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Record a winning trade
   * @throws On invalid P&L value
   */
  public recordWin(pnl: number): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof pnl !== 'number' || !Number.isFinite(pnl)) {
      this.throwValidationError('PnL must be a finite number');
    }

    try {
      this.state.dailyWins++;
      this.state.dailyPnL += pnl;
    } catch (error) {
      // GRACEFUL_DEGRADE: Win record failure
      this.safeLog(`Win record failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Record a losing trade
   * @throws On invalid P&L value
   */
  public recordLoss(pnl: number): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof pnl !== 'number' || !Number.isFinite(pnl)) {
      this.throwValidationError('PnL must be a finite number');
    }

    try {
      this.state.dailyLosses++;
      this.state.dailyPnL += pnl;
    } catch (error) {
      // GRACEFUL_DEGRADE: Loss record failure
      this.safeLog(`Loss record failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Record a trading event
   * IMPORTANT: Max 50 events in memory to prevent memory leak
   *
   * @param type - Event type (position-open, position-close, tp-hit, sl-hit, etc)
   * @param message - Human-readable event description
   * @throws On invalid event data
   */
  public recordEvent(type: string, message: string): void {
    // THROW: Input validation (outside try-catch to propagate)
    if (typeof type !== 'string' || type.length === 0) {
      this.throwValidationError('Event type must be a non-empty string');
    }

    if (typeof message !== 'string' || message.length === 0) {
      this.throwValidationError('Event message must be a non-empty string');
    }

    try {
      appendDashboardEventWithLimit(this.state.events, {
        timestamp: new Date(),
        type,
        message,
      }, 50);
    } catch (error) {
      // GRACEFUL_DEGRADE: Event record failure
      this.safeLog(`Event record failed: ${error instanceof Error ? error.message : String(error)}`);
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
    }
  }

  /**
   * Validate metrics input
   * @throws On invalid input
   */
  private validateMetricsInput(timeframe: string, data: Partial<TimeframeMetrics>): void {
    if (typeof timeframe !== 'string' || timeframe.length === 0) {
      const error = new Error('Timeframe must be a non-empty string');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (data && typeof data === 'object') {
      if (data.rsi !== undefined) {
        if (typeof data.rsi !== 'number' || !Number.isFinite(data.rsi)) {
          const error = new Error('RSI must be a finite number');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }

        if (data.rsi < 0 || data.rsi > 100) {
          const error = new Error('RSI must be between 0 and 100');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }

      if (data.ema20 !== undefined) {
        if (typeof data.ema20 !== 'number' || !Number.isFinite(data.ema20)) {
          const error = new Error('EMA20 must be a finite number');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }

      if (data.ema50 !== undefined) {
        if (typeof data.ema50 !== 'number' || !Number.isFinite(data.ema50)) {
          const error = new Error('EMA50 must be a finite number');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }

      if (data.atr !== undefined) {
        if (typeof data.atr !== 'number' || !Number.isFinite(data.atr)) {
          const error = new Error('ATR must be a finite number');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }

        if (data.atr < 0) {
          const error = new Error('ATR must be non-negative');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }

      if (data.volume !== undefined) {
        if (typeof data.volume !== 'number' || !Number.isFinite(data.volume)) {
          const error = new Error('Volume must be a finite number');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }

        if (data.volume < 0) {
          const error = new Error('Volume must be non-negative');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }

      if (data.trend !== undefined) {
        if (!['UPTREND', 'DOWNTREND', 'NEUTRAL'].includes(data.trend)) {
          const error = new Error('Trend must be UPTREND, DOWNTREND, or NEUTRAL');
          if (this.errorHandler) {
            this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
          }
          throw error;
        }
      }
    }
  }

  /**
   * Safe log wrapper - failures never block execution
   * @param message - Log message
   * @param meta - Optional metadata
   */
  private toLogMeta(value: unknown): DashboardLogMeta {
    if (typeof value === 'string') {
      return value;
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
      };
    }

    if (typeof value === 'object' && value !== null) {
      return value as Record<string, unknown>;
    }

    return String(value);
  }

  private safeLog(message: string, meta?: DashboardLogMeta): void {
    try {
      console.log(`[DASHBOARD] ${message}`, meta || '');
    } catch (error) {
      // SKIP: Logging failures never block execution
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  /**
   * Safe warn wrapper - failures never block execution
   * @param message - Warn message
   * @param meta - Optional metadata
   */
  private safeWarn(message: string, meta?: DashboardLogMeta): void {
    try {
      console.warn(`[DASHBOARD] ${message}`, meta || '');
    } catch (error) {
      // SKIP: Logging failures never block execution
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.SKIP });
      }
    }
  }

  public destroy(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      this.updateIntervalId = undefined;
    }
    if (this.screen) {
      try {
        this.screen.destroy();
      } catch (error) {
        // GRACEFUL_DEGRADE: Destroy failures
        if (this.errorHandler) {
          this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
        }
      }
    }
    this.screen = undefined;
    this.started = false;
  }

  /**
   * Stop dashboard (lifecycle)
   */
  stop(): void {
    this.destroy();
  }
}

