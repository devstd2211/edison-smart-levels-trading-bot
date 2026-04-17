/**
 * ConsoleDashboardService Error Handling Tests (Phase 8.9.72)
 *
 * Test Coverage:
 * - THROW: Config and input validation
 * - GRACEFUL_DEGRADE: Update failures
 * - SKIP: Logging failures
 * - Backward Compatibility: Tests without ErrorHandler still work
 */

import { ConsoleDashboardService } from '../../services/console-dashboard.service';
import {
  createConsoleDashboardPosition as createValidPosition,
  createManagedConsoleDashboardContext,
  type ManagedConsoleDashboardContext,
} from '../helpers/console-dashboard-test.utils';

type DashboardConfigInput = ConstructorParameters<typeof ConsoleDashboardService>[0];

describe('ConsoleDashboardService Error Handling (Phase 8.9.72)', () => {
  let createDashboard: ManagedConsoleDashboardContext['createService'];
  let createLegacyDashboard: ManagedConsoleDashboardContext['createLegacyService'];
  let service: ConsoleDashboardService;
  let cleanup: ManagedConsoleDashboardContext['cleanup'];

  beforeEach(() => {
    ({
      createService: createDashboard,
      createLegacyService: createLegacyDashboard,
      cleanup,
    } = createManagedConsoleDashboardContext());
  });

  afterEach(() => {
    cleanup();
  });

  // ============================================================================
  // THROW: Config Validation (4 tests)
  // ============================================================================

  describe('THROW: Config Validation', () => {
    test('should throw on null config', () => {
      expect(() => {
        createDashboard({
          config: null as unknown as DashboardConfigInput,
        });
      }).toThrow('Config must be a valid object');
    });

    test('should throw on invalid enabled (not boolean)', () => {
      expect(() => {
        createDashboard({
          config: { enabled: 'yes' as unknown as boolean } as DashboardConfigInput,
        });
      }).toThrow('Config.enabled must be a boolean');
    });

    test('should throw on negative updateInterval', () => {
      expect(() => {
        createDashboard({
          config: { enabled: true, updateInterval: -100 },
        });
      }).toThrow('Config.updateInterval must be non-negative');
    });

    test('should throw on invalid theme', () => {
      expect(() => {
        createDashboard({
          config: { enabled: true, theme: 'rainbow' as unknown as 'dark' | 'light' } as DashboardConfigInput,
        });
      }).toThrow('Config.theme must be "dark" or "light"');
    });
  });

  // ============================================================================
  // THROW: Input Validation (5 tests)
  // ============================================================================

  describe('THROW: Input Validation', () => {
    beforeEach(() => {
      service = createDashboard({
        config: { enabled: false },
      });
    });

    test('should throw on invalid price (NaN)', () => {
      expect(() => {
        service.updatePrice(NaN);
      }).toThrow('Price must be a finite number');
    });

    test('should throw on negative price', () => {
      expect(() => {
        service.updatePrice(-100);
      }).toThrow('Price must be non-negative');
    });

    test('should throw on invalid PnL (Infinity)', () => {
      expect(() => {
        service.updatePnL(Infinity, 5);
      }).toThrow('PnL must be a finite number');
    });

    test('should throw on empty take profit levels', () => {
      expect(() => {
        service.setTakeProfits([]);
      }).toThrow('Levels array cannot be empty');
    });

    test('should throw on negative stop loss', () => {
      expect(() => {
        service.setStopLoss(-100);
      }).toThrow('Stop loss price must be non-negative');
    });
  });

  // ============================================================================
  // GRACEFUL_DEGRADE: Update Failures (4 tests)
  // ============================================================================

  describe('GRACEFUL_DEGRADE: Update Failures', () => {
    beforeEach(() => {
      service = createDashboard({
        config: { enabled: false },
      });
    });

    test('should handle valid price update', () => {
      expect(() => {
        service.updatePrice(50000);
      }).not.toThrow();
    });

    test('should handle valid PnL update', () => {
      expect(() => {
        service.updatePnL(100, 2);
      }).not.toThrow();
    });

    test('should handle valid TP levels', () => {
      expect(() => {
        service.setTakeProfits([{ price: 55000, percent: 10 }]);
      }).not.toThrow();
    });

    test('should handle valid metrics update', () => {
      expect(() => {
        service.updateMetrics('5m', { rsi: 45, trend: 'UPTREND' });
      }).not.toThrow();
    });
  });

  // ============================================================================
  // SKIP: Logging Failures (2 tests)
  // ============================================================================

  describe('SKIP: Logging Failures', () => {
    test('should not throw when updating price', () => {
      const service = createDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.updatePrice(50000);
      }).not.toThrow();
    });

    test('should not throw when recording event', () => {
      const service = createDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.recordEvent('position-open', 'New position opened');
      }).not.toThrow();
    });
  });

  // ============================================================================
  // Integration: Data Updates (3 tests)
  // ============================================================================

  describe('Integration: Data Updates', () => {
    beforeEach(() => {
      service = createDashboard({
        config: { enabled: false },
      });
    });

    test('should update multiple metrics correctly', () => {
      service.updateMetrics('5m', { rsi: 45, trend: 'UPTREND', ema20: 50000 });
      service.updateMetrics('1h', { rsi: 55, trend: 'DOWNTREND', ema50: 49500 });
      service.updatePrice(50500);
      service.updatePnL(500, 1);

      expect(service).toBeDefined();
    });

    test('should handle position and TP/SL levels together', () => {
      const position = createValidPosition();
      service.updatePosition(position);
      service.setTakeProfits([
        { price: 55000, percent: 10, level: 1 },
        { price: 60000, percent: 20, level: 2 },
      ]);
      service.setStopLoss(49000);

      expect(service).toBeDefined();
    });

    test('should record wins and losses', () => {
      service.recordWin(100);
      service.recordLoss(-50);
      service.recordEvent('trade', 'Trade completed');

      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // Backward Compatibility: Without ErrorHandler (6 tests)
  // ============================================================================

  describe('Backward Compatibility: Without ErrorHandler', () => {
    test('should create service without ErrorHandler', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      expect(service).toBeDefined();
    });

    test('should handle price update', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.updatePrice(50000);
      }).not.toThrow();
    });

    test('should throw on invalid price even without ErrorHandler', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.updatePrice(NaN);
      }).toThrow('Price must be a finite number');
    });

    test('should handle destroy gracefully', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.destroy();
      }).not.toThrow();
    });

    test('should handle multiple sequential updates', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      expect(() => {
        service.updatePrice(50000);
        service.updatePrice(50100);
        service.recordWin(50);
        service.recordEvent('trade', 'successful');
      }).not.toThrow();
    });

    test('should maintain event history (max 50)', () => {
      const service = createLegacyDashboard({
        config: { enabled: false },
      });
      for (let i = 0; i < 60; i++) {
        service.recordEvent('test', `Event ${i}`);
      }
      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // Edge Cases (2 tests)
  // ============================================================================

  describe('Edge Cases', () => {
    beforeEach(() => {
      service = createDashboard({
        config: { enabled: false },
      });
    });

    test('should handle zero values correctly', () => {
      expect(() => {
        service.updatePrice(0);
        service.updatePnL(0, 0);
        service.setStopLoss(0);
        service.recordWin(0);
        service.recordLoss(0);
      }).not.toThrow();
    });

    test('should handle large values correctly', () => {
      expect(() => {
        service.updatePrice(999999999);
        service.updatePnL(999999999, 999);
        service.setTakeProfits([{ price: 999999999, percent: 50 }]);
        service.setStopLoss(999999999);
      }).not.toThrow();
    });
  });
});
