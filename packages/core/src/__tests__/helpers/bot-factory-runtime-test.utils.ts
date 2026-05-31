import type { Config } from '../../types/legacy';
import { ContextFilteringMode } from '../../types/legacy';
import {
  createSafeBotFactoryRuntimeSource,
  createValidatedBotFactoryRuntimeSource,
} from '../../services/bot-factory.service';
import type { TrackedServiceState } from './service-lifecycle-test.utils';
import { createAdvancedOrderFlowConfig } from './advanced-order-flow-test.utils';
import { createCompoundInterestConfig } from './compound-interest-calculator-test.utils';
import { createDeltaAnalyzerConfig } from './delta-analyzer-test.utils';
import { createOrderbookImbalanceConfig } from './orderbook-imbalance-test.utils';
import { createRetestEntryConfig } from './retest-entry-test.utils';
import {
  createCandleEnabledLifecycleConfig,
  createLegacyEntrypointCandleRuntimeConfig,
  createRuntimeDefaultLifecycleConfig,
  normalizeTrackedLifecycleConfig,
  trackCreatedServices,
} from './service-lifecycle-test.utils';
import { createWallTrackerConfig } from './wall-tracker-test.utils';

type UnknownRecord = Record<string, unknown>;
export type BotFactoryConfigRecord = UnknownRecord;

const getNestedRecord = (root: BotFactoryConfigRecord, path: string[]): BotFactoryConfigRecord | null => {
  let current: BotFactoryConfigRecord = root;
  for (const key of path) {
    const next = current[key];
    if (typeof next !== 'object' || next === null) {
      return null;
    }
    current = next as BotFactoryConfigRecord;
  }
  return current;
};

export function createMonitoringResilienceBuilderRuntimeDefaultConfig(): Config {
  return {
    ...createRuntimeDefaultLifecycleConfig(),
    monitoring: {
      metricsEnabled: true,
      healthCheckEnabled: true,
      serverEnabled: true,
      port: 9191,
      metricsPath: '/m',
      healthPath: '/h',
      cors: false,
      thresholds: {
        memoryUsagePercent: 85,
        cpuUsagePercent: 70,
        diskUsagePercent: 88,
      },
    },
    resilience: {
      enabled: true,
      circuitBreaker: {
        failureThreshold: 7,
        timeout: 120000,
      },
      rateLimiter: {
        bybit: {
          maxRequests: 12,
          queueSize: 40,
        },
      },
      retry: {
        maxAttempts: 4,
        retryBudgetPercent: 0.25,
      },
      bulkhead: {
        trading: {
          maxConcurrent: 3,
          timeoutMs: 1500,
        },
      },
    },
  } as unknown as Config;
}

export function createWebSocketMonitoringBuilderCandleEnabledConfig(): Config {
  return {
    ...createCandleEnabledLifecycleConfig(),
    monitoring: {
      metricsEnabled: true,
      collectInterval: 5000,
    },
  } as unknown as Config;
}

export function createRiskManagerBuilderRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createGroupedServicesBuilderRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createPositionManagementBuilderRiskMonitoringEnabledConfig(): Config {
  return {
    ...createRuntimeDefaultLifecycleConfig(),
    liveTrading: {
      enabled: true,
      riskMonitoring: {
        enabled: true,
        checkIntervalCandles: 7,
        healthScoreThreshold: 55,
        emergencyCloseOnCritical: false,
      },
    },
  } as unknown as Config;
}

export function createPositionManagementBuilderRiskMonitoringDisabledConfig(): Config {
  return {
    ...createRuntimeDefaultLifecycleConfig(),
    liveTrading: {
      enabled: true,
      riskMonitoring: {
        enabled: false,
        checkIntervalCandles: 3,
        healthScoreThreshold: 45,
        emergencyCloseOnCritical: false,
      },
    },
  } as unknown as Config;
}

export function createOrchestratorHandlersBuilderCandleEnabledConfig(): Config {
  const config = createCandleEnabledLifecycleConfig();

  return {
    ...config,
    btcConfirmation: {
      enabled: true,
      symbol: 'BTCUSDT',
      timeframe: '1',
      lookbackCandles: 25,
    },
    strategy: {
      ...config.strategy,
      contextFilteringMode: ContextFilteringMode.WEIGHT_BASED,
      emaDistanceThreshold: 0.25,
      priceAction: {
        enabled: true,
      },
    },
    atrFilter: {
      enabled: true,
      minimumATR: 0.2,
      maximumATR: 2.5,
    },
    indicators: {
      ...config.indicators,
      fastEmaPeriod: 9,
      zigzagDepth: 12,
      rsiOversold: 25,
      rsiOverbought: 75,
    },
  } as unknown as Config;
}

export function createOptionalServicesBuilderRuntimeDefaultConfig(): Config {
  return {
    ...createRuntimeDefaultLifecycleConfig(),
    compoundInterest: createCompoundInterestConfig(),
    retestEntry: createRetestEntryConfig(),
    delta: createDeltaAnalyzerConfig(),
    orderbookImbalance: createOrderbookImbalanceConfig(),
    wallTracking: createWallTrackerConfig(),
    advancedOrderFlow: {
      ...createAdvancedOrderFlowConfig(),
      enabled: true,
    },
    dynamicPositionSizing: {
      enabled: true,
      baseRiskPercent: 1,
      maxRiskPercent: 2,
      minPositionSize: 25,
      maxPositionSize: 250,
      volatilityMultiplier: 1.4,
      confidenceThreshold: 0.55,
    },
    positionScaling: {
      enabled: true,
      scaleInThreshold: 0.6,
      maxScales: 3,
      scaleReduction: 0.5,
      breakevenThreshold: 0.4,
    },
    smartOrderExecution: {
      enabled: true,
      maxSlippagePercent: 0.25,
      maxOrderSplits: 4,
      minFillProbability: 0.7,
      adaptiveExecution: true,
      executionStrategy: 'adaptive',
      twapInterval: 5000,
      vwapLookback: 20,
      executionTimeout: 30000,
    },
    orderStateMachine: {
      enabled: true,
    },
    monitoring: {
      metricsEnabled: true,
      metricsPrefix: 'edison_',
      collectInterval: 2500,
      defaultLabels: { env: 'test' },
    },
  } as unknown as Config;
}

export function createBotServiceStateBoundaryRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createBotFactoryServiceBoundaryRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createCliBoundaryRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createRootBotFactoryBoundaryRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createBotFactoryErrorHandlingBoundaryRuntimeDefaultConfig(): Config {
  return createRuntimeDefaultLifecycleConfig();
}

export function createCoreEntrypointBoundaryLegacyCandleRuntimeConfig(): Config {
  return createLegacyEntrypointCandleRuntimeConfig();
}

export function createTrackedBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  const trackedConfig = normalizeTrackedLifecycleConfig(config);
  return trackCreatedServices(
    trackedServices,
    trackedConfig,
    createValidatedBotFactoryRuntimeSource(trackedConfig),
  );
}

export function createTrackedSafeBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  const trackedConfig = normalizeTrackedLifecycleConfig(config);
  const result = createSafeBotFactoryRuntimeSource(trackedConfig);
  if (!result.success) {
    throw result.error;
  }

  return trackCreatedServices(trackedServices, trackedConfig, result.services);
}

export function deleteBotFactoryConfigPath(config: Config, dottedPath: string): void {
  const segments = dottedPath.split('.');
  const parentSegments = segments.slice(0, -1);
  const key = segments[segments.length - 1];
  const root = config as unknown as BotFactoryConfigRecord;
  const parent = parentSegments.length > 0 ? getNestedRecord(root, parentSegments) : root;
  if (!parent) {
    return;
  }

  delete parent[key];
}

export function setBotFactoryConfigPath(
  config: Config,
  dottedPath: string,
  value: unknown,
): void {
  const segments = dottedPath.split('.');
  const key = segments[segments.length - 1];
  const root = config as unknown as BotFactoryConfigRecord;
  const parent = segments.length > 1 ? getNestedRecord(root, segments.slice(0, -1)) : root;
  if (!parent) {
    return;
  }

  parent[key] = value;
}
