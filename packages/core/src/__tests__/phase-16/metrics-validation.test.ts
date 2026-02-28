/**
 * Phase 16.3: Metrics Infrastructure Validation
 */

import { PrometheusMetricsService } from '../../services/prometheus-metrics.service';
import { BotMetricsService } from '../../services/bot-metrics.service';
import { ErrorRegistry } from '../../errors/ErrorRegistry';
import { LoggerService } from '../../services/logger.service';
import { ValidationError } from '../../errors/DomainErrors';
import { ErrorSeverity } from '../../errors/BaseError';
import type { TradeMetrics } from '../../services/bot-metrics.service';

describe('Phase 16.3: Metrics Infrastructure Validation', () => {
  let logger: LoggerService;

  beforeEach(() => {
    logger = new LoggerService('info', './logs', false);
    ErrorRegistry.clear();
  });

  afterEach(() => { ErrorRegistry.clear(); });

  describe('PrometheusMetricsService', () => {
    it('should initialize', () => {
      const service = new PrometheusMetricsService({ prefix: 'test_' }, logger);
      expect(service).toBeDefined();
    });

    it('should export metrics', async () => {
      const service = new PrometheusMetricsService({}, logger);
      const metrics = await service.getMetrics();
      expect(typeof metrics).toBe('string');
    });
  });

  describe('BotMetricsService', () => {
    it('should record trades', () => {
      const service = new BotMetricsService(logger);
      const trade: TradeMetrics = {
        id: 'trade-1',
        direction: 'LONG',
        entryPrice: 50000,
        exitPrice: 51000,
        quantity: 0.1,
        pnl: 100,
        pnlPercent: 2,
        duration: 3600000,
        exitType: 'TP1',
        timestamp: Date.now()
      };
      service.recordTrade(trade);
      expect(service.getPerformanceMetrics().totalTrades).toBe(1);
    });

    it('should reset metrics', () => {
      const service = new BotMetricsService(logger);
      service.reset();
      expect(service.getPerformanceMetrics().totalTrades).toBe(0);
    });
  });

  describe('ErrorRegistry', () => {
    it('should track errors', () => {
      const error = new ValidationError('Test', { field: 'test', value: null, constraint: 'required' });
      ErrorRegistry.record(error);
      expect(ErrorRegistry.getStats()).toHaveLength(1);
    });

    it('should clear stats', () => {
      const error = new ValidationError('Test', { field: 'test', value: null, constraint: 'required' });
      ErrorRegistry.record(error);
      ErrorRegistry.clear();
      expect(ErrorRegistry.getStats()).toEqual([]);
    });
  });
});
