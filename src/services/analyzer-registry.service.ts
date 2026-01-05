/**
 * Analyzer Registry Service
 *
 * Central registry for all analyzers/detectors/indicators.
 * Manages initialization, execution, and signal collection from all sources.
 *
 * Purpose:
 * - Register all analyzers as signal sources
 * - Execute all analyzers in parallel
 * - Collect signals with weights
 * - Pass signals to coordinator for weighted aggregation
 *
 * This ensures:
 * ✅ All components work together (not isolated)
 * ✅ Weights determine influence (not hard blocks)
 * ✅ Single score for decision making
 * ✅ No single filter can block everything
 */

import {
  AnalyzerSignal,
  LoggerService,
  StrategyMarketData,
} from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzerDefinition {
  name: string;
  weight: number;
  priority: number;
  enabled: boolean;
  evaluate: (data: StrategyMarketData) => Promise<AnalyzerSignal | null>;
}

// ============================================================================
// ANALYZER REGISTRY
// ============================================================================

export class AnalyzerRegistry {
  private analyzers: Map<string, AnalyzerDefinition> = new Map();

  constructor(private logger: LoggerService) {}

  /**
   * Register an analyzer with weight and priority
   */
  register(name: string, analyzer: AnalyzerDefinition): void {
    this.analyzers.set(name, analyzer);
    this.logger.info(`Analyzer registered: ${name}`, {
      weight: analyzer.weight,
      priority: analyzer.priority,
      enabled: analyzer.enabled,
    });
  }

  /**
   * Register multiple analyzers at once
   */
  registerBatch(analyzers: AnalyzerDefinition[]): void {
    for (const analyzer of analyzers) {
      this.register(analyzer.name, analyzer);
    }
  }

  /**
   * Execute all enabled analyzers and collect signals
   *
   * Runs all analyzers in PARALLEL, not sequentially.
   * This ensures signals are independent and not influenced by order.
   */
  async collectSignals(data: StrategyMarketData): Promise<AnalyzerSignal[]> {
    const signals: AnalyzerSignal[] = [];
    const enabledAnalyzers = Array.from(this.analyzers.values()).filter(
      (a) => a.enabled,
    );

    if (enabledAnalyzers.length === 0) {
      this.logger.warn('No analyzers enabled');
      return signals;
    }

    this.logger.debug(`Collecting signals from ${enabledAnalyzers.length} analyzers`);

    // Execute all analyzers in parallel
    const results = await Promise.allSettled(
      enabledAnalyzers.map((analyzer) =>
        analyzer.evaluate(data).catch((error) => {
          this.logger.error(`Analyzer ${analyzer.name} failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        }),
      ),
    );

    // Collect successful signals
    const blockedAnalyzers: string[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const analyzer = enabledAnalyzers[i];

      if (result.status === 'fulfilled') {
        if (result.value !== null) {
          const signal = result.value;
          signals.push(signal);

          this.logger.info(`✅ AnalyzerSignal | ${analyzer.name}`, {
            direction: signal.direction,
            confidence: signal.confidence,
            weight: signal.weight,
            priority: signal.priority,
            source: signal.source,
          });
        } else {
          // Blocked signal (returned null)
          blockedAnalyzers.push(analyzer.name);
          this.logger.warn(`⛔ AnalyzerBlocked | ${analyzer.name}`, {
            weight: analyzer.weight,
            priority: analyzer.priority,
            reason: 'No signal generated (returned null)',
          });
        }
      } else {
        // Error in analyzer
        blockedAnalyzers.push(analyzer.name);
        this.logger.error(`❌ AnalyzerError | ${analyzer.name}`, {
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }

    this.logger.info(`📊 Signal Collection Summary`, {
      collected: signals.length,
      blocked: blockedAnalyzers.length,
      total: enabledAnalyzers.length,
      blockedAnalyzers: blockedAnalyzers.length > 0 ? blockedAnalyzers : undefined,
    });
    return signals;
  }

  /**
   * Get analyzer by name
   */
  getAnalyzer(name: string): AnalyzerDefinition | undefined {
    return this.analyzers.get(name);
  }

  /**
   * Update analyzer weight (for dynamic adjustment)
   */
  setWeight(name: string, weight: number): void {
    const analyzer = this.analyzers.get(name);
    if (analyzer) {
      analyzer.weight = weight;
      this.logger.info(`Weight updated: ${name} → ${weight}`);
    }
  }

  /**
   * Enable/disable analyzer
   */
  setEnabled(name: string, enabled: boolean): void {
    const analyzer = this.analyzers.get(name);
    if (analyzer) {
      analyzer.enabled = enabled;
      this.logger.info(`Analyzer ${enabled ? 'enabled' : 'disabled'}: ${name}`);
    }
  }

  /**
   * Get all registered analyzers
   */
  getAnalyzers(): AnalyzerDefinition[] {
    return Array.from(this.analyzers.values());
  }

  /**
   * Get analyzer count
   */
  getCount(): number {
    return this.analyzers.size;
  }

  /**
   * Get enabled analyzer count
   */
  getEnabledCount(): number {
    return Array.from(this.analyzers.values()).filter((a) => a.enabled).length;
  }

  /**
   * Clear all analyzers
   */
  clear(): void {
    this.analyzers.clear();
    this.logger.info('All analyzers cleared');
  }

  /**
   * Get registry status
   */
  getStatus(): Record<string, unknown> {
    const analyzers = this.getAnalyzers();
    return {
      totalAnalyzers: analyzers.length,
      enabledAnalyzers: this.getEnabledCount(),
      analyzers: analyzers.map((a) => ({
        name: a.name,
        weight: a.weight,
        priority: a.priority,
        enabled: a.enabled,
      })),
    };
  }
}
