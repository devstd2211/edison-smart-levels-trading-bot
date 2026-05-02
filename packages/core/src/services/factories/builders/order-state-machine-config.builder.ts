import type { Config } from '../../../types/legacy';
import type { OrderStateMachineConfig } from './bot-services.types';

export const createOrderStateMachineConfig = (
  config: Config,
): OrderStateMachineConfig | undefined =>
  (config as Partial<{ orderStateMachine: OrderStateMachineConfig }>).orderStateMachine;
