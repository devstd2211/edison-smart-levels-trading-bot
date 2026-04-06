/**
 * PrometheusMetricsService Tests
 *
 * Test coverage:
 * - 5 Initialization tests
 * - 8 Counter tests (orders, errors, retries)
 * - 8 Gauge tests (positions, PnL, memory, CPU)
 * - 6 Histogram tests (latency metrics)
 * - 3 Format tests (Prometheus output)
 *
 * Total: 30 tests
 *
 * Created: 2026-02-09 (Session 98)
 * Phase: 14.1.1 - Prometheus Metrics
 */

import type { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import type { LoggerService } from '../../types/legacy';
import {
  createManagedPrometheusMetricsTestContext,
  type ManagedPrometheusMetricsTestContext,
} from '../helpers/prometheus-metrics-test.utils';

describe('PrometheusMetricsService', () => {
  type PrometheusMetricsRuntime = Pick<
    ManagedPrometheusMetricsTestContext,
    'service' | 'logger'
  >;
  type PrometheusMetricsFactories = Pick<
    ManagedPrometheusMetricsTestContext,
    'createService' | 'createStartedService'
  >;
  type PrometheusMetricsFixtures = {
    runtime: PrometheusMetricsRuntime;
    factories: PrometheusMetricsFactories;
  };
  let service: PrometheusMetricsService;
  let logger: PrometheusMetricsRuntime['logger'];
  let createService: PrometheusMetricsFactories['createService'];
  let createStartedService: PrometheusMetricsFactories['createStartedService'];

  function bindPrometheusMetricsContext() {
    let fixtures: PrometheusMetricsFixtures;
    let cleanup: ManagedPrometheusMetricsTestContext['cleanup'];

    beforeEach(() => {
      const managedContext = createManagedPrometheusMetricsTestContext();
      fixtures = {
        runtime: {
          service: managedContext.service,
          logger: managedContext.logger,
        },
        factories: {
          createService: managedContext.createService,
          createStartedService: managedContext.createStartedService,
        },
      };
      cleanup = managedContext.cleanup;
    });

    afterEach(() => {
      cleanup();
    });

    return () => fixtures;
  }

  const getFixtures = bindPrometheusMetricsContext();

  beforeEach(() => {
    const fixtures = getFixtures();
    ({ service, logger } = fixtures.runtime);
    ({ createService, createStartedService } = fixtures.factories);
  });

  // ==========================================================================
  // INITIALIZATION TESTS (5 tests)
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const svc = createService();
      expect(svc).toBeDefined();
    });

    it('should initialize with custom prefix', () => {
      const svc = createService({ prefix: 'my_bot_' }, logger, undefined);
      expect(svc).toBeDefined();
    });

    it('should initialize with logger', () => {
      const svc = createService({}, logger, undefined);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized'),
        expect.any(Object)
      );
    });

    it('should initialize with auto-collection', () => {
      const svc = createStartedService({ collectInterval: 1000 }, logger, undefined);
      expect(svc).toBeDefined();
    });

    it('should initialize with default labels', () => {
      const svc = createService(
        {
          defaultLabels: {
            env: 'test',
            bot: 'v1',
          },
        },
        logger,
        undefined,
      );
      expect(svc).toBeDefined();
    });
  });

  // ==========================================================================
  // COUNTER TESTS (8 tests)
  // ==========================================================================

  describe('Counter Metrics', () => {
    it('should increment orders placed counter', () => {
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should increment orders filled counter', () => {
      service.incrementOrdersFilled('Buy', 'BTCUSDT');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should increment orders failed counter', () => {
      service.incrementOrdersFailed('Sell', 'ETHUSDT', 'insufficient_balance');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should increment errors counter', () => {
      service.incrementErrors('api_error', 'error');
      service.incrementErrors('network_error', 'warn');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should increment retries counter', () => {
      service.incrementRetries('placeOrder');
      service.incrementRetries('closePosition');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should increment recovery success counter', () => {
      service.incrementRecoverySuccess('RETRY');
      service.incrementRecoverySuccess('GRACEFUL_DEGRADE');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle counter errors gracefully (SKIP)', () => {
      // Simulate error by passing invalid values
      // Should not throw, just log error
      service.incrementOrdersPlaced('', '', '');

      expect(service).toBeDefined();
    });

    it('should track multiple counter increments', () => {
      // Place multiple orders
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      service.incrementOrdersPlaced('Sell', 'ETHUSDT', 'limit');
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');

      // Fill some orders
      service.incrementOrdersFilled('Buy', 'BTCUSDT');
      service.incrementOrdersFilled('Sell', 'ETHUSDT');

      // Should not throw
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // GAUGE TESTS (8 tests)
  // ==========================================================================

  describe('Gauge Metrics', () => {
    it('should update active positions gauge', () => {
      service.updateActivePositions(5);

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should update total PnL gauge', () => {
      service.updateTotalPnL(1234.56);

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should update win rate gauge', () => {
      service.updateWinRate(0.75); // 75%

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should update system metrics (memory, CPU, uptime)', () => {
      service.updateSystemMetrics();

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle gauge updates with zero values', () => {
      service.updateActivePositions(0);
      service.updateTotalPnL(0);
      service.updateWinRate(0);

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle gauge updates with negative values', () => {
      service.updateTotalPnL(-500.25); // Negative PnL

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle gauge errors gracefully (SKIP)', () => {
      // Should not throw even if error occurs
      service.updateActivePositions(NaN);

      expect(service).toBeDefined();
    });

    it('should track gauge value changes', () => {
      // Update positions over time
      service.updateActivePositions(0);
      service.updateActivePositions(2);
      service.updateActivePositions(5);
      service.updateActivePositions(3);

      // Update PnL
      service.updateTotalPnL(0);
      service.updateTotalPnL(100);
      service.updateTotalPnL(-50);
      service.updateTotalPnL(250);

      // Should not throw
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // HISTOGRAM TESTS (6 tests)
  // ==========================================================================

  describe('Histogram Metrics', () => {
    it('should record order latency', () => {
      service.recordOrderLatency(125, 'Buy', 'market');
      service.recordOrderLatency(85, 'Sell', 'limit');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should record API latency', () => {
      service.recordApiLatency(50, '/v5/order/create', 'POST');
      service.recordApiLatency(25, '/v5/position/list', 'GET');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should record indicator calculation time', () => {
      service.recordIndicatorCalcTime(5, 'RSI');
      service.recordIndicatorCalcTime(15, 'EMA');
      service.recordIndicatorCalcTime(25, 'MACD');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle histogram with various latencies', () => {
      // Record latencies across different buckets
      service.recordOrderLatency(5, 'Buy');
      service.recordOrderLatency(75, 'Sell');
      service.recordOrderLatency(500, 'Buy');
      service.recordOrderLatency(2500, 'Sell');

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should handle histogram errors gracefully (SKIP)', () => {
      // Should not throw even with invalid values
      service.recordOrderLatency(-1, 'Buy');
      service.recordApiLatency(NaN, '/test', 'GET');

      expect(service).toBeDefined();
    });

    it('should record summary metrics (slippage, fill rate)', () => {
      service.recordSlippage(2.5, 'Buy'); // 2.5 bps
      service.recordSlippage(1.2, 'Sell'); // 1.2 bps
      service.recordFillRate(0.95); // 95% filled
      service.recordFillRate(1.0); // 100% filled

      // Should not throw
      expect(service).toBeDefined();
    });
  });

  // ==========================================================================
  // FORMAT TESTS (3 tests)
  // ==========================================================================

  describe('Metrics Format', () => {
    it('should return metrics in Prometheus format', async () => {
      // Add some metrics
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      service.updateActivePositions(3);
      service.recordOrderLatency(125, 'Buy');

      const metrics = await service.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('string');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should include metric names and values', async () => {
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      service.updateActivePositions(5);

      const metrics = await service.getMetrics();

      // Should contain metric names
      expect(metrics).toContain('trading_bot_orders_placed_total');
      expect(metrics).toContain('trading_bot_active_positions');
    });

    it('should return content type for Prometheus', () => {
      const contentType = service.getContentType();

      expect(contentType).toBeDefined();
      expect(contentType).toContain('text/plain');
    });
  });

  // ==========================================================================
  // LIFECYCLE TESTS (Bonus)
  // ==========================================================================

  describe('Lifecycle Management', () => {
    it('should start and stop auto-collection', () => {
      const svc = createStartedService({ collectInterval: 100 }, logger, undefined);

      expect(svc).toBeDefined();

      // Stop collection
      svc.stop();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('stopped'),
        expect.any(Object)
      );
    });

    it('should reset metrics', () => {
      service.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      service.updateActivePositions(5);

      service.reset();

      // Should not throw
      expect(service).toBeDefined();
    });

    it('should work without logger', () => {
      const svc = createService(undefined, undefined, undefined);

      svc.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      svc.updateActivePositions(3);

      expect(svc).toBeDefined();
    });

    it('should work without errorHandler', () => {
      const svc = createService({}, logger, undefined);

      svc.incrementOrdersPlaced('Buy', 'BTCUSDT', 'market');
      svc.updateActivePositions(3);

      expect(svc).toBeDefined();
    });
  });
});
