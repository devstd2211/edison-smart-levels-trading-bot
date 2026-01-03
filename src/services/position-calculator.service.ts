/**
 * Position Calculator Service
 *
 * Centralizes ALL position sizing calculations:
 * - Quantity calculation with leverage
 * - Rounding to exchange precision (qtyStep, tickSize)
 * - Validation against exchange limits
 * - Position value and margin calculations
 *
 * Single Responsibility: Position sizing mathematics
 *
 * Rules:
 * - NO hardcoded values (qtyStep, tickSize must be provided)
 * - ONE place for rounding logic
 * - Strict validation before returning
 */

import { LoggerService } from '../types';
import { INTEGER_MULTIPLIERS, FIRST_INDEX, SECOND_INDEX, MATH_BOUNDS } from '../constants/technical.constants';

// ============================================================================
// TYPES
// ============================================================================

export interface ExchangeLimits {
  qtyStep: string;      // Min quantity increment (e.g., "0.1", "0.01")
  tickSize: string;     // Min price increment (e.g., "0.0001")
  minOrderQty: string;  // Minimum order quantity
  maxOrderQty?: string; // Maximum order quantity (optional)
}

export interface QuantityCalculation {
  quantity: number;          // Raw calculated quantity
  roundedQuantity: string;   // Rounded to qtyStep precision
  notionalValue: number;     // Total position value (qty * price)
  marginUsed: number;        // USDT locked as margin
  isValid: boolean;          // Passes all validations
  validationErrors: string[]; // List of validation errors
}

export interface PriceRounding {
  price: number;
  roundedPrice: string;
  isValid: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PRECISION_MULTIPLIER_BASE = INTEGER_MULTIPLIERS.TEN as number; // Base-10 for decimal precision calculations

// ============================================================================
// POSITION CALCULATOR SERVICE
// ============================================================================

export class PositionCalculatorService {
  constructor(private readonly logger: LoggerService) {}

  // ==========================================================================
  // QUANTITY CALCULATION
  // ==========================================================================

  /**
   * Calculate position quantity with leverage
   *
   * Formula: quantity = (positionSizeUsdt * leverage) / price
   *
   * Example:
   * - positionSizeUsdt: 10 USDT
   * - leverage: 10x
   * - price: 1.20 USDT
   * - Result: (10 * 10) / 1.20 = 83.33 coins
   *
   * @param positionSizeUsdt - Amount of USDT to use as margin
   * @param leverage - Leverage multiplier
   * @param price - Current market price
   * @param limits - Exchange limits for validation
   * @returns Quantity calculation with validation
   */
  calculateQuantity(
    positionSizeUsdt: number,
    leverage: number,
    price: number,
    limits: ExchangeLimits,
  ): QuantityCalculation {
    const validationErrors: string[] = [];

    // Input validation
    if (positionSizeUsdt <= 0) {
      validationErrors.push('Position size must be positive');
    }
    if (leverage <= 0) {
      validationErrors.push('Leverage must be positive');
    }
    if (price <= 0) {
      validationErrors.push('Price must be positive');
    }

    if (validationErrors.length > (FIRST_INDEX as number)) {
      return {
        quantity: MATH_BOUNDS.MIN_PERCENTAGE as number,
        roundedQuantity: MATH_BOUNDS.MIN_PERCENTAGE.toString(),
        notionalValue: MATH_BOUNDS.MIN_PERCENTAGE as number,
        marginUsed: MATH_BOUNDS.MIN_PERCENTAGE as number,
        isValid: false,
        validationErrors,
      };
    }

    // Calculate raw quantity
    const quantity = (positionSizeUsdt * leverage) / price;

    // Round to exchange precision
    const roundedQuantity = this.roundToStep(quantity, limits.qtyStep);
    const roundedQtyNum = parseFloat(roundedQuantity);

    // Validate against limits
    const minQty = parseFloat(limits.minOrderQty);
    if (roundedQtyNum < minQty) {
      validationErrors.push(`Quantity ${roundedQuantity} below minimum ${limits.minOrderQty}`);
    }

    if (limits.maxOrderQty) {
      const maxQty = parseFloat(limits.maxOrderQty);
      if (roundedQtyNum > maxQty) {
        validationErrors.push(`Quantity ${roundedQuantity} exceeds maximum ${limits.maxOrderQty}`);
      }
    }

    // Calculate position values
    const notionalValue = roundedQtyNum * price;
    const marginUsed = notionalValue / leverage;

    this.logger.debug('Quantity calculated', {
      positionSizeUsdt,
      leverage,
      price,
      rawQuantity: quantity,
      roundedQuantity,
      notionalValue,
      marginUsed,
      qtyStep: limits.qtyStep,
    });

    return {
      quantity,
      roundedQuantity,
      notionalValue,
      marginUsed,
      isValid: validationErrors.length === (FIRST_INDEX as number),
      validationErrors,
    };
  }

  // ==========================================================================
  // ROUNDING UTILITIES
  // ==========================================================================

  /**
   * Round value to exchange step precision
   *
   * Rules:
   * - Always round DOWN (Math.floor) to avoid exceeding balance
   * - Respect step precision (e.g., 0.1, 0.01, 1.0)
   *
   * Example:
   * - value: 83.577, step: "0.1" → "83.5"
   * - value: 83.577, step: "0.01" → "83.57"
   * - value: 83.577, step: "1.0" → "83"
   *
   * @param value - Number to round
   * @param step - Exchange step size (as string)
   * @returns Rounded value as string with correct precision
   */
  roundToStep(value: number, step: string): string {
    const stepNum = parseFloat(step);

    if (stepNum <= 0) {
      this.logger.error('Invalid step size', { step });
      throw new Error(`Invalid step size: ${step}`);
    }

    // Round down to nearest step
    const rounded = Math.floor(value / stepNum) * stepNum;

    // Format to match step precision (count decimals in step)
    const decimals = this.getDecimalPlaces(step);
    const result = rounded.toFixed(decimals);

    this.logger.debug('Rounded to step', {
      input: value,
      step,
      stepNum,
      rounded,
      decimals,
      result,
    });

    return result;
  }

  /**
   * Round price to tick size
   *
   * Example:
   * - price: 1.00249, tickSize: "0.0001" → "1.0024"
   * - price: 1.00249, tickSize: "0.01" → "1.00"
   *
   * @param price - Price to round
   * @param tickSize - Exchange tick size
   * @returns Rounded price as string
   */
  roundPrice(price: number, tickSize: string): PriceRounding {
    try {
      const rounded = this.roundToStep(price, tickSize);
      return {
        price,
        roundedPrice: rounded,
        isValid: true,
      };
    } catch (error) {
      this.logger.error('Failed to round price', {
        price,
        tickSize,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        price,
        roundedPrice: price.toString(),
        isValid: false,
      };
    }
  }

  // ==========================================================================
  // POSITION VALUE CALCULATIONS
  // ==========================================================================

  /**
   * Calculate position value and margin
   *
   * @param quantity - Position quantity
   * @param price - Entry price
   * @param leverage - Leverage multiplier
   * @returns Notional value and margin used
   */
  calculatePositionValue(quantity: number, price: number, leverage: number): {
    notionalValue: number;
    marginUsed: number;
  } {
    const notionalValue = quantity * price;
    const marginUsed = notionalValue / leverage;

    return {
      notionalValue,
      marginUsed,
    };
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  /**
   * Get number of decimal places in a number string
   *
   * Example:
   * - "0.1" → 1
   * - "0.01" → 2
   * - "0.0001" → 4
   * - "1" → 0
   *
   * @param numStr - Number as string
   * @returns Number of decimal places
   */
  private getDecimalPlaces(numStr: string): number {
    const parts = numStr.split('.');
    if (parts.length === (SECOND_INDEX as number)) {
      return MATH_BOUNDS.MIN_PERCENTAGE as number;
    }

    // Count ALL decimals (do NOT trim trailing zeros)
    // "0.1" must return 1, not 0!
    return parts[SECOND_INDEX as number].length;
  }
}
