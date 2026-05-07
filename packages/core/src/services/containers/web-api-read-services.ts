import type { ICoreServices } from '../../interfaces/ICoreServices';
import type { IWebApiReadServices, IWebApiWallTracker } from '../../interfaces/IWebApiServices';
import type { IWebApiServicesContainer } from '../../interfaces/IWebApiServicesContainer';

export interface WebApiReadServiceSource {
  coreServices: Pick<ICoreServices, 'logger'>;
  webApiServices: IWebApiServicesContainer;
  wallTrackerService?: IWebApiWallTracker;
}

export const createWebApiReadServiceDeps = (
  source: WebApiReadServiceSource,
): IWebApiReadServices => ({
  logger: source.coreServices.logger,
  candleProvider: source.webApiServices.marketDataServices.candleProvider,
  orderbookManager: source.webApiServices.marketDataServices.orderbookManager,
  indicatorCache: source.webApiServices.marketDataServices.indicatorCache,
  journal: source.webApiServices.journal,
  bybitService: source.webApiServices.bybitService,
  indicatorPreferences: source.webApiServices.indicatorPreferences,
  wallTrackerService: source.wallTrackerService,
});

export const createWebApiReadServices = (
  deps: IWebApiReadServices,
): IWebApiReadServices => ({
  logger: deps.logger,
  candleProvider: deps.candleProvider,
  orderbookManager: deps.orderbookManager,
  indicatorCache: deps.indicatorCache,
  journal: deps.journal,
  bybitService: deps.bybitService,
  indicatorPreferences: deps.indicatorPreferences,
  wallTrackerService: deps.wallTrackerService,
});
