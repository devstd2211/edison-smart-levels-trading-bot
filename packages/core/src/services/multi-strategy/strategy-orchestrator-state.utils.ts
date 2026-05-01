import type {
  IsolatedStrategyContext,
  MultiStrategyStats,
  MultiStrategySystemStats,
  StrategyMetadata,
} from '../../types/legacy';

export function buildStrategyMetadata(
  context: IsolatedStrategyContext,
  isActive: boolean,
): StrategyMetadata {
  return {
    id: context.strategyId,
    name: context.strategyName,
    version: context.strategy.metadata.version,
    symbol: context.symbol,
    isActive,
    loadedAt: new Date(),
  };
}

export function buildStrategyStats(
  strategyId: string,
  context: IsolatedStrategyContext,
  metadata: StrategyMetadata,
): MultiStrategyStats {
  return {
    strategyId,
    strategyName: context.strategyName,
    symbol: context.symbol,
    isActive: context.isActive,
    loadedAt: metadata.loadedAt,
    openPositions: 0,
    closedPositions: 0,
    totalTrades: 0,
    totalPnL: 0,
    winRate: 0,
    profitFactor: 1,
    maxDrawdown: 0,
    sharpeRatio: 0,
    avgHoldTime: 0,
    uptime: Date.now() - context.createdAt.getTime(),
  };
}

export function buildSystemStatsBase(
  strategies: IsolatedStrategyContext[],
  activeContext: IsolatedStrategyContext | null,
): MultiStrategySystemStats {
  return {
    totalStrategies: strategies.length,
    activeStrategies: strategies.filter((strategy) => strategy.isActive).length,
    inactiveStrategies: strategies.filter((strategy) => !strategy.isActive).length,
    totalOpenPositions: 0,
    totalClosedPositions: 0,
    totalTrades: 0,
    combinedPnL: 0,
    overallWinRate: 0,
    overallMaxDrawdown: 0,
    strategiesByPnL: [],
    memoryUsage: process.memoryUsage().heapUsed,
    uptime: activeContext ? Date.now() - activeContext.createdAt.getTime() : 0,
    lastUpdated: new Date(),
  };
}

export function getConfigVersion(
  config: IsolatedStrategyContext['config'],
): string {
  const version = (config as unknown as Record<string, unknown>).version;
  return typeof version === 'string' ? version : 'unknown';
}
