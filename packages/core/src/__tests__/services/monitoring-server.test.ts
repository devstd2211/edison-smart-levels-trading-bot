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
import type { LoggerService } from '../../types/legacy';
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
      server = await harness.startServer({ port: 9091 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('trading_bot_orders_placed_total');
      expect(response.header['content-type']).toContain('text/plain');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should return 503 when metrics service not available', async () => {
      server = await harness.startServer(
        { port: 9092, metricsService: undefined, healthService: mockHealthService },
        trackedServers,
      );

      const response = await request(harness.getBaseUrl(server))
        .get('/metrics')
        .expect(503);

      expect(response.body.error).toContain('not available');
    });

    it('should return 500 on metrics retrieval error', async () => {
      mockMetricsService.getMetrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      server = await harness.startServer({ port: 9093 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
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
      server = await harness.startServer({ port: 9094 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
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
        .mockResolvedValue(harness.createDegradedHealthStatus());

      server = await harness.startServer({ port: 9095 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });

    it('should return 503 when health service not available', async () => {
      server = await harness.startServer(
        { port: 9096, metricsService: mockMetricsService, healthService: undefined },
        trackedServers,
      );

      const response = await request(harness.getBaseUrl(server))
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
      server = await harness.startServer({ port: 9097 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
      expect(mockHealthService.isAlive).toHaveBeenCalled();
    });

    it('should return readiness status at /health/ready', async () => {
      server = await harness.startServer({ port: 9098 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
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
      server = harness.createServer({ port: 9099 }, trackedServers);

      expect(server.isRunning()).toBe(false);

      await harness.startAndStopServer({ port: 9099 }, trackedServers);
      expect(server.isRunning()).toBe(false);
    });

    it('should return 404 for unknown routes', async () => {
      server = await harness.startServer({ port: 9100 }, trackedServers);

      const response = await request(harness.getBaseUrl(server))
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toContain('Not found');
    });
  });
});
