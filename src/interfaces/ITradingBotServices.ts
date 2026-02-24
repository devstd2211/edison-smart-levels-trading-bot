/**
 * ITradingBotServices
 *
 * Narrow interface for TradingBot dependencies.
 */

import type { Position } from '../types';
import type { IWebApiServices } from './IWebApiServices';
import type { IMonitoringServices } from './IMonitoringServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IRiskServices } from './IRiskServices';
import type { ICoreServices } from './ICoreServices';

export interface ITradingBotServices extends IWebApiServices {
  coreServices: ICoreServices;
  tradingOrchestrator: {
    enableTestMode(): void;
    disableTestMode(): void;
  };
  positionManager: {
    getCurrentPosition(): Position | null;
  };
  positionMonitor: {
    on(event: string, listener: (...args: any[]) => void): void;
  };
  dashboard?: {
    recordEvent(type: string, message: string): void;
  };
  monitoringServices: IMonitoringServices;
  executionServices: Pick<IExecutionServices, 'positionManager' | 'positionExitingService' | 'tradingOrchestrator' | 'realTimeRiskMonitor'>;
  riskServices: IRiskServices;
}
