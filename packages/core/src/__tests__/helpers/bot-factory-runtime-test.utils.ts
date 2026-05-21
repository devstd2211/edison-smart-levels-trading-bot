import type { Config } from '../../types/legacy';
import { BotFactory } from '../../services/bot-factory.service';
import { ContextFilteringMode } from '../../types/legacy';
import type { TrackedServiceState } from './service-lifecycle-test.utils';
import { createAdvancedOrderFlowConfig } from './advanced-order-flow-test.utils';
import { createCompoundInterestConfig } from './compound-interest-calculator-test.utils';
import { createDeltaAnalyzerConfig } from './delta-analyzer-test.utils';
import { createOrderbookImbalanceConfig } from './orderbook-imbalance-test.utils';
import { createRetestEntryConfig } from './retest-entry-test.utils';
import {
  createCandleEnabledLifecycleConfig,
  createRuntimeLifecycleConfig,
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

export function createBotFactoryRuntimeTestConfig(): Config {
  return createCandleEnabledLifecycleConfig();
}

export function createWebSocketMonitoringBuilderConfig(): Config {
  return {
    ...createCandleEnabledLifecycleConfig(),
    monitoring: {
      metricsEnabled: true,
      collectInterval: 5000,
    },
  } as unknown as Config;
}

export function createRiskManagerBuilderConfig(): Config {
  return createRuntimeLifecycleConfig();
}

export function createPositionManagementRiskMonitoringConfig(): Config {
  return {
    ...createRuntimeLifecycleConfig(),
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

export function createPositionManagementDisabledRiskMonitoringConfig(): Config {
  return {
    ...createRuntimeLifecycleConfig(),
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

export function createOrchestratorHandlersBuilderConfig(): Config {
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

export function createOptionalServicesBuilderConfig(): Config {
  return {
    ...createRuntimeLifecycleConfig(),
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

export function createTrackedBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  const trackedConfig = normalizeTrackedLifecycleConfig(config);
  return trackCreatedServices(trackedServices, trackedConfig, BotFactory.createTestRuntimeSource(trackedConfig));
}

export function createTrackedSafeBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  const trackedConfig = normalizeTrackedLifecycleConfig(config);
  const result = BotFactory.createSafe(trackedConfig);
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
