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

export function createMockStrategyOrchestrators(count: number) {
  return Array.from({ length: count }, (_, index) =>
    createMockStrategyOrchestrator(`strategy-${index + 1}`),
  );
}

export function seedStrategyCache(
  cache: StrategyOrchestratorCacheService,
  strategyIds: string[],
) {
  const seeded = strategyIds.map((strategyId) => {
    const orchestrator = createMockStrategyOrchestrator(strategyId);
    cache.cacheOrchestrator(strategyId, orchestrator);
    return { strategyId, orchestrator };
  });

  return seeded;
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

export interface ManagedStrategyCacheContext {
  cache: StrategyOrchestratorCacheService;
  logger: LoggerService;
  createCache: (logger?: LoggerService) => StrategyOrchestratorCacheService;
  cleanup: () => void;
}

export type StrategyCacheRuntime = Pick<
  ManagedStrategyCacheContext,
  'cache' | 'logger'
>;

export type StrategyCacheState = StrategyCacheRuntime &
  Pick<ManagedStrategyCacheContext, 'cleanup'>;

export function createManagedStrategyCacheContext(): ManagedStrategyCacheContext {
  const harness = createStrategyCacheHarness();

  return {
    ...harness,
    cleanup() {
      jest.restoreAllMocks();
    },
  };
}
