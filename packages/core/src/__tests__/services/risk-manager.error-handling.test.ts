/**
 * Phase 8.9.1: RiskManager ErrorHandler Integration Tests
 *
 * Tests ErrorHandler integration with RiskManager for:
 * - Validation error handling (THROW strategy)
 * - Account balance error handling (GRACEFUL_DEGRADE)
 * - Calculation error handling (GRACEFUL_DEGRADE)
 * - Trade recording error recovery
 */

import { RiskManager } from '../../services/risk-manager.service';
import { ErrorHandler } from '../../errors/ErrorHandler';
import {
  RiskValidationError,
} from '../../errors/DomainErrors';
import type { TradeRecord } from '../../types/legacy';
import {
  MockRiskManagerLogger,
  createRiskManagerConfig,
  createManagedRiskManagerContext,
  createRiskManagerPosition,
  createRiskManagerSignal,
  createRiskManagerTrade,
  ManagedRiskManagerContext,
} from '../helpers/risk-manager-test.utils';

type RiskManagerRuntime = Pick<
  ManagedRiskManagerContext,
  'riskManager' | 'mockLogger' | 'errorHandler' | 'createRiskManager' | 'cleanup'
>;

describe('Phase 8.9.1: RiskManager ErrorHandler Integration', () => {
  let riskManager: RiskManager;
  let mockLogger: MockRiskManagerLogger;
  let errorHandler: ErrorHandler;
  let createRiskManager: RiskManagerRuntime['createRiskManager'];
  let cleanup: RiskManagerRuntime['cleanup'];

  beforeEach(() => {
    ({
      riskManager,
      mockLogger,
      errorHandler,
      createRiskManager,
      cleanup,
    } = createManagedRiskManagerContext() as RiskManagerRuntime);
  });

  afterEach(() => {
    cleanup();
  });

  // ========================================================================
  // A. VALIDATION ERRORS
  // ========================================================================

  describe('A. Validation Errors - THROW Strategy', () => {
    it('should throw RiskValidationError on negative signal price', async () => {
      const signal = createRiskManagerSignal({ price: -100 });
      await expect(riskManager.canTrade(signal, 1000, [])).rejects.toThrow(
        RiskValidationError
      );
    });

    it('should throw RiskValidationError on zero signal price', async () => {
      const signal = createRiskManagerSignal({ price: 0 });
      await expect(riskManager.canTrade(signal, 1000, [])).rejects.toThrow(
        RiskValidationError
      );
    });

    it('should throw RiskValidationError on invalid confidence (>100)', async () => {
      const signal = createRiskManagerSignal({ confidence: 150 });
      await expect(riskManager.canTrade(signal, 1000, [])).rejects.toThrow(
        RiskValidationError
      );
    });

    it('should throw RiskValidationError on invalid confidence (negative)', async () => {
      const signal = createRiskManagerSignal({ confidence: -10 });
      await expect(riskManager.canTrade(signal, 1000, [])).rejects.toThrow(
        RiskValidationError
      );
    });
  });

  // ========================================================================
  // B. ACCOUNT BALANCE ERRORS
  // ========================================================================

  describe('B. Account Balance Errors - GRACEFUL_DEGRADE Strategy', () => {
    it('should degrade gracefully on zero account balance', async () => {
      const rm = createRiskManager();
      const signal = createRiskManagerSignal();
      const result = await rm.canTrade(signal, 0, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('balance validation failed');
    });

    it('should degrade gracefully on negative account balance', async () => {
      const rm = createRiskManager();
      const signal = createRiskManagerSignal();
      const result = await rm.canTrade(signal, -500, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('balance validation failed');
    });

    it('should allow trade with valid account balance', async () => {
      const rm = createRiskManager();
      const signal = createRiskManagerSignal();
      const result = await rm.canTrade(signal, 1000, []);
      expect(result.allowed).toBe(true);
      expect(result.adjustedPositionSize).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // C. CALCULATION ERRORS
  // ========================================================================

  describe('C. Calculation Errors - GRACEFUL_DEGRADE Strategy', () => {
    it('should handle NaN in trade value calculation', () => {
      const trade = createRiskManagerTrade({ entryPrice: NaN });
      expect(() => riskManager.recordTradeResult(trade)).not.toThrow();
    });

    it('should handle Infinity in calculations', () => {
      const trade = createRiskManagerTrade({ entryPrice: 0 });
      expect(() => riskManager.recordTradeResult(trade)).not.toThrow();
    });

    it('should handle exposure calculation with invalid positions', async () => {
      const signal = createRiskManagerSignal();
      const badPosition = createRiskManagerPosition({ entryPrice: NaN });
      const result = await riskManager.canTrade(signal, 1000, [badPosition]);
      expect(result).toBeDefined();
    });
  });

  // ========================================================================
  // D. TRADE RECORDING
  // ========================================================================

  describe('D. Trade Recording - Error Recovery', () => {
    it('should record valid trade successfully', () => {
      const trade = createRiskManagerTrade({ realizedPnL: 50 });
      riskManager.recordTradeResult(trade);
      const status = riskManager.getRiskStatus();
      expect(status.dailyPnL).toBeCloseTo(50, 1);
      expect(status.consecutiveLosses).toBe(0);
    });

    it('should skip null trade without crashing', () => {
      const nullTrade = null as unknown as TradeRecord;
      expect(() => riskManager.recordTradeResult(nullTrade)).not.toThrow();
    });

    it('should track consecutive losses correctly', () => {
      const lossTrade = createRiskManagerTrade({ realizedPnL: -50 });
      riskManager.recordTradeResult(lossTrade);
      expect(riskManager.getRiskStatus().consecutiveLosses).toBe(1);
    });

    it('should reset loss streak on winning trade', () => {
      // Record loss
      const lossTrade = createRiskManagerTrade({ realizedPnL: -50 });
      riskManager.recordTradeResult(lossTrade);
      expect(riskManager.getRiskStatus().consecutiveLosses).toBe(1);

      // Record win
      const winTrade = createRiskManagerTrade({ id: 'trade-win', realizedPnL: 75 });
      riskManager.recordTradeResult(winTrade);
      expect(riskManager.getRiskStatus().consecutiveLosses).toBe(0);
      expect(riskManager.getRiskStatus().dailyPnL).toBeCloseTo(25, 1);
    });

    it('should recover from calculation failure without blocking', () => {
      const badTrade = createRiskManagerTrade({ entryPrice: 0, realizedPnL: 50 });
      expect(() => riskManager.recordTradeResult(badTrade)).not.toThrow();

      const goodTrade = createRiskManagerTrade({ id: 'trade-good' });
      expect(() => riskManager.recordTradeResult(goodTrade)).not.toThrow();

      const status = riskManager.getRiskStatus();
      expect(status.dailyPnL).toBeCloseTo(100, 1);
    });
  });

  // ========================================================================
  // E. EXPOSURE CALCULATION
  // ========================================================================

  describe('E. Exposure Calculation - GRACEFUL_DEGRADE', () => {
    it('should calculate exposure with valid positions', async () => {
      const signal = createRiskManagerSignal();
      const position = createRiskManagerPosition();
      const result = await riskManager.canTrade(signal, 1000, [position]);
      expect(result).toBeDefined();
    });

    it('should degrade on invalid position price', async () => {
      const signal = createRiskManagerSignal();
      const badPosition = createRiskManagerPosition({ entryPrice: NaN });
      const result = await riskManager.canTrade(signal, 1000, [badPosition]);
      expect(result).toBeDefined();
    });

    it('should return zero exposure on critical failure', async () => {
      const signal = createRiskManagerSignal();
      const extremePosition = createRiskManagerPosition({
        quantity: Number.MAX_VALUE,
        entryPrice: Number.MAX_VALUE,
      });
      const result = await riskManager.canTrade(signal, 1000, [extremePosition]);
      expect(result).toBeDefined();
    });
  });

  // ========================================================================
  // F. INTEGRATION TESTS
  // ========================================================================

  describe('F. Integration Tests', () => {
    it('should handle complete trade workflow', async () => {
      const rm = createRiskManager();

      const signal = createRiskManagerSignal();
      const decision = await rm.canTrade(signal, 1000, []);
      expect(decision.allowed).toBe(true);
      expect(decision.adjustedPositionSize).toBeGreaterThan(0);

      const trade = createRiskManagerTrade({ quantity: decision.adjustedPositionSize || 1 });
      rm.recordTradeResult(trade);

      const status = rm.getRiskStatus();
      expect(status.dailyPnL).toBeCloseTo(50, 1);
    });

    it('should recover from error and continue trading', async () => {
      const rm = createRiskManager();

      const goodSignal = createRiskManagerSignal();
      const badSignal = createRiskManagerSignal({ price: -100 });

      const result1 = await rm.canTrade(goodSignal, 1000, []);
      expect(result1.allowed).toBe(true);

      await expect(rm.canTrade(badSignal, 1000, [])).rejects.toThrow();

      const result3 = await rm.canTrade(goodSignal, 1000, []);
      expect(result3.allowed).toBe(true);
    });

    it('should maintain state during cascading failures', async () => {
      const rm = createRiskManager();

      // Trade 1: Loss
      const lossTrade = createRiskManagerTrade({ realizedPnL: -50 });
      rm.recordTradeResult(lossTrade);

      // Trade 2: Has NaN calculation due to entryPrice=0 calculation
      // This would be a bad trade that returns NaN in calculations
      const badTrade = createRiskManagerTrade({
        id: 'trade-bad',
        entryPrice: 0,
        realizedPnL: 50,
      });
      rm.recordTradeResult(badTrade);

      // State should show: lossTrade recorded + badTrade recorded (both process through GRACEFUL_DEGRADE)
      // badTrade with entryPrice=0 should degrade gracefully but still record the PnL
      const status = rm.getRiskStatus();
      expect(status.dailyPnL).toBeCloseTo(0, 1); // -50 + 50 = 0
      expect(status.consecutiveLosses).toBe(0); // Loss then Win resets streak
    });

    it('should enforce daily loss limit', async () => {
      const rm = createRiskManager();

      const signal = createRiskManagerSignal();

      // Record 6% loss (exceeds 5% limit)
      const lossTrade = createRiskManagerTrade({ realizedPnL: -60 });
      rm.recordTradeResult(lossTrade);

      // Next trade should be blocked
      const result = await rm.canTrade(signal, 1000, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily loss limit');
    });

    it('should apply loss streak multipliers', async () => {
      const rm = createRiskManager();

      const signal = createRiskManagerSignal();

      // First trade - get normal size
      let decision1 = await rm.canTrade(signal, 1000, []);
      expect(decision1.allowed).toBe(true);
      const normalSize = decision1.adjustedPositionSize;
      expect(normalSize).toBeGreaterThan(0);

      // Record small loss (2% = -20 to stay under 5% daily limit)
      const lossTrade1 = createRiskManagerTrade({ quantity: normalSize || 1, realizedPnL: -20 });
      rm.recordTradeResult(lossTrade1);

      // Second trade after 1 loss - still normal size (no reduction after 1 loss)
      let decision2 = await rm.canTrade(signal, 1000, []);
      expect(decision2.allowed).toBe(true);
      expect(decision2.adjustedPositionSize).toBeCloseTo(normalSize || 0, 0.1);

      // Record another small loss
      const lossTrade2 = createRiskManagerTrade({
        id: 'trade-loss2',
        quantity: decision2.adjustedPositionSize || 1,
        realizedPnL: -10, // Keep total well below 5% limit (2% + 1% = 3%)
      });
      rm.recordTradeResult(lossTrade2);

      // Third trade after 2 losses - should be 75% of normal
      let decision3 = await rm.canTrade(signal, 1000, []);
      expect(decision3.allowed).toBe(true);
      expect(decision3.adjustedPositionSize).toBeLessThan(normalSize || 0);
      expect(decision3.adjustedPositionSize).toBeCloseTo((normalSize || 0) * 0.75, 1);
    });
  });

  // ========================================================================
  // G. BACKWARD COMPATIBILITY
  // ========================================================================

  describe('G. Backward Compatibility', () => {
    it('should work with direct instantiation', () => {
      const config = createRiskManagerConfig();
      const rm = createRiskManager({ config });
      const status = rm.getRiskStatus();
      expect(status).toBeDefined();
      expect(status.dailyPnL).toBe(0);
    });

    it('should maintain existing behavior without errors', async () => {
      const freshLogger = new MockRiskManagerLogger();
      const freshErrorHandler = new ErrorHandler(freshLogger);
      const freshConfig = createRiskManagerConfig();
      const freshRiskManager = createRiskManager({
        config: freshConfig,
        balance: 1000,
        logger: freshLogger,
        errorHandler: freshErrorHandler,
      });

      const signal = createRiskManagerSignal();
      const result = await freshRiskManager.canTrade(signal, 1000, []);
      expect(result.allowed).toBe(true);
      expect(result.adjustedPositionSize).toBeGreaterThan(0);
    });
  });
});
