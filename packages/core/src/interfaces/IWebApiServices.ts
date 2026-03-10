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
  readonly webApiServices: IWebApiServicesContainer;
  readonly wallTrackerService?: IWebApiWallTracker;
}

export interface IWebApiServices extends IWebApiReadServices {}
