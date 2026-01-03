/**
 * Scalping Limit Order Strategy (Phase 2)
 *
 * This is a SPECIAL wrapper strategy that doesn't generate its own signals.
 * Instead, it modifies the ORDER EXECUTION for ALL strategies when enabled.
 *
 * Purpose:
 * - Intercept position opening and use limit orders instead of market orders
 * - Save 0.05% in fees per trade (0.06% taker → 0.01% maker)
 * - Fallback to market order if limit not filled within timeout
 *
 * Design:
 * - Returns NO_SIGNAL from evaluate() (doesn't compete with other strategies)
 * - Actual execution logic handled by LimitOrderExecutorService in PositionService
 * - Enabled/disabled via config.scalpingLimitOrder.enabled
 *
 * Note: This strategy serves as a GLOBAL SETTING for limit order execution,
 * not as a traditional signal-generating strategy.
 */

import {
  IStrategy,
  StrategySignal,
  StrategyMarketData,
  SignalDirection,
  SignalType,
  LoggerService,
  ScalpingLimitOrderConfig,
} from '../types';

// ============================================================================
// SCALPING LIMIT ORDER STRATEGY
// ============================================================================

export class ScalpingLimitOrderStrategy implements IStrategy {
  readonly name = 'ScalpingLimitOrder';
  readonly type = SignalType.SCALPING_LIMIT_ORDER;
  readonly priority: number;

  constructor(
    private config: ScalpingLimitOrderConfig,
    private logger: LoggerService,
  ) {
    this.priority = config.priority;
    this.logger.info('ScalpingLimitOrderStrategy initialized (execution wrapper)', {
      enabled: config.enabled,
      priority: config.priority,
      timeoutMs: config.executor.timeoutMs,
      slippage: config.executor.slippagePercent,
      fallbackToMarket: config.executor.fallbackToMarket,
      baseSignalSource: config.baseSignalSource,
    });

    if (config.enabled) {
      this.logger.info(
        '💰 Limit Order Execution ENABLED - All entries will use limit orders (maker fees)',
      );
      this.logger.info('📊 Fee savings: 0.05% per trade (0.06% taker → 0.01% maker)');
    }
  }

  // ==========================================================================
  // STRATEGY INTERFACE
  // ==========================================================================

  /**
   * Evaluate market data for signals
   *
   * IMPORTANT: This strategy NEVER generates its own signals!
   * It always returns NO_SIGNAL because it's a wrapper/modifier for execution.
   *
   * The actual limit order logic is handled by:
   * - LimitOrderExecutorService in PositionService.openPosition()
   * - Enabled/disabled via config.scalpingLimitOrder.enabled
   *
   * @returns NO_SIGNAL always
   */
  async evaluate(_data: StrategyMarketData): Promise<StrategySignal> {
    // This strategy doesn't generate signals - it modifies execution
    return this.noSignal('Wrapper strategy - does not generate signals');
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /**
   * Return NO_SIGNAL result
   */
  private noSignal(reason: string): StrategySignal {
    return {
      valid: false,
      strategyName: this.name,
      priority: this.priority,
      reason,
    };
  }

  /**
   * Get executor configuration
   * Used by PositionService to access limit order settings
   */
  getExecutorConfig() {
    return this.config.executor;
  }

  /**
   * Check if limit order execution is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled && this.config.executor.enabled;
  }

  /**
   * Get base signal source
   * Indicates which strategy this wrapper applies to
   */
  getBaseSignalSource(): string {
    return this.config.baseSignalSource;
  }
}
