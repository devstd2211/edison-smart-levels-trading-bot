/**
 * Prometheus Metrics Service
 *
 * Collects and exposes metrics in Prometheus format for monitoring:
 * - Trading metrics (positions, PnL, orders, fills)
 * - Performance metrics (latency, throughput)
 * - Error metrics (error rates, recovery)
 * - System metrics (memory, CPU, uptime)
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 14.1.1 - Monitoring & Observability
 */

import { LoggerService } from './logger.service';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import { Counter, Gauge, Histogram, Summary, Registry, register } from 'prom-client';
import type { IMonitoringMetricsReader } from '../interfaces/IMonitoringReaders';
import type { IMonitoringMetricsRecorder } from '../interfaces/IMonitoringRecorders';
import type { ILifecycle } from '../interfaces/ILifecycle';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  enabled?: boolean;
  prefix?: string;
  collectInterval?: number; // ms
  defaultLabels?: Record<string, string>;
}

/**
 * Trading metrics snapshot
 */
export interface TradingMetrics {
  activePositions: number;
  totalPnL: number;
  ordersPlaced: number;
  ordersFilled: number;
  ordersFailed: number;
  winRate: number;
}

/**
 * Performance metrics snapshot
 */
export interface PerformanceMetrics {
  orderLatencyP50: number;
  orderLatencyP95: number;
  orderLatencyP99: number;
  apiLatencyP50: number;
  memoryUsageMB: number;
  cpuUsagePercent: number;
}

// ============================================================================
// SERVICE
// ============================================================================

export class PrometheusMetricsService implements IMonitoringMetricsReader, IMonitoringMetricsRecorder, ILifecycle {
  private readonly registry: Registry;
  private readonly prefix: string;
  private collectIntervalId?: NodeJS.Timeout;

  // Trading metrics
  private readonly ordersPlacedCounter: Counter<string>;
  private readonly ordersFilledCounter: Counter<string>;
  private readonly ordersFailedCounter: Counter<string>;
  private readonly activePositionsGauge: Gauge<string>;
  private readonly totalPnLGauge: Gauge<string>;
  private readonly winRateGauge: Gauge<string>;

  // Performance metrics
  private readonly orderLatencyHistogram: Histogram<string>;
  private readonly apiLatencyHistogram: Histogram<string>;
  private readonly indicatorCalcHistogram: Histogram<string>;

  // Error metrics
  private readonly errorsCounter: Counter<string>;
  private readonly retriesCounter: Counter<string>;
  private readonly recoverySuccessCounter: Counter<string>;

  // System metrics
  private readonly memoryUsageGauge: Gauge<string>;
  private readonly cpuUsageGauge: Gauge<string>;
  private readonly uptimeGauge: Gauge<string>;

  // Summary metrics
  private readonly slippageSummary: Summary<string>;
  private readonly fillRateSummary: Summary<string>;

  constructor(
    private readonly config: MetricsConfig = {},
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    this.prefix = config.prefix || 'trading_bot_';
    this.registry = new Registry();

    // Set default labels
    if (config.defaultLabels) {
      this.registry.setDefaultLabels(config.defaultLabels);
    }

    // Initialize counters
    this.ordersPlacedCounter = new Counter({
      name: `${this.prefix}orders_placed_total`,
      help: 'Total number of orders placed',
      labelNames: ['side', 'symbol', 'type'],
      registers: [this.registry],
    });

    this.ordersFilledCounter = new Counter({
      name: `${this.prefix}orders_filled_total`,
      help: 'Total number of orders filled',
      labelNames: ['side', 'symbol'],
      registers: [this.registry],
    });

    this.ordersFailedCounter = new Counter({
      name: `${this.prefix}orders_failed_total`,
      help: 'Total number of orders failed',
      labelNames: ['side', 'symbol', 'reason'],
      registers: [this.registry],
    });

    this.errorsCounter = new Counter({
      name: `${this.prefix}errors_total`,
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [this.registry],
    });

    this.retriesCounter = new Counter({
      name: `${this.prefix}retries_total`,
      help: 'Total number of operation retries',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.recoverySuccessCounter = new Counter({
      name: `${this.prefix}recovery_success_total`,
      help: 'Total number of successful error recoveries',
      labelNames: ['strategy'],
      registers: [this.registry],
    });

    // Initialize gauges
    this.activePositionsGauge = new Gauge({
      name: `${this.prefix}active_positions`,
      help: 'Number of active positions',
      registers: [this.registry],
    });

    this.totalPnLGauge = new Gauge({
      name: `${this.prefix}total_pnl_usdt`,
      help: 'Total profit/loss in USDT',
      registers: [this.registry],
    });

    this.winRateGauge = new Gauge({
      name: `${this.prefix}win_rate`,
      help: 'Win rate (0-1)',
      registers: [this.registry],
    });

    this.memoryUsageGauge = new Gauge({
      name: `${this.prefix}memory_usage_mb`,
      help: 'Memory usage in MB',
      registers: [this.registry],
    });

    this.cpuUsageGauge = new Gauge({
      name: `${this.prefix}cpu_usage_percent`,
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    this.uptimeGauge = new Gauge({
      name: `${this.prefix}uptime_seconds`,
      help: 'Bot uptime in seconds',
      registers: [this.registry],
    });

    // Initialize histograms
    this.orderLatencyHistogram = new Histogram({
      name: `${this.prefix}order_latency_ms`,
      help: 'Order execution latency in milliseconds',
      labelNames: ['side', 'type'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    this.apiLatencyHistogram = new Histogram({
      name: `${this.prefix}api_latency_ms`,
      help: 'API request latency in milliseconds',
      labelNames: ['endpoint', 'method'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500],
      registers: [this.registry],
    });

    this.indicatorCalcHistogram = new Histogram({
      name: `${this.prefix}indicator_calc_ms`,
      help: 'Indicator calculation time in milliseconds',
      labelNames: ['indicator'],
      buckets: [1, 5, 10, 25, 50, 100, 250],
      registers: [this.registry],
    });

    // Initialize summaries
    this.slippageSummary = new Summary({
      name: `${this.prefix}slippage_bps`,
      help: 'Order slippage in basis points',
      labelNames: ['side'],
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.fillRateSummary = new Summary({
      name: `${this.prefix}fill_rate`,
      help: 'Order fill rate (0-1)',
      percentiles: [0.5, 0.9, 0.95, 0.99],
      registers: [this.registry],
    });

    this.safeLog('PrometheusMetricsService initialized', 'info');

  }

  // ============================================================================
  // PUBLIC API - TRADING METRICS
  // ============================================================================

  /**
   * Increment orders placed counter
   */
  incrementOrdersPlaced(side: string, symbol: string, type: string = 'market'): void {
    try {
      this.ordersPlacedCounter.inc({ side, symbol, type });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementOrdersPlaced',
        });
      }
      this.safeLog(`Failed to increment orders placed: ${error}`, 'error');
    }
  }

  /**
   * Increment orders filled counter
   */
  incrementOrdersFilled(side: string, symbol: string): void {
    try {
      this.ordersFilledCounter.inc({ side, symbol });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementOrdersFilled',
        });
      }
      this.safeLog(`Failed to increment orders filled: ${error}`, 'error');
    }
  }

  /**
   * Increment orders failed counter
   */
  incrementOrdersFailed(side: string, symbol: string, reason: string): void {
    try {
      this.ordersFailedCounter.inc({ side, symbol, reason });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementOrdersFailed',
        });
      }
      this.safeLog(`Failed to increment orders failed: ${error}`, 'error');
    }
  }

  /**
   * Update active positions gauge
   */
  updateActivePositions(count: number): void {
    try {
      this.activePositionsGauge.set(count);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.updateActivePositions',
        });
      }
      this.safeLog(`Failed to update active positions: ${error}`, 'error');
    }
  }

  /**
   * Update total PnL gauge
   */
  updateTotalPnL(pnl: number): void {
    try {
      this.totalPnLGauge.set(pnl);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.updateTotalPnL',
        });
      }
      this.safeLog(`Failed to update total PnL: ${error}`, 'error');
    }
  }

  /**
   * Update win rate gauge
   */
  updateWinRate(winRate: number): void {
    try {
      this.winRateGauge.set(winRate);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.updateWinRate',
        });
      }
      this.safeLog(`Failed to update win rate: ${error}`, 'error');
    }
  }

  // ============================================================================
  // PUBLIC API - PERFORMANCE METRICS
  // ============================================================================

  /**
   * Record order execution latency
   */
  recordOrderLatency(latencyMs: number, side: string, type: string = 'market'): void {
    try {
      this.orderLatencyHistogram.observe({ side, type }, latencyMs);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.recordOrderLatency',
        });
      }
      this.safeLog(`Failed to record order latency: ${error}`, 'error');
    }
  }

  /**
   * Record API request latency
   */
  recordApiLatency(latencyMs: number, endpoint: string, method: string = 'GET'): void {
    try {
      this.apiLatencyHistogram.observe({ endpoint, method }, latencyMs);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.recordApiLatency',
        });
      }
      this.safeLog(`Failed to record API latency: ${error}`, 'error');
    }
  }

  /**
   * Record indicator calculation time
   */
  recordIndicatorCalcTime(timeMs: number, indicator: string): void {
    try {
      this.indicatorCalcHistogram.observe({ indicator }, timeMs);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.recordIndicatorCalcTime',
        });
      }
      this.safeLog(`Failed to record indicator calc time: ${error}`, 'error');
    }
  }

  /**
   * Record order slippage
   */
  recordSlippage(slippageBps: number, side: string): void {
    try {
      this.slippageSummary.observe({ side }, slippageBps);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.recordSlippage',
        });
      }
      this.safeLog(`Failed to record slippage: ${error}`, 'error');
    }
  }

  /**
   * Record fill rate
   */
  recordFillRate(fillRate: number): void {
    try {
      this.fillRateSummary.observe(fillRate);
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.recordFillRate',
        });
      }
      this.safeLog(`Failed to record fill rate: ${error}`, 'error');
    }
  }

  // ============================================================================
  // PUBLIC API - ERROR METRICS
  // ============================================================================

  /**
   * Increment errors counter
   */
  incrementErrors(type: string, severity: string = 'error'): void {
    try {
      this.errorsCounter.inc({ type, severity });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementErrors',
        });
      }
      this.safeLog(`Failed to increment errors: ${error}`, 'error');
    }
  }

  /**
   * Increment retries counter
   */
  incrementRetries(operation: string): void {
    try {
      this.retriesCounter.inc({ operation });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementRetries',
        });
      }
      this.safeLog(`Failed to increment retries: ${error}`, 'error');
    }
  }

  /**
   * Increment recovery success counter
   */
  incrementRecoverySuccess(strategy: string): void {
    try {
      this.recoverySuccessCounter.inc({ strategy });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.incrementRecoverySuccess',
        });
      }
      this.safeLog(`Failed to increment recovery success: ${error}`, 'error');
    }
  }

  // ============================================================================
  // PUBLIC API - SYSTEM METRICS
  // ============================================================================

  /**
   * Update system metrics (memory, CPU, uptime)
   */
  updateSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      this.memoryUsageGauge.set(memUsageMB);

      // CPU usage (approximation via process.cpuUsage())
      const cpuUsage = process.cpuUsage();
      const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / process.uptime() * 100;
      this.cpuUsageGauge.set(cpuPercent);

      // Uptime
      this.uptimeGauge.set(process.uptime());
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.updateSystemMetrics',
        });
      }
      this.safeLog(`Failed to update system metrics: ${error}`, 'error');
    }
  }

  // ============================================================================
  // PUBLIC API - METRICS EXPORT
  // ============================================================================

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    try {
      // Update system metrics before export
      this.updateSystemMetrics();

      return await this.registry.metrics();
    } catch (error) {
      if (this.errorHandler) {
        const result = await this.errorHandler.executeAsync(
          async () => {
            throw error;
          },
          {
            strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
            context: 'PrometheusMetricsService.getMetrics',
          }
        );

        if (!result.success) {
          this.safeLog(`Failed to get metrics: ${error}`, 'error');
          return '# Metrics unavailable\n';
        }
      }

      this.safeLog(`Failed to get metrics: ${error}`, 'error');
      return '# Metrics unavailable\n';
    }
  }

  /**
   * Get content type for Prometheus metrics
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    try {
      this.registry.resetMetrics();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.reset',
        });
      }
      this.safeLog(`Failed to reset metrics: ${error}`, 'error');
    }
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Start automatic metric collection
   */
  private startAutoCollection(intervalMs: number): void {
    if (this.collectIntervalId) {
      clearInterval(this.collectIntervalId);
    }

    this.collectIntervalId = setInterval(() => {
      this.updateSystemMetrics();
    }, intervalMs);

    this.safeLog(`Auto-collection started (interval: ${intervalMs}ms)`, 'info');
  }

  /**
   * Stop metric collection
   */
  stop(): void {
    if (this.collectIntervalId) {
      clearInterval(this.collectIntervalId);
      this.collectIntervalId = undefined;
      this.safeLog('Metric collection stopped', 'info');
    }
  }

  /**
   * Start automatic metric collection (lifecycle)
   */
  start(): void {
    if (this.config.collectInterval && this.config.collectInterval > 0) {
      this.startAutoCollection(this.config.collectInterval);
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Safe logging wrapper (SKIP strategy)
   */
  private safeLog(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this.logger) return;

    try {
      const context = { service: 'PrometheusMetricsService' };
      if (level === 'warn') {
        this.logger.warn(message, context);
      } else if (level === 'error') {
        this.logger.error(message, context);
      } else {
        this.logger.info(message, context);
      }
    } catch (error) {
      // SKIP: Silently ignore logging errors
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'PrometheusMetricsService.safeLog',
        });
      }
    }
  }
}
