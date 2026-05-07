import type { Config } from '../../types/legacy';
import { BotFactory } from '../../services/bot-factory.service';
import { createMinimalLifecycleConfig } from './service-lifecycle-test.utils';
import type { TrackedServiceState } from './service-lifecycle-test.utils';
import { trackCreatedServices } from './service-lifecycle-test.utils';

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
  const config = createMinimalLifecycleConfig();
  config.dataSubscriptions = { candles: { enabled: true } } as Config['dataSubscriptions'];
  return config;
}

export function createTrackedBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  return trackCreatedServices(trackedServices, config, BotFactory.createTestRuntimeSource(config));
}

export function createTrackedSafeBotFactoryRuntimeSource(
  trackedServices: TrackedServiceState[],
  config: Config,
) {
  const result = BotFactory.createSafe(config);
  if (!result.success) {
    throw result.error;
  }

  return trackCreatedServices(trackedServices, config, result.services);
}

export const createTrackedBotFactoryRuntimeServices = createTrackedBotFactoryRuntimeSource;
export const createTrackedSafeBotFactoryRuntimeServices = createTrackedSafeBotFactoryRuntimeSource;

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
