/**
 * Strategy Interface
 *
 * Contract for all trading strategies.
 * Allows bot to support multiple strategies with unified API.
 */

import { SignalDirection } from '../types';

// ============================================================================
// STRATEGY EVALUATION
// ============================================================================

/**
 * Strategy evaluation result
 */
export interface StrategyEvaluation {
  // Should enter position
  shouldEnter: boolean;

  // Direction to trade (LONG/SHORT/HOLD)
  direction: SignalDirection;

  // Human-readable reason for decision
  reason: string;

  // List of blocking reasons (if shouldEnter = false)
  blockedBy: string[];

  // Confidence score (0-1) - optional, used for weighted strategies
  confidence?: number;

  // Additional details (strategy-specific)
  details?: Record<string, unknown>;
}

// ============================================================================
// STRATEGY INTERFACE
// ============================================================================

/**
 * Generic strategy interface with type safety
 *
 * All strategies must implement this interface with their specific data type
 */
export interface IStrategy<T = Record<string, unknown>> {
  /**
   * Evaluate market conditions and determine if should enter position
   *
   * @param data - Typed market data (strategy-specific)
   * @returns Strategy evaluation result
   */
  evaluate(data: T): StrategyEvaluation | Promise<StrategyEvaluation>;

  /**
   * Get strategy name
   */
  getName(): string;

  /**
   * Get strategy description
   */
  getDescription(): string;
}

/**
 * Backward compatibility: non-generic version
 * @deprecated Use IStrategy<T> for type safety
 */
export type IStrategyLegacy = IStrategy<Record<string, unknown>>;
