/**
 * ITradingBotServices
 *
 * Narrow interface for TradingBot dependencies.
 */

import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IExecutionServices } from './IExecutionServices';
import type { ICoreServices } from './ICoreServices';

export type ITradingBotExecutionServices = Pick<
  IExecutionServices,
  'positionManager' | 'positionMonitor' | 'tradingOrchestrator'
>;

export interface ITradingBotServices {
  coreServices: ICoreServices;
  monitoringServices: IMonitoringReadServices;
  executionServices: ITradingBotExecutionServices;
}
