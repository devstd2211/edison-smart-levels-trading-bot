/**
 * Tests for PositionSizingService
 * Session 64: Extracted sizing logic from PositionManager
 */

import { PositionSizingService } from '../../services/position-sizing.service';
import { SignalDirection, SignalType, TakeProfit } from '../../types';

describe('PositionSizingService', () => {
  let service: PositionSizingService;
  let mockBybitService: any;
  let mockPositionCalculator: any;
  let mockLogger: any;
  let mockCompoundInterest: any;
  let mockRiskBasedSizing: any;
  let mockLossStreakService: any;

  const mockTradingConfig = {
    leverage: 10,
    symbol: 'APEXUSDT',
  };

  const createMockRiskConfig = () => ({
    positionSizeUsdt: 10,
    trailingStopEnabled: true,
    trailingStopActivationLevel: 2,
    breakevenOffsetPercent: 0.1,
    smartTP3: {
      enabled: true,
      tickSizePercent: 0.5,
      maxTicks: 10,
    },
  });

  let mockRiskConfig: any;

  const mockFullConfig = {
    smartBreakeven: {
      enabled: true,
      preBeEnabled: true,
      minProfitLocked: 5,
      minQuantityRemaining: 50,
    },
  };

  const mockSignal = {
    type: SignalType.LEVEL_BASED,
    direction: SignalDirection.LONG,
    price: 100,
    stopLoss: 95,
    takeProfits: [
      { level: 1, percent: 5, sizePercent: 33, price: 105, hit: false } as TakeProfit,
      { level: 2, percent: 10, sizePercent: 33, price: 110, hit: false } as TakeProfit,
      { level: 3, percent: 15, sizePercent: 34, price: 115, hit: false } as TakeProfit,
    ] as TakeProfit[],
    confidence: 85,
    reason: 'Test signal',
    timestamp: Date.now(),
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBybitService = {
      getBalance: jest.fn().mockResolvedValue(1000),
      getExchangeLimits: jest.fn().mockReturnValue({
        minQty: 1,
        maxQty: 10000,
        stepSize: 0.01,
        minNotional: 5,
      }),
    };

    mockPositionCalculator = {
      calculateQuantity: jest.fn().mockReturnValue({
        isValid: true,
        quantity: 1,
        roundedQuantity: '1.00',
        marginUsed: 10,
        notionalValue: 100,
        validationErrors: [],
      }),
    };

    mockCompoundInterest = {
      isEnabled: jest.fn().mockReturnValue(false),
      calculatePositionSize: jest.fn(),
    };

    mockRiskBasedSizing = null;
    mockLossStreakService = null;

    // Create fresh config for each test
    mockRiskConfig = createMockRiskConfig();

    service = new PositionSizingService(
      mockBybitService,
      mockPositionCalculator,
      mockLogger,
      mockTradingConfig as any,
      mockRiskConfig as any,
      mockFullConfig as any,
      mockCompoundInterest,
      mockRiskBasedSizing,
      mockLossStreakService,
    );
  });

  describe('Fixed Sizing', () => {
    it('should calculate quantity with fixed position size', async () => {
      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(10);
      expect(result.quantity).toBe(1);
      expect(result.roundedQuantity).toBe('1.00');
      expect(result.marginUsed).toBe(10);
      expect(result.notionalValue).toBe(100);
      expect(result.sizingChain).toContain('FIXED');
    });

    it('should log fixed sizing information', async () => {
      await service.calculatePositionSize(mockSignal);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '📊 Position sizing: Fixed USDT',
        expect.objectContaining({
          positionSize: '10.00',
        }),
      );
    });
  });

  describe('Compound Interest Sizing', () => {
    it('should use compound interest when enabled', async () => {
      mockCompoundInterest.isEnabled.mockReturnValue(true);
      mockCompoundInterest.calculatePositionSize.mockResolvedValue({
        currentBalance: 1500,
        totalProfit: 500,
        positionSize: 15,
        protectionActive: false,
      });

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(15);
      expect(result.sizingChain).toContain('COMPOUND_INTEREST');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '💰 Position sizing: Compound interest',
        expect.objectContaining({
          positionSize: '15.00',
          growthFactor: '1.50x',
        }),
      );
    });

    it('should fallback to fixed when compound interest disabled', async () => {
      mockCompoundInterest.isEnabled.mockReturnValue(false);

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(10);
      expect(result.sizingChain).toContain('FIXED');
      expect(result.sizingChain).not.toContain('COMPOUND_INTEREST');
    });

    it('should handle compound interest calculation with protection active', async () => {
      mockCompoundInterest.isEnabled.mockReturnValue(true);
      mockCompoundInterest.calculatePositionSize.mockResolvedValue({
        currentBalance: 1000,
        totalProfit: 0,
        positionSize: 10,
        protectionActive: true,
      });

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(10);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '💰 Position sizing: Compound interest',
        expect.any(Object),
      );
    });
  });

  describe('Risk-Based Sizing', () => {
    beforeEach(() => {
      mockRiskBasedSizing = {
        calculatePositionSize: jest.fn().mockReturnValue(8),
      };

      service = new PositionSizingService(
        mockBybitService,
        mockPositionCalculator,
        mockLogger,
        mockTradingConfig as any,
        mockRiskConfig as any,
        mockFullConfig as any,
        mockCompoundInterest,
        mockRiskBasedSizing,
        mockLossStreakService,
      );
    });

    it('should apply risk-based sizing override', async () => {
      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(8);
      expect(result.sizingChain).toContain('RISK_BASED');
      expect(mockRiskBasedSizing.calculatePositionSize).toHaveBeenCalledWith(
        1000, // currentBalance
        100, // entry price
        95, // stop loss
      );
    });

    it('should log risk-based sizing with SL distance', async () => {
      await service.calculatePositionSize(mockSignal);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎯 Position sizing: Risk-based override',
        expect.objectContaining({
          originalSize: '10.00',
          newSize: '8.00',
          slDistance: '5.00',
          slPercent: '5.00%',
        }),
      );
    });

    it('should handle large SL distances', async () => {
      mockRiskBasedSizing.calculatePositionSize.mockReturnValue(5);

      const signalWithLargeSL = {
        ...mockSignal,
        stopLoss: 80, // 20% SL distance
      };

      const result = await service.calculatePositionSize(signalWithLargeSL);

      expect(result.positionSizeUsdt).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🎯 Position sizing: Risk-based override',
        expect.objectContaining({
          slPercent: '20.00%',
        }),
      );
    });
  });

  describe('Loss Streak Multiplier', () => {
    beforeEach(() => {
      mockLossStreakService = {
        getSizeMultiplier: jest.fn().mockReturnValue(0.8),
        getConsecutiveLosses: jest.fn().mockReturnValue(2),
      };

      service = new PositionSizingService(
        mockBybitService,
        mockPositionCalculator,
        mockLogger,
        mockTradingConfig as any,
        mockRiskConfig as any,
        mockFullConfig as any,
        mockCompoundInterest,
        mockRiskBasedSizing,
        mockLossStreakService,
      );
    });

    it('should apply loss streak multiplier to position size', async () => {
      const result = await service.calculatePositionSize(mockSignal);

      // 10 USDT (fixed) * 0.8 (loss streak multiplier)
      expect(result.positionSizeUsdt).toBe(8);
      expect(result.sizingChain).toContain('LOSS_STREAK_MULTIPLIER');
    });

    it('should log loss streak information', async () => {
      await service.calculatePositionSize(mockSignal);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔻 Position sizing: Loss streak multiplier',
        expect.objectContaining({
          consecutiveLosses: 2,
          multiplier: '80%',
          originalSize: '10.00',
          adjustedSize: '8.00',
        }),
      );
    });

    it('should scale down aggressively after multiple losses', async () => {
      mockLossStreakService.getSizeMultiplier.mockReturnValue(0.5);
      mockLossStreakService.getConsecutiveLosses.mockReturnValue(5);

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(5);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '🔻 Position sizing: Loss streak multiplier',
        expect.objectContaining({
          consecutiveLosses: 5,
          multiplier: '50%',
        }),
      );
    });
  });

  describe('Combined Sizing (Multiple Factors)', () => {
    beforeEach(() => {
      mockCompoundInterest.isEnabled.mockReturnValue(true);
      mockCompoundInterest.calculatePositionSize.mockResolvedValue({
        currentBalance: 2000,
        totalProfit: 1000,
        positionSize: 20,
        protectionActive: false,
      });

      mockRiskBasedSizing = {
        calculatePositionSize: jest.fn().mockReturnValue(15),
      };

      mockLossStreakService = {
        getSizeMultiplier: jest.fn().mockReturnValue(0.9),
        getConsecutiveLosses: jest.fn().mockReturnValue(1),
      };

      service = new PositionSizingService(
        mockBybitService,
        mockPositionCalculator,
        mockLogger,
        mockTradingConfig as any,
        mockRiskConfig as any,
        mockFullConfig as any,
        mockCompoundInterest,
        mockRiskBasedSizing,
        mockLossStreakService,
      );
    });

    it('should apply all sizing methods in correct order', async () => {
      const result = await service.calculatePositionSize(mockSignal);

      // Compound: 20 → Risk-based: 15 → Loss-streak: 15 * 0.9 = 13.5
      expect(result.positionSizeUsdt).toBe(13.5);
      expect(result.sizingChain.length).toBe(3);
      expect(result.sizingChain).toEqual(['COMPOUND_INTEREST', 'RISK_BASED', 'LOSS_STREAK_MULTIPLIER']);
    });

    it('should log complete sizing chain in final output', async () => {
      await service.calculatePositionSize(mockSignal);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '✅ Position sizing: Quantity calculated',
        expect.objectContaining({
          sizingChain: 'COMPOUND_INTEREST → RISK_BASED → LOSS_STREAK_MULTIPLIER',
        }),
      );
    });
  });

  describe('Exchange Limits Validation', () => {
    it('should validate quantity against exchange minimum', async () => {
      mockBybitService.getExchangeLimits.mockReturnValue({
        minQty: 10,
        maxQty: 10000,
        stepSize: 1,
        minNotional: 100,
      });

      mockPositionCalculator.calculateQuantity.mockReturnValue({
        isValid: true,
        quantity: 10,
        roundedQuantity: '10.00',
        marginUsed: 100,
        notionalValue: 1000,
        validationErrors: [],
      });

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.quantity).toBe(10);
      expect(mockPositionCalculator.calculateQuantity).toHaveBeenCalledWith(
        10, // position size
        10, // leverage
        100, // entry price
        expect.objectContaining({
          minQty: 10,
          maxQty: 10000,
        }),
      );
    });

    it('should validate quantity against exchange maximum', async () => {
      mockBybitService.getExchangeLimits.mockReturnValue({
        minQty: 0.01,
        maxQty: 100,
        stepSize: 0.01,
        minNotional: 5,
      });

      mockPositionCalculator.calculateQuantity.mockReturnValue({
        isValid: true,
        quantity: 100,
        roundedQuantity: '100.00',
        marginUsed: 1000,
        notionalValue: 10000,
        validationErrors: [],
      });

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.quantity).toBe(100);
    });

    it('should round quantity to correct step size', async () => {
      mockPositionCalculator.calculateQuantity.mockReturnValue({
        isValid: true,
        quantity: 1.2345,
        roundedQuantity: '1.23',
        marginUsed: 12.3,
        notionalValue: 123,
        validationErrors: [],
      });

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.roundedQuantity).toBe('1.23');
    });
  });

  describe('Error Handling', () => {
    it('should throw error if calculation is invalid', async () => {
      mockPositionCalculator.calculateQuantity.mockReturnValue({
        isValid: false,
        quantity: 0,
        roundedQuantity: '0',
        marginUsed: 0,
        notionalValue: 0,
        validationErrors: ['Quantity below minimum', 'Notional value too low'],
      });

      await expect(service.calculatePositionSize(mockSignal)).rejects.toThrow(
        'Position calculation failed: Quantity below minimum, Notional value too low',
      );
    });

    it('should log error with full context', async () => {
      mockPositionCalculator.calculateQuantity.mockReturnValue({
        isValid: false,
        quantity: 0,
        roundedQuantity: '0',
        marginUsed: 0,
        notionalValue: 0,
        validationErrors: ['Insufficient balance'],
      });

      try {
        await service.calculatePositionSize(mockSignal);
      } catch (error) {
        // Expected to throw
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        '❌ Position sizing: Calculation failed',
        expect.objectContaining({
          errors: ['Insufficient balance'],
          positionSizeUsdt: 10,
          leverage: 10,
          price: 100,
        }),
      );
    });

    it('should handle compound interest calculator throwing', async () => {
      mockCompoundInterest.isEnabled.mockReturnValue(true);
      mockCompoundInterest.calculatePositionSize.mockRejectedValue(
        new Error('Balance fetch failed'),
      );

      await expect(service.calculatePositionSize(mockSignal)).rejects.toThrow(
        'Balance fetch failed',
      );
    });

    it('should handle risk-based sizing calculator throwing', async () => {
      mockRiskBasedSizing = {
        calculatePositionSize: jest.fn().mockImplementation(() => {
          throw new Error('Risk calculation failed');
        }),
      };

      service = new PositionSizingService(
        mockBybitService,
        mockPositionCalculator,
        mockLogger,
        mockTradingConfig as any,
        mockRiskConfig as any,
        mockFullConfig as any,
        mockCompoundInterest,
        mockRiskBasedSizing,
        mockLossStreakService,
      );

      await expect(service.calculatePositionSize(mockSignal)).rejects.toThrow(
        'Risk calculation failed',
      );
    });
  });

  describe('Logging Completeness', () => {
    it('should log final summary with all metrics', async () => {
      await service.calculatePositionSize(mockSignal);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '✅ Position sizing: Quantity calculated',
        expect.objectContaining({
          quantity: 1,
          roundedQuantity: '1.00',
          marginUsed: 10,
          notionalValue: 100,
          sizingChain: 'FIXED',
        }),
      );
    });

    it('should include byte information in logs', async () => {
      await service.calculatePositionSize(mockSignal);

      const calls = mockLogger.info.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1][0]).toContain('Position sizing');
    });
  });

  describe('Edge Cases', () => {
    it('should handle position size of zero (edge case)', async () => {
      mockRiskConfig.positionSizeUsdt = 0;

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(0);
    });

    it('should handle very small position sizes', async () => {
      mockRiskConfig.positionSizeUsdt = 0.1;

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(0.1);
    });

    it('should handle very large position sizes', async () => {
      mockRiskConfig.positionSizeUsdt = 10000;

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(10000);
    });

    it('should handle loss streak multiplier of 1 (no loss)', async () => {
      mockLossStreakService = {
        getSizeMultiplier: jest.fn().mockReturnValue(1),
        getConsecutiveLosses: jest.fn().mockReturnValue(0),
      };

      service = new PositionSizingService(
        mockBybitService,
        mockPositionCalculator,
        mockLogger,
        mockTradingConfig as any,
        mockRiskConfig as any,
        mockFullConfig as any,
        mockCompoundInterest,
        mockRiskBasedSizing,
        mockLossStreakService,
      );

      const result = await service.calculatePositionSize(mockSignal);

      expect(result.positionSizeUsdt).toBe(10);
      expect(result.sizingChain).toContain('LOSS_STREAK_MULTIPLIER');
    });
  });
});
