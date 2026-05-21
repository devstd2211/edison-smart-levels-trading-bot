import type { IWebApiAdapter } from '@edison/contracts/web-api';

import type { BotRuntimeEventBusLike } from './bot-events';
import type { Config } from './legacy';
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

export interface TradingBotDashboardConfig {
  enabled?: boolean;
}

export interface TradingBotConfig {
  readonly exchange: Pick<Config['exchange'], 'symbol'>;
  readonly timeframes: Config['timeframes'];
  readonly trading: Pick<Config['trading'], 'forceOpenPosition'>;
  readonly riskManagement?: Pick<Config['riskManagement'], 'positionSizeUsdt'>;
  readonly dashboard?: TradingBotDashboardConfig;
  readonly strategicWeights?: Config['strategicWeights'];
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
