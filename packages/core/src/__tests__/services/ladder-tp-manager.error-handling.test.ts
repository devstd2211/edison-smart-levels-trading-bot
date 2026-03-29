/**
 * Error Handling Tests for LadderTpManagerService (Phase 8.9.26)
 *
 * Coverage:
 * - Configuration validation with THROW strategy
 * - Partial close execution with RETRY strategy
 * - Move to breakeven with RETRY + FALLBACK strategies
 * - Move trailing SL with RETRY + GRACEFUL_DEGRADE strategies
 * - Logger failures with SKIP strategy
 * - Backward compatibility without ErrorHandler
 * - Integration scenarios with cascading failures
 */

import { LadderTpManagerService } from '../../services/ladder-tp-manager.service';
import { ErrorHandler, RecoveryStrategy } from '../../errors/ErrorHandler';
import { ConfigurationError, ExitExecutionError, PositionProtectionError } from '../../errors/DomainErrors';
import {
  LoggerService,
  LogLevel,
  SignalDirection,
  PositionSide,
  LadderTpManagerConfig,
  Position,
} from '../../types/legacy';
import type { IExchange } from '../../interfaces/IExchange';
import {
  createLadderTpConfig,
  createManagedLadderTpContext,
  createLadderTpPosition,
  type ManagedLadderTpContext,
} from '../helpers/ladder-tp-manager-test.utils';

function bindLadderTpContext() {
  let cleanup: ManagedLadderTpContext['cleanup'];
  let fixtures: Pick<
    ManagedLadderTpContext,
    'logger' | 'bybitService' | 'errorHandler' | 'createStandardService' | 'createLegacyService'
  >;

  beforeEach(() => {
    const managedContext = createManagedLadderTpContext();
    cleanup = managedContext.cleanup;
    fixtures = {
      logger: managedContext.logger,
      bybitService: managedContext.bybitService,
      errorHandler: managedContext.errorHandler,
      createStandardService: managedContext.createStandardService,
      createLegacyService: managedContext.createLegacyService,
    };
  });

  afterEach(() => {
    cleanup();
  });

  return () => fixtures;
}

// ============================================================================
// MOCKS & HELPERS
// ============================================================================

// ============================================================================
// TEST SUITE
// ============================================================================

describe('LadderTpManagerService - Error Handling (Phase 8.9.26)', () => {
  type LadderTpFixtures = Pick<
    ManagedLadderTpContext,
    'logger' | 'bybitService' | 'errorHandler' | 'createStandardService' | 'createLegacyService'
  >;
  let logger: LoggerService;
  let bybitService: jest.Mocked<IExchange>;
  let errorHandler: ErrorHandler;
  let createStandardService: ManagedLadderTpContext['createStandardService'];
  let createLegacyService: ManagedLadderTpContext['createLegacyService'];
  const getContext = bindLadderTpContext();

  beforeEach(() => {
    const fixtures: LadderTpFixtures = getContext();
    ({ logger, bybitService, errorHandler } = fixtures);
    createStandardService = fixtures.createStandardService;
    createLegacyService = fixtures.createLegacyService;
  });

  // ========================================================================
  // CONFIG VALIDATION WITH THROW STRATEGY
  // ========================================================================

  describe('Configuration Validation (THROW Strategy)', () => {
    it('should throw ConfigurationError for empty levels', () => {
      const config = createLadderTpConfig({ levels: [] });
      expect(() => {
        createStandardService({ configOverrides: config });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid pricePercent', () => {
      const config = createLadderTpConfig({
        levels: [{ pricePercent: -0.5, closePercent: 100 }],
      });

      expect(() => {
        createStandardService({ configOverrides: config });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid closePercent', () => {
      const config = createLadderTpConfig({
        levels: [{ pricePercent: 0.08, closePercent: 5 }], // Below minPartialClosePercent (10)
        minPartialClosePercent: 10,
      });

      expect(() => {
        createStandardService({ configOverrides: config });
      }).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid trailingDistancePercent', () => {
      const config = createLadderTpConfig({
        trailingAfterTP2: true,
        trailingDistancePercent: -0.05,
      });

      expect(() => {
        createStandardService({ configOverrides: config });
      }).toThrow(ConfigurationError);
    });

    it('should handle config validation without ErrorHandler (backward compatibility)', () => {
      const config = createLadderTpConfig({ levels: [] });

      expect(() => {
        createLegacyService({ configOverrides: config });
      }).toThrow(ConfigurationError);
    });
  });

  // ========================================================================
  // EXECUTE PARTIAL CLOSE WITH RETRY STRATEGY
  // ========================================================================

  describe('Execute Partial Close (RETRY Strategy)', () => {
    it('should execute partial close successfully with ErrorHandler', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 1);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      bybitService.closePosition.mockResolvedValue(undefined);

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(true);
      expect(bybitService.closePosition).toHaveBeenCalledWith({
        positionId: position.id,
        percentage: 33,
      });
    });

    it('should retry on API failure and fallback to false', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 1);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      bybitService.closePosition.mockRejectedValue(new Error('Network error'));

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(false);
    });

    it('should handle close quantity too small', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 0.001); // Very small qty
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(false);
      expect(bybitService.closePosition).not.toHaveBeenCalled();
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 1);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      bybitService.closePosition.mockResolvedValue(undefined);

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(true);
      expect(bybitService.closePosition).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // MOVE TO BREAKEVEN WITH RETRY + FALLBACK
  // ========================================================================

  describe('Move to Breakeven (RETRY + FALLBACK Strategies)', () => {
    it('should move SL to breakeven successfully', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveToBreakeven(position);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalledWith({
        positionId: position.id,
        newPrice: 100, // Entry price
      });
    });

    it('should FALLBACK on retry exhaustion', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      // Mock multiple failures for retries
      bybitService.updateStopLoss.mockRejectedValue(new Error('API rate limited'));

      const result = await service.moveToBreakeven(position);

      // FALLBACK: returns false but doesn't crash
      expect(result).toBe(false);
    });

    it('should respect disabled config', async () => {
      const service = createStandardService({
        configOverrides: { moveToBreakevenAfterTP1: false },
      });
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      const result = await service.moveToBreakeven(position);

      expect(result).toBe(false);
      expect(bybitService.updateStopLoss).not.toHaveBeenCalled();
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveToBreakeven(position);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // MOVE TRAILING WITH RETRY + GRACEFUL_DEGRADE
  // ========================================================================

  describe('Move Trailing (RETRY + GRACEFUL_DEGRADE Strategies)', () => {
    it('should move trailing SL successfully', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveTrailing(position, 101); // Price moved up

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalled();
    });

    it('should GRACEFUL_DEGRADE on API failure', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockRejectedValue(new Error('Network timeout'));

      const result = await service.moveTrailing(position, 101);

      // GRACEFUL_DEGRADE: returns false but continues
      expect(result).toBe(false);
    });

    it('should skip if new SL is not better', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      const result = await service.moveTrailing(position, 99); // Price moved down, SL worse

      expect(result).toBe(false);
      expect(bybitService.updateStopLoss).not.toHaveBeenCalled();
    });

    it('should handle SHORT positions correctly', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.SHORT, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveTrailing(position, 99); // Price moved down (good for SHORT)

      expect(result).toBe(true);
    });

    it('should work without ErrorHandler (backward compatibility)', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveTrailing(position, 101);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalled();
    });

    it('should respect disabled config', async () => {
      const service = createStandardService({
        configOverrides: { trailingAfterTP2: false },
      });
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      const result = await service.moveTrailing(position, 101);

      expect(result).toBe(false);
      expect(bybitService.updateStopLoss).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // INTEGRATION SCENARIOS
  // ========================================================================

  describe('Integration Scenarios', () => {
    it('should handle cascading failures gracefully', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 1);
      const levels = [
        { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false },
        { level: 2, pricePercent: 0.15, closePercent: 33, targetPrice: 100.15, hit: false },
      ];

      // First close fails, second succeeds
      bybitService.closePosition
        .mockRejectedValueOnce(new Error('Rate limit'))
        .mockResolvedValueOnce(undefined);

      const result1 = await service.executePartialClose(levels[0], position);
      const result2 = await service.executePartialClose(levels[1], position);

      expect(result1).toBe(false);
      expect(result2).toBe(true);
    });

    it('should successfully execute full TP sequence', async () => {
      const service = createStandardService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 3);

      bybitService.closePosition.mockResolvedValue(undefined);
      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const levels = [
        { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false },
        { level: 2, pricePercent: 0.15, closePercent: 33, targetPrice: 100.15, hit: false },
        { level: 3, pricePercent: 0.25, closePercent: 34, targetPrice: 100.25, hit: false },
      ];

      // TP1: Close 33%, move SL to breakeven
      const close1 = await service.executePartialClose(levels[0], position);
      const move1 = await service.moveToBreakeven(position);

      // TP2: Close 33%, move to trailing
      const close2 = await service.executePartialClose(levels[1], position);
      const move2 = await service.moveTrailing(position, 100.20);

      // TP3: Close remaining 34%
      const close3 = await service.executePartialClose(levels[2], position);

      expect(close1).toBe(true);
      expect(move1).toBe(true);
      expect(close2).toBe(true);
      expect(move2).toBe(true);
      expect(close3).toBe(true);
    });
  });

  // ========================================================================
  // BACKWARD COMPATIBILITY
  // ========================================================================

  describe('Backward Compatibility', () => {
    it('should initialize and work without ErrorHandler parameter', () => {
      const service = createLegacyService();

      expect(service).toBeDefined();
    });

    it('should maintain existing behavior without ErrorHandler', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);
      const levels = service['config'].levels.map((l, i) => ({
        ...l,
        level: i + 1,
        targetPrice: 100 * (1 + l.pricePercent / 10000),
        hit: false,
      }));

      bybitService.closePosition.mockResolvedValue(undefined);

      const result = await service.executePartialClose(levels[0], position);

      expect(result).toBe(true);
      expect(bybitService.closePosition).toHaveBeenCalledWith({
        positionId: position.id,
        percentage: 33,
      });
    });

    it('should handle all three async methods without ErrorHandler', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      bybitService.closePosition.mockResolvedValue(undefined);
      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const r1 = await service.executePartialClose(level, position);
      const r2 = await service.moveToBreakeven(position);
      const r3 = await service.moveTrailing(position, 101);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
    });
  });

  // ========================================================================
  // LONG/SHORT POSITION HANDLING
  // ========================================================================

  describe('LONG/SHORT Position Handling', () => {
    it('should create correct TP levels for LONG positions', () => {
      const service = createLegacyService();

      const levels = service.createLadderLevels(100, SignalDirection.LONG);

      expect(levels).toHaveLength(3);
      expect(levels[0].targetPrice).toBeGreaterThan(100); // TP above entry
      expect(levels[1].targetPrice).toBeGreaterThan(levels[0].targetPrice);
      expect(levels[2].targetPrice).toBeGreaterThan(levels[1].targetPrice);
    });

    it('should create correct TP levels for SHORT positions', () => {
      const service = createLegacyService();

      const levels = service.createLadderLevels(100, SignalDirection.SHORT);

      expect(levels).toHaveLength(3);
      expect(levels[0].targetPrice).toBeLessThan(100); // TP below entry
      expect(levels[1].targetPrice).toBeLessThan(levels[0].targetPrice);
      expect(levels[2].targetPrice).toBeLessThan(levels[1].targetPrice);
    });

    it('should handle LONG breakeven correctly', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveToBreakeven(position);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalledWith({
        positionId: position.id,
        newPrice: 100, // Entry price
      });
    });

    it('should handle SHORT breakeven correctly', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.SHORT, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      const result = await service.moveToBreakeven(position);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalledWith({
        positionId: position.id,
        newPrice: 100, // Entry price
      });
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle very small position quantities', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 0.01);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(false); // Qty too small after close calculation
    });

    it('should handle very large position quantities', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100, 10000);
      const level = { level: 1, pricePercent: 0.08, closePercent: 33, targetPrice: 100.08, hit: false };

      bybitService.closePosition.mockResolvedValue(undefined);

      const result = await service.executePartialClose(level, position);

      expect(result).toBe(true);
    });

    it('should handle extreme price movements in trailing SL', async () => {
      const service = createLegacyService();
      const position = createLadderTpPosition(PositionSide.LONG, 100);

      bybitService.updateStopLoss.mockResolvedValue(undefined);

      // Extreme price move up
      const result = await service.moveTrailing(position, 200);

      expect(result).toBe(true);
      expect(bybitService.updateStopLoss).toHaveBeenCalled();
    });
  });
});
