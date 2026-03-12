import { BotInitializer } from '../../services/bot-initializer';
import { createServices, type BotFactoryOptions } from '../../services/bot-factory.service';
import type { IBotInitializerServices, IBotServicesAdapterSource } from '../../interfaces';
import type { Config } from '../../types/legacy';

export interface TrackedServiceState {
  config: Config;
  services: IBotServicesAdapterSource;
}

export function trackCreatedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  services: IBotServicesAdapterSource,
): IBotServicesAdapterSource {
  trackedServices.push({ config, services });
  return services;
}

export function createTrackedServices(
  trackedServices: TrackedServiceState[],
  config: Config,
  options: BotFactoryOptions = {},
): IBotServicesAdapterSource {
  return trackCreatedServices(trackedServices, config, createServices(config, options));
}

export async function shutdownTrackedServices(
  trackedServices: TrackedServiceState[],
): Promise<void> {
  while (trackedServices.length > 0) {
    const tracked = trackedServices.pop();
    if (!tracked) {
      continue;
    }

    const initializer = new BotInitializer(
      tracked.services as unknown as IBotInitializerServices,
      tracked.config,
    );
    await initializer.shutdown().catch(() => undefined);
  }
}
