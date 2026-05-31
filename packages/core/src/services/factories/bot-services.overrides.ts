/**
 * Bot services override helpers.
 *
 * Keeps DI overrides modular so the BotFactory stays thin.
 */

import type { BotServiceState } from '../bot-services.builder';
import {
  partitionBotFactoryOptions,
  type BotFactoryCoreOverrides,
  type BotFactoryOptions,
} from './bot-factory-options';
import { createCoreServices } from '../containers/core-services';
import { createMarketDataServices } from '../containers/market-data-services';
import { createWebApiServices } from '../containers/web-api-services';

const rebuildCoreServices = (
  services: BotServiceState,
  overrides: BotFactoryCoreOverrides,
): void => {
  if (!services.coreServices) {
    return;
  }
  services.coreServices = createCoreServices({
    logger: (overrides.logger as BotServiceState['logger'] | undefined) ?? services.coreServices.logger,
    eventBus: services.coreServices.eventBus,
    telegram: overrides.telegram ?? services.coreServices.telegram,
    timeService: services.coreServices.timeService,
  });
};

export const applyBotServiceOverrides = (
  services: BotServiceState,
  options: BotFactoryOptions,
): void => {
  const { core, runtime } = partitionBotFactoryOptions(options);

  if (runtime.bybitService) {
    services.bybitService = runtime.bybitService;

    if (services.marketDataServices) {
      const current = services.marketDataServices;
      services.marketDataServices = createMarketDataServices({
        bybitService: runtime.bybitService,
        timeframeProvider: current.timeframeProvider,
        candleProvider: current.candleProvider,
        orderbookManager: current.orderbookManager,
        publicWebSocket: current.publicWebSocket,
        webSocketManager: current.webSocketManager,
        indicatorCache: current.indicatorCache,
        indicatorPreCalc: current.indicatorPreCalc,
      });
    }

    if (services.webApiServices) {
      const current = services.webApiServices;
      services.webApiServices = createWebApiServices({
        marketDataServices: current.marketDataServices,
        journal: current.journal,
        bybitService: runtime.bybitService,
        indicatorPreferences: current.indicatorPreferences,
      });
    }

    if (services.coreServices?.timeService?.setBybitService) {
      services.coreServices.timeService.setBybitService(runtime.bybitService);
    }
  }

  if (core.telegram) {
    services.telegram = core.telegram as BotServiceState['telegram'];
  }

  if (core.logger) {
    services.logger = core.logger as BotServiceState['logger'];
  }

  if (runtime.errorHandler) {
    services.errorHandler = runtime.errorHandler;
  }

  if (core.logger || core.telegram) {
    rebuildCoreServices(services, {
      logger: core.logger,
      telegram: core.telegram,
    });
  }
};
