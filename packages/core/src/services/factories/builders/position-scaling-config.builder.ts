import type { Config } from '../../../types/legacy';
import type { PositionScalingConfig } from './bot-services.types';

export const createPositionScalingConfig = (
  config: Config,
): PositionScalingConfig | undefined =>
  (config as Partial<{ positionScaling: PositionScalingConfig }>).positionScaling;
