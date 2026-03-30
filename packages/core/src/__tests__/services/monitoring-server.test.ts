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
import type { MonitoringServer } from '../../services/monitoring-server.service';
import type { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import type { HealthCheckService } from '../../services/health-check.service';
import {
  createManagedMonitoringServerContext,
  type ManagedMonitoringServerContext,
} from '../helpers/monitoring-server-test.utils';

describe('MonitoringServer', () => {
  type MonitoringServerFixtures = Pick<
    ManagedMonitoringServerContext,
    'metricsService' | 'healthService' | 'startServer' | 'getBaseUrl' | 'harness' | 'createServer' | 'startAndStopServer'
  >;
  let mockMetricsService: jest.Mocked<PrometheusMetricsService>;
  let mockHealthService: jest.Mocked<HealthCheckService>;
  let startServer: MonitoringServerFixtures['startServer'];
  let getBaseUrl: MonitoringServerFixtures['getBaseUrl'];
  let monitoringHarness: MonitoringServerFixtures['harness'];
  let createServer: MonitoringServerFixtures['createServer'];
  let startAndStopServer: MonitoringServerFixtures['startAndStopServer'];

  function bindMonitoringServerFixtures() {
    let cleanup: ManagedMonitoringServerContext['cleanup'];
    let fixtures: MonitoringServerFixtures;

    beforeEach(() => {
      const managedContext = createManagedMonitoringServerContext();
      fixtures = {
        metricsService: managedContext.metricsService,
        healthService: managedContext.healthService,
        startServer: managedContext.startServer,
        getBaseUrl: managedContext.getBaseUrl,
        harness: managedContext.harness,
        createServer: managedContext.createServer,
        startAndStopServer: managedContext.startAndStopServer,
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindMonitoringServerFixtures();

  beforeEach(() => {
    ({
      metricsService: mockMetricsService,
      healthService: mockHealthService,
      startServer,
      getBaseUrl,
      harness: monitoringHarness,
      createServer,
      startAndStopServer,
    } = getFixtures());
  });

  // ==========================================================================
  // METRICS ENDPOINT TESTS (3 tests)
  // ==========================================================================

  describe('GET /metrics', () => {
    it('should return Prometheus metrics in text format', async () => {
      const server = await startServer({ port: 9091 });

      const response = await request(getBaseUrl(server))
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('trading_bot_orders_placed_total');
      expect(response.header['content-type']).toContain('text/plain');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should return 503 when metrics service not available', async () => {
      const server = await startServer(
        { port: 9092, metricsService: undefined, healthService: mockHealthService },
      );

      const response = await request(getBaseUrl(server))
        .get('/metrics')
        .expect(503);

      expect(response.body.error).toContain('not available');
    });

    it('should return 500 on metrics retrieval error', async () => {
      mockMetricsService.getMetrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      const server = await startServer({ port: 9093 });

      const response = await request(getBaseUrl(server))
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
      const server = await startServer({ port: 9094 });

      const response = await request(getBaseUrl(server))
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeDefined();
      expect(response.body.components).toBeDefined();
      expect(mockHealthService.checkHealth).toHaveBeenCalled();
    });

    it('should return 503 when system is degraded', async () => {
      mockHealthService.checkHealth = jest
        .fn()
        .mockResolvedValue(monitoringHarness.createDegradedHealthStatus());

      const server = await startServer({ port: 9095 });

      const response = await request(getBaseUrl(server))
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });

    it('should return 503 when health service not available', async () => {
      const server = await startServer(
        { port: 9096, metricsService: mockMetricsService, healthService: undefined },
      );

      const response = await request(getBaseUrl(server))
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
      const server = await startServer({ port: 9097 });

      const response = await request(getBaseUrl(server))
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
      expect(mockHealthService.isAlive).toHaveBeenCalled();
    });

    it('should return readiness status at /health/ready', async () => {
      const server = await startServer({ port: 9098 });

      const response = await request(getBaseUrl(server))
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
      const server = createServer({ port: 9099 });

      expect(server.isRunning()).toBe(false);

      await startAndStopServer({ port: 9099 });
      expect(server.isRunning()).toBe(false);
    });

    it('should return 404 for unknown routes', async () => {
      const server = await startServer({ port: 9100 });

      const response = await request(getBaseUrl(server))
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toContain('Not found');
    });
  });
});
