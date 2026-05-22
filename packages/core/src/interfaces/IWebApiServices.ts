/**
 * Web API runtime contracts.
 *
 * Keeps BotWebAPI and the web adapter decoupled from the broader services state
 * while still allowing the factory layer to materialize a stable read-only view.
 */

import type { WebApiWallView } from '@edison/contracts/web-api';
import type { IWebApiServicesContainer } from './IWebApiServicesContainer';

export interface IWebApiLogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface IWebApiWallTracker {
  getActiveWalls(): ReadonlyArray<{
    side: WebApiWallView['side'];
    price: number;
    currentSize: number;
  }>;
  getWallStrength(price: number, side: WebApiWallView['side']): number;
}

export interface IWebApiReadServices {
  readonly logger: IWebApiLogger;
  readonly candleProvider: IWebApiServicesContainer['marketDataServices']['candleProvider'];
  readonly orderbookManager: IWebApiServicesContainer['marketDataServices']['orderbookManager'];
  readonly indicatorCache: IWebApiServicesContainer['marketDataServices']['indicatorCache'];
  readonly journal: IWebApiServicesContainer['journal'];
  readonly bybitService: IWebApiServicesContainer['bybitService'];
  readonly indicatorPreferences: IWebApiServicesContainer['indicatorPreferences'];
  readonly wallTrackerService?: IWebApiWallTracker;
}

export interface IBotWebApiRuntimeServices extends IWebApiReadServices {}
