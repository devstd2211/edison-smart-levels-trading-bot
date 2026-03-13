/**
 * MonitoringServer Tests
 *
 * Test coverage:
 * - 3 Metrics endpoint tests - GET /metrics
 * - 3 Health endpoint tests - GET /health
 * - 2 Probe tests - Liveness and readiness
 * - 2 Error tests - Service unavailable, failures
 *
 * Total: 10 tests
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 14.1.3 - Monitoring Server
 */

import request from 'supertest';
import { MonitoringServer } from '../../services/monitoring-server.service';
import { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import { HealthCheckService } from '../../services/health-check.service';
import { LoggerService } from '../../types/legacy';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  createMonitoringServerHarness,
  type MonitoringServerHarness,
} from '../helpers/monitoring-server-test.utils';

describe('MonitoringServer', () => {
  let server: MonitoringServer;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockMetricsService: jest.Mocked<PrometheusMetricsService>;
  let mockHealthService: jest.Mocked<HealthCheckService>;
  let errorHandler: ErrorHandler;
  let harness: MonitoringServerHarness;
  let trackedServers: MonitoringServer[];
  const createServer = (options: {
    port: number;
    metricsService?: PrometheusMetricsService;
    healthService?: HealthCheckService;
  }): MonitoringServer => {
    server = harness.createServer(options, trackedServers);
    return server;
  };

  beforeEach(() => {
    harness = createMonitoringServerHarness();
    trackedServers = [];
    mockLogger = harness.logger;
    mockMetricsService = harness.metricsService;
    mockHealthService = harness.healthService;
    errorHandler = harness.errorHandler;
  });

  afterEach(async () => {
    await harness.stopTrackedServers(trackedServers);
  });

  // ==========================================================================
  // METRICS ENDPOINT TESTS (3 tests)
  // ==========================================================================

  describe('GET /metrics', () => {
    it('should return Prometheus metrics in text format', async () => {
      server = createServer({ port: 9091 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('trading_bot_orders_placed_total');
      expect(response.header['content-type']).toContain('text/plain');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should return 503 when metrics service not available', async () => {
      server = createServer({ port: 9092, metricsService: undefined, healthService: mockHealthService });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/metrics')
        .expect(503);

      expect(response.body.error).toContain('not available');
    });

    it('should return 500 on metrics retrieval error', async () => {
      mockMetricsService.getMetrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      server = createServer({ port: 9093 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/metrics')
        .expect(500);

      expect(response.body.error).toContain('Failed to retrieve metrics');
    });
  });

  // ==========================================================================
  // HEALTH ENDPOINT TESTS (3 tests)
  // ==========================================================================

  describe('GET /health', () => {
    it('should return health status as JSON with 200 when healthy', async () => {
      server = createServer({ port: 9094 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeDefined();
      expect(response.body.components).toBeDefined();
      expect(mockHealthService.checkHealth).toHaveBeenCalled();
    });

    it('should return 503 when system is degraded', async () => {
      mockHealthService.checkHealth = jest.fn().mockResolvedValue({
        status: 'degraded',
        timestamp: Date.now(),
        uptime: 100,
        components: {
          exchange: { status: 'degraded', lastCheck: Date.now() },
          websocket: { status: 'up', lastCheck: Date.now() },
          system: { status: 'up', lastCheck: Date.now() },
          trading: { status: 'up', lastCheck: Date.now() },
        },
      });

      server = createServer({ port: 9095 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });

    it('should return 503 when health service not available', async () => {
      server = createServer({ port: 9096, metricsService: mockMetricsService, healthService: undefined });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health')
        .expect(503);

      expect(response.body.error).toContain('not available');
    });
  });

  // ==========================================================================
  // KUBERNETES PROBES TESTS (2 tests)
  // ==========================================================================

  describe('Kubernetes Probes', () => {
    it('should return liveness status at /health/live', async () => {
      server = createServer({ port: 9097 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
      expect(mockHealthService.isAlive).toHaveBeenCalled();
    });

    it('should return readiness status at /health/ready', async () => {
      server = createServer({ port: 9098 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health/ready')
        .expect(200);

      expect(response.body.ready).toBe(true);
      expect(mockHealthService.isReady).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS (2 tests)
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle server start/stop lifecycle', async () => {
      server = createServer({ port: 9099 });

      expect(server.isRunning()).toBe(false);

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should return 404 for unknown routes', async () => {
      server = createServer({ port: 9100 });

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toContain('Not found');
    });
  });
});
