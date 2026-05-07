/**
 * CoreServices
 *
 * Grouped container for core dependencies.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { ICoreServices } from '../../interfaces/ICoreServices';

export class CoreServices implements ICoreServices {
  readonly logger: ICoreServices['logger'];
  readonly eventBus: ICoreServices['eventBus'];
  readonly telegram: ICoreServices['telegram'];
  readonly timeService: ICoreServices['timeService'];

  constructor(deps: ICoreServices) {
    this.logger = deps.logger;
    this.eventBus = deps.eventBus;
    this.telegram = deps.telegram;
    this.timeService = deps.timeService;
  }
}

export const createCoreServices = (
  deps: ICoreServices,
): ICoreServices => new CoreServices(deps);
