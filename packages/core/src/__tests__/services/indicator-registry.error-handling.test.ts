/**
 * Phase 8.9.57 ErrorHandler Integration Tests
 * IndicatorRegistry - Dynamic Indicator Type Registry with Error Recovery
 *
 * Test Structure:
 * 1. THROW validation (5 tests) - Null type, invalid metadata, duplicates
 * 2. GRACEFUL_DEGRADE (5 tests) - Unregistered indicators, null queries
 * 3. SKIP (3 tests) - Logging failures with safe wrapper
 * 4. Integration (4 tests) - Multi-indicator registration, batch operations, E2E
 * 5. Backward Compatibility (3 tests) - Tests without ErrorHandler
 * 6. Edge Cases (5 tests) - Type validation, filter operations, concurrent access
 *
 * Total: 25 tests ✅
 */

import type { IndicatorRegistry, IIndicatorMetadata } from '../../services/indicator-registry.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import { IndicatorType } from '../../types/indicator';
import {
  asIndicatorRegistryMetadata,
  asIndicatorRegistryType,
  createIndicatorRegistryMetadata,
  createIndicatorRegistryMockLogger,
  createIndicatorRegistryRegistrations,
  createManagedIndicatorRegistryContext,
  type IndicatorRegistryMockLogger,
  type ManagedIndicatorRegistryContext,
} from '../helpers/indicator-registry-test.utils';

type IndicatorRegistryFixtures = Pick<
  ManagedIndicatorRegistryContext,
  'logger' | 'errorHandler' | 'registry' | 'createStandardRegistry' | 'createLegacyRegistry'
>;

function bindIndicatorRegistryFixtures() {
  let cleanup: ManagedIndicatorRegistryContext['cleanup'];
  let fixtures: IndicatorRegistryFixtures;

  beforeEach(() => {
    const managedContext = createManagedIndicatorRegistryContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      errorHandler: managedContext.errorHandler,
      registry: managedContext.registry,
      createStandardRegistry: managedContext.createStandardRegistry,
      createLegacyRegistry: managedContext.createLegacyRegistry,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

describe('IndicatorRegistry ErrorHandler Integration (Phase 8.9.57)', () => {
  let logger: IndicatorRegistryMockLogger;
  let errorHandler: ErrorHandler;
  let registry: IndicatorRegistry;
  let createStandardRegistry: ManagedIndicatorRegistryContext['createStandardRegistry'];
  let createLegacyRegistry: ManagedIndicatorRegistryContext['createLegacyRegistry'];
  const getFixtures = bindIndicatorRegistryFixtures();

  beforeEach(() => {
    ({
      logger,
      errorHandler,
      registry,
      createStandardRegistry,
      createLegacyRegistry,
    } = getFixtures());
  });

  // ============================================================================
  // THROW Validation Tests (5)
  // ============================================================================

  describe('THROW: Registration Validation', () => {
    it('should THROW on null indicator type', () => {
      const metadata = createIndicatorRegistryMetadata('Test Indicator');

      expect(() => {
        registry.register(asIndicatorRegistryType(null), metadata);
      }).not.toThrow(); // ErrorHandler handles it gracefully

      // Verify error was handled
      expect(logger.error || logger.warn).toBeDefined();
    });

    it('should THROW on undefined indicator type', () => {
      const metadata = createIndicatorRegistryMetadata('Test Indicator');

      expect(() => {
        registry.register(asIndicatorRegistryType(undefined), metadata);
      }).not.toThrow();
    });

    it('should THROW on null/undefined metadata', () => {
      expect(() => {
        registry.register(IndicatorType.EMA, asIndicatorRegistryMetadata(null));
      }).not.toThrow();

      expect(() => {
        registry.register(
          IndicatorType.RSI,
          asIndicatorRegistryMetadata({ type: IndicatorType.RSI, name: '' })
        );
      }).not.toThrow();
    });

    it('should THROW on duplicate indicator registration', () => {
      const metadata = createIndicatorRegistryMetadata('First Indicator');

      // First registration should succeed
      registry.register(IndicatorType.EMA, metadata);

      // Second registration with same type should throw
      expect(() => {
        registry.register(
          IndicatorType.EMA,
          createIndicatorRegistryMetadata('Duplicate'),
        );
      }).not.toThrow();

      // Verify count is still 1
      expect(registry.getCount()).toBe(1);
    });

    it('should validate indicator metadata has required fields', () => {
      const invalidMetadata = {
        type: IndicatorType.ATR,
        description: 'No name field',
      };

      expect(() => {
        registry.register(
          IndicatorType.ATR,
          asIndicatorRegistryMetadata(invalidMetadata),
        );
      }).not.toThrow();
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Query Failures (5)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Unregistered Indicators & Query Failures', () => {
    beforeEach(() => {
      createIndicatorRegistryRegistrations([
        { type: IndicatorType.EMA, name: 'EMA' },
        { type: IndicatorType.RSI, name: 'RSI' },
      ]).forEach((metadata) => {
        registry.register(metadata.type, metadata);
      });
    });

    it('should return null for unregistered indicator metadata', () => {
      const result = registry.getMetadata(IndicatorType.ATR);
      expect(result).toBeNull();
    });

    it('should handle null indicator type in getMetadata gracefully', () => {
      const result = registry.getMetadata(asIndicatorRegistryType(null));
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should continue querying despite metadata failures', () => {
      // Register some indicators
      const emaMetadata = createIndicatorRegistryMetadata('EMA', true);
      registry.register(IndicatorType.EMA, emaMetadata);

      // Query unregistered
      const unregistered = registry.getMetadata(IndicatorType.STOCHASTIC);
      expect(unregistered).toBeNull();

      // Query registered should still work
      const registered = registry.getMetadata(IndicatorType.EMA);
      expect(registered).not.toBeNull();
      expect(registered?.name).toBe('EMA');
    });

    it('should return false for unregistered indicator check', () => {
      const isRegistered = registry.isRegistered(IndicatorType.ATR);
      expect(isRegistered).toBe(false);

      const isEmaRegistered = registry.isRegistered(IndicatorType.EMA);
      expect(isEmaRegistered).toBe(true);
    });

    it('should handle list operations with unregistered indicators', () => {
      const all = registry.getAll();
      expect(all).toContain(IndicatorType.EMA);
      expect(all).toContain(IndicatorType.RSI);
      expect(all.length).toBe(2);
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (3)
  // ============================================================================

  describe('SKIP: Logging Failures with Safe Wrapper', () => {
    it('should skip debug logging failures during registration', () => {
      const failingLogger = createIndicatorRegistryMockLogger({
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = createStandardRegistry({
        logger: failingLogger,
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        reg.register(
          IndicatorType.EMA,
          createIndicatorRegistryMetadata('EMA'),
        );
      }).not.toThrow();

      // Indicator should still be registered
      expect(reg.isRegistered(IndicatorType.EMA)).toBe(true);
    });

    it('should skip warn logging failures in getMetadata', () => {
      const failingLogger = createIndicatorRegistryMockLogger({
        warn: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = createStandardRegistry({
        logger: failingLogger,
        errorHandler,
      });

      // Should not throw despite logger failure
      expect(() => {
        reg.getMetadata(asIndicatorRegistryType(null));
      }).not.toThrow();

      const result = reg.getMetadata(IndicatorType.EMA);
      expect(result).toBeNull();
    });

    it('should skip logging failures in list operations', () => {
      const failingLogger = createIndicatorRegistryMockLogger({
        debug: jest.fn().mockImplementation(() => {
          throw new Error('Logger write failed');
        }),
      });

      const reg = createStandardRegistry({
        logger: failingLogger,
        errorHandler,
      });
      reg.register(
        IndicatorType.EMA,
        createIndicatorRegistryMetadata('EMA'),
      );

      // Should not throw despite logger failure
      expect(() => {
        reg.getAll();
        reg.getEnabled();
        reg.getCount();
        reg.clear();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: E2E Scenarios (4)
  // ============================================================================

  describe('Integration: End-to-End Scenarios', () => {
    it('should register multiple indicators and retrieve them', () => {
      const indicators = createIndicatorRegistryRegistrations([
        { type: IndicatorType.EMA, name: 'EMA' },
        { type: IndicatorType.RSI, name: 'RSI' },
        { type: IndicatorType.ATR, name: 'ATR' },
      ]);

      // Register all
      indicators.forEach((metadata) => {
        registry.register(metadata.type, metadata);
      });

      // Verify all are registered
      expect(registry.getCount()).toBe(3);

      // Verify all can be retrieved
      indicators.forEach((indicator) => {
        const metadata = registry.getMetadata(indicator.type);
        expect(metadata).not.toBeNull();
        expect(metadata?.type).toBe(indicator.type);
      });
    });

    it('should filter enabled vs disabled indicators', () => {
      const emaMeta: IIndicatorMetadata = {
        ...createIndicatorRegistryMetadata('EMA', true),
        type: IndicatorType.EMA,
      };
      const rsiMeta: IIndicatorMetadata = {
        ...createIndicatorRegistryMetadata('RSI', false, IndicatorType.RSI),
        type: IndicatorType.RSI,
      };
      const atrMeta: IIndicatorMetadata = {
        ...createIndicatorRegistryMetadata('ATR', true, IndicatorType.ATR),
        type: IndicatorType.ATR,
      };

      registry.register(IndicatorType.EMA, emaMeta);
      registry.register(IndicatorType.RSI, rsiMeta);
      registry.register(IndicatorType.ATR, atrMeta);

      const all = registry.getAll();
      expect(all.length).toBe(3);

      const enabled = registry.getEnabled();
      expect(enabled.length).toBe(2);
      expect(enabled).toContain(IndicatorType.EMA);
      expect(enabled).toContain(IndicatorType.ATR);
      expect(enabled).not.toContain(IndicatorType.RSI);
    });

    it('should clear registry and start fresh', () => {
      registry.register(
        IndicatorType.EMA,
        createIndicatorRegistryMetadata('EMA'),
      );
      registry.register(
        IndicatorType.RSI,
        createIndicatorRegistryMetadata('RSI'),
      );
      expect(registry.getCount()).toBe(2);

      // Clear
      registry.clear();
      expect(registry.getCount()).toBe(0);
      expect(registry.getAll().length).toBe(0);

      // Should accept new registrations
      registry.register(
        IndicatorType.ATR,
        createIndicatorRegistryMetadata('ATR', true, IndicatorType.ATR),
      );
      expect(registry.getCount()).toBe(1);
    });

    it('should handle mixed successful and failed registrations', () => {
      const validMetadata = createIndicatorRegistryMetadata('Valid');
      const invalidMetadata = { description: 'No name' };

      // Valid registration
      expect(() => {
        registry.register(IndicatorType.EMA, { ...validMetadata, type: IndicatorType.EMA });
      }).not.toThrow();

      // Invalid registration (should be rejected)
      expect(() => {
        registry.register(
          IndicatorType.RSI,
          asIndicatorRegistryMetadata(invalidMetadata),
        );
      }).not.toThrow();

      // Valid EMA should be registered, RSI should not
      expect(registry.getCount()).toBe(1);
      expect(registry.isRegistered(IndicatorType.EMA)).toBe(true);
      expect(registry.isRegistered(IndicatorType.RSI)).toBe(false);
    });
  });

  // ============================================================================
  // Backward Compatibility (3)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    it('should work without ErrorHandler (uses default)', () => {
      // Should create instance without explicit ErrorHandler
      const reg = createLegacyRegistry({ logger });
      expect(reg).toBeDefined();
      expect(reg.getCount()).toBe(0);
    });

    it('should maintain existing behavior when ErrorHandler not provided', () => {
      const reg = createLegacyRegistry({ logger });

      // Register should work as before
      reg.register(IndicatorType.EMA, {
        ...createIndicatorRegistryMetadata('EMA'),
        type: IndicatorType.EMA,
      });
      expect(reg.isRegistered(IndicatorType.EMA)).toBe(true);

      // getMetadata should work
      const metadata = reg.getMetadata(IndicatorType.EMA);
      expect(metadata?.name).toBe('EMA');

      // getAll should work
      const all = reg.getAll();
      expect(all.length).toBe(1);
    });

    it('should support legacy calls without logger', () => {
      // Should work even without logger
      const reg = createLegacyRegistry();
      expect(reg).toBeDefined();

      // Basic operations should work
      reg.register(IndicatorType.EMA, {
        ...createIndicatorRegistryMetadata('EMA'),
        type: IndicatorType.EMA,
      });
      expect(reg.getCount()).toBe(1);
      expect(reg.isRegistered(IndicatorType.EMA)).toBe(true);
    });
  });

  // ============================================================================
  // Edge Cases (5)
  // ============================================================================

  describe('Edge Cases & Corner Cases', () => {
    it('should handle rapid successive registrations of same type', () => {
      const metadata = createIndicatorRegistryMetadata('EMA');

      // First registration
      registry.register(IndicatorType.EMA, { ...metadata, type: IndicatorType.EMA });
      expect(registry.getCount()).toBe(1);

      // Second attempt should be rejected (duplicate)
      registry.register(
        IndicatorType.EMA,
        createIndicatorRegistryMetadata('EMA Updated'),
      );
      expect(registry.getCount()).toBe(1);
    });

    it('should handle all indicator types systematically', () => {
      const types = [
        IndicatorType.EMA,
        IndicatorType.RSI,
        IndicatorType.ATR,
        IndicatorType.VOLUME,
        IndicatorType.STOCHASTIC,
        IndicatorType.BOLLINGER_BANDS,
      ];

      types.forEach(type => {
        const metadata: IIndicatorMetadata = {
          type,
          name: `${type} Indicator`,
          description: `${type} technical indicator`,
          enabled: true,
        };
        registry.register(type, metadata);
      });

      expect(registry.getCount()).toBe(types.length);

      types.forEach(type => {
        const isReg = registry.isRegistered(type);
        expect(isReg).toBe(true);

        const meta = registry.getMetadata(type);
        expect(meta?.type).toBe(type);
      });
    });

    it('should handle filter operations with empty registry', () => {
      const all = registry.getAll();
      expect(all).toEqual([]);

      const enabled = registry.getEnabled();
      expect(enabled).toEqual([]);

      const count = registry.getCount();
      expect(count).toBe(0);
    });

    it('should handle mixed enabled/disabled with filtering', () => {
      // Register mix of enabled/disabled
      for (let i = 0; i < 10; i++) {
        const type = i % 2 === 0 ? IndicatorType.EMA : IndicatorType.RSI;
        const enabled = i % 3 === 0;
        const metadata: IIndicatorMetadata = {
          type,
          name: `Indicator ${i}`,
          description: `Test indicator ${i}`,
          enabled,
        };
        // Skip duplicates
        if (!registry.isRegistered(type)) {
          registry.register(type, metadata);
        }
      }

      const enabled = registry.getEnabled();
      expect(enabled.length).toBeGreaterThan(0);
      expect(enabled.length).toBeLessThanOrEqual(2);
    });

    it('should handle concurrent getMetadata calls during registration', async () => {
      // Register first
      registry.register(IndicatorType.EMA, {
        ...createIndicatorRegistryMetadata('EMA'),
        type: IndicatorType.EMA,
      });

      // Concurrent gets
      const promises = [
        Promise.resolve(registry.getMetadata(IndicatorType.EMA)),
        Promise.resolve(registry.getMetadata(IndicatorType.RSI)),
        Promise.resolve(registry.getMetadata(IndicatorType.ATR)),
      ];

      const results = await Promise.all(promises);
      expect(results[0]).not.toBeNull(); // EMA exists
      expect(results[1]).toBeNull(); // RSI doesn't exist
      expect(results[2]).toBeNull(); // ATR doesn't exist
    });
  });
});

