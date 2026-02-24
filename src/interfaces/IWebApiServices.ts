/**
 * IWebApiServices
 *
 * Narrow interface for BotWebAPI dependencies.
 * Keeps web adapter decoupled from the full BotServices container.
 */

import type { IWebApiServicesContainer } from './IWebApiServicesContainer';
import type { LoggerService } from '../types';

export interface IWebApiServices {
  logger: LoggerService;
  webApiServices: IWebApiServicesContainer;
  wallTrackerService?: {
    getActiveWalls(): Array<{ side: string; price: number; currentSize: number }>;
    getWallStrength(price: number, side: string): number;
  };
}
