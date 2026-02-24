/**
 * IEventHandlerServices
 *
 * Grouped event handler services.
 */

import type { PositionEventHandler, WebSocketEventHandler } from '../services/handlers';

export interface IEventHandlerServices {
  positionEventHandler: PositionEventHandler;
  webSocketEventHandler: WebSocketEventHandler;
}
