import type { IWebApiAdapter } from '@edison/contracts';

import type { BotRuntimeEventBusLike } from './bot-events';
import type { Position } from './position';

export interface TradingBotStatus {
  isRunning: boolean;
  hasPosition: boolean;
  position: Position | null;
}

export interface TradingBotRuntimeControls {
  readonly isRunning: boolean;
  readonly eventBus: BotRuntimeEventBusLike;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface TradingBotTestControls {
  enableTestMode(): void;
  disableTestMode(): void;
}

export interface TradingBotReadApi {
  getCurrentPosition(): Position | null;
  getBalance(): Promise<number>;
  getStatus(): TradingBotStatus;
}

export interface TradingBotWebApiAccess {
  getWebApiAdapter(): IWebApiAdapter;
}

export type TradingBotCoreApi =
  & TradingBotRuntimeControls
  & TradingBotReadApi
  & TradingBotTestControls;

export type TradingBotWebApi =
  & TradingBotRuntimeControls
  & TradingBotReadApi
  & TradingBotWebApiAccess;

export type TradingBotAppApi = TradingBotCoreApi & TradingBotWebApiAccess;
