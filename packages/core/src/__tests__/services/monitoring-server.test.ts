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

describe('MonitoringServer', () => {
  let server: MonitoringServer;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockMetricsService: jest.Mocked<PrometheusMetricsService>;
  let mockHealthService: jest.Mocked<HealthCheckService>;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    errorHandler = new ErrorHandler(mockLogger);

    // Mock PrometheusMetricsService
    mockMetricsService = {
      getMetrics: jest.fn().mockResolvedValue('# HELP trading_bot_orders_placed_total Total orders placed\ntrading_bot_orders_placed_total{side="Buy"} 10'),
      getContentType: jest.fn().mockReturnValue('text/plain; version=0.0.4; charset=utf-8'),
    } as any;

    // Mock HealthCheckService
    mockHealthService = {
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
    } as any;
  });

  afterEach(async () => {
    if (server && server.isRunning()) {
      await server.stop();
    }
  });

  // ==========================================================================
  // METRICS ENDPOINT TESTS (3 tests)
  // ==========================================================================

  describe('GET /metrics', () => {
    it('should return Prometheus metrics in text format', async () => {
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9091 },
        mockLogger,
        errorHandler
      );

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('trading_bot_orders_placed_total');
      expect(response.header['content-type']).toContain('text/plain');
      expect(mockMetricsService.getMetrics).toHaveBeenCalled();
    });

    it('should return 503 when metrics service not available', async () => {
      server = new MonitoringServer(
        undefined, // No metrics service
        mockHealthService,
        { port: 9092 },
        mockLogger,
        errorHandler
      );

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/metrics')
        .expect(503);

      expect(response.body.error).toContain('not available');
    });

    it('should return 500 on metrics retrieval error', async () => {
      mockMetricsService.getMetrics = jest.fn().mockRejectedValue(new Error('Metrics error'));

      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9093 },
        mockLogger,
        errorHandler
      );

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
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9094 },
        mockLogger,
        errorHandler
      );

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

      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9095 },
        mockLogger,
        errorHandler
      );

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('degraded');
    });

    it('should return 503 when health service not available', async () => {
      server = new MonitoringServer(
        mockMetricsService,
        undefined, // No health service
        { port: 9096 },
        mockLogger,
        errorHandler
      );

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
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9097 },
        mockLogger,
        errorHandler
      );

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/health/live')
        .expect(200);

      expect(response.body.alive).toBe(true);
      expect(mockHealthService.isAlive).toHaveBeenCalled();
    });

    it('should return readiness status at /health/ready', async () => {
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9098 },
        mockLogger,
        errorHandler
      );

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
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9099 },
        mockLogger,
        errorHandler
      );

      expect(server.isRunning()).toBe(false);

      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should return 404 for unknown routes', async () => {
      server = new MonitoringServer(
        mockMetricsService,
        mockHealthService,
        { port: 9100 },
        mockLogger,
        errorHandler
      );

      await server.start();

      const response = await request(`http://localhost:${server.getPort()}`)
        .get('/unknown')
        .expect(404);

      expect(response.body.error).toContain('Not found');
    });
  });
});
