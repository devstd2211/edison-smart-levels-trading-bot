/**
 * Analyzer Configuration Utilities (Phase 4.10)
 * Extract analyzer-specific parameters from BotConfig
 */

import type {
  AtrAnalyzerParams,
  BollingerBandsAnalyzerParams,
  BreakoutAnalyzerParams,
  OrderBlockAnalyzerParams,
  WickAnalyzerParams,
} from '../types/config/config.types';

interface AnalyzerConfigEnvelope {
  analyzerParameters?: {
    atr?: Partial<AtrAnalyzerParams>;
    bollingerBands?: Partial<BollingerBandsAnalyzerParams>;
    breakout?: Partial<BreakoutAnalyzerParams>;
    orderBlock?: Partial<OrderBlockAnalyzerParams>;
    wick?: Partial<WickAnalyzerParams>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getAnalyzerParameterSection<T extends object>(
  analyzerParameters: Record<string, unknown>,
  key: string,
): Partial<T> | undefined {
  const section = analyzerParameters[key];
  return isRecord(section) ? (section as Partial<T>) : undefined;
}

function asAnalyzerConfigEnvelope(config: unknown): AnalyzerConfigEnvelope {
  if (!isRecord(config)) {
    return {};
  }

  const analyzerParameters = config.analyzerParameters;
  if (!isRecord(analyzerParameters)) {
    return {};
  }

  return {
    analyzerParameters: {
      atr: getAnalyzerParameterSection<AtrAnalyzerParams>(analyzerParameters, 'atr'),
      bollingerBands: getAnalyzerParameterSection<BollingerBandsAnalyzerParams>(analyzerParameters, 'bollingerBands'),
      breakout: getAnalyzerParameterSection<BreakoutAnalyzerParams>(analyzerParameters, 'breakout'),
      orderBlock: getAnalyzerParameterSection<OrderBlockAnalyzerParams>(analyzerParameters, 'orderBlock'),
      wick: getAnalyzerParameterSection<WickAnalyzerParams>(analyzerParameters, 'wick'),
    },
  };
}

// ============================================================================
// PARAMETER EXTRACTION UTILITIES
// ============================================================================

/**
 * Extract ATR analyzer parameters from config
 * Falls back to defaults if config section is missing
 */
export function getAtrAnalyzerParams(config: unknown): AtrAnalyzerParams {
  const params = asAnalyzerConfigEnvelope(config).analyzerParameters?.atr;
  return {
    highThreshold: params?.highThreshold ?? 2.5,
    lowThreshold: params?.lowThreshold ?? 0.8,
  };
}

/**
 * Extract Bollinger Bands analyzer parameters from config
 * Falls back to defaults if config section is missing
 */
export function getBollingerBandsAnalyzerParams(config: unknown): BollingerBandsAnalyzerParams {
  const params = asAnalyzerConfigEnvelope(config).analyzerParameters?.bollingerBands;
  return {
    minCandlesRequired: params?.minCandlesRequired ?? 25,
    oversoldThreshold: params?.oversoldThreshold ?? 20,
    overboughtThreshold: params?.overboughtThreshold ?? 80,
    neutralRange: {
      lower: params?.neutralRange?.lower ?? 40,
      upper: params?.neutralRange?.upper ?? 60,
    },
    squeezeThreshold: params?.squeezeThreshold ?? 5,
  };
}

/**
 * Extract Breakout analyzer parameters from config
 * Falls back to defaults if config section is missing
 */
export function getBreakoutAnalyzerParams(config: unknown): BreakoutAnalyzerParams {
  const params = asAnalyzerConfigEnvelope(config).analyzerParameters?.breakout;
  return {
    minCandlesRequired: params?.minCandlesRequired ?? 30,
    resistanceLookback: params?.resistanceLookback ?? 20,
    volatilityThreshold: params?.volatilityThreshold ?? 1.5,
  };
}

/**
 * Extract Order Block analyzer parameters from config
 * Falls back to defaults if config section is missing
 */
export function getOrderBlockAnalyzerParams(config: unknown): OrderBlockAnalyzerParams {
  const params = asAnalyzerConfigEnvelope(config).analyzerParameters?.orderBlock;
  return {
    maxDistanceThreshold: params?.maxDistanceThreshold ?? 0.05,
    maxRejectionCount: params?.maxRejectionCount ?? 5,
  };
}

/**
 * Extract Wick analyzer parameters from config
 * Falls back to defaults if config section is missing
 */
export function getWickAnalyzerParams(config: unknown): WickAnalyzerParams {
  const params = asAnalyzerConfigEnvelope(config).analyzerParameters?.wick;
  return {
    minBodyToWickRatio: params?.minBodyToWickRatio ?? 0.3,
  };
}

