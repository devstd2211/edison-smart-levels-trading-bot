/**
 * Error Handling Tests for TakeProfitManagerService (Phase 8.9.22)
 *
 * Tests cover:
 * 1. Quantity validation with THROW strategy
 * 2. PnL calculation with GRACEFUL_DEGRADE strategy (implicit fallback)
 * 3. Logger failures with SKIP strategy (non-blocking)
 * 4. Integration scenarios with cascading failures
 * 5. Backward compatibility (without ErrorHandler)
 *
 * Total: 18 tests
 */

import { TakeProfitManagerService } from '../../services/take-profit-manager.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { LoggerService, PositionSide, LogLevel } from '../../types';
import { TakeProfitCalculationError } from '../../errors/DomainErrors';

describe('TakeProfitManagerService - Error Handling (Phase 8.9.22)', () => {
  let logger: LoggerService;
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    errorHandler = new ErrorHandler(logger);
  });

  // ============================================================================
  // TEST GROUP 1: Quantity Validation (THROW strategy)
  // ============================================================================

  describe('Quantity Validation - THROW Strategy (3 tests)', () => {
    it('should THROW when recording close exceeds total quantity', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_qty_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 50, 1.1676);

      // Should throw when exceeding total quantity
      expect(() => {
        manager.recordPartialClose(2, 50, 1.1617); // 50 + 50 = 100 > 85.2
      }).toThrow();
    });

    it('should preserve state after THROW (no partial state)', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_qty_002',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 50, 1.1676);

      try {
        manager.recordPartialClose(2, 50, 1.1617); // Will throw
      } catch {
        // Expected to throw
      }

      // State should be unchanged (only 1 partial close recorded)
      expect(manager.getPartialCloses()).toHaveLength(1);
      expect(manager.getTotalQuantityClosed()).toBe(50);
    });

    it('should work without ErrorHandler - keep original behavior', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_qty_003',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        // No ErrorHandler
      );

      manager.recordPartialClose(1, 85, 1.1676); // Use 85 of 85.2

      expect(() => {
        manager.recordPartialClose(2, 1, 1.1617); // 85 + 1 = 86 > 85.2
      }).toThrow();
    });
  });

  // ============================================================================
  // TEST GROUP 2: ErrorHandler Integration with GRACEFUL_DEGRADE
  // ============================================================================

  describe('ErrorHandler Integration - GRACEFUL_DEGRADE (3 tests)', () => {
    it('should record close even with ErrorHandler in use', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_eh_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Record with ErrorHandler
      const close = manager.recordPartialClose(1, 28.4, 1.1676);

      expect(close).toBeDefined();
      expect(close.level).toBe(1);
      expect(close.quantity).toBe(28.4);
      expect(manager.getTotalQuantityClosed()).toBe(28.4);
    });

    it('should handle PnL calculation correctly with ErrorHandler', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_eh_002',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Record 3 TP levels
      const close1 = manager.recordPartialClose(1, 28.4, 1.1676);
      const close2 = manager.recordPartialClose(2, 28.4, 1.1617);
      const close3 = manager.recordPartialClose(3, 28.4, 1.1363);

      // All should be recorded
      expect(manager.getPartialCloses()).toHaveLength(3);
      expect(manager.isFullyClosed()).toBe(true);

      // PnL should be calculated
      const total = manager.getTotalPnL();
      expect(total.pnlNet).toBeGreaterThan(0);
    });

    it('should maintain PnL calculation accuracy with ErrorHandler', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_eh_003',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Record partial closes
      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      const total = manager.getTotalPnL();

      // Verify PnL calculations match expected ranges
      expect(total.pnlNet).toBeGreaterThan(16.4);
      expect(total.pnlNet).toBeLessThan(16.8);
      expect(total.fees).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // TEST GROUP 3: Logger Failures - SKIP Strategy (Non-blocking)
  // ============================================================================

  describe('Logger Failures - SKIP Strategy (3 tests)', () => {
    it('should NOT block on logger errors (SKIP strategy)', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_log_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Mock logger to throw
      logger.info = jest.fn(() => {
        throw new Error('Logger failed - network unreachable');
      });

      // Should NOT throw, should complete and record close
      const close = manager.recordPartialClose(1, 28.4, 1.1676);

      expect(close).toBeDefined();
      expect(manager.getPartialCloses()).toHaveLength(1);
      expect(manager.getTotalQuantityClosed()).toBe(28.4);
    });

    it('should record multiple closes despite logger failures', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_log_002',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Mock logger to fail on all calls
      logger.info = jest.fn(() => {
        throw new Error('Logger service unavailable');
      });

      // Record 3 closes despite logger errors
      const close1 = manager.recordPartialClose(1, 28.4, 1.1676);
      const close2 = manager.recordPartialClose(2, 28.4, 1.1617);
      const close3 = manager.recordPartialClose(3, 28.4, 1.1363);

      // All closes should be recorded
      expect(manager.getPartialCloses()).toHaveLength(3);
      expect(manager.isFullyClosed()).toBe(true);
      expect(close1.pnlNet).toBeGreaterThan(0);
      expect(close2.pnlNet).toBeGreaterThan(0);
      expect(close3.pnlNet).toBeGreaterThan(0);
    });

    it('should handle intermittent logger failures gracefully', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_log_003',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Mock logger to fail intermittently
      let callCount = 0;
      logger.info = jest.fn(() => {
        callCount++;
        if (callCount === 2) throw new Error('Transient logger error');
        // Others succeed
      });

      // Should handle mixed success/failure
      const close1 = manager.recordPartialClose(1, 28.4, 1.1676); // Success
      const close2 = manager.recordPartialClose(2, 28.4, 1.1617); // Logger fails, but close recorded
      const close3 = manager.recordPartialClose(3, 28.4, 1.1363); // Success

      expect(manager.isFullyClosed()).toBe(true);
      expect(manager.getPartialCloses()).toHaveLength(3);
    });
  });

  // ============================================================================
  // TEST GROUP 4: calculateFinalPnL - GRACEFUL_DEGRADE
  // ============================================================================

  describe('calculateFinalPnL - GRACEFUL_DEGRADE Strategy (3 tests)', () => {
    it('should calculate final PnL with ErrorHandler', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_final_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);

      // Calculate final PnL with ErrorHandler
      const finalPnL = manager.calculateFinalPnL(1.1500);

      expect(finalPnL.partialPnL).toBeDefined();
      expect(finalPnL.remainingPnL).toBeDefined();
      expect(finalPnL.totalPnL).toBeDefined();
      expect(finalPnL.totalPnL.pnlNet).toBeGreaterThan(0);
    });

    it('should handle extreme prices in calculation', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_final_002',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 0.0001,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 28.4, 0.00009);

      // Should handle extreme prices without crashing
      const finalPnL = manager.calculateFinalPnL(0.00008);

      expect(finalPnL).toBeDefined();
      expect(finalPnL.totalPnL).toBeDefined();
    });

    it('should return consistent PnL values', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_final_003',
          symbol: 'APEXUSDT',
          side: PositionSide.LONG,
          entryPrice: 1.1500,
          totalQuantity: 100.0,
          leverage: 5,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 25.0, 1.1600);
      manager.recordPartialClose(2, 25.0, 1.1650);

      const finalPnL = manager.calculateFinalPnL(1.1700);

      // Verify consistency: total = partial + remaining
      const expectedTotal =
        finalPnL.partialPnL.pnlNet + finalPnL.remainingPnL.pnlNet;
      expect(finalPnL.totalPnL.pnlNet).toBeCloseTo(expectedTotal, 2);
    });
  });

  // ============================================================================
  // TEST GROUP 5: Integration - Full Workflow
  // ============================================================================

  describe('Integration - Full TP Workflow (3 tests)', () => {
    it('should handle complete TP1-TP2-TP3 sequence with ErrorHandler', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_integration_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      // Mock logger to fail on TP2
      let callCount = 0;
      logger.info = jest.fn(() => {
        callCount++;
        if (callCount === 2) throw new Error('Logger temporarily unavailable');
      });

      // Execute TP sequence
      const tp1 = manager.recordPartialClose(1, 28.4, 1.1676);
      const tp2 = manager.recordPartialClose(2, 28.4, 1.1617); // Logger fails, but close recorded
      const tp3 = manager.recordPartialClose(3, 28.4, 1.1363);

      // Verify all closes recorded despite logger failure
      expect(manager.isFullyClosed()).toBe(true);
      expect(manager.getPartialCloses()).toHaveLength(3);
      expect(tp1.level).toBe(1);
      expect(tp2.level).toBe(2);
      expect(tp3.level).toBe(3);
    });

    it('should maintain accurate PnL across multiple closes', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_integration_002',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      const total = manager.getTotalPnL();
      const remaining = manager.getRemainingQuantity();

      expect(remaining).toBeCloseTo(0, 1);
      expect(total.pnlNet).toBeGreaterThan(16.4);
      expect(total.fees).toBeGreaterThan(0);
    });

    it('should track TP levels correctly', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_integration_003',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      manager.recordPartialClose(1, 28.4, 1.1676);
      manager.recordPartialClose(2, 28.4, 1.1617);
      manager.recordPartialClose(3, 28.4, 1.1363);

      const tpLevels = manager.getTpLevelsHit();
      expect(tpLevels).toEqual([1, 2, 3]);
    });
  });

  // ============================================================================
  // TEST GROUP 6: Backward Compatibility (No ErrorHandler)
  // ============================================================================

  describe('Backward Compatibility - Without ErrorHandler (3 tests)', () => {
    it('should work identically without ErrorHandler parameter', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_compat_001',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        // No ErrorHandler
      );

      const close = manager.recordPartialClose(1, 28.4, 1.1676);

      expect(close).toBeDefined();
      expect(close.pnlNet).toBeGreaterThan(0);
      expect(close.fees).toBeGreaterThan(0);
    });

    it('should maintain original PnL calculations', () => {
      const managerWithHandler = new TakeProfitManagerService(
        {
          positionId: 'test_compat_with',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        errorHandler,
      );

      const managerWithoutHandler = new TakeProfitManagerService(
        {
          positionId: 'test_compat_without',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
        // No ErrorHandler
      );

      // Both should produce identical results
      const close1 = managerWithHandler.recordPartialClose(1, 28.4, 1.1676);
      const close2 = managerWithoutHandler.recordPartialClose(1, 28.4, 1.1676);

      expect(close1.pnlGross).toBe(close2.pnlGross);
      expect(close1.fees).toBe(close2.fees);
      expect(close1.pnlNet).toBe(close2.pnlNet);
    });

    it('should still throw on validation errors without ErrorHandler', () => {
      const manager = new TakeProfitManagerService(
        {
          positionId: 'test_compat_003',
          symbol: 'APEXUSDT',
          side: PositionSide.SHORT,
          entryPrice: 1.1748,
          totalQuantity: 85.2,
          leverage: 10,
        },
        logger,
      );

      manager.recordPartialClose(1, 85.2, 1.1676); // Full close

      expect(() => {
        manager.recordPartialClose(2, 1, 1.1617); // Exceeds total
      }).toThrow();
    });
  });
});
