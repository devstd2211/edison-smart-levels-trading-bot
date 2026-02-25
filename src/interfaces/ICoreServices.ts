/**
 * ICoreServices
 *
 * Grouped core services (logging, events, notifications, time).
 */

import type { LoggerService } from '../services/logger.service';
import type { BotEventBus } from '../services/event-bus';
import type { IExchange } from './IExchange';

export interface ICoreServices {
  readonly logger: LoggerService;
  readonly eventBus: BotEventBus;
  readonly telegram: {
    notifyBotStarted(symbol: string, enabledTimeframes: string[]): Promise<void>;
    notifyBotStopped(): Promise<void>;
  };
  readonly timeService: {
    syncWithExchange(): Promise<void>;
    getSyncInfo(): { offset: number; lastSync: Date; isRecent: boolean; nextSyncIn: number };
    setBybitService(exchange: IExchange): void;
  };
}
