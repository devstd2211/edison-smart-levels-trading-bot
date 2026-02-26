/**
 * Walk-Forward Analysis Types
 */

export interface ParameterOptimizer {
  optimize<TGrid = unknown, TConfig = unknown, TOpts = unknown, TResult = unknown>(
    grid: TGrid,
    config: TConfig,
    opts: TOpts
  ): Promise<TResult>;
}

export interface WindowAnalysisResult {
  windowId: number;
  inSamplePerformance: number;
  outOfSamplePerformance: number;
  drawdown: number;
}
