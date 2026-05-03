/**
 * ITradingBotRuntimeDependencies
 *
 * Separates TradingBot runtime wiring from the narrower service contracts
 * consumed by TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { IBotInitializerServices } from './IBotInitializerServices';
import type { ITradingBotServices } from './ITradingBotServices';
import type { IWebApiReadServices } from './IWebApiServices';
import type { IWebSocketEventHandlerServices } from './IWebSocketEventHandlerServices';

export interface ITradingBotRuntimeDependencies {
  tradingBotServices: ITradingBotServices;
  webApiServices: IWebApiReadServices;
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
}
