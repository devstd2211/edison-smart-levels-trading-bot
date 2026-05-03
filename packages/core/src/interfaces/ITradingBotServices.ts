/**
 * ITradingBotServices
 *
 * Narrow interface for TradingBot dependencies.
 */

import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';
import type { IWebApiReadServices } from './IWebApiServices';

export interface ITradingBotServices {
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<IExecutionServices, 'positionManager' | 'positionMonitor' | 'tradingOrchestrator'>;
  bybitService: IWebApiReadServices['bybitService'];
}
