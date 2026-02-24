/**
 * WebApiServices
 *
 * Grouped container for web API dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { IWebApiServicesContainer } from '../../interfaces/IWebApiServicesContainer';

export class WebApiServices implements IWebApiServicesContainer {
  readonly marketDataServices: IWebApiServicesContainer['marketDataServices'];
  readonly journal: IWebApiServicesContainer['journal'];
  readonly bybitService: IWebApiServicesContainer['bybitService'];

  constructor(deps: IWebApiServicesContainer) {
    this.marketDataServices = deps.marketDataServices;
    this.journal = deps.journal;
    this.bybitService = deps.bybitService;
  }
}
