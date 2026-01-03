/**
 * Tests for CompoundInterestCalculatorService
 */

import { CompoundInterestCalculatorService } from '../../services/compound-interest-calculator.service';
import { LoggerService, CompoundInterestConfig, LogLevel } from '../../types';
import {
  calculateLockedProfit,
  calculateReinvestment,
  calculateMaxRiskSize,
  isDepositProtectionActive,
  validateCompoundConfig,
  calculateGrowthFactor,
} from '../../utils/compound-interest.helpers';

describe('CompoundInterestCalculatorService', () => {
  let logger: LoggerService;
  let mockGetBalance: jest.Mock;

  const defaultConfig: CompoundInterestConfig = {
    enabled: true,
    useVirtualBalance: true,
    baseDeposit: 100,
    reinvestmentPercent: 50,
    maxRiskPerTrade: 2,
    minPositionSize: 10,
    maxPositionSize: 1000,
    profitLockPercent: 30,
  };

  beforeEach(() => {
    logger = new LoggerService(LogLevel.ERROR, './logs', false);
    mockGetBalance = jest.fn();
  });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with valid config', () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      expect(calculator.isEnabled()).toBe(true);
      expect(calculator.getConfig()).toEqual(defaultConfig);
    });

    it('should throw on invalid config (negative base deposit)', () => {
      const invalidConfig = { ...defaultConfig, baseDeposit: -100 };

      expect(() => {
        new CompoundInterestCalculatorService(invalidConfig, logger, mockGetBalance);
      }).toThrow('Base deposit cannot be negative');
    });

    it('should throw on invalid config (reinvestment > 100%)', () => {
      const invalidConfig = { ...defaultConfig, reinvestmentPercent: 150 };

      expect(() => {
        new CompoundInterestCalculatorService(invalidConfig, logger, mockGetBalance);
      }).toThrow('Reinvestment percent must be between 0 and 100');
    });

    it('should throw on invalid config (max < min position size)', () => {
      const invalidConfig = { ...defaultConfig, minPositionSize: 100, maxPositionSize: 50 };

      expect(() => {
        new CompoundInterestCalculatorService(invalidConfig, logger, mockGetBalance);
      }).toThrow('Max position size must be >= min position size');
    });
  });

  // ============================================================================
  // BASIC CALCULATIONS
  // ============================================================================

  describe('calculatePositionSize', () => {
    it('should return min position size when disabled', async () => {
      const config = { ...defaultConfig, enabled: false };
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(150); // Has profit

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(10); // Min size
      expect(result.protectionActive).toBe(false);
    });

    it('should return min position size when no profit', async () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      mockGetBalance.mockResolvedValue(100); // Exactly base deposit

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(10); // Min size
      expect(result.protectionActive).toBe(true);
      expect(result.totalProfit).toBe(0);
    });

    it('should return min position size when at loss', async () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      mockGetBalance.mockResolvedValue(90); // Loss

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(10); // Min size
      expect(result.protectionActive).toBe(true);
      expect(result.totalProfit).toBe(-10);
    });

    it('should calculate correct position size with profit', async () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 20 }; // Higher limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(120); // +20 profit

      const result = await calculator.calculatePositionSize();

      // Profit: 20
      // Locked: 20 * 30% = 6
      // Available: 20 - 6 = 14
      // Reinvest: 14 * 50% = 7
      // Position: 10 + 7 = 17
      // Max risk: 120 * 20% = 24 (not limiting)

      expect(result.positionSize).toBe(17);
      expect(result.totalProfit).toBe(20);
      expect(result.lockedProfit).toBe(6);
      expect(result.availableProfit).toBe(14);
      expect(result.reinvestedAmount).toBe(7);
      expect(result.protectionActive).toBe(false);
    });

    it('should respect max position size limit', async () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 100 }; // Remove risk limit for this test
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(10000); // Huge profit

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(1000); // Capped at max
      expect(result.limitApplied).toBe('max');
    });

    it('should respect max risk per trade limit', async () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      // Balance 200, max risk 2% = 4 USDT max position
      // But calculation would give more
      mockGetBalance.mockResolvedValue(200);

      const result = await calculator.calculatePositionSize();

      // Balance: 200, profit: 100
      // Without risk limit: 10 + (100 - 30) * 0.5 = 10 + 35 = 45
      // With risk limit: 200 * 2% = 4
      expect(result.positionSize).toBe(4);
      expect(result.limitApplied).toBe('risk');
    });
  });

  // ============================================================================
  // HELPER FUNCTIONS TESTS
  // ============================================================================

  describe('calculateLockedProfit', () => {
    it('should calculate locked profit correctly', () => {
      expect(calculateLockedProfit(100, 30)).toBe(30);
      expect(calculateLockedProfit(50, 50)).toBe(25);
      expect(calculateLockedProfit(200, 10)).toBe(20);
    });

    it('should return 0 for no profit', () => {
      expect(calculateLockedProfit(0, 30)).toBe(0);
      expect(calculateLockedProfit(-10, 30)).toBe(0);
    });

    it('should throw on invalid lock percent', () => {
      expect(() => calculateLockedProfit(100, -10)).toThrow('Lock percent cannot be negative');
      expect(() => calculateLockedProfit(100, 150)).toThrow('Lock percent cannot exceed 100');
    });
  });

  describe('calculateReinvestment', () => {
    it('should calculate reinvestment correctly', () => {
      expect(calculateReinvestment(100, 50)).toBe(50);
      expect(calculateReinvestment(70, 50)).toBe(35);
      expect(calculateReinvestment(200, 25)).toBe(50);
    });

    it('should return 0 for no available profit', () => {
      expect(calculateReinvestment(0, 50)).toBe(0);
      expect(calculateReinvestment(-10, 50)).toBe(0);
    });

    it('should throw on invalid reinvest percent', () => {
      expect(() => calculateReinvestment(100, -10)).toThrow(
        'Reinvest percent cannot be negative',
      );
      expect(() => calculateReinvestment(100, 150)).toThrow(
        'Reinvest percent cannot exceed 100',
      );
    });
  });

  describe('calculateMaxRiskSize', () => {
    it('should calculate max risk size correctly', () => {
      expect(calculateMaxRiskSize(100, 2)).toBe(2);
      expect(calculateMaxRiskSize(500, 5)).toBe(25);
      expect(calculateMaxRiskSize(1000, 1)).toBe(10);
    });

    it('should throw on negative balance', () => {
      expect(() => calculateMaxRiskSize(-100, 2)).toThrow('Balance cannot be negative');
    });

    it('should throw on invalid risk percent', () => {
      expect(() => calculateMaxRiskSize(100, -5)).toThrow('Max risk percent cannot be negative');
      expect(() => calculateMaxRiskSize(100, 150)).toThrow('Max risk percent cannot exceed 100');
    });
  });

  describe('isDepositProtectionActive', () => {
    it('should return true when at base deposit', () => {
      expect(isDepositProtectionActive(100, 100)).toBe(true);
    });

    it('should return true when below base deposit', () => {
      expect(isDepositProtectionActive(90, 100)).toBe(true);
    });

    it('should return false when above base deposit', () => {
      expect(isDepositProtectionActive(150, 100)).toBe(false);
    });

    it('should respect minimum profit threshold', () => {
      expect(isDepositProtectionActive(105, 100, 10)).toBe(true); // Profit 5 < threshold 10
      expect(isDepositProtectionActive(115, 100, 10)).toBe(false); // Profit 15 > threshold 10
    });
  });

  describe('validateCompoundConfig', () => {
    it('should pass valid config', () => {
      expect(() => validateCompoundConfig(defaultConfig)).not.toThrow();
    });

    it('should throw on invalid reinvestment + lock > 100%', () => {
      const invalid = { ...defaultConfig, reinvestmentPercent: 80, profitLockPercent: 30 };
      expect(() => validateCompoundConfig(invalid)).toThrow(
        'Reinvestment + profit lock percentages cannot exceed 100%',
      );
    });
  });

  describe('calculateGrowthFactor', () => {
    it('should calculate growth factor correctly', () => {
      expect(calculateGrowthFactor(10, 10)).toBe(1); // No growth
      expect(calculateGrowthFactor(20, 10)).toBe(2); // 2x growth
      expect(calculateGrowthFactor(15, 10)).toBe(1.5); // 1.5x growth
    });

    it('should handle zero min size gracefully', () => {
      expect(calculateGrowthFactor(10, 0)).toBe(1);
    });
  });

  // ============================================================================
  // SERVICE METHODS
  // ============================================================================

  describe('updateConfig', () => {
    it('should update config successfully', () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      calculator.updateConfig({ reinvestmentPercent: 60 }); // 60 + 30 lock = 90% < 100%

      expect(calculator.getConfig().reinvestmentPercent).toBe(60);
    });

    it('should throw on invalid update', () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      expect(() => {
        calculator.updateConfig({ maxPositionSize: 5 }); // Less than min
      }).toThrow();
    });
  });

  describe('calculatePositionSizeSync', () => {
    it('should calculate without API call', () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 20 }; // Higher limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      const result = calculator.calculatePositionSizeSync(120);

      expect(result.positionSize).toBe(17);
      expect(mockGetBalance).not.toHaveBeenCalled();
    });
  });

  describe('estimateFuturePositionSize', () => {
    it('should estimate position after profit', () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 20 }; // Higher limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      const futureSize = calculator.estimateFuturePositionSize(100, 20);

      expect(futureSize).toBe(17); // Same as +20 profit scenario
    });

    it('should estimate position after loss', () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      const futureSize = calculator.estimateFuturePositionSize(120, -30);

      // After -30 loss: 120 - 30 = 90 < base (100) → min size
      expect(futureSize).toBe(10);
    });
  });

  describe('calculateGrowthMetrics', () => {
    it('should calculate growth metrics', () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 20 }; // Higher limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      const metrics = calculator.calculateGrowthMetrics(120);

      expect(metrics.currentSize).toBe(17);
      expect(metrics.maxPossibleSize).toBe(1000);
      expect(metrics.growthFactor).toBe(1.7); // 17 / 10
      expect(metrics.profitToNextLevel).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('should handle exactly at max position size', async () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 100 }; // Remove risk limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      // Calculate balance needed for max position
      // Max: 1000, min: 10, need 990 from reinvestment
      // 990 = availableProfit * 50%
      // availableProfit = 1980
      // 1980 = totalProfit - (totalProfit * 30%)
      // 1980 = totalProfit * 70%
      // totalProfit = 2828.57
      mockGetBalance.mockResolvedValue(2929);

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(1000);
      expect(result.limitApplied).toBe('max');
    });

    it('should handle very small profit', async () => {
      const config = { ...defaultConfig, maxRiskPerTrade: 20 }; // Higher limit
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(100.01); // 0.01 profit

      const result = await calculator.calculatePositionSize();

      // Profit: 0.01
      // Locked: 0.003
      // Available: 0.007
      // Reinvest: 0.0035
      // Position: 10.0035
      expect(result.positionSize).toBeCloseTo(10.0035, 4);
    });

    it('should handle 0% reinvestment', async () => {
      const config = { ...defaultConfig, reinvestmentPercent: 0, maxRiskPerTrade: 20 };
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(150);

      const result = await calculator.calculatePositionSize();

      expect(result.positionSize).toBe(10); // No reinvestment = min size
      expect(result.reinvestedAmount).toBe(0);
    });

    it('should handle 0% profit lock', async () => {
      const config = { ...defaultConfig, profitLockPercent: 0, maxRiskPerTrade: 20 };
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(120);

      const result = await calculator.calculatePositionSize();

      // Profit: 20
      // Locked: 0
      // Available: 20
      // Reinvest: 10
      // Position: 20
      expect(result.positionSize).toBe(20);
      expect(result.lockedProfit).toBe(0);
    });

    it('should handle 100% reinvestment', async () => {
      const config = {
        ...defaultConfig,
        reinvestmentPercent: 100,
        profitLockPercent: 0,
        maxRiskPerTrade: 30,
      };
      const calculator = new CompoundInterestCalculatorService(config, logger, mockGetBalance);

      mockGetBalance.mockResolvedValue(120);

      const result = await calculator.calculatePositionSize();

      // Profit: 20
      // Locked: 0
      // Available: 20
      // Reinvest: 20
      // Position: 30
      expect(result.positionSize).toBe(30);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe('error handling', () => {
    it('should handle API error gracefully', async () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      mockGetBalance.mockRejectedValue(new Error('Network error'));

      await expect(calculator.calculatePositionSize()).rejects.toThrow('Network error');
    });

    it('should handle negative balance from API', async () => {
      const calculator = new CompoundInterestCalculatorService(
        defaultConfig,
        logger,
        mockGetBalance,
      );

      mockGetBalance.mockResolvedValue(-10);

      await expect(calculator.calculatePositionSize()).rejects.toThrow(
        'Current balance cannot be negative',
      );
    });
  });
});
