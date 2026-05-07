/**
 * ITradingBotRuntimeDependencies
 *
 * Separates TradingBot runtime wiring from the narrower service contracts
 * consumed by TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { IBotInitializerServices } from './IBotInitializerServices';
import type { IBotWebApiRuntimeServices } from './IWebApiServices';
import type { ITradingBotServices } from './ITradingBotServices';
import type { IWebSocketEventHandlerServices } from './IWebSocketEventHandlerServices';

export interface ITradingBotRuntimeDependencies {
  tradingBotServices: ITradingBotServices;
  webApiServices: IBotWebApiRuntimeServices;
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
}
