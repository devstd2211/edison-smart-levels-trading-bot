import type { StrategyConfigEntryPayload } from '@edison/contracts/runtime-api';

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  config?: StrategyConfigEntryPayload;
}
