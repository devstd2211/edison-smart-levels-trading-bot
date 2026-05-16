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
import type { IWebApiAdapter } from '@edison/contracts/web-api';

export interface ITradingBotRuntimeDependencies {
  tradingBotServices: ITradingBotServices;
  webApiServices: IBotWebApiRuntimeServices;
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
  webApiAdapter?: IWebApiAdapter;
}
