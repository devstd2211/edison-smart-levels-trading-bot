/**
 * ITradingBotServices
 *
 * Narrow interface for TradingBot dependencies.
 */

import type { IWebApiReadServices } from './IWebApiServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';

export interface ITradingBotServices extends IWebApiReadServices {
  coreServices: ICoreServices;
  positionMonitor: {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<IExecutionServices, 'positionManager' | 'tradingOrchestrator'>;
}
