/**
 * ITradingBotServices
 *
 * Narrow interface for TradingBot dependencies.
 */

import type { Position } from '../types/position';
import type { IWebApiReadServices } from './IWebApiServices';
import type { IMonitoringReadServices } from './IMonitoringServices';
import type { IExecutionServices } from './IExecutionServices';
import type { IRiskServices } from './IRiskServices';
import type { ICoreServices } from './ICoreServices';

export interface ITradingBotServices extends IWebApiReadServices {
  coreServices: ICoreServices;
  tradingOrchestrator: {
    enableTestMode(): void;
    disableTestMode(): void;
  };
  positionManager: {
    getCurrentPosition(): Position | null;
  };
  positionMonitor: {
    on(event: string, listener: (...args: unknown[]) => void): void;
  };
  dashboard?: {
    recordEvent(type: string, message: string): void;
  };
  monitoringServices: IMonitoringReadServices;
  executionServices: Pick<IExecutionServices, 'positionManager' | 'positionExitingService' | 'tradingOrchestrator' | 'realTimeRiskMonitor'>;
  riskServices: IRiskServices;
}
