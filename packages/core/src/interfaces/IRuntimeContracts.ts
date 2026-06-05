import type { IWebApiAdapter } from '@edison/contracts/web-api';
import type { TradingBot } from '../bot';
import type { IBotFactoryRuntimeSource } from './IRuntimeSources';
import type { ITradingBotRuntimeDependencies } from './ITradingBotRuntimeDependencies';

export interface IBotRuntimeBundle {
  runtimeDependencies: ITradingBotRuntimeDependencies;
  webApiAdapter: IWebApiAdapter;
}

export interface ITradingBotFactoryRuntime {
  runtimeSource: IBotFactoryRuntimeSource;
  runtimeBundle: IBotRuntimeBundle;
}

export interface ITradingBotRuntime {
  bot: TradingBot;
  runtimeSource: IBotFactoryRuntimeSource;
  runtimeBundle: IBotRuntimeBundle;
  webApiAdapter: IWebApiAdapter;
}
