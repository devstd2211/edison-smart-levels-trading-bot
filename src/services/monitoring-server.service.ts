/**
 * Monitoring Server Service
 *
 * HTTP server that exposes monitoring endpoints:
 * - GET /metrics - Prometheus metrics (text/plain)
 * - GET /health - Full health check (JSON)
 * - GET /health/live - Liveness probe (K8s)
 * - GET /health/ready - Readiness probe (K8s)
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 14.1.3 - HTTP Monitoring Endpoints
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { LoggerService } from './logger.service';
import type { ILifecycle } from '../interfaces/ILifecycle';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';
import type {
  IMonitoringHealthReader,
  IMonitoringMetricsReader,
} from '../interfaces/IMonitoringReaders';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Monitoring server configuration
 */
export interface MonitoringServerConfig {
  enabled?: boolean;
  port?: number;
  metricsPath?: string;
  healthPath?: string;
  cors?: boolean;
}

// ============================================================================
// SERVICE
// ============================================================================

export class MonitoringServer implements ILifecycle {
  private app?: Express;
  private server?: Server;
  private readonly port: number;
  private readonly metricsPath: string;
  private readonly healthPath: string;
  private readonly corsEnabled: boolean;

  constructor(
    private readonly metricsService?: IMonitoringMetricsReader,
    private readonly healthCheckService?: IMonitoringHealthReader,
    private readonly config: MonitoringServerConfig = {},
    private readonly logger?: LoggerService,
    private readonly errorHandler?: ErrorHandler
  ) {
    this.port = config.port ?? 9090;
    this.metricsPath = config.metricsPath ?? '/metrics';
    this.healthPath = config.healthPath ?? '/health';
    this.corsEnabled = config.cors ?? true;

    this.safeLog('MonitoringServer initialized', 'info');
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Start HTTP server
   */
  async start(): Promise<void> {
    if (this.server) {
      this.safeLog('MonitoringServer already running', 'warn');
      return;
    }

    try {
      this.app = express();

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Start server
      await new Promise<void>((resolve, reject) => {
        try {
          this.server = this.app!.listen(this.port, () => {
            this.safeLog(`MonitoringServer listening on port ${this.port}`, 'info');
            resolve();
          });

          if (this.server) {
            this.server.on('error', (error) => {
              this.safeLog(`MonitoringServer error: ${error}`, 'error');
              reject(error);
            });
          }
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'MonitoringServer.start',
        });
      }
      this.safeLog(`Failed to start MonitoringServer: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Stop HTTP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((error) => {
          if (error) {
            reject(error);
          } else {
            this.safeLog('MonitoringServer stopped', 'info');
            this.server = undefined;
            this.app = undefined;
            resolve();
          }
        });
      });
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'MonitoringServer.stop',
        });
      }
      this.safeLog(`Failed to stop MonitoringServer: ${error}`, 'error');
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return !!this.server;
  }

  /**
   * Get server port
   */
  getPort(): number {
    return this.port;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    if (!this.app) return;

    // CORS
    if (this.corsEnabled) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        next();
      });
    }

    // JSON body parser
    this.app.use(express.json());

    // Request logging (SKIP strategy)
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      try {
        this.safeLog(`${req.method} ${req.path}`, 'debug');
      } catch (error) {
        // SKIP logging errors
      }
      next();
    });
  }

  /**
   * Setup HTTP routes
   */
  private setupRoutes(): void {
    if (!this.app) return;

    // GET /metrics - Prometheus metrics
    this.app.get(this.metricsPath, async (req: Request, res: Response) => {
      try {
        if (!this.metricsService) {
          res.status(503).json({ error: 'Metrics service not available' });
          return;
        }

        const metrics = await this.metricsService.getMetrics();
        const contentType = this.metricsService.getContentType();

        res.set('Content-Type', contentType);
        res.send(metrics);
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'MonitoringServer./metrics',
          });
        }
        this.safeLog(`/metrics error: ${error}`, 'error');
        res.status(500).json({ error: 'Failed to retrieve metrics' });
      }
    });

    // GET /health - Full health check
    this.app.get(this.healthPath, async (req: Request, res: Response) => {
      try {
        if (!this.healthCheckService) {
          res.status(503).json({ error: 'Health check service not available' });
          return;
        }

        const health = await this.healthCheckService.checkHealth();
        const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;

        res.status(statusCode).json(health);
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'MonitoringServer./health',
          });
        }
        this.safeLog(`/health error: ${error}`, 'error');
        res.status(500).json({ error: 'Failed to retrieve health status' });
      }
    });

    // GET /health/live - Liveness probe (K8s)
    this.app.get(`${this.healthPath}/live`, async (req: Request, res: Response) => {
      try {
        if (!this.healthCheckService) {
          res.status(200).json({ alive: true, message: 'Health check service not configured' });
          return;
        }

        const isAlive = await this.healthCheckService.isAlive();
        const statusCode = isAlive ? 200 : 503;

        res.status(statusCode).json({ alive: isAlive });
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'MonitoringServer./health/live',
          });
        }
        this.safeLog(`/health/live error: ${error}`, 'error');
        res.status(500).json({ alive: false, error: 'Failed to check liveness' });
      }
    });

    // GET /health/ready - Readiness probe (K8s)
    this.app.get(`${this.healthPath}/ready`, async (req: Request, res: Response) => {
      try {
        if (!this.healthCheckService) {
          res.status(503).json({ ready: false, message: 'Health check service not configured' });
          return;
        }

        const isReady = await this.healthCheckService.isReady();
        const statusCode = isReady ? 200 : 503;

        res.status(statusCode).json({ ready: isReady });
      } catch (error) {
        if (this.errorHandler) {
          this.errorHandler.handle(error, {
            strategy: RecoveryStrategy.SKIP,
            context: 'MonitoringServer./health/ready',
          });
        }
        this.safeLog(`/health/ready error: ${error}`, 'error');
        res.status(500).json({ ready: false, error: 'Failed to check readiness' });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  /**
   * Safe logging wrapper (SKIP strategy)
   */
  private safeLog(message: string, level: 'info' | 'warn' | 'error' | 'debug' = 'info'): void {
    if (!this.logger) return;

    try {
      const context = { service: 'MonitoringServer' };
      if (level === 'warn') {
        this.logger.warn(message, context);
      } else if (level === 'error') {
        this.logger.error(message, context);
      } else if (level === 'debug') {
        this.logger.debug(message, context);
      } else {
        this.logger.info(message, context);
      }
    } catch (error) {
      // SKIP: Silently ignore logging errors
      if (this.errorHandler) {
        this.errorHandler.handle(error, {
          strategy: RecoveryStrategy.SKIP,
          context: 'MonitoringServer.safeLog',
        });
      }
    }
  }
}
