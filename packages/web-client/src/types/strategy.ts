import type { StrategyConfigEntryPayload } from '@edison/contracts';

export interface Strategy {
  id: string;
  name: string;
  enabled: boolean;
  config?: StrategyConfigEntryPayload;
}
