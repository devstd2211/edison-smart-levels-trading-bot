/**
 * Analyzer Registry Service Tests
 *
 * Tests for centralized analyzer management and signal collection
 */

import { AnalyzerRegistry } from '../../services/analyzer-registry.service';
import {
  LoggerService,
  LogLevel,
  StrategyMarketData,
  SignalDirection,
} from '../../types';
import { createTestMarketData } from '../helpers/test-data.helper';

describe('AnalyzerRegistry', () => {
  let registry: AnalyzerRegistry;
  let logger: LoggerService;
  let mockMarketData: StrategyMarketData;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    registry = new AnalyzerRegistry(logger);

    mockMarketData = createTestMarketData({
      candles: [],
      rsi: 50,
      ema: { fast: 100, slow: 95 },
      trend: 'BULLISH',
      atr: 1.5,
      timestamp: Date.now(),
      currentPrice: 100,
    });
  });

  describe('register', () => {
    it('should register analyzer', () => {
      registry.register('TEST_ANALYZER', {
        name: 'TEST_ANALYZER',
        weight: 0.5,
        priority: 5,
        enabled: true,
        evaluate: async () => null,
      });

      expect(registry.getCount()).toBe(1);
      expect(registry.getAnalyzer('TEST_ANALYZER')).toBeDefined();
    });

    it('should register multiple analyzers', () => {
      registry.registerBatch([
        {
          name: 'ANALYZER1',
          weight: 0.3,
          priority: 5,
          enabled: true,
          evaluate: async () => null,
        },
        {
          name: 'ANALYZER2',
          weight: 0.4,
          priority: 6,
          enabled: true,
          evaluate: async () => null,
        },
        {
          name: 'ANALYZER3',
          weight: 0.3,
          priority: 4,
          enabled: false,
          evaluate: async () => null,
        },
      ]);

      expect(registry.getCount()).toBe(3);
      expect(registry.getEnabledCount()).toBe(2);
    });
  });

  describe('collectSignals', () => {
    it('should collect signals from enabled analyzers', async () => {
      registry.register('LONG_SIGNAL', {
        name: 'LONG_SIGNAL',
        weight: 0.4,
        priority: 5,
        enabled: true,
        evaluate: async () => ({
          source: 'LONG_SIGNAL',
          direction: SignalDirection.LONG,
          confidence: 75,
          weight: 0.4,
          priority: 5,
        }),
      });

      registry.register('SHORT_SIGNAL', {
        name: 'SHORT_SIGNAL',
        weight: 0.3,
        priority: 6,
        enabled: true,
        evaluate: async () => ({
          source: 'SHORT_SIGNAL',
          direction: SignalDirection.SHORT,
          confidence: 60,
          weight: 0.3,
          priority: 6,
        }),
      });

      const signals = await registry.collectSignals(mockMarketData);

      expect(signals.length).toBe(2);
      expect(signals[0].direction).toBe(SignalDirection.LONG);
      expect(signals[1].direction).toBe(SignalDirection.SHORT);
    });

    it('should skip disabled analyzers', async () => {
      registry.register('ENABLED', {
        name: 'ENABLED',
        weight: 0.5,
        priority: 5,
        enabled: true,
        evaluate: async () => ({
          source: 'ENABLED',
          direction: SignalDirection.LONG,
          confidence: 70,
          weight: 0.5,
          priority: 5,
        }),
      });

      registry.register('DISABLED', {
        name: 'DISABLED',
        weight: 0.5,
        priority: 5,
        enabled: false,
        evaluate: async () => ({
          source: 'DISABLED',
          direction: SignalDirection.LONG,
          confidence: 90,
          weight: 0.5,
          priority: 5,
        }),
      });

      const signals = await registry.collectSignals(mockMarketData);

      expect(signals.length).toBe(1);
      expect(signals[0].source).toBe('ENABLED');
    });

    it('should skip null signals', async () => {
      registry.register('RETURNS_NULL', {
        name: 'RETURNS_NULL',
        weight: 0.3,
        priority: 5,
        enabled: true,
        evaluate: async () => null,
      });

      registry.register('RETURNS_SIGNAL', {
        name: 'RETURNS_SIGNAL',
        weight: 0.4,
        priority: 6,
        enabled: true,
        evaluate: async () => ({
          source: 'RETURNS_SIGNAL',
          direction: SignalDirection.LONG,
          confidence: 70,
          weight: 0.4,
          priority: 6,
        }),
      });

      const signals = await registry.collectSignals(mockMarketData);

      expect(signals.length).toBe(1);
      expect(signals[0].source).toBe('RETURNS_SIGNAL');
    });

    it('should handle analyzer errors gracefully', async () => {
      registry.register('ERROR_ANALYZER', {
        name: 'ERROR_ANALYZER',
        weight: 0.3,
        priority: 5,
        enabled: true,
        evaluate: async () => {
          throw new Error('Analyzer failed');
        },
      });

      registry.register('GOOD_ANALYZER', {
        name: 'GOOD_ANALYZER',
        weight: 0.4,
        priority: 6,
        enabled: true,
        evaluate: async () => ({
          source: 'GOOD_ANALYZER',
          direction: SignalDirection.LONG,
          confidence: 70,
          weight: 0.4,
          priority: 6,
        }),
      });

      const signals = await registry.collectSignals(mockMarketData);

      // Should skip error analyzer and continue with good one
      expect(signals.length).toBe(1);
      expect(signals[0].source).toBe('GOOD_ANALYZER');
    });

    it('should return empty array when no analyzers enabled', async () => {
      registry.register('DISABLED', {
        name: 'DISABLED',
        weight: 0.5,
        priority: 5,
        enabled: false,
        evaluate: async () => null,
      });

      const signals = await registry.collectSignals(mockMarketData);

      expect(signals.length).toBe(0);
    });
  });

  describe('setWeight', () => {
    it('should update analyzer weight', () => {
      registry.register('TEST', {
        name: 'TEST',
        weight: 0.5,
        priority: 5,
        enabled: true,
        evaluate: async () => null,
      });

      registry.setWeight('TEST', 0.8);
      const analyzer = registry.getAnalyzer('TEST');

      expect(analyzer?.weight).toBe(0.8);
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable analyzer', () => {
      registry.register('TEST', {
        name: 'TEST',
        weight: 0.5,
        priority: 5,
        enabled: true,
        evaluate: async () => null,
      });

      expect(registry.getEnabledCount()).toBe(1);

      registry.setEnabled('TEST', false);
      expect(registry.getEnabledCount()).toBe(0);

      registry.setEnabled('TEST', true);
      expect(registry.getEnabledCount()).toBe(1);
    });
  });

  describe('getStatus', () => {
    it('should return registry status', () => {
      registry.register('ANALYZER1', {
        name: 'ANALYZER1',
        weight: 0.4,
        priority: 5,
        enabled: true,
        evaluate: async () => null,
      });

      registry.register('ANALYZER2', {
        name: 'ANALYZER2',
        weight: 0.3,
        priority: 6,
        enabled: false,
        evaluate: async () => null,
      });

      const status = registry.getStatus();

      expect(status.totalAnalyzers).toBe(2);
      expect(status.enabledAnalyzers).toBe(1);
      expect((status.analyzers as any[]).length).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all analyzers', () => {
      registry.registerBatch([
        {
          name: 'A1',
          weight: 0.3,
          priority: 5,
          enabled: true,
          evaluate: async () => null,
        },
        {
          name: 'A2',
          weight: 0.4,
          priority: 6,
          enabled: true,
          evaluate: async () => null,
        },
      ]);

      expect(registry.getCount()).toBe(2);
      registry.clear();
      expect(registry.getCount()).toBe(0);
    });
  });

  describe('parallel execution', () => {
    it('should execute analyzers in parallel', async () => {
      const executionOrder: string[] = [];

      registry.register('ANALYZER1', {
        name: 'ANALYZER1',
        weight: 0.4,
        priority: 5,
        enabled: true,
        evaluate: async () => {
          executionOrder.push('A1');
          await new Promise((r) => setTimeout(r, 10));
          return {
            source: 'ANALYZER1',
            direction: SignalDirection.LONG,
            confidence: 70,
            weight: 0.4,
            priority: 5,
          };
        },
      });

      registry.register('ANALYZER2', {
        name: 'ANALYZER2',
        weight: 0.3,
        priority: 6,
        enabled: true,
        evaluate: async () => {
          executionOrder.push('A2');
          await new Promise((r) => setTimeout(r, 5));
          return {
            source: 'ANALYZER2',
            direction: SignalDirection.SHORT,
            confidence: 60,
            weight: 0.3,
            priority: 6,
          };
        },
      });

      const signals = await registry.collectSignals(mockMarketData);

      // Both should complete and signals should be collected
      expect(signals.length).toBe(2);
      // Order doesn't matter for parallel execution
      expect(executionOrder.sort()).toEqual(['A1', 'A2']);
    });
  });
});
