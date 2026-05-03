import type { Config } from '../../../types/legacy';
import type { MonitoringConfig } from './bot-services.types';

export const resolveMonitoringConfig = (
  config: Config,
): MonitoringConfig | undefined =>
  (config as Partial<{ monitoring: MonitoringConfig }>).monitoring;
