/**
 * EventHandlerServices
 *
 * Grouped container for event handlers.
 * This is a thin wrapper and does not own lifecycle.
 */

import type { IEventHandlerServices } from '../../interfaces/IEventHandlerServices';

export class EventHandlerServices implements IEventHandlerServices {
  readonly positionEventHandler: IEventHandlerServices['positionEventHandler'];
  readonly webSocketEventHandler: IEventHandlerServices['webSocketEventHandler'];

  constructor(deps: IEventHandlerServices) {
    this.positionEventHandler = deps.positionEventHandler;
    this.webSocketEventHandler = deps.webSocketEventHandler;
  }
}

export const createEventHandlerServices = (
  deps: IEventHandlerServices,
): IEventHandlerServices => new EventHandlerServices(deps);
