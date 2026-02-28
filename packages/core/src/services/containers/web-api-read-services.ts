import type { IWebApiReadServices } from '../../interfaces/IWebApiServices';

export const createWebApiReadServices = (
  deps: IWebApiReadServices,
): IWebApiReadServices => ({
  logger: deps.logger,
  webApiServices: deps.webApiServices,
  wallTrackerService: deps.wallTrackerService,
});
