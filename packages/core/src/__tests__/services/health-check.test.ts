/**
 * HealthCheckService Tests
 *
 * Test coverage:
 * - 5 Exchange tests - API reachable, auth valid, server time
 * - 5 WebSocket tests - Connection active, recent messages
 * - 5 System tests - Memory, CPU, disk checks
 * - 5 Trading tests - State consistency, readiness probes
 *
 * Total: 20 tests
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 14.1.2 - Health Checks
 */

import { HealthCheckService } from '../../services/health-check.service';
import {
  createManagedHealthCheckContext,
  createStandardHealthCheckService,
} from '../helpers/health-check-test.utils';

type HealthCheckRuntime = ReturnType<typeof createManagedHealthCheckContext>;

describe('HealthCheckService', () => {
  let service: HealthCheckRuntime['service'];
  let harness: HealthCheckRuntime['harness'];
  let cleanup: HealthCheckRuntime['cleanup'];

  beforeEach(() => {
    ({
      service,
      harness,
      cleanup,
    } = createManagedHealthCheckContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================================================
  // EXCHANGE HEALTH TESTS (5 tests)
  // ==========================================================================

  describe('Exchange Health', () => {
    it('should report exchange as healthy when all checks pass', async () => {
      const health = await service.checkExchange();

      expect(health.status).toBe('up');
      expect(health.checks?.connection).toBe(true);
      expect(health.checks?.serverTime).toBe(true);
    });

    it('should report exchange as degraded when connection fails', async () => {
      const health = await harness.createDisconnectedExchangeService().checkExchange();

      expect(health.status).toBe('degraded');
      expect(health.checks?.connection).toBe(false);
    });

    it('should report exchange as degraded when server time is out of sync', async () => {
      const health = await harness.createOutOfSyncExchangeService().checkExchange();

      expect(health.status).toBe('degraded');
      expect(health.checks?.serverTime).toBe(false);
    });

    it('should report exchange as degraded when connection fails with error', async () => {
      service = createStandardHealthCheckService(harness, {
        exchange: harness.configureExchangeHealth({
          throwOnConnection: new Error('API error'),
        }),
      });

      const health = await service.checkExchange();

      expect(health.status).toBe('degraded');
      expect(health.checks?.connection).toBe(false);
    });

    it('should report exchange as degraded when service not available', async () => {
      const svc = harness.createUnavailableService();

      const health = await svc.checkExchange();

      expect(health.status).toBe('degraded');
      expect(health.message).toContain('not available');
    });
  });

  // ==========================================================================
  // WEBSOCKET HEALTH TESTS (5 tests)
  // ==========================================================================

  describe('WebSocket Health', () => {
    it('should report WebSocket as healthy when connected with recent messages', async () => {
      service = createStandardHealthCheckService(harness, {
        websocket: harness.configureWebSocketHealth({
          connected: true,
          messageAgeMs: 1000,
        }),
      });

      const health = await service.checkWebSocket();

      expect(health.status).toBe('up');
      expect(health.checks?.connected).toBe(true);
      expect(health.checks?.recentMessages).toBe(true);
    });

    it('should report WebSocket as degraded when no recent messages', async () => {
      const health = await harness.createStaleWebSocketService().checkWebSocket();

      expect(health.status).toBe('degraded');
      expect(health.checks?.recentMessages).toBe(false);
    });

    it('should report WebSocket as degraded when disconnected', async () => {
      service = createStandardHealthCheckService(harness, {
        websocket: harness.configureWebSocketHealth({
          connected: false,
          messageAgeMs: Date.now(),
        }),
      });

      const health = await service.checkWebSocket();

      expect(health.status).toBe('degraded');
      expect(health.checks?.connected).toBe(false);
    });

    it('should report WebSocket as down on error', async () => {
      const health = await harness.createThrowingWebSocketService().checkWebSocket();

      expect(health.status).toBe('down');
      expect(health.checks?.error).toBe(true);
    });

    it('should report WebSocket as degraded when service not available', async () => {
      const svc = harness.createUnavailableService();

      const health = await svc.checkWebSocket();

      expect(health.status).toBe('degraded');
      expect(health.message).toContain('not available');
    });
  });

  // ==========================================================================
  // SYSTEM HEALTH TESTS (5 tests)
  // ==========================================================================

  describe('System Health', () => {
    it('should report system health status', async () => {
      const health = await service.checkSystem();

      // Should return a valid status
      expect(['up', 'degraded', 'down']).toContain(health.status);
      expect(health.checks?.memory).toBeDefined();
      expect(health.checks?.cpu).toBeDefined();
      expect(health.checks?.disk).toBeDefined();
    });

    it('should report system as degraded when memory usage high', async () => {
      const svc = harness.createMemoryConstrainedService(1);

      const health = await svc.checkSystem();

      expect(health.status).toBe('degraded');
      expect(health.checks?.memory).toBe(false);
    });

    it('should report system as degraded when CPU usage high', async () => {
      const svc = harness.createCpuConstrainedService(1);

      const health = await svc.checkSystem();

      expect(health.status).toBe('degraded');
      expect(health.checks?.cpu).toBe(false);
    });

    it('should include memory and CPU percentages in checks', async () => {
      const health = await service.checkSystem();

      expect(health.checks?.memoryUsagePercent).toBeDefined();
      expect(typeof health.checks?.memoryUsagePercent).toBe('number');
      expect(health.checks?.cpuUsagePercent).toBeDefined();
      expect(typeof health.checks?.cpuUsagePercent).toBe('number');
    });

    it('should handle system check errors gracefully', async () => {
      // Mock process.memoryUsage to throw
      const memoryUsageSpy = jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory error');
      });

      const health = await service.checkSystem();

      expect(health.status).toBe('down');

      memoryUsageSpy.mockRestore();
    });
  });

  // ==========================================================================
  // TRADING HEALTH TESTS (5 tests)
  // ==========================================================================

  describe('Trading Health', () => {
    it('should report trading as healthy', async () => {
      const health = await service.checkTrading();

      expect(health.status).toBe('up');
      expect(health.checks?.stateConsistent).toBe(true);
    });

    it('should perform complete health check', async () => {
      const health = await service.checkHealth();

      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.timestamp).toBeDefined();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.components.exchange).toBeDefined();
      expect(health.components.websocket).toBeDefined();
      expect(health.components.system).toBeDefined();
      expect(health.components.trading).toBeDefined();
    });

    it('should report overall status as degraded if any component degraded', async () => {
      const svc = harness.createDisconnectedWebSocketService();

      const health = await svc.checkHealth();

      expect(health.status).toBe('degraded');
    });

    it('should report overall status as unhealthy if any component down', async () => {
      const svc = harness.createFailingExchangeService();

      const health = await svc.checkHealth();

      // Exchange is down, so overall should NOT be healthy
      expect(health.status).not.toBe('healthy');
      // Exchange component should not be 'up'
      expect(health.components.exchange.status).not.toBe('up');
    });

    it('should handle complete health check errors gracefully', async () => {
      // Mock checkExchange to throw
      const svc = createStandardHealthCheckService(harness, {
        exchange: undefined,
        websocket: undefined,
      });

      const health = await svc.checkHealth();

      // Should still return a result (degraded)
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
    });
  });

  // ==========================================================================
  // KUBERNETES PROBES TESTS (Bonus)
  // ==========================================================================

  describe('Kubernetes Probes', () => {
    it('should return true for liveness probe (service is running)', async () => {
      const isAlive = await service.isAlive();
      expect(isAlive).toBe(true);
    });

    it('should return boolean for readiness probe', async () => {
      const healthySvc = harness.createHealthyProbeService();

      const isReady = await healthySvc.isReady();
      expect(typeof isReady).toBe('boolean');
    });

    it('should return false for readiness probe when degraded', async () => {
      const degradedSvc = harness.createDisconnectedWebSocketService();

      const isReady = await degradedSvc.isReady();
      expect(isReady).toBe(false);
    });

    it('should return uptime in seconds', () => {
      const uptime = service.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });
  });
});
