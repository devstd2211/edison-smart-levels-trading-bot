import { StrategyOrchestratorCacheService } from '../../services/multi-strategy/strategy-orchestrator-cache.service';
import type { LoggerService } from '../../types/legacy';

export function createStrategyCacheLogger(): LoggerService {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as LoggerService;
}

export function createMockStrategyOrchestrator(strategyId: string) {
  return {
    strategyId,
    process: jest.fn(),
    cleanup: jest.fn(),
  };
}

export function createStrategyCacheHarness(): {
  cache: StrategyOrchestratorCacheService;
  logger: LoggerService;
  createCache: (logger?: LoggerService) => StrategyOrchestratorCacheService;
} {
  const logger = createStrategyCacheLogger();
  const createCache = (cacheLogger: LoggerService = logger): StrategyOrchestratorCacheService =>
    new StrategyOrchestratorCacheService(cacheLogger);

  return {
    cache: createCache(),
    logger,
    createCache,
  };
}
