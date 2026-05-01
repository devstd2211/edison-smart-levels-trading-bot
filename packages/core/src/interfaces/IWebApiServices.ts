/**
 * IWebApiServices
 *
 * Narrow interface for BotWebAPI dependencies.
 * Keeps web adapter decoupled from the full services state.
 */

import type { IWebApiServicesContainer } from './IWebApiServicesContainer';

export interface IWebApiLogger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export interface IWebApiWallTracker {
  getActiveWalls(): ReadonlyArray<{ side: string; price: number; currentSize: number }>;
  getWallStrength(price: number, side: string): number;
}

export interface IWebApiReadServices {
  readonly logger: IWebApiLogger;
  readonly candleProvider: IWebApiServicesContainer['marketDataServices']['candleProvider'];
  readonly orderbookManager: IWebApiServicesContainer['marketDataServices']['orderbookManager'];
  readonly indicatorCache: IWebApiServicesContainer['marketDataServices']['indicatorCache'];
  readonly journal: IWebApiServicesContainer['journal'];
  readonly bybitService: IWebApiServicesContainer['bybitService'];
  readonly indicatorPreferences?: IWebApiServicesContainer['indicatorPreferences'];
  readonly wallTrackerService?: IWebApiWallTracker;
}

export interface IWebApiServices extends IWebApiReadServices {}
