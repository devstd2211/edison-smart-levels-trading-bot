import { PERCENT_MULTIPLIER, INTEGER_MULTIPLIERS } from '../constants';
/**
 * Compound Interest Calculation Helpers
 *
 * Pure functions for compound interest position sizing calculations.
 * No side effects, easy to test.
 */

import { CompoundInterestConfig } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface CompoundCalculationResult {
  positionSize: number; // Calculated position size in USDT
  currentBalance: number; // Current account balance
  totalProfit: number; // Total profit (balance - base deposit)
  lockedProfit: number; // Profit that is locked/protected
  availableProfit: number; // Profit available for reinvestment
  reinvestedAmount: number; // Amount being reinvested
  protectionActive: boolean; // True if deposit protection kicked in
  limitApplied: 'none' | 'min' | 'max' | 'risk'; // Which limit was applied
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate compound interest position size
 *
 * @param currentBalance - Current account balance in USDT
 * @param config - Compound interest configuration
 * @returns Calculation result with position size and breakdown
 */
export function calculateCompoundPositionSize(
  currentBalance: number,
  config: CompoundInterestConfig,
): CompoundCalculationResult {
  // Validate inputs
  if (currentBalance < 0) {
    throw new Error('Current balance cannot be negative');
  }

  if (!config.enabled) {
    // If disabled, return min position size
    return {
      positionSize: config.minPositionSize,
      currentBalance,
      totalProfit: 0,
      lockedProfit: 0,
      availableProfit: 0,
      reinvestedAmount: 0,
      protectionActive: false,
      limitApplied: 'none',
    };
  }

  // Calculate total profit
  const totalProfit = currentBalance - config.baseDeposit;

  // If no profit or loss, use base position size
  if (totalProfit <= 0) {
    return {
      positionSize: config.minPositionSize,
      currentBalance,
      totalProfit,
      lockedProfit: 0,
      availableProfit: 0,
      reinvestedAmount: 0,
      protectionActive: true, // Protection active (at or below base)
      limitApplied: 'min',
    };
  }

  // Calculate locked profit (protected)
  const lockedProfit = calculateLockedProfit(totalProfit, config.profitLockPercent);

  // Calculate available profit for reinvestment
  const availableProfit = totalProfit - lockedProfit;

  // Calculate reinvestment amount
  const reinvestedAmount = calculateReinvestment(availableProfit, config.reinvestmentPercent);

  // Calculate base position size with reinvestment
  let positionSize = config.minPositionSize + reinvestedAmount;

  // Track which limit was applied
  let limitApplied: 'none' | 'min' | 'max' | 'risk' = 'none';

  // Apply minimum limit
  if (positionSize < config.minPositionSize) {
    positionSize = config.minPositionSize;
    limitApplied = 'min';
  }

  // Apply maximum limit
  if (positionSize > config.maxPositionSize) {
    positionSize = config.maxPositionSize;
    limitApplied = 'max';
  }

  // Apply max risk per trade limit
  const maxRiskSize = calculateMaxRiskSize(currentBalance, config.maxRiskPerTrade);
  if (positionSize > maxRiskSize) {
    positionSize = maxRiskSize;
    limitApplied = 'risk';
  }

  return {
    positionSize,
    currentBalance,
    totalProfit,
    lockedProfit,
    availableProfit,
    reinvestedAmount,
    protectionActive: false,
    limitApplied,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate locked profit amount
 *
 * @param totalProfit - Total profit in USDT
 * @param lockPercent - Percentage to lock (0-100)
 * @returns Locked profit amount
 */
export function calculateLockedProfit(totalProfit: number, lockPercent: number): number {
  if (totalProfit <= 0) {
    return 0;
  }
  if (lockPercent < 0) {
    throw new Error('Lock percent cannot be negative');
  }
  if (lockPercent > PERCENT_MULTIPLIER) {
    throw new Error('Lock percent cannot exceed 100');
  }

  return totalProfit * (lockPercent / PERCENT_MULTIPLIER);
}

/**
 * Calculate reinvestment amount
 *
 * @param availableProfit - Profit available for reinvestment
 * @param reinvestPercent - Percentage to reinvest (0-100)
 * @returns Reinvestment amount
 */
export function calculateReinvestment(availableProfit: number, reinvestPercent: number): number {
  if (availableProfit <= 0) {
    return 0;
  }
  if (reinvestPercent < 0) {
    throw new Error('Reinvest percent cannot be negative');
  }
  if (reinvestPercent > PERCENT_MULTIPLIER) {
    throw new Error('Reinvest percent cannot exceed 100');
  }

  return availableProfit * (reinvestPercent / PERCENT_MULTIPLIER);
}

/**
 * Calculate maximum position size based on risk limit
 *
 * @param currentBalance - Current balance
 * @param maxRiskPercent - Max risk per trade (0-100)
 * @returns Maximum allowed position size
 */
export function calculateMaxRiskSize(currentBalance: number, maxRiskPercent: number): number {
  if (currentBalance < 0) {
    throw new Error('Balance cannot be negative');
  }
  if (maxRiskPercent < 0) {
    throw new Error('Max risk percent cannot be negative');
  }
  if (maxRiskPercent > PERCENT_MULTIPLIER) {
    throw new Error('Max risk percent cannot exceed 100');
  }

  return currentBalance * (maxRiskPercent / PERCENT_MULTIPLIER);
}

/**
 * Check if deposit protection should be active
 *
 * @param currentBalance - Current balance
 * @param baseDeposit - Base deposit (protected amount)
 * @param minProfitThreshold - Minimum profit to consider protection inactive (default 0)
 * @returns True if protection is active
 */
export function isDepositProtectionActive(
  currentBalance: number,
  baseDeposit: number,
  minProfitThreshold: number = 0,
): boolean {
  const profit = currentBalance - baseDeposit;
  return profit <= minProfitThreshold;
}

/**
 * Calculate compound interest growth over time
 *
 * @param initialDeposit - Starting deposit
 * @param trades - Array of trade PnLs
 * @param config - Compound interest config
 * @returns Array of balance snapshots after each trade
 */
export function simulateCompoundGrowth(
  initialDeposit: number,
  trades: number[],
  config: CompoundInterestConfig,
): number[] {
  const balances: number[] = [initialDeposit];
  let currentBalance = initialDeposit;

  for (const tradePnL of trades) {
    currentBalance += tradePnL;
    balances.push(currentBalance);
  }

  return balances;
}

/**
 * Calculate position size growth factor
 *
 * @param currentPositionSize - Current position size
 * @param minPositionSize - Base/minimum position size
 * @returns Growth factor (e.g., 1.5 = CONFIDENCE_THRESHOLDS.MODERATE% larger than base)
 */
export function calculateGrowthFactor(
  currentPositionSize: number,
  minPositionSize: number,
): number {
  if (minPositionSize === 0) {
    return 1;
  }
  return currentPositionSize / minPositionSize;
}

/**
 * Validate compound interest configuration
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateCompoundConfig(config: CompoundInterestConfig): void {
  if (config.baseDeposit < 0) {
    throw new Error('Base deposit cannot be negative');
  }

  if (config.reinvestmentPercent < 0 || config.reinvestmentPercent > INTEGER_MULTIPLIERS.ONE_HUNDRED) {
    throw new Error('Reinvestment percent must be between 0 and 100');
  }

  if (config.maxRiskPerTrade < 0 || config.maxRiskPerTrade > INTEGER_MULTIPLIERS.ONE_HUNDRED) {
    throw new Error('Max risk per trade must be between 0 and 100');
  }

  if (config.profitLockPercent < 0 || config.profitLockPercent > INTEGER_MULTIPLIERS.ONE_HUNDRED) {
    throw new Error('Profit lock percent must be between 0 and 100');
  }

  if (config.minPositionSize < 0) {
    throw new Error('Min position size cannot be negative');
  }

  if (config.maxPositionSize < config.minPositionSize) {
    throw new Error('Max position size must be >= min position size');
  }

  if (config.reinvestmentPercent + config.profitLockPercent > INTEGER_MULTIPLIERS.ONE_HUNDRED) {
    throw new Error(
      'Reinvestment + profit lock percentages cannot exceed 100% (some profit must remain unlocked for safety)',
    );
  }
}
