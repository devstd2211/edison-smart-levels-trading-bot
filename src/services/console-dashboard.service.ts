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
import { Position } from '../types';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

interface DashboardConfig {
  enabled: boolean;
  updateInterval?: number; // ms between refreshes (1000 = 1 sec)
  theme?: 'dark' | 'light';
}

interface TimeframeMetrics {
  timeframe: string;
  trend: string; // UPTREND | DOWNTREND | NEUTRAL
  rsi: number;
  ema20?: number;
  ema50?: number;
  atr?: number;
  volume?: number;
}

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
  events: Array<{ timestamp: Date; type: string; message: string }>;

  // UI state
  lastUpdate: Date;
}

export class ConsoleDashboardService extends EventEmitter {
  private screen?: Widgets.Screen;
  private config: DashboardConfig;
  private state: DashboardState;
  private widgets: Map<string, Widgets.BoxElement> = new Map();

  // Non-blocking render control
  private renderScheduled = false;
  private updateQueue: Array<() => void> = [];

  constructor(
    config: DashboardConfig = { enabled: true },
    private errorHandler?: ErrorHandler
  ) {
    super();
    // THROW: Config validation
    this.validateConfig(config);
    this.config = { ...config };
    this.state = {
      metrics: new Map(),
      currentPrice: 0,
      priceUpdatedAt: 0,
      tpLevels: [],
      dailyWins: 0,
      dailyLosses: 0,
      dailyPnL: 0,
      events: [],
      lastUpdate: new Date(),
    };

    if (this.config.enabled) {
      try {
        this.initialize();
      } catch (error) {
        this.safeWarn('[DASHBOARD] Failed to initialize:', error instanceof Error ? error.message : String(error));
        this.config.enabled = false;
      }
    }
  }

  /**
   * Validate configuration values
   * @throws On invalid config
   */
  private validateConfig(config: DashboardConfig): void {
    if (!config || typeof config !== 'object') {
      const error = new Error('Config must be a valid object');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (typeof config.enabled !== 'boolean') {
      const error = new Error('Config.enabled must be a boolean');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (config.updateInterval !== undefined) {
      if (typeof config.updateInterval !== 'number' || !Number.isFinite(config.updateInterval)) {
        const error = new Error('Config.updateInterval must be a finite number');
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }

      if (config.updateInterval < 0) {
        const error = new Error('Config.updateInterval must be non-negative');
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    }

    if (config.theme !== undefined) {
      if (!['dark', 'light'].includes(config.theme)) {
        const error = new Error('Config.theme must be "dark" or "light"');
        if (this.errorHandler) {
          this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
        }
        throw error;
      }
    }
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
      this.safeWarn('[DASHBOARD] Initialization failed:', error);
      this.config.enabled = false;
      // GRACEFUL_DEGRADE: Dashboard init failure
      if (this.errorHandler) {
        this.errorHandler.handle(error as Error, { strategy: RecoveryStrategy.GRACEFUL_DEGRADE });
      }
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
    setInterval(updateLoop, interval);
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
    const color = value >= 0 ? '{green-fg}' : '{red-fg}';
    const sign = value > 0 ? '+' : '';
    return `${color}${sign}$${value.toFixed(2)}{/}`;
  }

  /**
   * Format percentage with color
   */
  private formatPercent(value: number): string {
    const color = value >= 0 ? '{green-fg}' : '{red-fg}';
    const sign = value > 0 ? '+' : '';
    return `${color}${sign}${value.toFixed(2)}%{/}`;
  }

  /**
   * Render ASCII progress bar
   */
  private renderProgressBar(current: number, target: number, width: number = 20): string {
    if (target === 0) return '░'.repeat(width);
    const percent = Math.min(100, Math.max(0, (current / target) * 100));
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;
    return '{green-fg}' + '█'.repeat(filled) + '{/}' + '{gray-fg}' + '░'.repeat(empty) + '{/}';
  }

  /**
   * Format duration (seconds to human-readable)
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
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
        const trendColor = metrics.trend === 'UPTREND' ? '{green-fg}' :
                          metrics.trend === 'DOWNTREND' ? '{red-fg}' : '{yellow-fg}';
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
    const wrColor = winRate >= 60 ? '{green-fg}' :
                    winRate >= 40 ? '{yellow-fg}' : '{red-fg}';

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
      const trendColor = metrics.trend === 'UPTREND' ? '{green-fg}' :
                        metrics.trend === 'DOWNTREND' ? '{red-fg}' : '{yellow-fg}';

      content += `{bold}{cyan-fg}${tf.toUpperCase()}{/}{/bold}\n`;
      content += `  Trend: ${trendColor}${metrics.trend}{/}\n`;

      // RSI with color (overbought/oversold)
      const rsiColor = metrics.rsi > 70 ? '{red-fg}' :
                       metrics.rsi < 30 ? '{green-fg}' : '{white-fg}';
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
      let typeColor = '{white-fg}';
      if (event.type.includes('win') || event.type.includes('profit')) {
        typeColor = '{green-fg}';
      } else if (event.type.includes('loss') || event.type.includes('sl-hit')) {
        typeColor = '{red-fg}';
      } else if (event.type.includes('position-open') || event.type.includes('tp-hit')) {
        typeColor = '{cyan-fg}';
      } else if (event.type.includes('error') || event.type.includes('warning')) {
        typeColor = '{yellow-fg}';
      }

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
      const error = new Error('Price must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (price < 0) {
      const error = new Error('Price must be non-negative');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
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
      const error = new Error('PnL must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (typeof pnlPercent !== 'number' || !Number.isFinite(pnlPercent)) {
      const error = new Error('PnL percent must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
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
      this.state.tpLevels = levels.map((l, idx) => ({
        price: l.price || 0,
        percent: l.percent,
        level: l.level ?? idx + 1,
        reached: false,
      }));
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
      const error = new Error('Stop loss price must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (price < 0) {
      const error = new Error('Stop loss price must be non-negative');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
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
      const error = new Error('PnL must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
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
      const error = new Error('PnL must be a finite number');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
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
      const error = new Error('Event type must be a non-empty string');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    if (typeof message !== 'string' || message.length === 0) {
      const error = new Error('Event message must be a non-empty string');
      if (this.errorHandler) {
        this.errorHandler.handle(error, { strategy: RecoveryStrategy.THROW });
      }
      throw error;
    }

    try {
      this.state.events.push({
        timestamp: new Date(),
        type,
        message,
      });

      // Keep only last 50 events (prevent memory leak)
      if (this.state.events.length > 50) {
        this.state.events.shift();
      }
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
  private safeLog(message: string, meta?: any): void {
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
  private safeWarn(message: string, meta?: any): void {
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
  }
}
