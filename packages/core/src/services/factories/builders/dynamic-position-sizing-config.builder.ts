import type { Config } from '../../../types/legacy';
import type { DynamicPositionSizingConfig } from './bot-services.types';

export const createDynamicPositionSizingConfig = (
  config: Config,
): DynamicPositionSizingConfig | undefined =>
  (config as Partial<{ dynamicPositionSizing: DynamicPositionSizingConfig }>).dynamicPositionSizing;
