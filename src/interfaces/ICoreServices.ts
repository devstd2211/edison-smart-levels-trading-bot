/**
 * ICoreServices
 *
 * Grouped core services (logging, events, notifications, time).
 */

import type { LoggerService } from '../types';
import type { BotEventBus } from '../services/event-bus';
import type { IExchange } from './IExchange';

export interface ICoreServices {
  logger: LoggerService;
  eventBus: BotEventBus;
  telegram: {
    notifyBotStarted(symbol: string, enabledTimeframes: string[]): Promise<void>;
    notifyBotStopped(): Promise<void>;
  };
  timeService: {
    syncWithExchange(): Promise<void>;
    getSyncInfo(): { offset: number; lastSync: Date; isRecent: boolean; nextSyncIn: number };
    setBybitService(exchange: IExchange): void;
  };
}
