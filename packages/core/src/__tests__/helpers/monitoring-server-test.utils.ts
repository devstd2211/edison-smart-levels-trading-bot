import { ErrorHandler } from '../../errors/ErrorHandler';
import { HealthCheckService } from '../../services/health-check.service';
import { MonitoringServer } from '../../services/monitoring-server.service';
import { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import { LoggerService } from '../../types/legacy';

export interface MonitoringServerHarness {
  logger: jest.Mocked<LoggerService>;
  metricsService: jest.Mocked<PrometheusMetricsService>;
  healthService: jest.Mocked<HealthCheckService>;
  errorHandler: ErrorHandler;
  createDegradedHealthStatus: () => Awaited<ReturnType<HealthCheckService['checkHealth']>>;
  createServer: (
    options: {
      port: number;
      metricsService?: PrometheusMetricsService;
      healthService?: HealthCheckService;
    },
    trackedServers: MonitoringServer[],
  ) => MonitoringServer;
  startServer: (
    options: {
      port: number;
      metricsService?: PrometheusMetricsService;
      healthService?: HealthCheckService;
    },
    trackedServers: MonitoringServer[],
  ) => Promise<MonitoringServer>;
  startAndStopServer: (
    options: {
      port: number;
      metricsService?: PrometheusMetricsService;
      healthService?: HealthCheckService;
    },
    trackedServers: MonitoringServer[],
  ) => Promise<MonitoringServer>;
  getBaseUrl: (server: MonitoringServer) => string;
  stopTrackedServers: (trackedServers: MonitoringServer[]) => Promise<void>;
}

export interface MonitoringServerTestContext {
  harness: MonitoringServerHarness;
  logger: jest.Mocked<LoggerService>;
  metricsService: jest.Mocked<PrometheusMetricsService>;
  healthService: jest.Mocked<HealthCheckService>;
  errorHandler: ErrorHandler;
  trackedServers: MonitoringServer[];
  stop: () => Promise<void>;
}

export interface ManagedMonitoringServerContext extends MonitoringServerTestContext {
  cleanup: () => Promise<void>;
}

export function createMonitoringServerHarness(): MonitoringServerHarness {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as unknown as jest.Mocked<LoggerService>;

  const errorHandler = new ErrorHandler(logger);

  const metricsService = {
    getMetrics: jest
      .fn()
      .mockResolvedValue(
        '# HELP trading_bot_orders_placed_total Total orders placed\ntrading_bot_orders_placed_total{side="Buy"} 10',
      ),
    getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
  } as unknown as jest.Mocked<PrometheusMetricsService>;

  const healthService = {
    checkHealth: jest.fn().mockResolvedValue({
      status: 'healthy',
      timestamp: Date.now(),
      uptime: 100,
      components: {
        exchange: { status: 'up', lastCheck: Date.now() },
        websocket: { status: 'up', lastCheck: Date.now() },
        system: { status: 'up', lastCheck: Date.now() },
        trading: { status: 'up', lastCheck: Date.now() },
      },
    }),
    isAlive: jest.fn().mockResolvedValue(true),
    isReady: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<HealthCheckService>;

  return {
    logger,
    metricsService,
    healthService,
    errorHandler,
    createDegradedHealthStatus() {
      return {
        status: 'degraded',
        timestamp: Date.now(),
        uptime: 100,
        components: {
          exchange: { status: 'degraded', lastCheck: Date.now() },
          websocket: { status: 'up', lastCheck: Date.now() },
          system: { status: 'up', lastCheck: Date.now() },
          trading: { status: 'up', lastCheck: Date.now() },
        },
      };
    },
    createServer(options, trackedServers) {
      const metrics =
        Object.prototype.hasOwnProperty.call(options, 'metricsService')
          ? options.metricsService
          : metricsService;
      const health =
        Object.prototype.hasOwnProperty.call(options, 'healthService')
          ? options.healthService
          : healthService;

      const server = new MonitoringServer(
        metrics,
        health,
        { port: options.port },
        logger,
        errorHandler,
      );
      trackedServers.push(server);
      return server;
    },
    async startServer(options, trackedServers) {
      const server = this.createServer(options, trackedServers);
      await server.start();
      return server;
    },
    async startAndStopServer(options, trackedServers) {
      const server = await this.startServer(options, trackedServers);
      await server.stop();
      return server;
    },
    getBaseUrl(server) {
      return `http://localhost:${server.getPort()}`;
    },
    async stopTrackedServers(trackedServers) {
      while (trackedServers.length > 0) {
        const server = trackedServers.pop();
        if (server?.isRunning()) {
          await server.stop();
        }
      }
    },
  };
}

export function createStandardMonitoringServer(
  harness: Pick<MonitoringServerHarness, 'createServer'>,
  options: {
    port: number;
    metricsService?: PrometheusMetricsService;
    healthService?: HealthCheckService;
  },
  trackedServers: MonitoringServer[],
): MonitoringServer {
  return harness.createServer(options, trackedServers);
}

export function createStartedMonitoringServer(
  harness: Pick<MonitoringServerHarness, 'startServer'>,
  options: {
    port: number;
    metricsService?: PrometheusMetricsService;
    healthService?: HealthCheckService;
  },
  trackedServers: MonitoringServer[],
): Promise<MonitoringServer> {
  return harness.startServer(options, trackedServers);
}

export function createMonitoringServerTestContext(): MonitoringServerTestContext {
  const harness = createMonitoringServerHarness();
  const trackedServers: MonitoringServer[] = [];

  return {
    harness,
    logger: harness.logger,
    metricsService: harness.metricsService,
    healthService: harness.healthService,
    errorHandler: harness.errorHandler,
    trackedServers,
    stop: () => harness.stopTrackedServers(trackedServers),
  };
}

export function createManagedMonitoringServerContext(): ManagedMonitoringServerContext {
  const context = createMonitoringServerTestContext();

  return {
    ...context,
    cleanup: async () => {
      jest.restoreAllMocks();
      await context.stop();
    },
  };
}
