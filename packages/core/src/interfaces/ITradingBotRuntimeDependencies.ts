/**
 * ITradingBotRuntimeDependencies
 *
 * Separates TradingBot runtime wiring from the narrower service contracts
 * consumed by TradingBot, BotInitializer, and WebSocketEventHandlerManager.
 */

import type { IBotInitializerServices } from './IBotInitializerServices';
import type { IExchangeAccount } from './IExchange';
import type { ITradingBotServices } from './ITradingBotServices';
import type { IWebSocketEventHandlerServices } from './IWebSocketEventHandlerServices';
import type { IWebApiAdapter } from '@edison/contracts/web-api';

export interface ITradingBotLifecycleDependencies {
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
}

export interface ITradingBotReadAdapters {
  balanceReader: Pick<IExchangeAccount, 'getBalance'>;
  webApiAdapter: IWebApiAdapter;
}

export interface ITradingBotRuntimeDependencies {
  tradingBotServices: ITradingBotServices;
  lifecycleDependencies: ITradingBotLifecycleDependencies;
  readAdapters: ITradingBotReadAdapters;
}
