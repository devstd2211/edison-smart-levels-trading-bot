import type { Config } from '../../../types/legacy';
import type { SmartOrderExecutionConfig } from './bot-services.types';

export const createSmartOrderExecutionConfig = (
  config: Config,
): SmartOrderExecutionConfig | undefined =>
  (config as Partial<{ smartOrderExecution: SmartOrderExecutionConfig }>).smartOrderExecution;
