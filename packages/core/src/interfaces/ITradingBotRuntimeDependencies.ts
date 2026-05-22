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

export interface ITradingBotRuntimeDependencies {
  tradingBotServices: ITradingBotServices;
  balanceReader: Pick<IExchangeAccount, 'getBalance'>;
  initializerServices: IBotInitializerServices;
  eventHandlerServices: IWebSocketEventHandlerServices;
  webApiAdapter: IWebApiAdapter;
}
