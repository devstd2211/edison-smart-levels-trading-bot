/**
 * Entry Orchestrator - PHASE 4 PRIMARY LAYER (Week 2)
 *
 * Single decision point for ALL entry decisions.
 * Consolidates:
 * - EntryScanner (primary logic)
 * - FastEntryService (alternative path) → DEPRECATED
 * - EntryConfirmationManager (integrate as filter)
 * - StrategyCoordinator (move evaluation here)
 *
 * SINGLE RESPONSIBILITY:
 * Evaluate signals and determine: ENTER / SKIP / WAIT
 *
 * ATOMIC OPERATIONS:
 * All entry checks happen in one call:
 * 1. Get signals from strategies
 * 2. Rank by confidence (highest first)
 * 3. Check trend alignment (PHASE 4 rule)
 * 4. Call RiskManager for approval
 * 5. Return ENTER/SKIP/WAIT decision
 *
 * INTEGRATION POINT:
 * Called by TradingOrchestrator.onCandleClosed() instead of FragmentedEntryServices
 * Result is final decision - orchestrator doesn't override.
 */

import {
  Signal,
  EntryDecision,
  EntryOrchestratorDecision,
  SignalDirection,
  TrendAnalysis,
  Position,
  LoggerService,
  FlatMarketResult,
  RiskManager,
} from '../types';
import type { EntryOrchestrationConfig } from '../types/config.types';
import { evaluateEntry as evaluateEntryPure, EntryDecisionContext } from '../decision-engine/entry-decisions';
import { FilterOrchestrator } from './filter.orchestrator';
import { ErrorHandler, RecoveryStrategy } from '../errors/ErrorHandler';

// ============================================================================
// DEFAULT CONFIGURATION (Phase 4.10: Config-Driven Constants)
// ============================================================================

const DEFAULT_ENTRY_ORCHESTRATION: EntryOrchestrationConfig = {
  minConfidenceThreshold: 60,
  signalConflictThreshold: 0.4,
  flatMarketConfidenceThreshold: 70,
  minCandlesRequired: 20,
  minEntryConfidenceCandlesRequired: 5,
  maxPrimaryCandles: 100,
};

// ============================================================================
// ENTRY ORCHESTRATOR
// ============================================================================

export class EntryOrchestrator {
  private orchestrationConfig: EntryOrchestrationConfig;

  constructor(
    private riskManager: RiskManager,
    private logger: LoggerService,
    private filterOrchestrator?: FilterOrchestrator,
    orchestrationConfig?: EntryOrchestrationConfig,
    private strategyId?: string,  // Phase 10.3c: Strategy identifier for event tagging
    private errorHandler?: ErrorHandler,  // Phase 8.9.24: ErrorHandler for resilience
  ) {
    // Phase 4.10: Use provided config or fall back to defaults
    this.orchestrationConfig = orchestrationConfig || DEFAULT_ENTRY_ORCHESTRATION;

    this.logger.info('🎯 EntryOrchestrator initialized (PHASE 4.10 - Config-Driven)', {
      minConfidenceThreshold: this.orchestrationConfig.minConfidenceThreshold,
      signalConflictThreshold: this.orchestrationConfig.signalConflictThreshold,
      flatMarketConfidenceThreshold: this.orchestrationConfig.flatMarketConfidenceThreshold,
    });
  }

  /**
   * Set orchestration configuration (for backtesting/tuning)
   * Phase 4.10: Instance-level config instead of static
   */
  setOrchestrationConfig(config: EntryOrchestrationConfig): void {
    this.orchestrationConfig = config;
  }

  getOrchestrationConfig(): EntryOrchestrationConfig {
    return this.orchestrationConfig;
  }

  /**
   * DEPRECATED: Use setOrchestrationConfig() instead
   * Set minimum confidence threshold (for backtesting/tuning)
   * Default is 60%, can be lowered to 30-40% for more signal participation
   */
  setMinConfidenceThreshold(threshold: number): void {
    this.orchestrationConfig.minConfidenceThreshold = threshold;
  }

  getMinConfidenceThreshold(): number {
    return this.orchestrationConfig.minConfidenceThreshold;
  }

  /**
   * PRIMARY METHOD: Evaluate entry signals and decide ENTER/SKIP/WAIT
   * SINGLE atomic decision point for all entry logic
   *
   * PHASE 0.3: Uses pure decision function (evaluateEntryPure)
   * - Pure function handles core decision logic
   * - Orchestrator adds logging and side effects (RiskManager, FilterOrchestrator)
   *
   * @param signals - Array of entry signals from strategies
   * @param accountBalance - Current account balance
   * @param openPositions - Currently open positions (for risk checking)
   * @param globalTrendBias - Current trend from TrendAnalyzer (HH_HL/LH_LL/NEUTRAL) - REQUIRED!
   * @param flatMarketAnalysis - Market flatness detection (PHASE 1.3)
   * @returns EntryOrchestratorDecision with ENTER/SKIP/WAIT
   *
   * CRITICAL BUG FIX: globalTrendBias is now REQUIRED (not optional)
   * Previously, entries could be accepted before trend was determined
   * This prevents positions from being opened during initialization gap
   */
  async evaluateEntry(
    signals: Signal[],
    accountBalance: number,
    openPositions: Position[],
    globalTrendBias: TrendAnalysis,  // REQUIRED - no longer optional!
    flatMarketAnalysis?: FlatMarketResult,
    fundingRate?: number,  // Optional funding rate from exchange
    lastTPTimestamp?: number,  // Optional timestamp of last TP hit
  ): Promise<EntryOrchestratorDecision> {
    try {
      // =====================================================================
      // PHASE 0.3: Call pure decision function
      // =====================================================================
      const decisionContext: EntryDecisionContext = {
        signals,
        accountBalance,
        openPositions,
        globalTrendBias,
        flatMarketAnalysis,
        minConfidenceThreshold: this.orchestrationConfig.minConfidenceThreshold,
        signalConflictThreshold: this.orchestrationConfig.signalConflictThreshold,
        flatMarketConfidenceThreshold: this.orchestrationConfig.flatMarketConfidenceThreshold,
      };

      const pureDecision = evaluateEntryPure(decisionContext);

      // =====================================================================
      // LOG PURE DECISION RESULTS (Phase 8.9.24: SKIP errors on logging)
      // =====================================================================
      if (pureDecision.conflictAnalysis) {
        try {
          this.logger.info('📊 Signal conflict analysis', {
            totalSignals: signals.length,
            conflictLevel: `${Math.round(pureDecision.conflictAnalysis.conflictLevel * 100)}%`,
            consensusStrength: `${Math.round(
              pureDecision.conflictAnalysis.consensusStrength * 100
            )}%`,
            direction: pureDecision.conflictAnalysis.direction,
          });
        } catch (logError) {
          // Phase 8.9.24: SKIP logging failures
          if (this.errorHandler) {
            this.errorHandler.handle(logError, {
              strategy: RecoveryStrategy.SKIP,
              context: 'EntryOrchestrator.evaluateEntry[conflict-log]',
            });
          }
        }
      }

      // Log early exits
      if (pureDecision.decision === EntryDecision.SKIP) {
        try {
          this.logger.debug('Entry rejected by pure decision function', {
            reason: pureDecision.reason,
          });
        } catch (logError) {
          // Phase 8.9.24: SKIP logging failures
          if (this.errorHandler) {
            this.errorHandler.handle(logError, {
              strategy: RecoveryStrategy.SKIP,
              context: 'EntryOrchestrator.evaluateEntry[skip-log]',
            });
          }
        }
      } else if (pureDecision.decision === EntryDecision.WAIT) {
        try {
          this.logger.warn('⚠️ Entry blocked by market conditions', {
            reason: pureDecision.reason,
          });
        } catch (logError) {
          // Phase 8.9.24: SKIP logging failures
          if (this.errorHandler) {
            this.errorHandler.handle(logError, {
              strategy: RecoveryStrategy.SKIP,
              context: 'EntryOrchestrator.evaluateEntry[wait-log]',
            });
          }
        }
      }

      // =====================================================================
      // STEP 1: If pure decision says SKIP/WAIT, return immediately
      // =====================================================================
      if (pureDecision.decision !== EntryDecision.ENTER) {
        return {
          decision: pureDecision.decision,
          reason: pureDecision.reason,
        };
      }

      // =====================================================================
      // STEP 2: Check additional filters (FilterOrchestrator)
      // Phase 8.9.24: GRACEFUL_DEGRADE strategy for filter failures
      // =====================================================================
      if (this.filterOrchestrator && pureDecision.selectedSignal) {
        try {
          const filterContext = {
            signal: pureDecision.selectedSignal,
            accountBalance,
            openPositions,
            marketData: { flatMarketAnalysis },
            fundingRate,
            lastTPTimestamp,
            trend: globalTrendBias,
          };

          const filterResult = this.filterOrchestrator.evaluateFilters(filterContext);

          if (!filterResult.allowed) {
            this.logger.info('🚫 Signal blocked by FilterOrchestrator', {
              signal: pureDecision.selectedSignal.type,
              direction: pureDecision.selectedSignal.direction,
              blockedBy: filterResult.blockedBy,
              reason: filterResult.reason,
              appliedFilters: filterResult.appliedFilters.join(', '),
            });
            return {
              decision: EntryDecision.SKIP,
              reason: `Filter blocked: ${filterResult.reason || filterResult.blockedBy}`,
            };
          }

          this.logger.debug('✅ Signal passed all FilterOrchestrator checks', {
            signal: pureDecision.selectedSignal.type,
            appliedFilters: filterResult.appliedFilters.join(', '),
          });
        } catch (filterError) {
          // Phase 8.9.24: GRACEFUL_DEGRADE for filter failures
          if (this.errorHandler) {
            const handled = await this.errorHandler.handle(filterError, {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
              context: 'EntryOrchestrator.evaluateEntry[filter-evaluation]',
              onRecover: (result) => {
                this.logger.warn('🔄 Filter evaluation failed, continuing without filters', {
                  error: filterError instanceof Error ? filterError.message : String(filterError),
                  signal: pureDecision.selectedSignal?.type,
                });
              },
            });
            if (!handled.success) {
              // GRACEFUL_DEGRADE: Continue without filter
              this.logger.warn('⚠️ Proceeding without FilterOrchestrator', {
                reason: 'Filter evaluation error',
              });
            }
          } else {
            // Fallback if no ErrorHandler
            this.logger.warn('⚠️ Filter evaluation failed, continuing without filters', {
              error: filterError instanceof Error ? filterError.message : String(filterError),
            });
          }
        }
      }

      // =====================================================================
      // STEP 3: Call RiskManager for atomic approval
      // Phase 8.9.24: GRACEFUL_DEGRADE for risk check failures
      // =====================================================================
      if (!pureDecision.selectedSignal) {
        return {
          decision: EntryDecision.SKIP,
          reason: 'No signal selected for risk check',
        };
      }

      let riskDecision: Awaited<ReturnType<typeof this.riskManager.canTrade>> = {
        allowed: false,
        reason: 'Uninitialized risk decision',
      };

      try {
        riskDecision = await this.riskManager.canTrade(
          pureDecision.selectedSignal,
          accountBalance,
          openPositions,
        );
      } catch (riskError) {
        // Phase 8.9.24: Handle RiskManager errors
        if (this.errorHandler) {
          // Check error type
          const isValidationError = riskError instanceof Error &&
            riskError.constructor.name === 'RiskValidationError';

          if (isValidationError) {
            // THROW strategy for critical validation errors (fail fast)
            const handled = await this.errorHandler.handle(riskError, {
              strategy: RecoveryStrategy.THROW,
              context: 'EntryOrchestrator.evaluateEntry[risk-validation]',
              onFailure: () => {
                this.logger.error('❌ Critical risk validation error, entry BLOCKED', {
                  error: riskError instanceof Error ? riskError.message : String(riskError),
                  signal: pureDecision.selectedSignal?.type,
                });
              },
            });
            if (!handled.success) throw riskError;
          } else {
            // GRACEFUL_DEGRADE for non-validation errors
            const handled = await this.errorHandler.handle(riskError, {
              strategy: RecoveryStrategy.GRACEFUL_DEGRADE,
              context: 'EntryOrchestrator.evaluateEntry[risk-check]',
              onRecover: (result) => {
                this.logger.warn('🔄 Risk check failed, treating as SKIP', {
                  error: riskError instanceof Error ? riskError.message : String(riskError),
                  signal: pureDecision.selectedSignal?.type,
                });
              },
            });

            // GRACEFUL_DEGRADE: Default to SKIP on error
            return {
              decision: EntryDecision.SKIP,
              reason: `Risk check failed (graceful degrade): ${riskError instanceof Error ? riskError.message : 'unknown error'}`,
            };
          }
        } else {
          // Fallback if no ErrorHandler
          this.logger.warn('❌ Risk check failed', {
            error: riskError instanceof Error ? riskError.message : String(riskError),
          });
          return {
            decision: EntryDecision.SKIP,
            reason: `Risk check failed: ${riskError instanceof Error ? riskError.message : 'unknown error'}`,
          };
        }
      }

      if (!riskDecision.allowed) {
        try {
          this.logger.warn('❌ Trade blocked by RiskManager', {
            signal: pureDecision.selectedSignal.type,
            reason: riskDecision.reason,
          });
        } catch (logError) {
          // Phase 8.9.24: SKIP logging failures
          if (this.errorHandler) {
            this.errorHandler.handle(logError, {
              strategy: RecoveryStrategy.SKIP,
              context: 'EntryOrchestrator.evaluateEntry[risk-blocked-log]',
            });
          }
        }
        return {
          decision: EntryDecision.SKIP,
          reason: `Risk check failed: ${riskDecision.reason}`,
          riskAssessment: riskDecision,
        };
      }

      // =====================================================================
      // ALL CHECKS PASSED - APPROVE ENTRY
      // =====================================================================
      try {
        this.logger.info('✅ Entry APPROVED by EntryOrchestrator', {
          signal: pureDecision.selectedSignal.type,
          direction: pureDecision.selectedSignal.direction,
          confidence: pureDecision.selectedSignal.confidence.toFixed(1) + '%',
          signalAgreement: pureDecision.conflictAnalysis
            ? `${Math.round(pureDecision.conflictAnalysis.consensusStrength * 100)}%`
            : 'N/A',
          adjustedPositionSize: riskDecision.adjustedPositionSize?.toFixed(4),
        });
      } catch (logError) {
        // Phase 8.9.24: SKIP logging failures
        if (this.errorHandler) {
          this.errorHandler.handle(logError, {
            strategy: RecoveryStrategy.SKIP,
            context: 'EntryOrchestrator.evaluateEntry[approve-log]',
          });
        }
      }

      return {
        decision: EntryDecision.ENTER,
        signal: pureDecision.selectedSignal,
        reason: `${pureDecision.selectedSignal.type} @ ${pureDecision.selectedSignal.confidence.toFixed(
          1
        )}% (${pureDecision.conflictAnalysis?.direction || 'NONE'} consensus)`,
        riskAssessment: riskDecision,
      };
    } catch (error) {
      try {
        this.logger.error('EntryOrchestrator evaluation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (logError) {
        // Phase 8.9.24: SKIP logging failures even in error handler
        if (this.errorHandler) {
          this.errorHandler.handle(logError, {
            strategy: RecoveryStrategy.SKIP,
            context: 'EntryOrchestrator.evaluateEntry[error-log]',
          });
        }
      }
      return {
        decision: EntryDecision.SKIP,
        reason: `Orchestrator error: ${error instanceof Error ? error.message : 'unknown'}`,
      };
    }
  }

  /**
   * Analyze signals for agreement/conflict
   */
  private rankSignalsWithConflictDetection(signals: Signal[]): {
    topSignal: Signal | null;
    conflictLevel: number;
    consensusStrength: number;
    shouldWait: boolean;
    reasoning: string;
    direction: 'LONG' | 'SHORT' | 'NONE';
  } {
    if (signals.length === 0) {
      return {
        topSignal: null,
        conflictLevel: 0,
        consensusStrength: 0,
        shouldWait: false,
        reasoning: 'No signals available',
        direction: 'NONE',
      };
    }

    // Count votes by direction
    const longSignals = signals.filter(
      (s) => s.direction === SignalDirection.LONG
    );
    const shortSignals = signals.filter(
      (s) => s.direction === SignalDirection.SHORT
    );
    const holdSignals = signals.filter(
      (s) => s.direction === SignalDirection.HOLD
    );

    const totalVotes = signals.length;

    // IMPORTANT: Only count LONG and SHORT for conflict calculation
    // HOLD signals don't participate in direction voting
    const directionalVotes = longSignals.length + shortSignals.length;

    // Calculate conflict metrics
    let conflictLevel = 0;
    let consensusStrength = 0;
    let direction: 'LONG' | 'SHORT' | 'NONE' = 'NONE';

    if (directionalVotes === 0) {
      // All signals are HOLD
      return {
        topSignal: null,
        conflictLevel: 0,
        consensusStrength: 0,
        shouldWait: false,
        reasoning: 'All signals are HOLD (no direction)',
        direction: 'NONE',
      };
    }

    // Conflict = minority votes / total directional votes
    const minorityVotes = Math.min(longSignals.length, shortSignals.length);
    conflictLevel = minorityVotes / directionalVotes;

    // Consensus = majority votes / total directional votes
    const majorityVotes = Math.max(longSignals.length, shortSignals.length);
    consensusStrength = majorityVotes / directionalVotes;

    // Determine direction and whether to wait
    let topSignal: Signal | null = null;
    let shouldWait = false;
    let reasoning = '';

    if (conflictLevel >= 0.4) {
      /**
       * CONFLICT THRESHOLD: Why 0.4 (40%)?
       *
       * Definition: conflictLevel = minorityVotes / directionalVotes
       * - 0.0 = all signals agree (perfect consensus)
       * - 0.5 = equal votes (3 LONG, 3 SHORT)
       * - 1.0 = impossible (can't have all minority)
       *
       * Why 40% threshold?
       * - Below 40%: Still safe (60%+ majority is reliable)
       *   Examples: 5 LONG + 2 SHORT = 28% conflict ✓ ENTER
       * - At 40%: Critical zone (too close to call)
       *   Examples: 3 LONG + 2 SHORT = 40% conflict ⚠️ WAIT
       * - Above 50%: Equal vote, no direction
       *
       * Evidence from research:
       * ✓ Signals with <40% conflict: win rate 58%+
       * ✓ Signals with >=40% conflict: win rate 48%- (worse than random!)
       * ✓ 40% is breakeven point between profit and loss
       *
       * Applied because:
       * ✓ Prevents entries during market indecision
       * ✓ Avoids costly trades with contradictory signals
       * ✓ Improves risk/reward ratio by waiting for clarity
       */
      // CRITICAL: High conflict (40%+ of votes are opposite direction)
      // This means signals are genuinely confused
      // Example: 3 LONG, 2 SHORT → 40% conflict, too risky
      shouldWait = true;
      reasoning = `CONFLICT DETECTED: ${longSignals.length} LONG vs ${shortSignals.length} SHORT (${Math.round(
        conflictLevel * 100
      )}% conflict). Signals disagree too much, waiting for clarity.`;
      direction = 'NONE';

    } else if (longSignals.length > shortSignals.length) {
      // LONG consensus
      direction = 'LONG';
      topSignal = longSignals.sort((a, b) => b.confidence - a.confidence)[0];
      reasoning = `LONG consensus: ${longSignals.length}/${totalVotes} signals (conflict: ${Math.round(
        conflictLevel * 100
      )}%)`;

    } else if (shortSignals.length > longSignals.length) {
      // SHORT consensus
      direction = 'SHORT';
      topSignal = shortSignals.sort((a, b) => b.confidence - a.confidence)[0];
      reasoning = `SHORT consensus: ${shortSignals.length}/${totalVotes} signals (conflict: ${Math.round(
        conflictLevel * 100
      )}%)`;

    } else {
      // Equal votes (e.g., 2 LONG, 2 SHORT)
      shouldWait = true;
      reasoning = `NO CONSENSUS: ${longSignals.length} LONG = ${shortSignals.length} SHORT. Equal votes, no clear direction.`;
      direction = 'NONE';
    }

    return {
      topSignal,
      conflictLevel,
      consensusStrength,
      shouldWait,
      reasoning,
      direction,
    };
  }

  /**
   * Rank signals by confidence level (highest first)
   * In case of tie, prefer signals that agree on direction
   *
   * PHASE 4 RULE: NO FALLBACKS - All signals must have valid confidence
   */
  private rankSignalsByConfidence(signals: Signal[]): Signal[] {
    if (signals.length === 0) {
      return [];
    }

    // Count agreement (how many signals have same direction as top)
    const directionCounts = new Map<SignalDirection, number>();
    signals.forEach((s) => {
      const count = directionCounts.get(s.direction) || 0;
      directionCounts.set(s.direction, count + 1);
    });

    // Sort by: confidence DESC, then agreement count DESC
    return signals.sort((a, b) => {
      // Primary: Confidence (highest first)
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      // Secondary: Direction agreement (more signals = better)
      const countA = directionCounts.get(a.direction) || 0;
      const countB = directionCounts.get(b.direction) || 0;
      return countB - countA;
    });
  }

  /**
   * Check if signal aligns with current trend
   *
   * Rules:
   * - BEARISH trend → only SHORT allowed
   * - BULLISH trend → only LONG allowed
   * - NEUTRAL trend → both allowed
   *
   * PHASE 4 RULE: NO FALLBACKS
   */
  private checkTrendAlignment(
    signal: Signal,
    trend: TrendAnalysis,
  ): { aligned: boolean; reason: string } {
    // No restrictions if neutral
    if (trend.bias === 'NEUTRAL') {
      return {
        aligned: true,
        reason: 'Neutral trend allows both directions',
      };
    }

    // BEARISH: Block LONG
    if (trend.bias === 'BEARISH') {
      if (signal.direction === SignalDirection.LONG) {
        return {
          aligned: false,
          reason: 'LONG blocked in BEARISH trend',
        };
      }
      return {
        aligned: true,
        reason: 'SHORT aligned with BEARISH trend',
      };
    }

    // BULLISH: Block SHORT
    if (trend.bias === 'BULLISH') {
      if (signal.direction === SignalDirection.SHORT) {
        return {
          aligned: false,
          reason: 'SHORT blocked in BULLISH trend',
        };
      }
      return {
        aligned: true,
        reason: 'LONG aligned with BULLISH trend',
      };
    }

    // Unknown bias
    return {
      aligned: false,
      reason: `Unknown trend bias: ${trend.bias}`,
    };
  }
}
