/**
 * Bot services override helpers.
 *
 * Keeps DI overrides modular so the BotFactory stays thin.
 */

import type { BotServiceState } from '../bot-services.builder';
import type { BotFactoryOptions } from './bot-factory-options';
import { createCoreServices } from '../containers/core-services';
import { createMarketDataServices } from '../containers/market-data-services';
import { createWebApiServices } from '../containers/web-api-services';

const rebuildCoreServices = (
  services: BotServiceState,
  overrides: { logger?: BotServiceState['logger']; telegram?: BotFactoryOptions['telegram'] },
): void => {
  if (!services.coreServices) {
    return;
  }
  services.coreServices = createCoreServices({
    logger: overrides.logger ?? services.coreServices.logger,
    eventBus: services.coreServices.eventBus,
    telegram: overrides.telegram ?? services.coreServices.telegram,
    timeService: services.coreServices.timeService,
  });
};

export const applyBotServiceOverrides = (
  services: BotServiceState,
  options: BotFactoryOptions,
): void => {
  if (options.bybitService) {
    services.bybitService = options.bybitService;

    if (services.marketDataServices) {
      const current = services.marketDataServices;
      services.marketDataServices = createMarketDataServices({
        bybitService: options.bybitService,
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
        bybitService: options.bybitService,
        indicatorPreferences: current.indicatorPreferences,
      });
    }

    if (services.coreServices?.timeService?.setBybitService) {
      services.coreServices.timeService.setBybitService(options.bybitService);
    }
  }

  if (options.telegram) {
    services.telegram = options.telegram as BotServiceState['telegram'];
  }

  if (options.logger) {
    services.logger = options.logger;
  }

  if (options.errorHandler) {
    services.errorHandler = options.errorHandler;
  }

  if (options.logger || options.telegram) {
    rebuildCoreServices(services, {
      logger: options.logger,
      telegram: options.telegram,
    });
  }
};
