/**
 * Structure Analysis Registration Module
 * Registers: Trend Detector, CHOCH/BOS, Swing, Trend Conflict
 */

import { AnalyzerRegistry } from '../analyzer-registry.service';
import { LoggerService, StrategyMarketData, SignalDirection } from '../../types';
import { AnalyzerRegistrationModule } from './analyzer-registry.interface';
import {
  TREND_DETECTOR_DEFAULT_CONFIDENCE,
} from '../../constants/analyzer.constants';
import { ChochBosSignalAnalyzer } from '../../analyzers/choch-bos-signal.analyzer';
import { TrendConflictDetector } from '../signal-validators/trend-conflict-detector';

export class StructureAnalysisRegistration implements AnalyzerRegistrationModule {
  constructor(
    private chochBosSignalAnalyzer: ChochBosSignalAnalyzer,
    private trendConflictDetector: TrendConflictDetector,
  ) {}

  register(analyzerRegistry: AnalyzerRegistry, logger: LoggerService, config: any): void {
    // Trend Detector (priority 5, weight 0.15)
    const trendEnabled = config?.strategicWeights?.structureAnalysis?.trendDetector?.enabled ?? true;
    analyzerRegistry.register('TREND_DETECTOR', {
      name: 'TREND_DETECTOR',
      weight: 0.15,
      priority: 5,
      enabled: trendEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.trend) return null;
        const direction = data.trend === 'BULLISH' ? SignalDirection.LONG : SignalDirection.SHORT;
        const confidence = config?.analyzerConstants?.trend?.defaultConfidence ?? TREND_DETECTOR_DEFAULT_CONFIDENCE;
        return {
          source: 'TREND_DETECTOR',
          direction,
          confidence,
          weight: 0.15,
          priority: 5,
        };
      },
    });

    // ===== FIX #2: CHOCH_BOS_DETECTOR - Full Implementation =====
    const chochEnabled = config?.strategicWeights?.structureAnalysis?.chochBos?.enabled ?? true;
    analyzerRegistry.register('CHOCH_BOS_DETECTOR', {
      name: 'CHOCH_BOS_DETECTOR',
      weight: 0.2,
      priority: 7,
      enabled: chochEnabled,
      evaluate: async (data: StrategyMarketData) => {
        return this.chochBosSignalAnalyzer.evaluate(data);
      },
    });

    // Swing Detector (priority 8, weight 0.18)
    const swingEnabled = config?.strategicWeights?.structureAnalysis?.swingDetector?.enabled ?? true;
    analyzerRegistry.register('SWING_DETECTOR', {
      name: 'SWING_DETECTOR',
      weight: 0.18,
      priority: 8,
      enabled: swingEnabled,
      evaluate: async (data: StrategyMarketData) => {
        if (!data.swingPoints || data.swingPoints.length < 2) {
          logger.debug('⛔ SWING_DETECTOR | Insufficient swing points for analysis');
          return null;
        }
        logger.debug('⛔ SWING_DETECTOR | No swing-based signal generated');
        return null;
      },
    });

    // ===== FIX #6: TREND_CONFLICT_DETECTOR - Detects conflicting signals indicating reversals =====
    const trendConflictEnabled = config?.analyzerStrategic?.trendConflictDetector?.enabled ?? true;
    analyzerRegistry.register('TREND_CONFLICT', {
      name: 'TREND_CONFLICT',
      weight: 0.1,
      priority: 8,
      enabled: trendConflictEnabled,
      evaluate: async (data: StrategyMarketData) => {
        // TrendConflictDetector needs to be called with all current signals
        // For now, return null as this requires signal aggregation context
        // Will be properly integrated in TradeExecutionService
        return null;
      },
    });

    logger.info('✅ Structure Analysis registered (4 analyzers)');
  }
}
