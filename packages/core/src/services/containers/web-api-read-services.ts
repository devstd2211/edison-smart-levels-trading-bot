import type { IWebApiReadServices } from '../../interfaces/IWebApiServices';

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
